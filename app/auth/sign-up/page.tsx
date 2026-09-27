import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Sign up | Celis",
  description: "Create your free Celis account and start buying or selling in Somalia.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const value = (await searchParams).role;
  const role = Array.isArray(value) ? value[0] : value;
  return (
    <SignUpForm defaultRole={role === "seller" ? "seller" : "buyer"} />
  );
}
