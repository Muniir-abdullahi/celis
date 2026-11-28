import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { randomBytes } from "node:crypto";

const testUrl = process.env.CELIS_TEST_DATABASE_URL;
if (!testUrl) throw new Error("Set CELIS_TEST_DATABASE_URL to the disposable localhost:55439 fixture.");
const target = new URL(testUrl);
if (target.hostname !== "127.0.0.1" || target.port !== "55439" || target.pathname !== "/postgres") throw new Error("Refusing a non-fixture database.");
Object.assign(process.env, { DATABASE_URL: testUrl, DATABASE_POOL_SIZE: "5", NODE_ENV: "test",
  SEND_SMS_HOOK_SECRET: randomBytes(32).toString("base64"), OTP_DELIVERY_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  WAHA_BASE_URL: "https://waha.example.test", WAHA_API_KEY: "test-only", WAHA_SESSION: "defualt" });
const sql = postgres(testUrl, { max: 2 });
const { db } = await import("../../app/db");
const { enqueueAuthMessage, processAuthMessage, drainAuthMessages } = await import("../../app/server/auth-message-deliveries.server");
const { encryptOtp, decryptOtp } = await import("../../app/lib/whatsapp-otp");
const payload = { user: { phone: "252610000000" }, sms: { otp: "123456" } };
const cipher = (id: string) => encryptOtp(payload, process.env.OTP_DELIVERY_ENCRYPTION_KEY!, id);
const expiry = () => new Date(Date.now() + 300_000);
const originalFetch = globalThis.fetch;

before(async () => {
  // Only this isolated fixture table is reset. Apply the shipped migration itself.
  await sql`DROP TABLE IF EXISTS auth_message_deliveries`;
  const migration = readFileSync("drizzle/0040_fine_ted_forrester.sql", "utf8");
  await sql.begin(async (tx) => { for (const statement of migration.split("--> statement-breakpoint").filter((part) => part.trim())) await tx.unsafe(statement); });
  await sql.unsafe("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='celis_otp_client') THEN CREATE ROLE celis_otp_client NOLOGIN; END IF; END $$");
  await sql`GRANT USAGE ON SCHEMA public TO celis_otp_client`;
  await sql`GRANT SELECT, INSERT ON auth_message_deliveries TO celis_otp_client`;
});
beforeEach(async () => { await sql`TRUNCATE auth_message_deliveries`; globalThis.fetch = originalFetch; });
after(async () => { globalThis.fetch = originalFetch; await sql.end(); await db.$client.end(); });

test("concurrent duplicate webhook IDs persist one encrypted record", async () => {
  await Promise.all(Array.from({ length: 10 }, () => enqueueAuthMessage("duplicate", cipher("duplicate"), expiry())));
  const rows = await sql`SELECT * FROM auth_message_deliveries`;
  assert.equal(rows.length, 1); assert.equal(rows[0].status, "queued");
  assert.equal(rows[0].payload.includes("123456"), false);
  assert.deepEqual(decryptOtp(rows[0].payload, process.env.OTP_DELIVERY_ENCRYPTION_KEY!, "duplicate"), payload);
});

test("concurrent workers claim once, scrub sent data and do not resend a replay", async () => {
  await enqueueAuthMessage("once", cipher("once"), expiry()); let sends = 0;
  globalThis.fetch = async () => { sends++; await new Promise((resolve) => setTimeout(resolve, 50)); return new Response("{}", { status: 200 }); };
  const results = await Promise.all(Array.from({ length: 5 }, () => processAuthMessage("once")));
  assert.equal(results.filter(Boolean).length, 1); assert.equal(sends, 1);
  const [row] = await sql`SELECT * FROM auth_message_deliveries WHERE id='once'`;
  assert.equal(row.status, "sent"); assert.equal(row.payload, null); assert.equal(row.attempts, 1);
  await enqueueAuthMessage("once", cipher("once"), expiry());
  assert.equal(await processAuthMessage("once"), false); assert.equal(sends, 1);
});

test("provider errors retry at most three times and scrub terminal payloads", async () => {
  await enqueueAuthMessage("failure", cipher("failure"), expiry()); let sends = 0;
  globalThis.fetch = async () => { sends++; return new Response("must-not-be-logged", { status: 401 }); };
  for (let i = 0; i < 3; i++) {
    assert.equal(await processAuthMessage("failure"), true);
    await sql`UPDATE auth_message_deliveries SET next_attempt_at=now()-interval '1 second' WHERE id='failure'`;
  }
  const [row] = await sql`SELECT * FROM auth_message_deliveries WHERE id='failure'`;
  assert.equal(row.status, "failed"); assert.equal(row.payload, null); assert.equal(row.attempts, 3);
  assert.equal(row.last_error, "provider_http_401"); assert.equal(await processAuthMessage("failure"), false); assert.equal(sends, 3);
});

test("expired jobs are never sent and housekeeping scrubs their payloads", async () => {
  await enqueueAuthMessage("expired", cipher("expired"), new Date(Date.now() - 1000)); let sends = 0;
  globalThis.fetch = async () => { sends++; return new Response("{}"); };
  assert.equal(await processAuthMessage("expired"), false);
  await drainAuthMessages();
  const [row] = await sql`SELECT * FROM auth_message_deliveries WHERE id='expired'`;
  assert.equal(sends, 0); assert.equal(row.status, "expired"); assert.equal(row.payload, null);
});

test("expired sending lease is recoverable after process interruption", async () => {
  await enqueueAuthMessage("crashed", cipher("crashed"), expiry());
  await sql`UPDATE auth_message_deliveries SET status='sending', attempts=1, lease_until=now()-interval '1 second' WHERE id='crashed'`;
  globalThis.fetch = async () => new Response("{}");
  assert.equal(await processAuthMessage("crashed"), true);
  const [row] = await sql`SELECT status,attempts,payload FROM auth_message_deliveries WHERE id='crashed'`;
  assert.equal(row.status, "sent"); assert.equal(row.attempts, 2); assert.equal(row.payload, null);
});

test("stale worker cannot overwrite a newer attempt's state", async () => {
  await enqueueAuthMessage("fenced", cipher("fenced"), expiry());
  globalThis.fetch = async () => {
    await sql`UPDATE auth_message_deliveries SET attempts=2, lease_until=now()+interval '45 seconds' WHERE id='fenced'`;
    return new Response("{}");
  };
  await processAuthMessage("fenced");
  const [row] = await sql`SELECT * FROM auth_message_deliveries WHERE id='fenced'`;
  assert.equal(row.status, "sending"); assert.equal(row.attempts, 2); assert.ok(row.payload);
});

test("RLS hides encrypted delivery records and prevents client insertion", async () => {
  await enqueueAuthMessage("private", cipher("private"), expiry());
  await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE celis_otp_client`;
    const rows = await tx`SELECT * FROM auth_message_deliveries`; assert.equal(rows.length, 0);
  });
  await assert.rejects(sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE celis_otp_client`;
    await tx`INSERT INTO auth_message_deliveries (id,expires_at) VALUES ('forged',now())`;
  }), /row-level security/);
});

test("drain is bounded and retention removes old terminal metadata", async () => {
  for (let i = 0; i < 4; i++) await enqueueAuthMessage(`batch-${i}`, cipher(`batch-${i}`), expiry());
  globalThis.fetch = async () => new Response("{}");
  assert.equal((await drainAuthMessages()).processed, 2);
  const [counts] = await sql`SELECT count(*) FILTER (WHERE status='sent')::int AS sent, count(*) FILTER (WHERE status='queued')::int AS queued FROM auth_message_deliveries`;
  assert.equal(counts.sent, 2); assert.equal(counts.queued, 2);
  await sql`UPDATE auth_message_deliveries SET updated_at=now()-interval '25 hours' WHERE status='sent'`;
  await drainAuthMessages();
  const [remaining] = await sql`SELECT count(*)::int AS total FROM auth_message_deliveries`; assert.equal(remaining.total, 2);
});
