import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "~/components/admin/admin-shell";
import { getCurrentUser } from "~/server/auth.server";
import { fetchCurrentUserPermissions } from "~/server/auth.functions";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin | Celis",
  description: "Celis admin dashboard.",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [user, permissions] = await Promise.all([
    getCurrentUser(),
    fetchCurrentUserPermissions(),
  ]);
  if (!user || !(user.isInternal || permissions.includes("admin:access"))) {
    redirect("/");
  }
  return <AdminShell permissions={permissions}>{children}</AdminShell>;
}