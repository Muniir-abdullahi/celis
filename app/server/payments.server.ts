import { eq } from "drizzle-orm";
import { db } from "~/db";
import { auditLogs, listings, walletPayments, users } from "~/db/schema";
import type { WalletProvider } from "~/db/schema";
import { CelisError } from "~/lib/errors";
import { getWaafiUserMessage, normalizeWaafiAccountNo } from "~/lib/waafi";
import { purchaseWithWaafi } from "./waafi.server";
import { listingPaymentStatus } from "~/lib/listing-payment-result";

export type PaymentPurpose = "listing_fee" | "feature_listing" | "order";
export type PaymentFlowStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "pending_reconciliation";

export interface PaymentInitResult {
  merchantRef: string;
  status: PaymentFlowStatus;
  providerRef?: string;
  message?: string;
}

function resultFromRow(row: typeof walletPayments.$inferSelect): PaymentInitResult {
  return {
    merchantRef: row.merchantRef,
    status: row.status as PaymentFlowStatus,
    providerRef: row.walletRef ?? undefined,
    message: row.providerError ?? undefined,
  };
}

export async function initiateWalletPayment(
  userId: string,
  listingId: string | null,
  orderId: string | null,
  provider: WalletProvider,
  phone: string,
  amountCents: number,
  purpose: PaymentPurpose = "listing_fee",
  idempotencyKey?: string,
  purchase: typeof purchaseWithWaafi = purchaseWithWaafi
): Promise<PaymentInitResult> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new CelisError("Payment amount is invalid", "PAYMENT_AMOUNT_INVALID", 422);
  }
  if (provider === "premier") {
    throw new CelisError("Premier Wallet is not connected yet", "PAYMENT_PROVIDER_UNAVAILABLE", 422);
  }

  const normalizedPhone = normalizeWaafiAccountNo(phone);
  let merchantRef = `celis-${crypto.randomUUID()}`;
  let invoiceId = listingId ? `listing-${listingId}` : orderId ? `order-${orderId}` : merchantRef;
  let retryingFailedPayment = false;

  if (idempotencyKey) {
    const [existing] = await db
      .select()
      .from(walletPayments)
      .where(eq(walletPayments.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existing) {
      if (existing.userId !== userId || existing.listingId !== listingId || existing.amount !== amountCents) {
        throw new CelisError("Payment key conflicts with another request", "PAYMENT_IDEMPOTENCY_CONFLICT", 409);
      }
      if (existing.status !== "failed") return resultFromRow(existing);

      retryingFailedPayment = true;
      merchantRef = existing.merchantRef;
      invoiceId = existing.invoiceId ?? invoiceId;
      await db.update(walletPayments).set({
        customerPhone: normalizedPhone,
        status: "processing",
        providerResponseCode: null,
        providerState: null,
        providerError: null,
        retryCount: existing.retryCount + 1,
        updatedAt: new Date(),
      }).where(eq(walletPayments.id, existing.id));
      console.info("[wallet-payment] retrying failed payment", {
        merchantRef,
        listingId,
        retryCount: existing.retryCount + 1,
      });
    }
  }

  if (!retryingFailedPayment) {
    await db.insert(walletPayments).values({
      userId,
      listingId,
      orderId,
      walletProvider: provider,
      amount: amountCents,
      merchantRef,
      idempotencyKey: idempotencyKey ?? null,
      invoiceId,
      customerPhone: normalizedPhone,
      status: "processing",
      purpose,
    });
    console.info("[wallet-payment] payment recorded", {
      merchantRef,
      listingId,
      amountCents,
      purpose,
    });
  }

  try {
    const response = await purchase({
      accountNo: normalizedPhone,
      referenceId: merchantRef,
      invoiceId,
      amountCents,
      currency: "USD",
      description:
        purpose === "feature_listing"
          ? "Celis featured listing fee"
          : purpose === "listing_fee"
            ? "Celis listing fee"
            : "Celis order payment",
    });

    const amountMatches = response.amountCents === amountCents;
    const status: PaymentFlowStatus = purpose === "listing_fee" ? listingPaymentStatus(response, amountCents) : response.approved && amountMatches
      ? "completed"
      : response.approved
        ? "pending_reconciliation"
        : "failed";
    const message = status === "pending_reconciliation"
      ? response.approved ? "Provider approved a different amount; payment requires reconciliation." : "The gateway did not confirm a final payment state; reconciliation is required."
      : response.approved
        ? null
        : getWaafiUserMessage(response.responseMessage);

    await db.transaction(async (tx) => {
      // Checkout preparation locks seller -> listing -> checkout. Take the
      // same seller lock before wallet/listing writes and the audit actor FK.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
      await tx.update(walletPayments).set({
        status,
        walletRef: response.transactionId,
        providerResponseCode: response.responseCode,
        providerState: response.state,
        providerError: message,
        callbackPayload: {
          transactionId: response.transactionId,
          issuerTransactionId: response.issuerTransactionId,
          amountCents: response.amountCents,
          merchantChargesCents: response.merchantChargesCents,
        },
        callbackReceivedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(walletPayments.merchantRef, merchantRef));

      if (status === "completed" && purpose === "listing_fee" && listingId) {
        await tx.update(listings).set({
          status: "pending_review",
          monetizationStatus: "active",
          updatedAt: new Date(),
        }).where(eq(listings.id, listingId));
      }

      // Listing activity log: every listing-fee / feature-fee attempt outcome.
      // No phone number is stored.
      if (listingId && (purpose === "listing_fee" || purpose === "feature_listing")) {
        await tx.insert(auditLogs).values({
          actorId: userId,
          action:
            status === "completed"
              ? purpose === "listing_fee" ? "listing_fee_paid" : "listing_feature_paid"
              : purpose === "listing_fee" ? "listing_fee_payment_failed" : "listing_feature_payment_failed",
          resourceType: "listing",
          resourceId: listingId,
          metadata: {
            merchantRef,
            amountCents,
            provider,
            paymentStatus: status,
            providerResponseCode: response.responseCode,
            message: message ?? null,
          },
        });
      }
    });

    console.info("[wallet-payment] gateway response recorded", {
      merchantRef,
      status,
      responseCode: response.responseCode,
      providerState: response.state,
    });

    return {
      merchantRef,
      status,
      providerRef: response.transactionId ?? undefined,
      message: message ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "WaafiPay request failed.";
    const ambiguous = purpose === "listing_fee" || /timed out|reconciliation/i.test(message);
    const status: PaymentFlowStatus = ambiguous ? "pending_reconciliation" : "failed";
    await db
      .update(walletPayments)
      .set({ status, providerError: message, updatedAt: new Date() })
      .where(eq(walletPayments.merchantRef, merchantRef));
    console.error("[wallet-payment] gateway request failed", {
      merchantRef,
      status,
      message,
    });
    return { merchantRef, status, message };
  }
}

export async function getWalletPaymentByMerchantRef(merchantRef: string) {
  const [payment] = await db
    .select()
    .from(walletPayments)
    .where(eq(walletPayments.merchantRef, merchantRef))
    .limit(1);
  return payment;
}
