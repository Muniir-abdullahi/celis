import type { Metadata } from "next";
import { LandingPage } from "~/components/landing-page";
import { fetchFeaturedListings } from "~/server/listings.functions";
import {
  fetchCategoryCounts,
  fetchPriceRange,
  listCategories,
} from "~/server/categories.functions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Celis — Buy & sell anything in Somalia",
  description:
    "Somalia's fastest growing P2P marketplace. Discover local deals on electronics, vehicles, property, fashion, livestock, and more.",
};

export default async function HomePage() {
  const [featured, categories, counts, priceRange] = await Promise.all([
    fetchFeaturedListings(),
    listCategories(),
    fetchCategoryCounts(),
    fetchPriceRange(),
  ]);

  return (
    <LandingPage
      featured={featured}
      categories={categories}
      counts={counts}
      priceRange={priceRange}
    />
  );
}
