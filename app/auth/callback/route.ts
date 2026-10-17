import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "~/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL("/auth/reset-password", request.url);

  if (!code) {
    destination.searchParams.set("error", "recovery");
    return NextResponse.redirect(destination);
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) destination.searchParams.set("error", "recovery");
  return NextResponse.redirect(destination);
}
