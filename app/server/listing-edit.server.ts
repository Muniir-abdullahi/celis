import { and, eq } from "drizzle-orm";
import { db } from "~/db";
import { auditLogs, categories, listings, listingFeeCheckouts } from "~/db/schema";
import { CelisError } from "~/lib/errors";
import {
  changedListingFields,
  checkPaidPriceTier,
  isListingEditable,
  statusAfterEdit,
} from "~/lib/listing-edit";
import { formatPrice } from "~/lib/format";
import { monetizationTypeForModel } from "~/lib/pricing";
import type { ListingInput } from "~/lib/validation";
import type { EditableListing } from "~/lib/listing-edit";

export type { EditableListing };
import { getSellerListingPricing } from "./seller-pricing.server";
import { getSellerListingEligibility } from "./seller-packages.server";

function assertEditable(
  listing: { sellerId: string; status: string } | undefined,
  sellerId: string
) {
  if (!listing) {
    throw new CelisError("Listing not found", "LISTING_NOT_FOUND", 404);
  }
  if (listing.sellerId !== sellerId) {
    throw new CelisError("Forbidden", "FORBIDDEN", 403);
  }
  if (!isListingEditable(listing.status)) {
    throw new CelisError(
      `A ${listing.status.replace(/_/g, " ")} listing can't be edited.`,
      "LISTING_NOT_EDITABLE",
      400
    );
  }
}

export async function getSellerListingForEdit(
  listingId: string,
  sellerId: string
): Promise<EditableListing> {
  const [row] = await db
    .select({
      id: listings.id,
      sellerId: listings.sellerId,
      title: listings.title,
      description: listings.description,
      categoryId: listings.categoryId,
      parentCategoryId: categories.parentId,
      condition: listings.condition,
      price: listings.price,
      deliveryMethod: listings.deliveryMethod,
      images: listings.images,
      metadata: listings.metadata,
      status: listings.status,
      monetizationStatus: listings.monetizationStatus,
    })
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(eq(listings.id, listingId))
    .limit(1);
  assertEditable(row, sellerId);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    parentCategoryId: row.parentCategoryId,
    condition: row.condition,
    price: row.price,
    deliveryMethod: row.deliveryMethod,
    images: row.images,
    metadata: (row.metadata as ListingInput["metadata"]) ?? {},
    status: row.status,
    monetizationStatus: row.monetizationStatus,
  };
}

/**
 * Apply a seller's edit. `input` must already have passed
 * `prepareListingDetails`. Runs in one transaction with an audit entry so a
 * moderator can see what changed and why the listing returned to review.
 */
export async function updateSellerListing(
  listingId: string,
  sellerId: string,
  input: ListingInput
) {
  const eligibility = await getSellerListingEligibility(sellerId);
  const pricing = await getSellerListingPricing(
    sellerId,
    input.price,
    input.categoryId,
    eligibility
  );

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1)
      .for("update");
    assertEditable(current, sellerId);
    const [checkout] = await tx.select().from(listingFeeCheckouts).where(eq(listingFeeCheckouts.listingId, listingId)).limit(1);
    if (checkout && ["processing", "pending_reconciliation"].includes(checkout.status)) {
      throw new CelisError("A payment is in progress for this listing. Wait for reconciliation before editing it.", "LISTING_PAYMENT_IN_PROGRESS", 409);
    }
    const status = current.status as Parameters<typeof statusAfterEdit>[0];

    if (input.categoryId !== current.categoryId) {
      throw new CelisError(
        "The category can't be changed. Create a new listing instead.",
        "CATEGORY_LOCKED",
        400
      );
    }

    // A paid per-listing fee covers its tier only.
    const feePaid =
      (eligibility.requiresPayment || checkout?.status === "completed") && current.monetizationStatus === "active";
    const tier = checkPaidPriceTier({
      feePaid,
      paidFeeCents: checkout?.status === "completed" ? checkout.regularFeeCents : current.feeAmountCents,
      newFeeCents: checkout?.status === "completed" ? pricing.standardFeeCents ?? pricing.feeCents : pricing.feeCents,
    });
    if (!tier.ok) {
      throw new CelisError(
        `This price falls in a higher fee tier (${formatPrice(tier.newFeeCents)}) than the ${formatPrice(tier.paidFeeCents)} you paid. Keep the price in your current tier or create a new listing.`,
        "PRICE_TIER_CHANGED",
        400,
        { paidFeeCents: tier.paidFeeCents, newFeeCents: tier.newFeeCents }
      );
    }

    const images = input.images.map((i) => i.url);
    const nextStatus = statusAfterEdit(status, current.monetizationStatus);
    const changed = changedListingFields(
      {
        title: current.title,
        description: current.description,
        condition: current.condition,
        price: current.price,
        deliveryMethod: current.deliveryMethod,
        images: current.images,
        metadata: current.metadata,
      },
      {
        title: input.title,
        description: input.description,
        condition: input.condition ?? null,
        price: input.price,
        deliveryMethod: input.deliveryMethod,
        images,
        metadata: input.metadata,
      }
    );

    // Unpaid listings are re-priced like a new listing; paid ones keep the
    // fee snapshot they were charged.
    const repricing =
      current.monetizationStatus === "pending_paid"
        ? {
            feeAmountCents: pricing.feeCents,
            commissionBps: pricing.commissionBps,
            appliedFeeRuleId: pricing.appliedFeeRuleId,
            currency: pricing.currency,
            expiresAt: pricing.expiresAt,
            monetizationType: monetizationTypeForModel(pricing.monetizationModel),
          }
        : {};

    const [updated] = await tx
      .update(listings)
      .set({
        title: input.title,
        description: input.description,
        condition: input.condition ?? null,
        price: input.price,
        deliveryMethod: input.deliveryMethod,
        images,
        metadata: input.metadata,
        status: nextStatus,
        ...repricing,
        updatedAt: new Date(),
      })
      .where(and(eq(listings.id, listingId), eq(listings.sellerId, sellerId)))
      .returning({ id: listings.id, status: listings.status });

    await tx.insert(auditLogs).values({
      actorId: sellerId,
      action: "listing.seller_edit",
      resourceType: "listing",
      resourceId: listingId,
      metadata: {
        previousStatus: current.status,
        newStatus: nextStatus,
        changedFields: changed.join(","),
        reason:
          current.status === nextStatus
            ? "seller edit"
            : `seller edit of ${current.status} listing requires review`,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      previousStatus: current.status,
      changedFields: changed,
      feeCents: pricing.totalFeeCents,
    };
  });
}
