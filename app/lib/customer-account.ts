import { z } from "zod";

export const customerAccountSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72),
  displayName: z.string().trim().min(2).max(60),
  phone: z.string().regex(/^\+[1-9]\d{6,13}$/, "Use international format, e.g. +252611234567").optional(),
  role: z.enum(["buyer", "seller"]),
  sellerType: z.enum(["individual", "shop"]).default("individual"),
  businessName: z.string().trim().max(120).optional(),
  businessRegistrationNumber: z.string().trim().max(60).optional(),
  businessAddress: z.string().trim().max(500).optional(),
  playReviewer: z.boolean().default(false),
}).strict().superRefine((value, ctx) => {
  if (value.role === "seller" && value.sellerType === "shop" && !value.businessName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businessName"], message: "Shop name is required." });
  }
});

export type CustomerAccountInput = z.infer<typeof customerAccountSchema>;

/** Compensate Auth creation if the local database transaction fails. */
export async function provisionCustomerAccount(
  input: CustomerAccountInput,
  dependencies: {
    createAuth: (input: CustomerAccountInput) => Promise<string>;
    saveCustomer: (id: string, input: CustomerAccountInput) => Promise<void>;
    deleteAuth: (id: string) => Promise<void>;
  },
) {
  const id = await dependencies.createAuth(input);
  try {
    await dependencies.saveCustomer(id, input);
  } catch (error) {
    try {
      await dependencies.deleteAuth(id);
    } catch {
      // Never return credentials or raw database errors in a cleanup failure.
      throw new Error(`Customer setup failed and Auth cleanup failed. Administrator must remove orphan account ${id} before retrying.`);
    }
    throw error;
  }
  return { id, email: input.email, role: input.role, playReviewer: input.playReviewer };
}
