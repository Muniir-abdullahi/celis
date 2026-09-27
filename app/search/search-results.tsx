"use client";

import { useRouter } from "next/navigation";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { ListingGrid } from "~/components/listings/listing-grid";
import {
  SearchFilters,
  type SearchFiltersState,
} from "~/components/listings/search-filters";
import { Button } from "~/components/ui/button";
import type { CategoryListItem } from "~/server/categories.functions";
import type { ListingPublic } from "~/server/listings.server";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SearchResultsProps {
  result: {
    listings: ListingPublic[];
    total: number;
    page: number;
    totalPages: number;
  };
  categories: CategoryListItem[];
  search: {
    query?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    metadata?: Record<string, string>;
    sort?: "newest" | "price_asc" | "price_desc";
    page?: number;
  };
}

export function SearchResults({ result, categories, search }: SearchResultsProps) {
  const router = useRouter();
  const initialFilters: SearchFiltersState = {
    query: search.query ?? "",
    categoryId: search.categoryId ?? "",
    minPrice: search.minPrice?.toString() ?? "",
    maxPrice: search.maxPrice?.toString() ?? "",
    condition: search.condition ?? "",
    metadata: search.metadata ?? {},
    sort: search.sort ?? "newest",
  };

  const updateSearch = (filters: SearchFiltersState, page: number) => {
    const params = new URLSearchParams();
    if (filters.query) params.set("query", filters.query);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.condition) params.set("condition", filters.condition);
    if (Object.keys(filters.metadata).length) {
      params.set("metadata", JSON.stringify(filters.metadata));
    }
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    if (page > 1) params.set("page", String(page));
    router.push(`/search${params.size ? `?${params}` : ""}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-celis-bg">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Browse listings</h1>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside>
            <SearchFilters
              categories={categories}
              initial={initialFilters}
              onSearch={(filters) => updateSearch(filters, 1)}
            />
          </aside>
          <section className="space-y-6">
            <div className="flex items-center justify-between text-sm text-celis-ink-secondary">
              <span>
                {result.total} result{result.total === 1 ? "" : "s"}
              </span>
              <span>
                Page {result.page} of {result.totalPages}
              </span>
            </div>
            <ListingGrid
              listings={result.listings}
              emptyMessage="No listings match your search."
            />
            {result.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1}
                  onClick={() => updateSearch(initialFilters, result.page - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-celis-ink-secondary">
                  {result.page} / {result.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page >= result.totalPages}
                  onClick={() => updateSearch(initialFilters, result.page + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
