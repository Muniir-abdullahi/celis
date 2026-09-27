import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in | Celis",
  description: "Sign in to your Celis account to buy, sell, and manage listings.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const value = (await searchParams).redirect;
  return <SignInForm redirect={Array.isArray(value) ? value[0] : value} />;
}