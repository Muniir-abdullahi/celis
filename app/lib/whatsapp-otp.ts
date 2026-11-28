import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { z } from "zod";

const payloadSchema = z.object({
  user: z.object({ phone: z.string().regex(/^\+?[1-9]\d{6,14}$/) }),
  sms: z.object({ otp: z.string().regex(/^\d{6,10}$/) }),
});
export type OtpPayload = z.infer<typeof payloadSchema>;
export type DeliveryConfig = { hookSecret: string; encryptionKey: string; baseUrl: string; apiKey: string; session: string; ttlSeconds: number };

export function deliveryConfig(env: NodeJS.ProcessEnv): DeliveryConfig {
  const parsed = z.object({
    SEND_SMS_HOOK_SECRET: z.string().min(1),
    OTP_DELIVERY_ENCRYPTION_KEY: z.string().min(32),
    WAHA_BASE_URL: z.string().url(),
    WAHA_API_KEY: z.string().trim().min(1),
    WAHA_SESSION: z.string().trim().min(1).max(100),
    OTP_DELIVERY_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(300),
  }).parse(env);
  const url = new URL(parsed.WAHA_BASE_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("WAHA_BASE_URL must be an HTTPS origin.");
  }
  return { hookSecret: parsed.SEND_SMS_HOOK_SECRET.replace(/^v1,whsec_/, ""), encryptionKey: parsed.OTP_DELIVERY_ENCRYPTION_KEY,
    baseUrl: url.origin, apiKey: parsed.WAHA_API_KEY, session: parsed.WAHA_SESSION, ttlSeconds: parsed.OTP_DELIVERY_TTL_SECONDS };
}

function key(secret: string) { return createHash("sha256").update(secret).digest(); }
export function encryptOtp(payload: OtpPayload, secret: string, deliveryId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(deliveryId));
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
export function decryptOtp(value: string, secret: string, deliveryId: string): OtpPayload {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Invalid encrypted delivery.");
  const cipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  cipher.setAAD(Buffer.from(deliveryId));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return payloadSchema.parse(JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, "base64url")), cipher.final()]).toString("utf8")));
}

const hookError = (status: number, message: string) => Response.json({ error: { http_code: status, message } }, { status });
export function smsHookHandler(deps: {
  config: () => DeliveryConfig;
  enqueue: (id: string, encrypted: string, expiresAt: Date) => Promise<void>;
  schedule: (id: string) => void;
  report: (event: string) => void;
}) {
  return async (request: Request): Promise<Response> => {
    let config: DeliveryConfig;
    try { config = deps.config(); } catch { return hookError(503, "delivery_not_configured"); }
    // Cap actual bytes, including chunked requests, before allocating a raw body.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    if (!reader) return hookError(400, "invalid_payload");
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.length;
        if (bytes > 64 * 1024) { await reader.cancel(); return hookError(413, "payload_too_large"); }
        chunks.push(value);
      }
    } catch { return hookError(400, "invalid_payload"); }
    const raw = Buffer.concat(chunks).toString("utf8");
    let verified: unknown;
    try { verified = new Webhook(config.hookSecret).verify(raw, Object.fromEntries(request.headers)); }
    catch { return hookError(401, "invalid_signature"); }
    const id = request.headers.get("webhook-id") ?? "";
    const parsed = payloadSchema.safeParse(verified);
    if (!id || id.length > 200 || !parsed.success) return hookError(400, "invalid_payload");
    // Count from the signed event timestamp, not from a delayed retry's arrival.
    const timestamp = request.headers.get("webhook-timestamp") ?? "";
    if (!/^\d{1,12}$/.test(timestamp)) return hookError(400, "invalid_payload");
    const expiresAt = new Date(Number(timestamp) * 1000 + config.ttlSeconds * 1000);
    if (expiresAt.getTime() <= Date.now()) return hookError(400, "delivery_expired");
    try { await deps.enqueue(id, encryptOtp(parsed.data, config.encryptionKey, id), expiresAt); }
    catch { deps.report("enqueue_failed"); return hookError(503, "delivery_unavailable"); }
    // A failed wake-up does not lose the committed delivery: the drain job recovers it.
    try { deps.schedule(id); } catch { deps.report("schedule_failed"); }
    return Response.json({});
  };
}

export function authorizedDrain(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !authorization) return false;
  const supplied = Buffer.from(authorization); const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function sendOtp(config: DeliveryConfig, payload: OtpPayload, fetcher: typeof fetch = fetch, timeoutMs = 15_000): Promise<void> {
  const phone = payload.user.phone.replace(/^\+/, "");
  const response = await fetcher(`${config.baseUrl}/api/sendText`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": config.apiKey },
    body: JSON.stringify({ session: config.session, chatId: `${phone}@c.us`, text: `Celis: ${payload.sms.otp}\nKoodhkaaga Celis waa ${payload.sms.otp}.\nHa la wadaagin cidna.` }),
    signal: AbortSignal.timeout(timeoutMs), redirect: "error",
  });
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
}
