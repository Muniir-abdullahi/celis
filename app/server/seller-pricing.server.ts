import { CelisError } from "~/lib/errors";
import type { ListingPricing } from "~/lib/pricing";
import { computeListingPricing, getListingPricing } from "./config.server";
import { getSellerListingEligibility } from "./seller-packages.server";
import { discountedFee } from "~/lib/listing-discounts";
import { findSellerDiscount } from "./discount-eligibility.server";

type Eligibility = Awaited<ReturnType<typeof getSellerListingEligibility>>;

export type SellerListingPricing = ListingPricing & {
  /** True when an active package covers this listing: no listing fee. */
  coveredByPackage: boolean;
  standardFeeCents?: number;
  discountCents?: number;
  discountAssignmentId?: string;
};

/**
 * What this seller is charged for a listing at this price.
 *
 * - Package sellers (shop or individual with an active subscription): no
 *   listing fee. Tier data is kept only for expiry; a price outside every
 *   tier is allowed because nothing is charged.
 * - Everyone else: the strict tier fee (`getListingPricing`), which refuses
 *   prices outside every tier.
 */
export async function getSellerListingPricing(
  sellerId: string,
  priceCents: number,
  categoryId: string | null,
  eligibility?: Eligibility
): Promise<SellerListingPricing> {
  const elig = eligibility ?? (await getSellerListingEligibility(sellerId));
  if (!elig.canList && !elig.subscription) throw new CelisError("An active seller package is required.", "SHOP_PACKAGE_REQUIRED", 402);
  if (!elig.requiresPayment) {
    const base = await computeListingPricing(priceCents, categoryId);
    return {
      ...base,
      feeCents: 0,
      appliedFeeRuleId: base.commissionAmountCents ? base.appliedFeeRuleId : null,
      totalFeeCents: base.commissionAmountCents ?? 0,
      coveredByPackage: true,
    };
  }
  const pricing = await getListingPricing(priceCents, categoryId);
  const assignment = pricing.tierKey && pricing.feeCents > 0 ? await findSellerDiscount(sellerId, pricing.tierKey) : null;
  const feeCents = assignment ? discountedFee(pricing.feeCents, assignment.terms.type, assignment.terms.value) : pricing.feeCents;
  return { ...pricing, feeCents, totalFeeCents: feeCents + (pricing.commissionAmountCents ?? 0), coveredByPackage: false,
    standardFeeCents: pricing.feeCents, discountCents: pricing.feeCents - feeCents, discountAssignmentId: assignment?.id };
}

/** Refuse a listing-fee payment when the seller's package covers it. */
export function assertListingFeePayable(pricing: SellerListingPricing) {
  if (pricing.coveredByPackage) {
    throw new CelisError(
      "This listing is covered by your package. No listing fee is needed.",
      "LISTING_COVERED_BY_PACKAGE",
      409
    );
  }
}
