import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Create new password | Celis",
  description: "Create a new password for your Celis account.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
