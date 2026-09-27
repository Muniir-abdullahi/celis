"use client";

import { useRouter } from "next/navigation";
import type { fetchShopListings } from "~/server/listings.functions";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { ListingGrid } from "~/components/listings/listing-grid";
import { Pagination } from "~/components/ui/pagination";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Store, MapPin, CheckCircle2 } from "lucide-react";

type ShopData = NonNullable<Awaited<ReturnType<typeof fetchShopListings>>>;
export function ShopContent({ result, shopSlug }: { result: ShopData; shopSlug: string }) {
  const { seller, listings, total, page, totalPages } = result;
  const router = useRouter();

  const displayName = seller.businessName || seller.displayName || "Shop";

  return (
    <div className="flex min-h-screen flex-col bg-celis-bg">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Card className="mb-8 overflow-hidden border-celis-border bg-celis-surface-base">
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-celis-primary-subtle">
              {seller.businessLogoUrl ? (
                <img
                  src={seller.businessLogoUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-8 w-8 text-celis-primary" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-celis-ink sm:text-3xl">
                  {displayName}
                </h1>
                <Badge variant="secondary" className="capitalize">
                  {seller.sellerType}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-celis-ink-secondary">
                {seller.businessAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {seller.businessAddress}
                  </span>
                )}
                {seller.businessRegistrationNumber && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Reg: {seller.businessRegistrationNumber}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-celis-ink">
            Listings ({total})
          </h2>
        </div>

        <ListingGrid
          listings={listings}
          emptyMessage="This shop has no active listings right now."
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={(p) =>
            router.push(`/shops/${encodeURIComponent(shopSlug)}?page=${p}`)
          }
        />
      </main>

      <SiteFooter />
    </div>
  );
}
