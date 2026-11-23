import { z } from "zod";
import type { PricingTier } from "./pricing";

/** A range identity fails closed when tier boundaries change; labels can be renamed safely. */
export const listingTierKey = (tier: PricingTier) => `${tier.minCents}:${tier.maxCents ?? "*"}`;
export const discountInputSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(2).max(120),
  tierKey: z.string().min(1).max(100), type: z.enum(["percentage", "fixed"]),
  value: z.number().int().min(0).max(100000000),
  listingLimit: z.number().int().min(1).max(100000), durationDays: z.number().int().min(1).max(3650),
});
export type DiscountTerms = z.infer<typeof discountInputSchema> & { tierLabel: string; version: number };
export function discountedFee(regularCents: number, type: "percentage" | "fixed", value: number) {
  if (!Number.isSafeInteger(regularCents) || regularCents < 0 || !Number.isSafeInteger(value) || value < 0 || (type === "percentage" && value > 10000)) throw new Error("Invalid discount amount");
  return Math.max(0, type === "percentage" ? Math.round(regularCents * (10000 - value) / 10000) : regularCents - value);
}
