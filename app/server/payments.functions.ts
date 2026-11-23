"use server";

import { z } from "zod";
import {
  initiateWalletPayment,
  getWalletPaymentByMerchantRef,
} from "./payments.server";
import {
  getListingFeeCents,
  getFeaturedListingFeeCents,
} from "./config.server";
import { featureListing } from "./listings.server";
import { payListingFee } from "./listing-fee-checkout.server";
import { isCelisError } from "~/lib/errors";
import { db } from "~/db";
import { listings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { WALLET_PROVIDERS } from "~/db/schema";
import type { walletPayments } from "~/db/schema";

type WalletPaymentRow = typeof walletPayments.$inferSelect;

function serializeWalletPayment(payment: WalletPaymentRow) {
  return {
    id: payment.id,
    userId: payment.userId,
    orderId: payment.orderId,
    listingId: payment.listingId,
    walletProvider: payment.walletProvider,
    amount: payment.amount,
    currency: payment.currency,
    walletRef: payment.walletRef,
    merchantRef: payment.merchantRef,
    idempotencyKey: payment.idempotencyKey,
    invoiceId: payment.invoiceId,
    customerPhone: payment.customerPhone,
    status: payment.status,
    providerResponseCode: payment.providerResponseCode,
    providerState: payment.providerState,
    providerError: payment.providerError,
    callbackReceivedAt: payment.callbackReceivedAt,
    retryCount: payment.retryCount,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

const initiateSchema = z.object({
  userId: z.string().uuid().optional(),
  expectedFeeCents: z.number().int().min(0).optional(),
  listingId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  provider: z.enum(WALLET_PROVIDERS),
  phone: z.string().max(20),
  featureListing: z.boolean().optional().default(false),
  idempotencyKey: z.string().min(16).max(160).optional(),
});

export async function initiatePayment(input: { data: unknown }) {
  const data = initiateSchema.parse(input.data);
  const { requireCurrentUser } = await import("./auth.server");
  const user = await requireCurrentUser();
  if (data.listingId && !data.featureListing && !data.orderId) {
    try {
      return await payListingFee({ sellerId: user.id, listingId: data.listingId, phone: data.phone, provider: data.provider, requestKey: data.idempotencyKey ?? crypto.randomUUID(), expectedFeeCents: data.expectedFeeCents });
    } catch (error) {
      if (isCelisError(error)) return { merchantRef: "", status: "failed" as const, message: error.message, amountCents: data.expectedFeeCents ?? 0 };
      throw error;
    }
  }
  let amountCents = await getListingFeeCents();
  if (data.listingId) {
    const [listing] = await db.select({ sellerId: listings.sellerId }).from(listings).where(eq(listings.id, data.listingId)).limit(1);
    if (!listing || listing.sellerId !== user.id) throw new Error("Forbidden");
    if (data.featureListing) amountCents = await getFeaturedListingFeeCents();
  }
  const result = await initiateWalletPayment(user.id, data.listingId, data.orderId, data.provider, data.phone, amountCents,
    data.featureListing ? "feature_listing" : data.orderId ? "order" : "listing_fee", data.idempotencyKey);
  if (result.status === "completed" && data.listingId && data.featureListing) await featureListing(data.listingId, user.id, amountCents);
  return { ...result, amountCents };
}

const statusSchema = z.object({ merchantRef: z.string().min(1) });

export async function getPaymentStatus(input: { data: unknown }) {
  const data = (statusSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    const payment = await getWalletPaymentByMerchantRef(data.merchantRef);
    if (payment && payment.userId !== user.id) throw new Error("Forbidden");
    return payment ? serializeWalletPayment(payment) : null;
}

