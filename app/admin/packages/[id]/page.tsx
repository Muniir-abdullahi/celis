import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchAdminPackageDetail } from "~/server/admin.functions";
import { isCelisError } from "~/lib/errors";
import { PackageDetailContent } from "./package-detail";

export const metadata: Metadata = {
  title: "Package details | Admin | Celis",
  robots: { index: false, follow: false },
};

const FILTERS = ["active", "expired", "cancelled", "all"] as const;

export default async function AdminPackageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rawStatus = first(sp.status);
  const filter = (FILTERS as readonly string[]).includes(rawStatus ?? "")
    ? (rawStatus as (typeof FILTERS)[number])
    : "active";
  const page = Math.max(1, Math.floor(Number(first(sp.page)) || 1));
  const search = (first(sp.q) ?? "").slice(0, 120);

  let data;
  try {
    data = await fetchAdminPackageDetail({
      data: { packageId: id, filter, search, page, limit: 20 },
    });
  } catch (err) {
    if (isCelisError(err) && err.code === "PACKAGE_NOT_FOUND") notFound();
    // Invalid id (zod) also means there is nothing to show.
    if (err instanceof Error && err.name === "ZodError") notFound();
    throw err;
  }

  return <PackageDetailContent data={data} />;
}
