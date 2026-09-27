import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password | Celis",
  description: "Reset your Celis account password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}