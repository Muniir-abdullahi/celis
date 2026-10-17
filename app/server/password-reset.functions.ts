"use server";

import { z } from "zod";
import { getSupabaseServerClient } from "~/lib/supabase/server";
import { env } from "~/lib/env";

const requestResetSchema = z.object({
  email: z.string().trim().email().max(254),
});

/** Supabase sends the one-time recovery link using the project's configured SMTP (Brevo). */
export async function requestPasswordReset(input: { data: unknown }) {
  const { email } = requestResetSchema.parse(input.data);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
    redirectTo: `${env.APP_URL}/auth/reset-password`,
  });

  // Keep the response identical for existing and unknown addresses. Provider errors
  // are logged server-side only; never return provider/account details to the caller.
  if (error) console.error("Password recovery request failed", error.message);
  return { ok: true };
}
