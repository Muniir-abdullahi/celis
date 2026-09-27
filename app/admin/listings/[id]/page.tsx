import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchListingById } from "~/server/listings.functions";
import { AdminListingDetail } from "./listing-detail";

export const metadata: Metadata = {
  title: "Listing details | Admin | Celis",
  robots: { index: false, follow: false },
};

export default async function AdminListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let listing;
  try {
    listing = await fetchListingById({ data: { id } });
  } catch {
    notFound();
  }
  if (!listing) notFound();
  return <AdminListingDetail listing={listing} />;
}
