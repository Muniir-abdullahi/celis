import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { listings } from "~/db/schema";
import { getServiceSupabase } from "~/lib/supabase/server";
import { payListingFee } from "~/server/listing-fee-checkout.server";
import { isCelisError } from "~/lib/errors";

const requestSchema = z.object({
  listingId: z.string().uuid(),
  expectedFeeCents: z.number().int().min(0).optional(),
  phone: z.string().max(20).default(""),
  idempotencyKey: z.string().min(16).max(160),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    console.info("[mobile-listing-payment] request received", { requestId });
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ message: "Authentication required." }, 401);

    const { data: authData, error: authError } =
      await getServiceSupabase().auth.getUser(token);
    if (authError || !authData.user) {
      return json({ message: "Invalid or expired session." }, 401);
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ message: "Invalid payment request." }, 400);
    console.info("[mobile-listing-payment] request authenticated", {
      requestId,
      listingId: parsed.data.listingId,
    });

    const [listing] = await db
      .select({
        id: listings.id,
        sellerId: listings.sellerId,
        price: listings.price,
        categoryId: listings.categoryId,
      })
      .from(listings)
      .where(eq(listings.id, parsed.data.listingId))
      .limit(1);
    if (!listing) return json({ message: "Listing not found." }, 404);
    if (listing.sellerId !== authData.user.id) {
      return json({ message: "Forbidden." }, 403);
    }
    const payment = await payListingFee({ sellerId: authData.user.id, listingId: listing.id, provider: "evc", phone: parsed.data.phone, requestKey: parsed.data.idempotencyKey, expectedFeeCents: parsed.data.expectedFeeCents });

    console.info("[mobile-listing-payment] request completed", {
      requestId,
      merchantRef: payment.merchantRef,
      status: payment.status,
      durationMs: Date.now() - startedAt,
    });
    return json(payment);
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Payment request failed.";
    console.error("[mobile-listing-payment] request failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      message,
    });
    const status = isCelisError(cause) ? cause.status : 500;
    return json({ message, code: isCelisError(cause) ? cause.code : undefined }, status);
  }
}
