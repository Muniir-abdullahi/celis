import { z } from "zod";
import { AdminInputError } from "./admin-mutation";

export const internalAccountSchema = z.object({
  fullName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72),
  role: z.string().trim().min(1).max(60),
  department: z.string().trim().max(100).optional(),
}).strict();

export type InternalAccountInput = z.infer<typeof internalAccountSchema>;

export async function provisionInternalAccount(input: InternalAccountInput, dependencies: {
  isInternalRole: (role: string) => Promise<boolean>;
  createAuth: (input: InternalAccountInput) => Promise<string>;
  saveAccount: (id: string, input: InternalAccountInput) => Promise<void>;
  deleteAuth: (id: string) => Promise<void>;
}) {
  if (!(await dependencies.isInternalRole(input.role))) {
    throw new AdminInputError("Select an existing internal staff role.");
  }
  const id = await dependencies.createAuth(input);
  try {
    await dependencies.saveAccount(id, input);
  } catch (error) {
    try {
      await dependencies.deleteAuth(id);
    } catch {
      throw new AdminInputError(`Account setup failed and cleanup could not complete. Ask support to remove the orphan account ${id} before retrying.`);
    }
    throw error;
  }
  return { id, email: input.email };
}
