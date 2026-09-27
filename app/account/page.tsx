import type { Metadata } from "next";
import { getCurrentUserProfile } from "~/server/auth.server";
import { requireNextUser } from "~/lib/require-next-user";
import { AccountForm } from "./account-form";

export const metadata: Metadata = {
  title: "Account settings | Celis",
  description: "Manage your Celis profile, phone number, seller details, and preferences.",
};

export default async function AccountPage() {
  await requireNextUser("/account");
  const profile = await getCurrentUserProfile();
  return <AccountForm profile={profile} />;
}