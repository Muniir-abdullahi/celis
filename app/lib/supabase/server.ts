import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "../env";
import type { Database } from "./database.types";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, {
              ...options,
              sameSite: options?.sameSite ?? "lax",
            });
          }
        } catch {
          // Session cookies can only be changed in a Server Action or Route
          // Handler; read-only Server Component rendering cannot refresh them.
        }
      },
    },
  });
}

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;

export function getServiceSupabase() {
  if (!serviceClient) {
    serviceClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return serviceClient;
}
