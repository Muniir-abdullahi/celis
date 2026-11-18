import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateListingPricing,
  DEFAULT_LISTING_TIERS,
  findListingTier,
  minimumTierPriceCents,
  type ListingTiersConfig,
} from "../app/lib/pricing.ts";
import {
  SINGLE_CHOICE_CHIP_KEYS,
  validateMetadata,
  type CategoryMetadataSchema,
} from "../app/lib/category-metadata.ts";

// IT report 16 Nov 2026: issue 01 (single-choice color) and 02 (fee only
// after a valid price).

const tiers: ListingTiersConfig = DEFAULT_LISTING_TIERS;

// ---- 02: listing fee ------------------------------------------------------

test("empty or below-minimum price gets no tier and no fee (never Premium)", () => {
  for (const price of [0, -5, Number.NaN, 100, 999]) {
    assert.equal(findListingTier(price, tiers), null, String(price));
    const p = calculateListingPricing(price, tiers, { monetizationModel: "fixed_only" });
    assert.equal(p.priced, false);
    assert.equal(p.tierLabel, null);
    assert.equal(p.feeCents, 0);
    assert.equal(p.totalFeeCents, 0);
  }
});

test("valid prices map to the approved tiers", () => {
  const fee = (price: number) =>
    calculateListingPricing(price, tiers, { monetizationModel: "fixed_only" });
  assert.deepEqual([fee(10_000).tierLabel, fee(10_000).feeCents], ["Basic", 50]); // $100
  assert.deepEqual([fee(100_000).tierLabel, fee(100_000).feeCents], ["Standard", 100]); // $1,000
  assert.deepEqual([fee(500_000).tierLabel, fee(500_000).feeCents], ["Premium", 250]); // $5,000
  // Boundaries.
  assert.equal(fee(1_000).tierLabel, "Basic"); // $10.00
  assert.equal(fee(49_999).tierLabel, "Basic"); // $499.99
  assert.equal(fee(50_000).tierLabel, "Standard"); // $500.00
  assert.equal(fee(499_999).tierLabel, "Standard"); // $4,999.99
});

test("lowering the first tier's minimum (admin setting) prices $1–$9.99 as Basic", () => {
  const adminConfig: ListingTiersConfig = {
    ...tiers,
    tiers: tiers.tiers.map((t, i) => (i === 0 ? { ...t, minCents: 100 } : t)),
  };
  assert.equal(minimumTierPriceCents(adminConfig), 100);
  assert.equal(findListingTier(500, adminConfig)?.label, "Basic"); // $5
  assert.equal(minimumTierPriceCents(tiers), 1_000);
});

test("server charging paths refuse unpriced prices; previews stay neutral", () => {
  const config = readFileSync("app/server/config.server.ts", "utf8");
  const preview = readFileSync("app/server/config.functions.ts", "utf8");
  const approval = readFileSync("app/server/listings.server.ts", "utf8");
  assert.match(config, /if \(!pricing\.priced\) \{[\s\S]*?"PRICE_OUTSIDE_TIERS"/);
  assert.match(preview, /return computeListingPricing\(data\.price, data\.categoryId\)/);
  assert.match(approval, /computeListingPricing\(listing\.price, listing\.categoryId\)/);
  // Create, edit and both payment entry points go through the seller pricing
  // helper, which uses the strict version for fee-paying sellers.
  for (const file of [
    "app/server/listings.functions.ts",
    "app/server/listing-edit.server.ts",
    "app/server/payments.functions.ts",
    "app/api/mobile/payments/listing-fee/route.ts",
  ]) {
    assert.match(readFileSync(file, "utf8"), /getSellerListingPricing\(/, file);
  }
  assert.match(
    readFileSync("app/server/seller-pricing.server.ts", "utf8"),
    /const pricing = await getListingPricing\(priceCents, categoryId\)/
  );
});

test("wizard shows a neutral summary and blocks Next until the price has a tier", () => {
  const wizard = readFileSync("app/components/listings/listing-wizard.tsx", "utf8");
  assert.match(wizard, /Enter a price to calculate the listing fee\./);
  assert.match(wizard, /: findListingTier\(form\.price, tiersConfig\) !== null;\s*return priceOk && form\.deliveryMethod/);
  assert.match(wizard, /if \(!cancelled\) setPreview\(next\)/);
  assert.doesNotMatch(readFileSync("app/lib/pricing.ts", "utf8"), /\?\? config\.tiers\[config\.tiers\.length - 1\]/);
});

// ---- 01: color -------------------------------------------------------------

test("color is a single choice drawn as one-click chips", () => {
  assert.ok(SINGLE_CHOICE_CHIP_KEYS.has("color"));
  const seed = readFileSync("scripts/seed-category-fields.ts", "utf8");
  assert.doesNotMatch(seed, /key: "color", label: "Color", type: "multi-select"/);
  assert.equal((seed.match(/key: "color", label: "Color", type: "single-select"/g) ?? []).length, 3);
  const input = readFileSync("app/components/listings/metadata-field-input.tsx", "utf8");
  assert.match(input, /role=\{exclusive \? "radiogroup" : "group"\}/);
  assert.match(input, /onToggle=\{\(v\) => onChange\(v\)\}/);
});

test("server accepts exactly one color", () => {
  const schema: CategoryMetadataSchema = {
    fields: [{ key: "color", type: "single-select", label: "Color", options: ["black", "white", "green"] }],
  };
  assert.deepEqual(validateMetadata(schema, { color: "green" }), {});
  assert.equal(validateMetadata(schema, { color: "white,green" }).color, "Color is invalid");
  assert.equal(validateMetadata(schema, { color: ["white", "green"] }).color, "Color is invalid");
});

test("migration 0036 switches color fields and keeps one saved color", () => {
  const m = readFileSync("drizzle/0036_single_choice_color.sql", "utf8");
  assert.match(m, /SET "type" = 'single-select'[\s\S]*?"field_key" = 'color'[\s\S]*?"type" = 'multi-select'/);
  assert.match(m, /split_part\("metadata" ->> 'color', ',', 1\)/);
  assert.match(m, /COALESCE\(/);
});
