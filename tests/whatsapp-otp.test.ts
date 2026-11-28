import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { authorizedDrain, deliveryConfig, encryptOtp, decryptOtp, sendOtp, smsHookHandler } from "../app/lib/whatsapp-otp";

const secret = `whsec_${randomBytes(32).toString("base64")}`;
const config = deliveryConfig({ SEND_SMS_HOOK_SECRET: `v1,${secret}`, OTP_DELIVERY_ENCRYPTION_KEY: "test-only-key-".repeat(4),
  WAHA_BASE_URL: "https://waha.example.test", WAHA_API_KEY: "private-test-key", WAHA_SESSION: "defualt" });
const payload = { user: { phone: "+252610000000" }, sms: { otp: "123456" } };
function signed(body: unknown = payload, timestamp = new Date(), id = "hook-1") {
  const raw = JSON.stringify(body);
  return new Request("https://celis.example.test/api/auth/send-sms", { method: "POST", body: raw, headers: {
    "webhook-id": id, "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": new Webhook(secret).sign(id, timestamp, raw),
  } });
}
function fixture() {
  const calls: string[] = []; const events: string[] = [];
  const deps = { config: () => config,
    enqueue: async (id: string, encrypted: string, expiresAt: Date) => {
      assert.deepEqual(decryptOtp(encrypted, config.encryptionKey, id), payload);
      assert.ok(expiresAt.getTime() > Date.now()); calls.push(`persist:${id}`);
    }, schedule: (id: string) => { calls.push(`schedule:${id}`); }, report: (event: string) => { events.push(event); } };
  return { deps, calls, events };
}
test("signed Supabase hook is durably queued before waking delivery and returns the hook contract", async () => {
  const { deps, calls } = fixture(); const result = await smsHookHandler(deps)(signed());
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), {});
  assert.deepEqual(calls, ["persist:hook-1", "schedule:hook-1"]);
});
test("unsigned and forged requests never enqueue or send", async () => {
  const { deps, calls } = fixture();
  const unsigned = new Request("https://example.test", { method: "POST", body: JSON.stringify(payload) });
  assert.equal((await smsHookHandler(deps)(unsigned)).status, 401);
  const forged = signed(); forged.headers.set("webhook-signature", "v1,aW52YWxpZA==");
  assert.equal((await smsHookHandler(deps)(forged)).status, 401); assert.deepEqual(calls, []);
});
test("body tampering invalidates a valid signature", async () => {
  const { deps, calls } = fixture(); const original = signed();
  const tampered = new Request(original.url, { method: "POST", headers: original.headers, body: JSON.stringify({ ...payload, sms: { otp: "654321" } }) });
  assert.equal((await smsHookHandler(deps)(tampered)).status, 401); assert.deepEqual(calls, []);
});
test("old and future signatures are rejected", async () => {
  const { deps, calls } = fixture();
  for (const seconds of [-600, 600]) assert.equal((await smsHookHandler(deps)(signed(payload, new Date(Date.now() + seconds * 1000)))).status, 401);
  assert.deepEqual(calls, []);
});
test("signed malformed payloads cannot enqueue arbitrary WhatsApp messages", async () => {
  const { deps, calls } = fixture();
  for (const body of [{ user: { phone: "252610000000@c.us" }, sms: { otp: "123456" } }, { ...payload, sms: { otp: "arbitrary text" } }, {}]) {
    assert.equal((await smsHookHandler(deps)(signed(body))).status, 400);
  }
  assert.deepEqual(calls, []);
});
test("oversized chunked bodies are rejected before queueing", async () => {
  const { deps, calls } = fixture();
  assert.equal((await smsHookHandler(deps)(signed({ extra: "a".repeat(65_537) }))).status, 413);
  assert.deepEqual(calls, []);
});
test("queue failures return a generic retryable error without reflecting private details", async () => {
  const { deps, calls, events } = fixture(); deps.enqueue = async () => { throw new Error("phone=private otp=private"); };
  const result = await smsHookHandler(deps)(signed());
  assert.equal(result.status, 503); assert.deepEqual(await result.json(), { error: { http_code: 503, message: "delivery_unavailable" } });
  assert.deepEqual(calls, []); assert.deepEqual(events, ["enqueue_failed"]);
});
test("a failed background wake-up still acknowledges the persisted job for scheduled recovery", async () => {
  const { deps, calls, events } = fixture(); deps.schedule = () => { throw new Error("unavailable"); };
  assert.equal((await smsHookHandler(deps)(signed())).status, 200);
  assert.deepEqual(calls, ["persist:hook-1"]); assert.deepEqual(events, ["schedule_failed"]);
});
test("expired delivery TTL is measured from the signed event, not retry time", async () => {
  const { deps, calls } = fixture(); deps.config = () => ({ ...config, ttlSeconds: 30 });
  assert.equal((await smsHookHandler(deps)(signed(payload, new Date(Date.now() - 60_000)))).status, 400);
  assert.deepEqual(calls, []);
});
test("unconfigured delivery fails closed", async () => {
  const { deps, calls } = fixture(); deps.config = () => { throw new Error("private env"); };
  assert.equal((await smsHookHandler(deps)(signed())).status, 503); assert.deepEqual(calls, []);
});
test("encrypted payloads are randomized and bound to the webhook ID", () => {
  const a = encryptOtp(payload, config.encryptionKey, "one"); const b = encryptOtp(payload, config.encryptionKey, "one");
  assert.notEqual(a, b); assert.equal(a.includes("123456"), false); assert.equal(a.includes("252610000000"), false);
  assert.deepEqual(decryptOtp(a, config.encryptionKey, "one"), payload);
  assert.throws(() => decryptOtp(a, config.encryptionKey, "two"));
  assert.throws(() => decryptOtp(a, "wrong-key", "one"));
  const parts = a.split("."); parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decryptOtp(parts.join("."), config.encryptionKey, "one"));
});
test("provider call uses configured session, normalized chat ID and no redirects", async () => {
  let called = false;
  await sendOtp(config, payload, async (input, init) => {
    called = true; assert.equal(input, "https://waha.example.test/api/sendText");
    assert.equal(new Headers(init?.headers).get("X-Api-Key"), "private-test-key");
    const body = JSON.parse(String(init?.body)); assert.equal(body.session, "defualt"); assert.equal(body.chatId, "252610000000@c.us");
    assert.match(body.text, /123456/); assert.equal(init?.redirect, "error"); assert.ok(init?.signal);
    return new Response("{}", { status: 200 });
  }); assert.equal(called, true);
});
test("provider failures do not reflect response bodies that may contain private data", async () => {
  await assert.rejects(sendOtp(config, payload, async () => new Response("private phone and otp", { status: 401 })), /^Error: provider_http_401$/);
});
test("cron authentication fails closed and accepts only the exact configured bearer token", () => {
  const token = "t".repeat(32);
  assert.equal(authorizedDrain(`Bearer ${token}`, token), true);
  for (const value of [null, token, `Bearer ${token}x`, `Bearer ${"x".repeat(32)}`]) assert.equal(authorizedDrain(value, token), false);
  assert.equal(authorizedDrain(`Bearer ${token}`, undefined), false);
});
test("unsafe WAHA origin and missing session cannot be configured", () => {
  for (const url of ["http://waha.test", "https://user:pass@waha.test", "https://waha.test/path", "https://waha.test?secret=key"]) {
    assert.throws(() => deliveryConfig({ SEND_SMS_HOOK_SECRET: secret, OTP_DELIVERY_ENCRYPTION_KEY: "x".repeat(32), WAHA_API_KEY: "key", WAHA_SESSION: "defualt", WAHA_BASE_URL: url }));
  }
  assert.throws(() => deliveryConfig({ SEND_SMS_HOOK_SECRET: secret, OTP_DELIVERY_ENCRYPTION_KEY: "x".repeat(32), WAHA_API_KEY: "key", WAHA_BASE_URL: "https://waha.test" }));
});
