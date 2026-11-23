"use server";

import { z } from "zod";
import {
  getListingFeeCents,
  getListingTiersConfig,
  getPlatformMonetizationModel,
  computeListingPricing,
  getPlatformConfig,
  getFeaturedListingFeeCents,
} from "./config.server";

export async function getListingFee() {

  return getListingFeeCents();
}

export async function getFeaturedListingFee() {
return getFeaturedListingFeeCents();
}

export async function getListingTiers() {

  return getListingTiersConfig();
}

export async function getMonetizationModel() {
return getPlatformMonetizationModel();
}

export async function getFeatureToggles() {

    const [
      localPickupEnabled,
      platformShippingEnabled,
      evcEnabled,
      premierWalletEnabled,
      edahabEnabled,
    ] = await Promise.all([
      getPlatformConfig<boolean>("local_pickup_enabled"),
      getPlatformConfig<boolean>("platform_shipping_enabled"),
      getPlatformConfig<boolean>("evc_enabled"),
      getPlatformConfig<boolean>("premier_wallet_enabled"),
      getPlatformConfig<boolean>("edahab_enabled"),
    ]);
    return {
      localPickupEnabled: localPickupEnabled ?? true,
      platformShippingEnabled: platformShippingEnabled ?? true,
      evcEnabled: evcEnabled ?? true,
      premierWalletEnabled: premierWalletEnabled ?? true,
      edahabEnabled: edahabEnabled ?? true,
    };
}

const pricingPreviewSchema = z.object({
  price: z.coerce.number().int().min(0),
  categoryId: z.string().uuid(),
});

export async function getListingPricingPreview(input: { data: unknown }) {
  const data = (pricingPreviewSchema).parse(input.data);
  const base = await computeListingPricing(data.price, data.categoryId);
  const { getCurrentUser } = await import("./auth.server");
  const user = await getCurrentUser();
  if (!user || !base.priced) return base;
  const { getSellerListingPricing } = await import("./seller-pricing.server");
  return getSellerListingPricing(user.id, data.price, data.categoryId);
}
