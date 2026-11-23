import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Regression: seller-scoped server actions must act as the signed-in user and
// never trust a seller id sent by the browser.

const listingsFns = readFileSync("app/server/listings.functions.ts", "utf8");
const storageFns = readFileSync("app/server/storage.functions.ts", "utf8");
const listingsServer = readFileSync("app/server/listings.server.ts", "utf8");
const wizard = readFileSync("app/components/listings/listing-wizard.tsx", "utf8");

function fnBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("no listing action schema accepts a client seller id", () => {
  assert.doesNotMatch(listingsFns, /sellerId:\s*z\./);
  assert.doesNotMatch(storageFns, /sellerId:\s*z\./);
  assert.doesNotMatch(listingsFns, /data\.sellerId/);
  assert.doesNotMatch(storageFns, /data\.sellerId/);
});

test("createListing inserts under the signed-in user", () => {
  const body = fnBody(listingsFns, "createListing");
  assert.match(body, /requireCurrentUser\(\)/);
  assert.match(body, /insertDraftListing\(\s*user\.id,/);
});

test("eligibility and shop submit use the signed-in user", () => {
  assert.match(fnBody(listingsFns, "fetchSellerListingEligibility"), /getSellerListingEligibility\(user\.id\)/);
  assert.match(fnBody(listingsFns, "submitShopListing"), /submitShopListingForReview\(data\.listingId, user\.id\)/);
});

test("shop submit checks ownership and draft status before using a package credit", () => {
  assert.match(fnBody(listingsServer, "submitShopListingForReview"), /consumeSellerPackage\(id, sellerId\)/);
  const body = readFileSync("app/server/package-assignment.server.ts", "utf8");
  const ownership = body.indexOf("listing.sellerId !== sellerId");
  const draft = body.indexOf('listing.status !== "draft"');
  const eligibility = body.indexOf("row.sub.listingsUsed >= row.pkg.listingAllowance");
  assert.ok(ownership > 0 && draft > 0 && eligibility > 0);
  assert.ok(ownership < eligibility && draft < eligibility);
});

test("image upload URLs require sign-in and use the user's own folder", () => {
  const body = fnBody(storageFns, "getListingImageUploadUrl");
  assert.match(body, /requireCurrentUser\(\)/);
  assert.match(body, /createListingImageUploadUrl\(user\.id,/);
});

test("the wizard no longer sends a seller id to these actions", () => {
  assert.match(wizard, /fetchSellerListingEligibility\(\)/);
  assert.doesNotMatch(wizard, /data: \{ sellerId, listing: form \}/);
  assert.doesNotMatch(wizard, /listingId: result\.id, sellerId/);
});
