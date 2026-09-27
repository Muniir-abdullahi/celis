import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "~/components/landing-page";
import { fetchFeaturedListings } from "~/server/listings.functions";
import {
  listCategories,
  fetchCategoryCounts,
  fetchPriceRange,
} from "~/server/categories.functions";

export const Route = createFileRoute("/")({
  component: LegacyLandingPage,
  head: () => ({
    meta: [
      { title: "Celis — Buy & sell anything in Somalia" },
      {
        name: "description",
        content:
          "Somalia's fastest growing P2P marketplace. Discover local deals on electronics, vehicles, property, fashion, livestock, and more.",
      },
    ],
  }),
  loader: async () => {
    const [featured, categories, counts, priceRange] = await Promise.all([
      fetchFeaturedListings(),
      listCategories(),
      fetchCategoryCounts(),
      fetchPriceRange(),
    ]);
    return { featured, categories, counts, priceRange };
  },
});

function LegacyLandingPage() {
  const data = Route.useLoaderData();
  return <LandingPage {...data} />;
}