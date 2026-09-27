import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { ListingGrid } from "~/components/listings/listing-grid";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { fetchFeaturedListings } from "~/server/listings.functions";
import { listCategories } from "~/server/categories.functions";

export const metadata: Metadata = {
  title: "Browse listings | Celis",
  description:
    "Discover local deals on electronics, vehicles, property, fashion, and more in Somalia.",
};

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const [featured, categories] = await Promise.all([
    fetchFeaturedListings(),
    listCategories(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-celis-bg">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-celis-border bg-celis-surface-base px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-celis-ink sm:text-5xl">
              Buy and sell in Somalia
            </h1>
            <p className="mt-4 text-lg text-celis-ink-secondary">
              Discover local deals on electronics, vehicles, property, fashion,
              and more.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/search">Browse listings</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sell">Sell an item</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10">
          <h2 className="mb-4 text-xl font-semibold">Browse categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/search?categoryId=${encodeURIComponent(category.id)}`}
              >
                <Badge variant="secondary" className="cursor-pointer">
                  {category.name}
                </Badge>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Fresh listings</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/search">View all</Link>
            </Button>
          </div>
          <ListingGrid listings={featured} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
