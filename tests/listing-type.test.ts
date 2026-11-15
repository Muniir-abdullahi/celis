import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateListingPricing,
  monetizationTypeForModel,
  type ListingTiersConfig,
} from "../app/lib/pricing.ts";

const wizard = readFileSync("app/components/listings/listing-wizard.tsx", "utf8");
const validation = readFileSync("app/lib/validation.ts", "utf8");
const createListing = readFileSync("app/server/listings.functions.ts", "utf8");
const payments = readFileSync("app/server/payments.functions.ts", "utf8");

test("listing type is derived from the platform monetization model", () => {
  assert.equal(monetizationTypeForModel("fixed_only"), "fixed_rate");
  assert.equal(monetizationTypeForModel("commission_only"), "commission");
  assert.equal(monetizationTypeForModel("hybrid"), "commission");
});

test("sellers are not asked to choose a listing type", () => {
  assert.doesNotMatch(wizard, /Listing type/);
  assert.doesNotMatch(wizard, /Commission on sale/);
  assert.doesNotMatch(wizard, /monetizationType/);
});

test("listing input no longer accepts a seller-chosen listing type", () => {
  assert.doesNotMatch(validation, /monetizationType:\s*z\./);
});

test("create and payment flows both use the server-derived type", () => {
  assert.match(createListing, /monetizationTypeForModel\(pricing\.monetizationModel\)/);
  assert.match(payments, /monetizationTypeForModel\(pricing\.monetizationModel\)/);
});

test("fees do not depend on the removed selector", () => {
  const tiers: ListingTiersConfig = {
    currency: "USD",
    tiers: [
      { label: "Standard", minCents: 0, maxCents: 499_999, feeCents: 100, expiryDays: 30 },
      { label: "Premium", minCents: 500_000, maxCents: null, feeCents: 250, expiryDays: 30 },
    ],
  };
  const fixed = calculateListingPricing(600_000, tiers, { monetizationModel: "fixed_only" });
  assert.equal(fixed.feeCents, 250);
  assert.equal(fixed.commissionAmountCents, null);
  const commission = calculateListingPricing(600_000, tiers, {
    monetizationModel: "commission_only",
    commissionRule: { feeType: "commission", percentage: 500, currency: "USD" },
  });
  assert.equal(commission.feeCents, 0);
  assert.equal(commission.commissionAmountCents, 30_000);
});
