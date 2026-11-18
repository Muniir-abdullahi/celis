"use server";

import { z } from "zod";
import { listingSchema } from "~/lib/validation";
import {
  insertDraftListing,
  getListingById,
  searchListings,
  getFeaturedListings,
  getSellerListings,
  deleteListing,
  deactivateListing,
  reactivateListing,
  markListingAsSold,
  getListingReviews,
  insertListingReview,
  submitShopListingForReview,
  type SearchListingsFilters,
} from "./listings.server";
import {
  getSellerListingEligibility,
  getCurrentSellerSubscription,
} from "./seller-packages.server";
import { prepareListingDetails } from "./listing-details.server";
import { monetizationTypeForModel } from "~/lib/pricing";
import { requireCurrentUser } from "./auth.server";

// Seller-scoped actions always act as the signed-in user. Older clients may
// still send a `sellerId`; zod strips it and it is never used.

const createListingSchema = z.object({
  listing: listingSchema,
});

const submitShopSchema = z.object({
  listingId: z.string().uuid(),
});

export async function fetchSellerListingEligibility() {
  const user = await requireCurrentUser();
  return getSellerListingEligibility(user.id);
}

export async function submitShopListing(input: { data: unknown }) {
  const data = (submitShopSchema).parse(input.data);
  const user = await requireCurrentUser();
  await submitShopListingForReview(data.listingId, user.id);
  const { insertAuditLog } = await import("./audit.server");
  await insertAuditLog({
    action: "listing_submitted_with_package",
    resourceType: "listing",
    resourceId: data.listingId,
    metadata: { reason: "listing fee covered by package" },
  });
  return { success: true, id: data.listingId };
}

const shopSlugSchema = z.object({
  shopSlug: z.string().min(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
});

export async function fetchShopListings(input: { data: unknown }) {
  const data = (shopSlugSchema).parse(input.data);

    const { getShopListings } = await import("./listings.server");
    return getShopListings(data.shopSlug, {
      page: data.page,
      limit: data.limit,
    });
}

export async function fetchCurrentSellerSubscription() {

  const { getCurrentUser } = await import("./auth.server");
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return getCurrentSellerSubscription(user.id);
}

export async function createListing(input: { data: unknown }) {
  const data = (createListingSchema).parse(input.data);

    const user = await requireCurrentUser();
    if (!user.phone) {
      throw new Error("Add a phone number to your account before listing an item.");
    }
    // Condition + category details: same rules as editing.
    await prepareListingDetails(data.listing);

    // Pricing (and the listing type) come from admin configuration, never
    // from the seller.
    // Package sellers pay no listing fee; others get the strict tier fee.
    const { getSellerListingPricing } = await import("./seller-pricing.server");
    const pricing = await getSellerListingPricing(
      user.id,
      data.listing.price,
      data.listing.categoryId
    );
    const listing = await insertDraftListing(
      user.id,
      data.listing,
      monetizationTypeForModel(pricing.monetizationModel)
    );

    const { updateListingFees } = await import("./listings.server");
    await updateListingFees(listing.id, pricing);

    const { insertAuditLog } = await import("./audit.server");
    await insertAuditLog({
      action: "listing_created",
      resourceType: "listing",
      resourceId: listing.id,
      metadata: {
        priceCents: data.listing.price,
        feeCents: pricing.feeCents,
        coveredByPackage: pricing.coveredByPackage,
      },
    });

    return {
      id: listing.id,
      status: listing.status,
      feeCents: pricing.totalFeeCents,
      expiresAt: pricing.expiresAt.toISOString(),
    };
}

const listingIdSchema = z.object({ id: z.string().uuid() });

export async function fetchListingById(input: { data: unknown }) {
  const data = (listingIdSchema).parse(input.data);

    return getListingById(data.id);
}

const similarListingsSchema = z.object({
  listingId: z.string().uuid(),
  categoryId: z.string().uuid(),
});

export async function fetchSimilarListings(input: { data: unknown }) {
  const data = (similarListingsSchema).parse(input.data);

    const { getSimilarListings } = await import("./listings.server");
    return getSimilarListings(data.listingId, data.categoryId);
}

const searchSchema = z.object({
  query: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  condition: z.string().max(100).optional(),
  metadata: z.record(z.string()).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function fetchListings(input: { data: unknown }) {
  const data = (searchSchema).parse(input.data);

    return searchListings(data as SearchListingsFilters);
}

export async function fetchFeaturedListings() {

    return getFeaturedListings(8);
}

const sellerListingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export async function fetchSellerListings(input: { data: unknown }) {
  const data = (sellerListingsQuerySchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return getSellerListings(user.id, data);
}

const listingActionSchema = z.object({ id: z.string().uuid() });

export async function removeListing(input: { data: unknown }) {
  const data = (listingActionSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    const deleted = await deleteListing(data.id, user.id);
    return { success: !!deleted, id: deleted?.id };
}

export async function deactivateSellerListing(input: { data: unknown }) {
  const data = (listingActionSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    const updated = await deactivateListing(data.id, user.id);
    return { success: !!updated, id: updated?.id, status: updated?.status };
}

export async function reactivateSellerListing(input: { data: unknown }) {
  const data = (listingActionSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    const updated = await reactivateListing(data.id, user.id);
    return { success: !!updated, id: updated?.id, status: updated?.status };
}

const markSoldSchema = z.object({ id: z.string().uuid(), orderId: z.string().uuid().optional() });

export async function markSellerListingSold(input: { data: unknown }) {
  const data = (markSoldSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    const updated = await markListingAsSold(data.id, user.id, data.orderId);
    return { success: !!updated, id: updated?.id, status: updated?.status };
}

export async function fetchListingReviews(input: { data: unknown }) {
  const data = (listingIdSchema).parse(input.data);

    return getListingReviews(data.id);
}

const createReviewSchema = z.object({
  listingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function createListingReview(input: { data: unknown }) {
  const data = (createReviewSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return insertListingReview({
      listingId: data.listingId,
      reviewerId: user.id,
      rating: data.rating,
      comment: data.comment,
    });
}
