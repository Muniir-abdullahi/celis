import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Sellers with an active package must not be asked for, or charged, a
// listing fee — shops and individual sellers alike.

const read = (f: string) => readFileSync(f, "utf8");
const packages = read("app/server/seller-packages.server.ts");
const sellerPricing = read("app/server/seller-pricing.server.ts");
const listingsServer = read("app/server/listings.server.ts");
const listingsFns = read("app/server/listings.functions.ts");
const editServer = read("app/server/listing-edit.server.ts");
const paymentsFns = read("app/server/payments.functions.ts");
const mobileRoute = read("app/api/mobile/payments/listing-fee/route.ts");
const wizard = read("app/components/listings/listing-wizard.tsx");

function fnBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("an active package covers fees for individual sellers too", () => {
  const body = fnBody(packages, "getSellerListingEligibility");
  // The subscription is loaded before the individual pay-per-listing branch.
  assert.ok(body.indexOf("getActiveSellerSubscription(sellerId)") < body.indexOf("requiresPayment: true"));
  assert.match(body, /if \(!sub && sellerType === "individual"\)/);
});

test("package submit accepts any seller with an active package", () => {
  const body = fnBody(listingsServer, "submitShopListingForReview");
  assert.match(body, /consumeSellerPackage\(id, sellerId\)/);
  assert.match(read("app/server/package-assignment.server.ts"), /row\.sub\.listingsUsed >= row\.pkg\.listingAllowance/);
  assert.doesNotMatch(body, /sellerType !== "shop"/);
});

test("package listings are stored and priced with no listing fee", () => {
  assert.match(sellerPricing, /if \(!elig\.requiresPayment\) \{[\s\S]*?feeCents: 0,[\s\S]*?coveredByPackage: true/);
  assert.match(fnBody(listingsFns, "createListing"), /getSellerListingPricing\(\s*user\.id,/);
  assert.match(editServer, /getSellerListingPricing\(\s*sellerId,/);
});

test("web and mobile payment paths refuse to charge a covered listing", () => {
  assert.match(sellerPricing, /"LISTING_COVERED_BY_PACKAGE",\s*409/);
  assert.match(paymentsFns, /assertListingFeePayable\(pricing\)/);
  assert.match(mobileRoute, /assertListingFeePayable\(pricing\)/);
});

test("wizard hides fee tiers and fee for package sellers", () => {
  assert.match(wizard, /const coveredByPackage = eligibility\?\.requiresPayment === false;/);
  assert.match(wizard, /No listing fee: this listing is covered by your package\./);
  assert.match(wizard, /!coveredByPackage && monetizationModel !== "commission_only"/);
  assert.match(wizard, /"Covered by package"/);
});
