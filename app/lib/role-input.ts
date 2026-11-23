import { z } from "zod";

export const roleKeySchema = z.string().trim().toLowerCase()
  .transform((value) => value.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""))
  .pipe(z.string().min(2, "Role key must contain at least two letters or numbers.").max(60));

export const roleInputSchema = z.object({
  key: roleKeySchema,
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  domain: z.enum(["customer", "internal"]).default("internal"),
}).strict();
