import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getVisibleFields,
  validateMetadata,
  type CategoryMetadataSchema,
} from "../app/lib/category-metadata.ts";

const seed = readFileSync("scripts/seed-category-fields.ts", "utf8");

/** Field keys seeded for a slug, read from the SEED map line. */
function seededLine(slug: string) {
  const line = seed.split("\n").find((l) => l.includes(`"${slug}":`));
  assert.ok(line, `no seed entry for ${slug}`);
  return line;
}

test("battery health is asked only for pre-owned phones (any-of condition codes)", () => {
  const schema: CategoryMetadataSchema = {
    fields: [
      {
        key: "battery_health",
        type: "single-select",
        label: "Battery Health",
        options: ["100"],
        showWhen: { field: "condition", value: "used,used_excellent,used_good,used_fair,refurbished" },
      },
    ],
  };
  const visible = (condition: string | null) =>
    getVisibleFields(schema, {}, { condition }).map((f) => f.key);
  assert.deepEqual(visible("brand_new"), []);
  assert.deepEqual(visible(null), []);
  assert.deepEqual(visible("used"), ["battery_health"]);
  assert.deepEqual(visible("used_good"), ["battery_health"]);
  assert.deepEqual(visible("refurbished"), ["battery_health"]);
});

test("any-of matching also works for booleans and multi-select parents", () => {
  const schema: CategoryMetadataSchema = {
    fields: [
      { key: "a", type: "boolean", label: "A" },
      { key: "b", type: "text", label: "B", showWhen: { field: "a", value: "yes, true" } },
      { key: "c", type: "multi-select", label: "C", options: ["x", "y"] },
      { key: "d", type: "text", label: "D", showWhen: { field: "c", value: "z,y" } },
    ],
  };
  const keys = (m: Record<string, unknown>) => getVisibleFields(schema, m).map((f) => f.key);
  assert.deepEqual(keys({ a: true, c: ["y"] }), ["a", "b", "c", "d"]);
  assert.deepEqual(keys({ a: false, c: ["x"] }), ["a", "c"]);
});

test("battery health is not gated (mobile can't do any-of conditions); SIM slots bounded", () => {
  const battery = seed.slice(seed.indexOf('key: "battery_health"'), seed.indexOf('key: "sim_slots"'));
  assert.doesNotMatch(battery, /parentKey|parentValue/);
  assert.match(seed, /parentValue must be a single value/);
  assert.match(seed, /key: "sim_slots"[\s\S]*?rules: \{ integer: true, min: 0, max: 4 \}/);
});

test("property, jobs and services get their own field sets", () => {
  assert.match(seededLine("property-houses-rent"), /RENT_PERIOD/);
  assert.match(seededLine("property-houses-sale"), /PROPERTY_ROOMS/);
  assert.match(seededLine("property-land"), /PROPERTY_SIZE, required: true/);
  assert.match(seededLine("jobs-full-time"), /JOB_FIELDS/);
  assert.match(seededLine("services-repair"), /SERVICE_FIELDS/);
  // None of these reuse the item fields (condition / exchange / brand).
  for (const slug of ["property-houses-sale", "jobs-full-time", "services-cleaning"]) {
    assert.doesNotMatch(seededLine(slug), /COMMON_FIELDS|PHONES_FIELDS|CARS_FIELDS/);
  }
});

test("job fields describe a role, not an item", () => {
  const block = seed.slice(seed.indexOf("const JOB_FIELDS"), seed.indexOf("const SERVICE_FIELDS"));
  assert.match(block, /key: "job_title"/);
  assert.match(block, /key: "pay_period"/);
  assert.doesNotMatch(block, /key: "condition"|key: "brand"|key: "battery_health"/);
});

test("car year is a bounded whole number", () => {
  const schema: CategoryMetadataSchema = {
    fields: [{ key: "year", type: "number", label: "Year of Manufacture", required: true, integer: true, min: 1950, max: 2027 }],
  };
  assert.deepEqual(validateMetadata(schema, { year: 2018 }), {});
  assert.equal(validateMetadata(schema, { year: 1800 }).year, "Year of Manufacture must be at least 1950");
  assert.match(seed, /key: "year", label: "Year of Manufacture"[\s\S]*?rules: \{ integer: true, min: 1950, max: 2027 \}/);
});
