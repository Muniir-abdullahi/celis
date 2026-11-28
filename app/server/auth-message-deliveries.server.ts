import { and, or, eq, lt, lte, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "~/db";
import { authMessageDeliveries as deliveries } from "~/db/schema";
import { decryptOtp, deliveryConfig, sendOtp } from "~/lib/whatsapp-otp";

export async function enqueueAuthMessage(id: string, payload: string, expiresAt: Date) {
  // The unique webhook ID makes concurrent/replayed hook requests idempotent.
  await db.transaction(async (tx) => {
    // Protocol deadline: bound queue persistence rather than timing out at Auth.
    await tx.execute(sql`SET LOCAL statement_timeout = '2000ms'`);
    await tx.insert(deliveries).values({ id, payload, expiresAt }).onConflictDoNothing({ target: deliveries.id });
  });
}

async function claim(id?: string) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [job] = await tx.select().from(deliveries).where(and(
      id ? eq(deliveries.id, id) : undefined,
      gt(deliveries.expiresAt, now), lt(deliveries.attempts, 3), isNotNull(deliveries.payload),
      or(and(eq(deliveries.status, "queued"), lte(deliveries.nextAttemptAt, now)),
        and(eq(deliveries.status, "sending"), lte(deliveries.leaseUntil, now))),
    )).orderBy(deliveries.createdAt).limit(1).for("update", { skipLocked: true });
    if (!job) return null;
    const [leased] = await tx.update(deliveries).set({ status: "sending", attempts: job.attempts + 1,
      leaseUntil: new Date(now.getTime() + 45_000), updatedAt: now }).where(eq(deliveries.id, job.id)).returning();
    return leased;
  });
}

export async function processAuthMessage(id?: string): Promise<boolean> {
  const config = deliveryConfig(process.env);
  const job = await claim(id);
  if (!job || !job.payload) return false;
  const fence = and(eq(deliveries.id, job.id), eq(deliveries.status, "sending"), eq(deliveries.attempts, job.attempts));
  try {
    const remaining = job.expiresAt.getTime() - Date.now();
    if (remaining <= 0) {
      await db.update(deliveries).set({ status: "expired", payload: null, leaseUntil: null, updatedAt: new Date() }).where(fence);
      return true;
    }
    await sendOtp(config, decryptOtp(job.payload, config.encryptionKey, job.id), fetch, Math.min(15_000, remaining));
    await db.update(deliveries).set({ status: "sent", payload: null, leaseUntil: null, lastError: null, updatedAt: new Date() }).where(fence);
  } catch (error) {
    // Never log provider bodies, transport errors, payloads, phone numbers or OTPs.
    const code = error instanceof Error && /^provider_http_\d{3}$/.test(error.message) ? error.message : "delivery_failed";
    const terminal = job.attempts >= 3 || job.expiresAt.getTime() <= Date.now();
    await db.update(deliveries).set({ status: terminal ? "failed" : "queued", payload: terminal ? null : job.payload,
      leaseUntil: null, lastError: code, nextAttemptAt: new Date(Date.now() + 15_000), updatedAt: new Date() }).where(fence);
    console.warn("[auth-delivery] attempt_failed", { id: job.id, attempt: job.attempts, code });
  }
  return true;
}

export async function drainAuthMessages() {
  // Bounded housekeeping: expire and scrub sensitive payloads, then retain metadata 24h.
  const now = new Date();
  const expired = await db.select({ id: deliveries.id }).from(deliveries)
    .where(and(lte(deliveries.expiresAt, now), inArray(deliveries.status, ["queued", "sending"]))).limit(100);
  if (expired.length) await db.update(deliveries).set({ status: "expired", payload: null, leaseUntil: null, updatedAt: now })
    .where(and(inArray(deliveries.id, expired.map((row) => row.id)), lte(deliveries.expiresAt, now), inArray(deliveries.status, ["queued", "sending"])));
  const old = await db.select({ id: deliveries.id }).from(deliveries)
    .where(and(lt(deliveries.updatedAt, new Date(now.getTime() - 86_400_000)), inArray(deliveries.status, ["sent", "failed", "expired"]))).limit(100);
  if (old.length) await db.delete(deliveries).where(inArray(deliveries.id, old.map((row) => row.id)));
  let processed = 0;
  // Two sends fit the route duration even when both provider calls take 15 seconds.
  for (let i = 0; i < 2; i++) if (await processAuthMessage()) processed++; else break;
  return { processed };
}
