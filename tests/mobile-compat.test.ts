import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatMetadataValue,
  getVisibleFields,
  normalizeMetadataValue,
  serializeMetadataForStorage,
  toBooleanValue,
  toMultiValues,
  validateMetadata,
  type CategoryMetadataSchema,
} from "../app/lib/category-metadata.ts";

// The mobile app (Expo) reads and writes the same Supabase rows. These tests
// pin the shared formats: multi-select = "a,b", boolean = "yes"/"no".

const schema: CategoryMetadataSchema = {
  fields: [
    { key: "color", type: "multi-select", label: "Color", options: ["black", "white"], optionLabels: { black: "Black", white: "White" } },
    { key: "registered", type: "boolean", label: "Registered Car" },
    { key: "model", type: "text", label: "Model" },
  ],
};

test("web saves multi-select as comma strings and booleans as yes/no", () => {
  assert.deepEqual(
    serializeMetadataForStorage(schema, { color: ["black", "white"], registered: true, model: "Corolla" }),
    { color: "black,white", registered: "yes", model: "Corolla" }
  );
  assert.deepEqual(serializeMetadataForStorage(schema, { registered: false }), { registered: "no" });
  assert.deepEqual(serializeMetadataForStorage(schema, { color: [] }), {});
});

test("web reads mobile-format values", () => {
  assert.deepEqual(normalizeMetadataValue("multi-select", "black, white"), ["black", "white"]);
  assert.equal(normalizeMetadataValue("boolean", "yes"), true);
  assert.equal(normalizeMetadataValue("boolean", "no"), false);
  assert.equal(formatMetadataValue(schema.fields[0], "black,white"), "Black, White");
  assert.equal(formatMetadataValue(schema.fields[1], "yes"), "Yes");
  assert.equal(formatMetadataValue(schema.fields[1], "no"), "No");
  // Older web rows still display correctly.
  assert.equal(formatMetadataValue(schema.fields[0], ["black"]), "Black");
  assert.equal(formatMetadataValue(schema.fields[1], true), "Yes");
});

test("editing a mobile-created listing on the web validates", () => {
  assert.deepEqual(validateMetadata(schema, { color: "black,white", registered: "yes" }), {});
  assert.equal(validateMetadata(schema, { color: "black,pink" }).color, "Color is invalid");
});

test("conditions work with mobile-format parents", () => {
  const s: CategoryMetadataSchema = {
    fields: [
      { key: "has", type: "boolean", label: "Has" },
      { key: "detail", type: "text", label: "Detail", showWhen: { field: "has", value: "yes" } },
    ],
  };
  assert.deepEqual(getVisibleFields(s, { has: "yes" }).map((f) => f.key), ["has", "detail"]);
  assert.deepEqual(getVisibleFields(s, { has: "no" }).map((f) => f.key), ["has"]);
});

test("helpers", () => {
  assert.deepEqual(toMultiValues("a,,b, a"), ["a", "b"]);
  assert.equal(toBooleanValue("maybe"), null);
});

test("create and edit both store the mobile format", () => {
  const details = readFileSync("app/server/listing-details.server.ts", "utf8");
  assert.match(details, /listing\.metadata = serializeMetadataForStorage\(metadataSchema, metadata\)/);
});

test("repair migration moves required → requiredWhenVisible and drops any-of conditions", () => {
  const m = readFileSync("drizzle/0035_mobile_compatible_category_data.sql", "utf8");
  assert.match(m, /"parent_field_id" IS NOT NULL\s+AND \("validation_rules" ->> 'required'\) = 'true'/);
  assert.match(m, /jsonb_build_object\('requiredWhenVisible', true\)/);
  assert.match(m, /WHERE "parent_value" LIKE '%,%'/);
  assert.match(m, /jsonb_typeof\(kv\.value\) = 'array'/);
});

test("web loader honours requiredWhenVisible", () => {
  const loader = readFileSync("app/server/categories.server.ts", "utf8");
  assert.match(loader, /rules\.requiredWhenVisible === true/);
});
