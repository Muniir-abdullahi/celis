"use server";

import { z } from "zod";
import { listingSchema } from "~/lib/validation";
import { getCurrentUser } from "./auth.server";
import { prepareListingDetails } from "./listing-details.server";
import { updateSellerListing } from "./listing-edit.server";

const updateListingSchema = z.object({
  id: z.string().uuid(),
  listing: listingSchema,
});

/**
 * Seller edit of their own listing. The seller is always the signed-in user;
 * no seller id is accepted from the client.
 */
export async function updateListing(input: { data: unknown }) {
  const data = updateListingSchema.parse(input.data);
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await prepareListingDetails(data.listing);
  return updateSellerListing(data.id, user.id, data.listing);
}
