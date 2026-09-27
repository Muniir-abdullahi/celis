import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchShopListings } from "~/server/listings.functions";
import { ShopContent } from "./shop-content";

type RouteProps = {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { shopSlug } = await params;
  const result = await fetchShopListings({ data: { shopSlug, page: 1, limit: 1 } });
  return {
    title: result?.seller.businessName
      ? `${result.seller.businessName} - Celis Shop`
      : "Celis Shop",
  };
}

export default async function ShopPage({ params, searchParams }: RouteProps) {
  const [{ shopSlug }, search] = await Promise.all([params, searchParams]);
  const rawPage = Array.isArray(search.page) ? search.page[0] : search.page;
  const page = Math.max(1, Math.floor(Number(rawPage) || 1));
  const result = await fetchShopListings({
    data: { shopSlug, page, limit: 24 },
  });
  if (!result) notFound();
  return <ShopContent result={result} shopSlug={shopSlug} />;
}