import type { Metadata } from "next";
import { z } from "zod";
import { fetchListings } from "~/server/listings.functions";
import { listCategories } from "~/server/categories.functions";
import { SearchResults } from "./search-results";

export const metadata: Metadata = {
  title: "Search listings | Celis",
  description:
    "Search thousands of local listings on Celis. Find electronics, cars, apartments, and more.",
};

const searchSchema = z.object({
  query: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  condition: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSearch(params: SearchParams) {
  let metadata: Record<string, string> | undefined;
  const rawMetadata = first(params.metadata);
  if (rawMetadata) {
    try {
      const parsed: unknown = JSON.parse(rawMetadata);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Object.values(parsed).every((value) => typeof value === "string")
      ) {
        metadata = parsed as Record<string, string>;
      }
    } catch {
      metadata = undefined;
    }
  }

  const parsed = searchSchema.safeParse({
    query: first(params.query),
    categoryId: first(params.categoryId),
    minPrice: first(params.minPrice),
    maxPrice: first(params.maxPrice),
    condition: first(params.condition),
    metadata,
    sort: first(params.sort),
    page: first(params.page),
  });
  return parsed.success ? parsed.data : searchSchema.parse({});
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = parseSearch(await searchParams);
  const [{ listings, total, page, totalPages }, categories] = await Promise.all([
    fetchListings({
      data: {
        query: search.query,
        categoryId: search.categoryId,
        minPrice: search.minPrice,
        maxPrice: search.maxPrice,
        condition: search.condition,
        metadata: search.metadata,
        sort: search.sort ?? "newest",
        page: search.page ?? 1,
        limit: 24,
      },
    }),
    listCategories(),
  ]);

  return (
    <SearchResults
      result={{ listings, total, page, totalPages }}
      categories={categories}
      search={search}
    />
  );
}
