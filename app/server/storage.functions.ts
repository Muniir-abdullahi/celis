"use server";

import { z } from "zod";
import { createListingImageUploadUrl } from "./storage.server";
import { requireCurrentUser } from "./auth.server";

// Uploads always go to the signed-in user's own folder; a client-sent
// `sellerId` is stripped by zod and never used.
const uploadUrlSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileType: z.string().regex(/^image\//, "Only image files are allowed"),
});

export async function getListingImageUploadUrl(input: { data: unknown }) {
  const data = (uploadUrlSchema).parse(input.data);
  const user = await requireCurrentUser();
  return createListingImageUploadUrl(user.id, data.fileName, data.fileType);
}
