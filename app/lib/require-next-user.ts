import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "~/server/auth.server";

export async function requireNextUser(path: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/sign-in?redirect=${encodeURIComponent(path)}`);
  }
  return user;
}
