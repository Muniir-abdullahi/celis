import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "~/server/auth.server";
import {
  fetchListingById,
  fetchListingReviews,
  fetchSimilarListings,
} from "~/server/listings.functions";
import { fetchCategoryMetadataSchema } from "~/server/categories.functions";
import { getFeaturedListingFee } from "~/server/config.functions";
import { formatPrice } from "~/lib/format";
import { ListingDetail } from "./listing-detail";

type RouteParams = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const listing = await fetchListingById({ data: { id } });
  if (!listing) return { title: "Listing not found | Celis" };
  const description = `${listing.title} - ${formatPrice(listing.price)} on Celis`;
  return {
    title: `${listing.title} | Celis`,
    description,
    openGraph: {
      title: listing.title,
      description,
      type: "website",
      images: listing.images[0] ? [listing.images[0]] : undefined,
    },
  };
}

export default async function ListingPage({ params }: RouteParams) {
  const { id } = await params;
  const [listing, user] = await Promise.all([
    fetchListingById({ data: { id } }),
    getCurrentUser(),
  ]);
  if (!listing || (listing.status !== "active" && user?.id !== listing.sellerId)) {
    notFound();
  }

  const [reviews, similar, metadataSchema, featuredFeeCents] = await Promise.all([
    fetchListingReviews({ data: { id } }),
    fetchSimilarListings({
      data: { listingId: listing.id, categoryId: listing.categoryId },
    }),
    fetchCategoryMetadataSchema({ data: { categoryId: listing.categoryId } }),
    getFeaturedListingFee(),
  ]);

  return (
    <ListingDetail
      listing={listing}
      reviews={reviews}
      similar={similar}
      metadataSchema={metadataSchema}
      featuredFeeCents={featuredFeeCents}
      user={user}
    />
  );
}