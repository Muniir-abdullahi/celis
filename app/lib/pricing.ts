export type MonetizationModel = "fixed_only" | "commission_only" | "hybrid";

/**
 * The listing's stored `monetization_type`, derived from the platform
 * monetization model (admin configuration). Sellers never choose it.
 * `hybrid` charges a fee and a commission and is recorded as "commission".
 */
export function monetizationTypeForModel(
  model: MonetizationModel
): "fixed_rate" | "commission" {
  return model === "fixed_only" ? "fixed_rate" : "commission";
}

export interface FeeRuleInput {
  id?: string;
  feeType: "listing_fee" | "commission" | "featured_fee";
  amount?: number; // cents
  percentage?: number; // basis points (100 = 1%)
  currency: string;
}

export interface PricingTier {
  label: string;
  minCents: number;
  maxCents: number | null;
  feeCents: number;
  expiryDays: number;
}

export interface ListingTiersConfig {
  currency: string;
  tiers: PricingTier[];
}

export const DEFAULT_LISTING_TIERS: ListingTiersConfig = {
  currency: "USD",
  tiers: [
    {
      label: "Basic",
      minCents: 1000, // $10.00
      maxCents: 49999, // $499.99
      feeCents: 50, // $0.50
      expiryDays: 7,
    },
    {
      label: "Standard",
      minCents: 50000, // $500.00
      maxCents: 499999, // $4,999.99
      feeCents: 100, // $1.00
      expiryDays: 14,
    },
    {
      label: "Premium",
      minCents: 500000, // $5,000.00
      maxCents: null, // unlimited
      feeCents: 250, // $2.50
      expiryDays: 30,
    },
  ],
};

export function parseListingTiersConfig(raw: unknown): ListingTiersConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_LISTING_TIERS;
  const obj = raw as Partial<ListingTiersConfig>;
  const tiers = Array.isArray(obj.tiers)
    ? obj.tiers
        .filter(
          (t): t is PricingTier =>
            typeof t === "object" &&
            t !== null &&
            typeof t.label === "string" &&
            typeof t.minCents === "number" &&
            (t.maxCents === null || typeof t.maxCents === "number") &&
            typeof t.feeCents === "number" &&
            typeof t.expiryDays === "number"
        )
        .map((t) => ({
          ...t,
          minCents: Math.round(t.minCents),
          maxCents: t.maxCents === null ? null : Math.round(t.maxCents),
          feeCents: Math.round(t.feeCents),
          expiryDays: Math.round(t.expiryDays),
        }))
    : [];

  return {
    currency: "USD",
    tiers: tiers.length > 0 ? tiers : DEFAULT_LISTING_TIERS.tiers,
  };
}

/**
 * The tier whose [minCents, maxCents] range contains the price, or null.
 * There is deliberately no fallback: a price outside every tier (empty, or
 * below the lowest tier's minimum) must never be priced as Premium.
 */
export function findListingTier(
  priceCents: number,
  config: ListingTiersConfig
): PricingTier | null {
  if (!Number.isFinite(priceCents) || priceCents <= 0) return null;
  return (
    config.tiers.find((t) => {
      const aboveMin = priceCents >= t.minCents;
      const belowMax = t.maxCents === null || priceCents <= t.maxCents;
      return aboveMin && belowMax;
    }) ?? null
  );
}

/** Lowest price (cents) that falls in a tier. */
export function minimumTierPriceCents(config: ListingTiersConfig): number {
  return config.tiers.reduce(
    (min, t) => Math.min(min, t.minCents),
    Number.POSITIVE_INFINITY
  );
}

export interface ListingPricing {
  /** False when the price falls in no tier: no fee is computed or payable. */
  priced: boolean;
  /** Null when `priced` is false. */
  tierLabel: string | null;
  baseFeeCents: number;
  feeCents: number;
  commissionBps: number | null;
  commissionAmountCents: number | null;
  totalFeeCents: number;
  expiryDays: number;
  expiresAt: Date;
  currency: string;
  appliedFeeRuleId: string | null;
  monetizationModel: MonetizationModel;
}

export interface CalculateListingPricingOptions {
  monetizationModel?: MonetizationModel;
  listingFeeRule?: FeeRuleInput;
  commissionRule?: FeeRuleInput;
  currency?: string;
}

export function calculateListingPricing(
  priceCents: number,
  config: ListingTiersConfig,
  options: CalculateListingPricingOptions = {},
  referenceDate: Date = new Date()
): ListingPricing {
  const {
    monetizationModel = "fixed_only",
    listingFeeRule,
    commissionRule,
    currency = config.currency,
  } = options;

  const tier = findListingTier(priceCents, config);
  if (!tier) {
    // Unpriced: no tier, no fee. Expiry uses the lowest tier's duration so
    // display / approval paths for older out-of-range listings stay sane;
    // getListingPricing refuses to charge such prices.
    const lowest = [...config.tiers].sort((a, b) => a.minCents - b.minCents)[0];
    const expiryDays = lowest?.expiryDays ?? 7;
    const expiresAt = new Date(referenceDate);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    return {
      priced: false,
      tierLabel: null,
      baseFeeCents: 0,
      feeCents: 0,
      commissionBps: null,
      commissionAmountCents: null,
      totalFeeCents: 0,
      expiryDays,
      expiresAt,
      currency,
      appliedFeeRuleId: null,
      monetizationModel,
    };
  }

  const baseFeeCents = tier.feeCents;

  let feeCents = 0;
  let commissionBps: number | null = null;
  let commissionAmountCents: number | null = null;
  let appliedFeeRuleId: string | null = null;

  if (monetizationModel === "fixed_only" || monetizationModel === "hybrid") {
    if (listingFeeRule?.amount !== undefined) {
      feeCents = listingFeeRule.amount;
      appliedFeeRuleId = listingFeeRule.id ?? null;
    } else {
      feeCents = baseFeeCents;
    }
  }

  if (
    monetizationModel === "commission_only" ||
    monetizationModel === "hybrid"
  ) {
    commissionBps = commissionRule?.percentage ?? 0;
    commissionAmountCents = Math.round((priceCents * commissionBps) / 10_000);
    if (!appliedFeeRuleId && commissionRule?.id) {
      appliedFeeRuleId = commissionRule.id;
    }
  }

  const totalFeeCents = feeCents + (commissionAmountCents ?? 0);

  const expiresAt = new Date(referenceDate);
  expiresAt.setDate(expiresAt.getDate() + tier.expiryDays);

  return {
    priced: true,
    tierLabel: tier.label,
    baseFeeCents,
    feeCents,
    commissionBps,
    commissionAmountCents,
    totalFeeCents,
    expiryDays: tier.expiryDays,
    expiresAt,
    currency,
    appliedFeeRuleId,
    monetizationModel,
  };
}
