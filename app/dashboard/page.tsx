import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "~/server/auth.server";
import { fetchSellerListings } from "~/server/listings.functions";
import { getFeaturedListingFee } from "~/server/config.functions";
import { DashboardContent } from "./dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard | Celis",
  description: "Manage your listings, orders, and seller package from your Celis dashboard.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?redirect=%2Fdashboard");
  if (user.isInternal || user.role === "admin") redirect("/admin");

  const value = (await searchParams).page;
  const page = Math.max(1, Math.floor(Number(Array.isArray(value) ? value[0] : value) || 1));
  const [data, featuredFeeCents] = await Promise.all([
    fetchSellerListings({ data: { page, limit: 10 } }),
    getFeaturedListingFee(),
  ]);

  return (
    <DashboardContent
      user={user}
      data={{ ...data, featuredFeeCents }}
    />
  );
}