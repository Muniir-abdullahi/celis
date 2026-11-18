import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchListingById } from "~/server/listings.functions";
import { fetchListingAuditLogs } from "~/server/admin.functions";
import { AdminListingDetail } from "./listing-detail";
import { ListingActivity } from "./listing-activity";

export const metadata: Metadata = {
  title: "Listing details | Admin | Celis",
  robots: { index: false, follow: false },
};

export default async function AdminListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activity?: string | string[] }>;
}) {
  const { id } = await params;
  const raw = (await searchParams).activity;
  const activityPage = Math.max(
    1,
    Math.floor(Number(Array.isArray(raw) ? raw[0] : raw) || 1)
  );

  let listing;
  try {
    listing = await fetchListingById({ data: { id } });
  } catch {
    notFound();
  }
  if (!listing) notFound();

  // Staff without audit:read still see the listing, just not its activity.
  const activity = await fetchListingAuditLogs({
    data: { listingId: id, page: activityPage, limit: 10 },
  }).catch(() => null);

  return (
    <div className="space-y-6">
      <AdminListingDetail listing={listing} />
      {activity && <ListingActivity data={activity} />}
    </div>
  );
}
