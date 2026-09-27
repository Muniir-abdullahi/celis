"use server";

import { z } from "zod";
import { createListingImageUploadUrl } from "./storage.server";

const uploadUrlSchema = z.object({
  sellerId: z.string().uuid(),
  fileName: z.string().min(1),
  fileType: z.string().regex(/^image\//, "Only image files are allowed"),
});

export async function getListingImageUploadUrl(input: { data: unknown }) {
  const data = (uploadUrlSchema).parse(input.data);

    return createListingImageUploadUrl(data.sellerId, data.fileName, data.fileType);
}
