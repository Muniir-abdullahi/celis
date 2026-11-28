import { authorizedDrain } from "~/lib/whatsapp-otp";
import { drainAuthMessages } from "~/server/auth-message-deliveries.server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizedDrain(request.headers.get("authorization"), process.env.AUTH_DELIVERY_CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try { return Response.json(await drainAuthMessages()); }
  catch {
    console.error("[auth-delivery] drain_failed");
    return Response.json({ error: "Delivery worker unavailable" }, { status: 503 });
  }
}
