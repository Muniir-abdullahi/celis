import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { ListingWizard } from "~/components/listings/listing-wizard";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "~/server/auth.server";
import { listCategories } from "~/server/categories.functions";
import {
  getFeatureToggles,
  getListingTiers,
  getMonetizationModel,
} from "~/server/config.functions";

export const metadata: Metadata = {
  title: "Sell an item | Celis",
  description: "List your item for sale on Celis and reach buyers across Somalia.",
};

export default async function SellPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?redirect=%2Fsell");

  const [categories, tiersConfig, monetizationModel, featureToggles] =
    await Promise.all([
      listCategories(),
      getListingTiers(),
      getMonetizationModel(),
      getFeatureToggles(),
    ]);

  return (
    <div className="flex min-h-screen flex-col bg-celis-bg">
      <SiteHeader showSearch={false} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Sell an item</h1>
          <span className="text-sm text-celis-ink-secondary">
            Tiered listing fee applies on publish
          </span>
        </div>
        {!user.phone ? (
          <Card className="border-celis-caution bg-celis-caution-subtle">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-celis-caution" />
              <div>
                <h2 className="text-lg font-semibold text-celis-ink">
                  Phone number required
                </h2>
                <p className="mt-1 max-w-sm text-sm text-celis-ink-secondary">
                  Buyers will use your phone number to contact you. Add it to
                  your account before listing an item.
                </p>
              </div>
              <Button asChild>
                <Link href="/account?redirect=%2Fsell">Add phone number</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ListingWizard
            sellerId={user.id}
            categories={categories}
            tiersConfig={tiersConfig}
            monetizationModel={monetizationModel}
            featureToggles={featureToggles}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
