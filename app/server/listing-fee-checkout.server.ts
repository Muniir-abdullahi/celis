import { and, eq, gt } from "drizzle-orm";
import { db } from "~/db";
import { auditLogs, listings, listingFeeCheckouts as checkouts, users, walletPayments, profiles, sellerSubscriptions, listingPackages } from "~/db/schema";
import { CelisError } from "~/lib/errors";
import { monetizationTypeForModel } from "~/lib/pricing";
import { discountedFee } from "~/lib/listing-discounts";
import { normalizeWaafiAccountNo } from "~/lib/waafi";
import type { WalletProvider } from "~/db/schema";
import { assertListingFeePayable } from "./seller-pricing.server";
import { computeListingPricing } from "./config.server";
import { findSellerDiscount } from "./discount-eligibility.server";
import { initiateWalletPayment, type PaymentInitResult } from "./payments.server";

/** Both web and mobile must enter here; clients supply identity, never charge amounts. */
export async function payListingFee(input: {
  sellerId: string; listingId: string; phone: string; provider: WalletProvider; requestKey: string; expectedFeeCents?: number;
}, gateway: typeof initiateWalletPayment = initiateWalletPayment): Promise<PaymentInitResult & { amountCents: number }> {
  // Config reads happen before acquiring a transaction connection. Never nest
  // global-pool reads inside a reserved connection (pool exhaustion can deadlock).
  const [source] = await db.select({ price: listings.price, categoryId: listings.categoryId, sellerId: listings.sellerId }).from(listings).where(eq(listings.id, input.listingId)).limit(1);
  if (!source) throw new CelisError("Listing not found", "LISTING_NOT_FOUND", 404);
  if (source.sellerId !== input.sellerId) throw new CelisError("Forbidden", "FORBIDDEN", 403);
  const base = await computeListingPricing(source.price, source.categoryId);
  const prepared = await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, input.sellerId)).for("update");
    const [listing] = await tx.select().from(listings).where(eq(listings.id, input.listingId)).for("update");
    if (!listing) throw new CelisError("Listing not found", "LISTING_NOT_FOUND", 404);
    if (listing.sellerId !== input.sellerId) throw new CelisError("Forbidden", "FORBIDDEN", 403);
    const [previous] = await tx.select().from(checkouts).where(eq(checkouts.listingId, listing.id)).for("update");
    if (previous?.status === "completed") return { existing: { merchantRef: previous.merchantRef ?? previous.paymentKey,
      status: "completed" as const, amountCents: previous.finalFeeCents } };
    if (previous && previous.status !== "failed") {
      const [payment] = await tx.select().from(walletPayments).where(eq(walletPayments.idempotencyKey, previous.paymentKey)).limit(1);
      if (payment && payment.status !== previous.status) {
        const status = payment.status === "completed" ? "completed" : payment.status === "failed" ? "failed" : "pending_reconciliation";
        await tx.update(checkouts).set({ status, merchantRef: payment.merchantRef, updatedAt: new Date() }).where(eq(checkouts.id, previous.id));
        // A terminal failure releases its reservation; a later request can quote again.
        if (status === "failed") return { existing: { merchantRef: payment.merchantRef, status, amountCents: previous.finalFeeCents, message: "Payment failed. Retry to request a new quote." } as const };
      }
      return { existing: { merchantRef: payment?.merchantRef ?? previous.merchantRef ?? previous.paymentKey,
        status: payment?.status === "completed" ? "completed" as const : "pending_reconciliation" as const,
        amountCents: previous.finalFeeCents, message: "This listing already has a payment in progress or completed. Do not pay again." } };
    }
    if (listing.status !== "draft") throw new CelisError("This listing is already submitted or paid.", "LISTING_NOT_DRAFT", 409);
    if (listing.price !== source.price || listing.categoryId !== source.categoryId) throw new CelisError("The listing changed. Review its price and try again.", "LISTING_PRICE_CHANGED", 409);
    const [subscription] = await tx.select({ id: sellerSubscriptions.id }).from(sellerSubscriptions).innerJoin(listingPackages, eq(listingPackages.id, sellerSubscriptions.packageId))
      .where(and(eq(sellerSubscriptions.sellerId, input.sellerId), eq(sellerSubscriptions.status, "active"), gt(sellerSubscriptions.expiresAt, new Date()), eq(listingPackages.isActive, true))).limit(1);
    assertListingFeePayable({ ...base, coveredByPackage: !!subscription });
    const [profile] = await tx.select({ sellerType: profiles.sellerType }).from(profiles).where(eq(profiles.id, input.sellerId)).limit(1);
    if (profile?.sellerType === "shop") throw new CelisError("An active seller package is required.", "SHOP_PACKAGE_REQUIRED", 402);
    if (!base.priced) throw new CelisError("The listing price is outside the configured fee tiers.", "PRICE_OUTSIDE_TIERS", 422);
    const assignment = base.tierKey && base.feeCents > 0 ? await findSellerDiscount(input.sellerId, base.tierKey, tx) : null;
    const feeCents = assignment ? discountedFee(base.feeCents, assignment.terms.type, assignment.terms.value) : base.feeCents;
    const pricing = { ...base, feeCents, standardFeeCents: base.feeCents, discountCents: base.feeCents - feeCents, discountAssignmentId: assignment?.id };
    if (input.expectedFeeCents !== undefined && input.expectedFeeCents !== pricing.feeCents) {
      return { existing: { merchantRef: "", status: "failed" as const, amountCents: pricing.feeCents, message: "Your listing fee changed. Review the updated amount and confirm again." } };
    }
    if (pricing.feeCents > 0) {
      try { normalizeWaafiAccountNo(input.phone); }
      catch { throw new CelisError("Enter a valid Somali wallet number.", "PAYMENT_PHONE_INVALID", 422); }
      if (input.provider === "premier") throw new CelisError("Premier Wallet is not connected yet", "PAYMENT_PROVIDER_UNAVAILABLE", 422);
    }
    const paymentKey = `listing-${crypto.randomUUID()}`;
    const values = { sellerId: input.sellerId, listingId: listing.id, assignmentId: pricing.discountAssignmentId ?? null,
      regularFeeCents: pricing.standardFeeCents ?? pricing.feeCents, discountCents: pricing.discountCents ?? 0,
      finalFeeCents: pricing.feeCents, requestKey: input.requestKey, paymentKey, merchantRef: null,
      status: pricing.feeCents === 0 ? "completed" as const : "processing" as const, updatedAt: new Date() };
    const [checkout] = previous ? await tx.update(checkouts).set(values).where(eq(checkouts.id, previous.id)).returning()
      : await tx.insert(checkouts).values(values).returning();
    if (pricing.feeCents === 0) await tx.update(checkouts).set({ merchantRef: `free-${checkout.id}` }).where(eq(checkouts.id, checkout.id));
    await tx.update(listings).set({ feeAmountCents: pricing.feeCents, commissionBps: pricing.commissionBps,
      currency: pricing.currency, expiresAt: pricing.expiresAt, appliedFeeRuleId: pricing.appliedFeeRuleId,
      monetizationType: monetizationTypeForModel(pricing.monetizationModel),
      ...(pricing.feeCents === 0 ? { status: "pending_review" as const, monetizationStatus: "active" as const } : {}), updatedAt: new Date() }).where(eq(listings.id, listing.id));
    await tx.insert(auditLogs).values({ actorId: input.sellerId, action: pricing.feeCents === 0 ? "listing_fee_waived" : "listing_fee_reserved", resourceType: "listing", resourceId: listing.id,
      metadata: { assignmentId: values.assignmentId, regularFeeCents: values.regularFeeCents, discountCents: values.discountCents, finalFeeCents: values.finalFeeCents, checkoutId: checkout.id } });
    return { checkout };
  });
  if (prepared.existing) return prepared.existing;
  const checkout = prepared.checkout!;
  if (checkout.finalFeeCents === 0) return { merchantRef: `free-${checkout.id}`, status: "completed", amountCents: 0 };
  let result: PaymentInitResult;
  try {
    result = await gateway(input.sellerId, input.listingId, null, input.provider, input.phone, checkout.finalFeeCents, "listing_fee", checkout.paymentKey);
  } catch {
    // An exception after initiation is not proof that money was not transferred.
    result = { merchantRef: checkout.paymentKey, status: "pending_reconciliation", message: "Payment needs reconciliation. Do not retry payment." };
  }
  await db.transaction(async (tx) => {
    // Audit actor FKs also lock users: acquire this lock before checkout rows,
    // in the same order as preparation, to avoid concurrent retry deadlocks.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, input.sellerId)).for("update");
    await tx.update(checkouts).set({ status: result.status === "completed" ? "completed" : result.status === "failed" ? "failed" : "pending_reconciliation", merchantRef: result.merchantRef, updatedAt: new Date() }).where(eq(checkouts.id, checkout.id));
    await tx.insert(auditLogs).values({ actorId: input.sellerId, action: "listing_discount_payment_result", resourceType: "listing", resourceId: input.listingId,
      metadata: { checkoutId: checkout.id, assignmentId: checkout.assignmentId, amountCents: checkout.finalFeeCents, status: result.status, merchantRef: result.merchantRef } });
  });
  return { ...result, amountCents: checkout.finalFeeCents };
}
