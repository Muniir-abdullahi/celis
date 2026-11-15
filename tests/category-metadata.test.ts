import assert from "node:assert/strict";
import test from "node:test";
import {
  compactMetadata,
  formatMetadataValue,
  normalizeCategoryMetadataSchema,
  normalizeMetadataValue,
  validateMetadata,
  type CategoryMetadataSchema,
} from "../app/lib/category-metadata.ts";

// Shape emitted by the category_fields → metadata_schema sync trigger.
const syncedPhonesSchema = {
  fields: [
    { key: "region", type: "single-select", label: "Region", required: true, options: ["mogadishu", "hargeisa"] },
    { key: "brand", type: "single-select", label: "Brand", required: true, options: ["apple", "samsung"] },
    { key: "model", type: "text", label: "Model", required: true, options: [] },
    { key: "color", type: "multi-select", label: "Color", required: false, options: ["black", "white"] },
    { key: "sim_slots", type: "number", label: "SIM Slots", required: false, options: [] },
    { key: "photos", type: "photo-grid", label: "Photos", required: true, options: [] },
  ],
};

test("synced single/multi-select fields are kept, unrenderable types dropped", () => {
  const schema = normalizeCategoryMetadataSchema(syncedPhonesSchema);
  assert.ok(schema);
  assert.deepEqual(
    schema.fields.map((f) => [f.key, f.type]),
    [
      ["region", "single-select"],
      ["brand", "single-select"],
      ["model", "text"],
      ["color", "multi-select"],
      ["sim_slots", "number"],
    ]
  );
});

test("legacy select schemas still normalize", () => {
  const schema = normalizeCategoryMetadataSchema({
    fields: [{ key: "battery", type: "select", label: "Battery", options: ["Good"] }],
  });
  assert.equal(schema?.fields[0].type, "select");
  assert.equal(normalizeCategoryMetadataSchema(null), null);
  assert.equal(normalizeCategoryMetadataSchema({}), null);
});

test("required single-select fields are enforced and option values checked", () => {
  const schema = normalizeCategoryMetadataSchema(syncedPhonesSchema)!;
  const missing = validateMetadata(schema, { model: "iPhone 13" });
  assert.equal(missing.region, "Region is required");
  assert.equal(missing.brand, "Brand is required");

  const invalid = validateMetadata(schema, { region: "nairobi", brand: "apple", model: "x" });
  assert.equal(invalid.region, "Region is invalid");
  assert.equal(invalid.brand, undefined);

  const ok = validateMetadata(schema, {
    region: "mogadishu",
    brand: "apple",
    model: "iPhone 13",
    color: ["black"],
    sim_slots: 2,
  });
  assert.deepEqual(ok, {});
});

test("multi-select rejects values outside its options and empty arrays count as missing", () => {
  const schema: CategoryMetadataSchema = {
    fields: [{ key: "color", type: "multi-select", label: "Color", required: true, options: ["black"] }],
  };
  assert.equal(validateMetadata(schema, { color: ["pink"] }).color, "Color is invalid");
  assert.equal(validateMetadata(schema, { color: [] }).color, "Color is required");
});

test("number normalization strips leading zeros and keeps blanks empty", () => {
  assert.equal(normalizeMetadataValue("number", "012"), 12);
  assert.equal(normalizeMetadataValue("number", ""), null);
  assert.equal(normalizeMetadataValue("boolean", undefined), null);
  assert.equal(normalizeMetadataValue("single-select", ""), null);
  assert.deepEqual(normalizeMetadataValue("multi-select", ["a", "a", ""]), ["a"]);
});

test("compactMetadata drops empty optional values", () => {
  assert.deepEqual(
    compactMetadata({ brand: "apple", storage: null, color: [], model: "", sim: 0 }),
    { brand: "apple", sim: 0 }
  );
});

test("select values render with their option labels", () => {
  const field = {
    key: "condition",
    type: "single-select" as const,
    label: "Condition",
    options: ["brand_new"],
    optionLabels: { brand_new: "Brand New", black: "Black" },
  };
  assert.equal(formatMetadataValue(field, "brand_new"), "Brand New");
  assert.equal(formatMetadataValue({ ...field, type: "multi-select" }, ["black", "x"]), "Black, x");
  assert.equal(formatMetadataValue(field, null), "—");
  assert.equal(formatMetadataValue({ ...field, type: "boolean" }, false), "No");
});

// --- Phase 2: inheritance and conditional fields -------------------------

import {
  getVisibleFields,
  resolveInheritedFields,
  stripHiddenMetadata,
} from "../app/lib/category-metadata.ts";

const conditionalSchema: CategoryMetadataSchema = {
  fields: [
    { key: "condition", type: "single-select", label: "Condition", required: true, options: ["brand_new", "used"] },
    { key: "battery_health", type: "single-select", label: "Battery Health", required: true, options: ["good"], showWhen: { field: "condition", value: "used" } },
    { key: "warranty", type: "boolean", label: "Warranty available?" },
    { key: "warranty_months", type: "number", label: "Warranty (months)", required: true, integer: true, min: 1, max: 120, showWhen: { field: "warranty", value: "yes" } },
    { key: "warranty_note", type: "text", label: "Warranty note", showWhen: { field: "warranty_months", value: "12" } },
  ],
};

test("conditional fields show only when the parent holds the expected value", () => {
  const keys = (m: Record<string, unknown>) => getVisibleFields(conditionalSchema, m).map((f) => f.key);
  assert.deepEqual(keys({ condition: "brand_new" }), ["condition", "warranty"]);
  assert.deepEqual(keys({ condition: "used" }), ["condition", "battery_health", "warranty"]);
  assert.deepEqual(keys({ warranty: true }), ["condition", "warranty", "warranty_months"]);
  // Chains collapse when an ancestor is switched off.
  assert.deepEqual(keys({ warranty: false, warranty_months: 12 }), ["condition", "warranty"]);
  assert.deepEqual(keys({ warranty: true, warranty_months: 12 }), [
    "condition", "warranty", "warranty_months", "warranty_note",
  ]);
});

test("hidden required fields are not enforced; visible ones are", () => {
  assert.deepEqual(validateMetadata(conditionalSchema, { condition: "brand_new", warranty: false }), {});
  const errs = validateMetadata(conditionalSchema, { condition: "used", warranty: true });
  assert.equal(errs.battery_health, "Battery Health is required");
  assert.equal(errs.warranty_months, "Warranty (months) is required");
});

test("stale values of hidden fields are stripped; unknown keys untouched", () => {
  assert.deepEqual(
    stripHiddenMetadata(conditionalSchema, {
      condition: "brand_new",
      battery_health: "good",
      warranty: false,
      warranty_months: 12,
      legacy_key: "kept",
    }),
    { condition: "brand_new", warranty: false, legacy_key: "kept" }
  );
});

test("cycles and missing parents never show the gated field", () => {
  const schema: CategoryMetadataSchema = {
    fields: [
      { key: "a", type: "text", label: "A", showWhen: { field: "b", value: "x" } },
      { key: "b", type: "text", label: "B", showWhen: { field: "a", value: "x" } },
      { key: "c", type: "text", label: "C", showWhen: { field: "missing", value: "x" } },
    ],
  };
  assert.deepEqual(getVisibleFields(schema, { a: "x", b: "x", c: "x" }), []);
});

test("number fields enforce whole-number and bounds rules", () => {
  const base = { condition: "brand_new", warranty: true };
  assert.equal(validateMetadata(conditionalSchema, { ...base, warranty_months: 1.5 }).warranty_months, "Warranty (months) must be a whole number");
  assert.equal(validateMetadata(conditionalSchema, { ...base, warranty_months: 0 }).warranty_months, "Warranty (months) must be at least 1");
  assert.equal(validateMetadata(conditionalSchema, { ...base, warranty_months: 121 }).warranty_months, "Warranty (months) must be at most 120");
  assert.deepEqual(validateMetadata(conditionalSchema, { ...base, warranty_months: 12 }), {});
});

test("subcategory inherits ancestor fields and overrides by key", () => {
  const depth = new Map([["phones", 0], ["electronics", 1], ["root", 2]]);
  const rows = [
    { id: "1", categoryId: "root", fieldKey: "region", label: "Region", sortOrder: 0, appliesToDescendants: true },
    { id: "2", categoryId: "electronics", fieldKey: "brand", label: "Brand", sortOrder: 0, appliesToDescendants: true },
    { id: "3", categoryId: "electronics", fieldKey: "voltage", label: "Voltage", sortOrder: 1, appliesToDescendants: false },
    { id: "4", categoryId: "phones", fieldKey: "brand", label: "Phone brand", sortOrder: 5, appliesToDescendants: true },
    { id: "5", categoryId: "phones", fieldKey: "ram", label: "RAM", sortOrder: 2, appliesToDescendants: false },
    { id: "6", categoryId: "vehicles", fieldKey: "mileage", label: "Mileage", sortOrder: 0, appliesToDescendants: true },
  ];
  const resolved = resolveInheritedFields(rows, "phones", depth);
  // root first, then phones' own fields by sortOrder; electronics' brand is
  // overridden, its non-inheritable voltage and unrelated vehicles rows skipped.
  assert.deepEqual(resolved.map((r) => r.id), ["1", "5", "4"]);
});

// --- Phase 3: listing condition is the single condition source -----------

import { resolveListingConditionLabel } from "../app/lib/category-metadata.ts";

test("a `condition` category field is never rendered as a category detail", () => {
  const schema = normalizeCategoryMetadataSchema({
    fields: [
      { key: "condition", type: "single-select", label: "Condition", required: true, options: ["used"] },
      { key: "brand", type: "text", label: "Brand" },
    ],
  });
  assert.deepEqual(schema?.fields.map((f) => f.key), ["brand"]);
  // So a required metadata condition can no longer block submission.
  assert.deepEqual(validateMetadata(schema, {}), {});
});

test("conditional fields can depend on the listing condition via context", () => {
  const schema: CategoryMetadataSchema = {
    fields: [
      { key: "battery_health", type: "single-select", label: "Battery Health", required: true, options: ["good"], showWhen: { field: "condition", value: "used" } },
    ],
  };
  assert.deepEqual(getVisibleFields(schema, {}, { condition: "brand_new" }), []);
  assert.deepEqual(getVisibleFields(schema, {}, { condition: "used" }).map((f) => f.key), ["battery_health"]);
  assert.equal(validateMetadata(schema, {}, { condition: "used" }).battery_health, "Battery Health is required");
  assert.deepEqual(validateMetadata(schema, {}, { condition: "brand_new" }), {});
  assert.deepEqual(
    stripHiddenMetadata(schema, { battery_health: "good" }, { condition: "brand_new" }),
    {}
  );
  // Without the context value the gated field stays hidden.
  assert.deepEqual(getVisibleFields(schema, {}), []);
});

test("condition label prefers the listing column, then legacy metadata", () => {
  const conditions = [{ code: "brand_new", label: "Brand New" }];
  assert.equal(resolveListingConditionLabel("brand_new", {}, conditions), "Brand New");
  assert.equal(resolveListingConditionLabel(null, { condition: "brand_new" }, conditions), "Brand New");
  assert.equal(resolveListingConditionLabel(null, { condition: "used_good" }, conditions), "Used Good");
  assert.equal(resolveListingConditionLabel(null, {}, conditions), null);
});
