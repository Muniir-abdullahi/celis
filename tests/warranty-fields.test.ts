import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CONDITION_GROUP_KEYS,
  getVisibleFields,
  normalizeMetadataValue,
  stripHiddenMetadata,
  validateMetadata,
  type CategoryMetadataSchema,
} from "../app/lib/category-metadata.ts";

const migration = readFileSync("drizzle/0034_conditional_warranty_fields.sql", "utf8");
const down = readFileSync("drizzle/0034_conditional_warranty_fields.down.sql", "utf8");
const seed = readFileSync("scripts/seed-category-fields.ts", "utf8");

// Shape getCategoryMetadataSchema produces for the migrated fields.
const warrantySchema: CategoryMetadataSchema = {
  fields: [
    { key: "warranty_available", type: "single-select", label: "Warranty available?", options: ["yes", "no"] },
    {
      key: "warranty_months",
      type: "number",
      label: "Warranty duration (months)",
      required: true,
      integer: true,
      min: 1,
      max: 120,
      showWhen: { field: "warranty_available", value: "yes" },
    },
  ],
};

test("duration is hidden, not required and not submitted unless warranty is Yes", () => {
  assert.deepEqual(getVisibleFields(warrantySchema, {}).map((f) => f.key), ["warranty_available"]);
  assert.deepEqual(validateMetadata(warrantySchema, { warranty_available: "no" }), {});
  assert.deepEqual(
    stripHiddenMetadata(warrantySchema, { warranty_available: "no", warranty_months: 12 }),
    { warranty_available: "no" }
  );
});

test("Yes requires a positive whole number of months", () => {
  const yes = { warranty_available: "yes" };
  assert.equal(validateMetadata(warrantySchema, yes).warranty_months, "Warranty duration (months) is required");
  assert.equal(validateMetadata(warrantySchema, { ...yes, warranty_months: 0 }).warranty_months, "Warranty duration (months) must be at least 1");
  assert.equal(validateMetadata(warrantySchema, { ...yes, warranty_months: 2.5 }).warranty_months, "Warranty duration (months) must be a whole number");
  // "012" typed by the seller is stored as 12 and is valid.
  const months = normalizeMetadataValue("number", "012");
  assert.equal(months, 12);
  assert.deepEqual(validateMetadata(warrantySchema, { ...yes, warranty_months: months }), {});
});

test("warranty fields render in the Condition & Warranty group", () => {
  assert.ok(CONDITION_GROUP_KEYS.has("warranty_available"));
  assert.ok(CONDITION_GROUP_KEYS.has("warranty_months"));
});

test("migration gates duration on warranty_available = yes with whole-number bounds", () => {
  assert.match(migration, /'warranty_available',\s*'Warranty available\?',\s*'single-select'/);
  assert.match(migration, /"parent_value" = 'yes'/);
  assert.match(migration, /\{"requiredWhenVisible": true, "integer": true, "min": 1, "max": 120\}/);
  // Mobile validates validation_rules.required on hidden fields too.
  assert.doesNotMatch(migration, /\{"required": true/);
});

test("migration never sets the required column (mobile RPC enforces it unconditionally)", () => {
  assert.doesNotMatch(migration, /"required"\s*=\s*true/);
  const insertCols = migration.match(/INSERT INTO "category_fields" \(([\s\S]*?)\)/)?.[1] ?? "";
  assert.match(insertCols, /"required"/);
  assert.match(migration, /'Choose Yes only[^']*',\s*false,/);
});

test("listing backfill is guarded and keeps existing values", () => {
  assert.match(migration, /CASE\s+WHEN \("metadata" ->> 'warranty_months'\) ~/);
  assert.doesNotMatch(migration, /"metadata" - 'warranty_months'/);
  assert.match(down, /"metadata" - 'warranty_available'/);
  assert.match(down, /DELETE FROM "category_fields" WHERE "field_key" = 'warranty_available'/);
});

test("seed mirrors the migration for fresh databases", () => {
  assert.match(seed, /parentKey: "warranty_available", parentValue: "yes"/);
  assert.match(seed, /rules: \{ requiredWhenVisible: true, integer: true, min: 1, max: 120 \}/);
  assert.doesNotMatch(seed, /key: "warranty_months", label: "Warranty \(months\)"/);
});
