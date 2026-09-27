import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { PageHeader } from "~/components/admin/page-header";
import { ListingStatusBadge } from "~/components/admin/status-badge";
import { fetchListingById } from "~/server/listings.functions";
import { formatPrice, formatRelativeDate } from "~/lib/format";
import { getOptimizedImageUrl } from "~/lib/images";
import { ArrowLeft, ExternalLink } from "lucide-react";

type Listing = NonNullable<Awaited<ReturnType<typeof fetchListingById>>>;

export function AdminListingDetail({ listing }: { listing: Listing }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={listing.title}
        description={`${listing.sellerName ?? "Seller"} - ${listing.categoryName}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/listings">
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Link>
            </Button>
            {listing.status === "active" && (
              <Button asChild>
                <Link href={`/listings/${listing.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />Public page
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="border-celis-border bg-celis-surface-base">
          <CardHeader><CardTitle className="text-lg">Listing media</CardTitle></CardHeader>
          <CardContent>
            {listing.images.length === 0 ? (
              <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-celis-border text-sm text-celis-ink-secondary">
                No images uploaded
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {listing.images.map((src, index) => (
                  <img key={`${src}-${index}`} src={getOptimizedImageUrl(src, { width: 720, height: 540, quality: 80 })}
                    alt={`${listing.title} image ${index + 1}`} className="aspect-[4/3] w-full rounded-md border border-celis-border object-cover" loading="lazy" decoding="async" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-celis-border bg-celis-surface-base">
            <CardHeader><CardTitle className="text-lg">Moderation</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <DetailRow label="Status"><ListingStatusBadge status={listing.status} /></DetailRow>
              <DetailRow label="Posted">{formatRelativeDate(listing.createdAt)}</DetailRow>
              <DetailRow label="Reviewed">{listing.reviewedAt ? formatRelativeDate(listing.reviewedAt) : "Not reviewed"}</DetailRow>
              {listing.rejectionReason && <div className="rounded-md border border-celis-destructive/30 bg-celis-destructive-subtle p-3 text-celis-destructive">{listing.rejectionReason}</div>}
            </CardContent>
          </Card>
          <Card className="border-celis-border bg-celis-surface-base">
            <CardHeader><CardTitle className="text-lg">Price and delivery</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <DetailRow label="Price"><span className="font-semibold">{formatPrice(listing.price)}</span></DetailRow>
              <DetailRow label="Condition"><Badge variant="secondary">{listing.condition?.replace(/_/g, " ") ?? "N/A"}</Badge></DetailRow>
              <DetailRow label="Delivery">{listing.deliveryMethod.replace(/_/g, " ")}</DetailRow>
              <DetailRow label="Monetization">{listing.monetizationType.replace(/_/g, " ")}</DetailRow>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-celis-border bg-celis-surface-base">
        <CardHeader><CardTitle className="text-lg">Description</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap text-sm text-celis-ink-secondary">{listing.description}</p></CardContent>
      </Card>

      <Card className="border-celis-border bg-celis-surface-base">
        <CardHeader><CardTitle className="text-lg">Seller</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <SellerField label="Name">{listing.sellerName ?? "Unknown"}</SellerField>
          <SellerField label="Phone">{listing.sellerPhone ?? "Not set"}</SellerField>
          <SellerField label="Type">{listing.sellerType}</SellerField>
          <SellerField label="Verified">{listing.sellerVerified ? "Yes" : "No"}</SellerField>
          {listing.businessName && <SellerField label="Business" className="sm:col-span-2">{listing.businessName}</SellerField>}
          {listing.businessAddress && <SellerField label="Business address" className="sm:col-span-2">{listing.businessAddress}</SellerField>}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-celis-ink-secondary">{label}</span><span>{children}</span></div>;
}

function SellerField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className}><p className="text-celis-ink-secondary">{label}</p><p className="font-medium">{children}</p></div>;
}
