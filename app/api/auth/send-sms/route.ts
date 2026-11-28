import { after } from "next/server";
import { deliveryConfig, smsHookHandler } from "~/lib/whatsapp-otp";
import { enqueueAuthMessage, processAuthMessage } from "~/server/auth-message-deliveries.server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Supabase calls this server-to-server; it is not a public mobile send endpoint.
export const POST = smsHookHandler({
  config: () => deliveryConfig(process.env),
  enqueue: enqueueAuthMessage,
  schedule: (id) => after(async () => {
    try { await processAuthMessage(id); }
    catch { console.error("[auth-delivery] background_failed", { id }); }
  }),
  report: (event) => console.error("[auth-delivery]", event),
});
