import { CelisError } from "~/lib/errors";
import type { ListingPricing } from "~/lib/pricing";
import { computeListingPricing, getListingPricing } from "./config.server";
import { getSellerListingEligibility } from "./seller-packages.server";

type Eligibility = Awaited<ReturnType<typeof getSellerListingEligibility>>;

export type SellerListingPricing = ListingPricing & {
  /** True when an active package covers this listing: no listing fee. */
  coveredByPackage: boolean;
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
  return { ...pricing, coveredByPackage: false };
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
