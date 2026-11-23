import { getDiscountAdminData } from "~/server/discount-packages.server";
import { DiscountPackagesContent } from "./discount-packages-content";

export default async function DiscountPackagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const page = Math.max(1, Math.floor(Number(first(raw.page)) || 1));
  const status = first(raw.status);
  const data = await getDiscountAdminData({ page, q: (first(raw.q) ?? "").slice(0, 120), status: ["active", "expired", "cancelled", "all"].includes(status ?? "") ? status : "active", packageId: first(raw.packageId) || undefined });
  return <DiscountPackagesContent data={data} />;
}
