import { getCategoryConditions, getCategoryMetadataSchema } from "./categories.server";
import {
  compactMetadata,
  RESERVED_METADATA_KEYS,
  stripHiddenMetadata,
  validateMetadata,
} from "~/lib/category-metadata";
import type { ListingInput } from "~/lib/validation";

/**
 * Normalize and validate a listing's condition and category details. Shared
 * by create and edit so both enforce the same rules. Mutates `listing`:
 *
 * - `condition` (listings.condition) is the single condition source. It is
 *   required when the category or its nearest ancestor defines options and
 *   must be one of them; otherwise it is cleared.
 * - `metadata` keeps only fields defined for the category (never reserved keys
 *   such as `condition`), drops values of hidden conditional fields and blanks,
 *   then is validated (required-when-visible, options, number rules).
 *
 * Throws an Error with a readable message when validation fails.
 */
export async function prepareListingDetails(listing: ListingInput): Promise<void> {
  const [metadataSchema, conditions] = await Promise.all([
    getCategoryMetadataSchema(listing.categoryId),
    getCategoryConditions(listing.categoryId),
  ]);

  if (conditions.length > 0) {
    if (!listing.condition) {
      throw new Error("Condition is required");
    }
    if (!conditions.some((c) => c.code === listing.condition)) {
      throw new Error("Condition is invalid for this category");
    }
  } else {
    listing.condition = null;
  }
  const context = { condition: listing.condition ?? null };

  const allowedKeys = metadataSchema
    ? new Set(metadataSchema.fields.map((f) => f.key))
    : null;
  listing.metadata = compactMetadata(
    stripHiddenMetadata(
      metadataSchema,
      Object.fromEntries(
        Object.entries(listing.metadata).filter(
          ([key]) =>
            !RESERVED_METADATA_KEYS.has(key) && (!allowedKeys || allowedKeys.has(key))
        )
      ),
      context
    )
  );

  const metadataErrors = validateMetadata(metadataSchema, listing.metadata, context);
  if (Object.keys(metadataErrors).length > 0) {
    throw new Error(Object.values(metadataErrors).join("; "));
  }
}
