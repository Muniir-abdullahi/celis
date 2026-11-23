import { z } from "zod";

export class AdminInputError extends Error {}

export async function adminMutation<T>(operation: () => Promise<T>) {
  try {
    return { success: true as const, data: await operation() };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0]?.message ?? "Check the submitted fields." };
    }
    if (error instanceof AdminInputError) {
      return { success: false as const, error: error.message };
    }
    if (error instanceof Error && ["Unauthorized", "Forbidden"].includes(error.message)) {
      return { success: false as const, error: "You do not have permission to perform this action. Sign in with an authorized account." };
    }
    // Never log input, passwords, provider responses, or database query text.
    console.error("[admin-mutation] Unexpected operation failure");
    return { success: false as const, error: "The operation could not be completed. Please try again or contact support." };
  }
}
