import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { ListingWizard } from "~/components/listings/listing-wizard";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "~/server/auth.server";
import { getSellerListingForEdit } from "~/server/listing-edit.server";
import { listCategories } from "~/server/categories.functions";
import {
  getFeatureToggles,
  getListingTiers,
  getMonetizationModel,
} from "~/server/config.functions";
import { isCelisError } from "~/lib/errors";

export const metadata: Metadata = {
  title: "Edit listing | Celis",
  robots: { index: false },
};

type RouteParams = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/sign-in?redirect=${encodeURIComponent(`/listings/${id}/edit`)}`);
  }

  let listing;
  let blockedReason: string | null = null;
  try {
    listing = await getSellerListingForEdit(id, user.id);
  } catch (err) {
    // Missing listings and other sellers' listings look the same: not found.
    if (!isCelisError(err) || err.code !== "LISTING_NOT_EDITABLE") notFound();
    blockedReason = err.message;
  }

  const [categories, tiersConfig, monetizationModel, featureToggles] = listing
    ? await Promise.all([
        listCategories(),
        getListingTiers(),
        getMonetizationModel(),
        getFeatureToggles(),
      ])
    : [null, null, null, null];

  return (
    <div className="flex min-h-screen flex-col bg-celis-bg">
      <SiteHeader showSearch={false} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Edit listing</h1>
          <Link
            href={`/listings/${id}`}
            className="text-sm text-celis-primary underline-offset-2 hover:underline"
          >
            View listing
          </Link>
        </div>
        {listing && categories && tiersConfig && monetizationModel && featureToggles ? (
          <ListingWizard
            sellerId={user.id}
            categories={categories}
            tiersConfig={tiersConfig}
            monetizationModel={monetizationModel}
            featureToggles={featureToggles}
            editListing={listing}
          />
        ) : (
          <Card className="border-celis-caution bg-celis-caution-subtle">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-celis-caution" />
              <div>
                <h2 className="text-lg font-semibold text-celis-ink">
                  This listing can&apos;t be edited
                </h2>
                <p className="mt-1 max-w-sm text-sm text-celis-ink-secondary">
                  {blockedReason} Sold, expired, suspended and deactivated listings
                  stay as they are; create a new listing instead.
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
