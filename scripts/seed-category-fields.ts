import { db } from "../app/db";
import {
  categories,
  categoryConditions,
  categoryFields,
  categoryFieldOptions,
} from "../app/db/schema";
import { eq, isNull, sql } from "drizzle-orm";

/**
 * Dynamic field + option seeder for the Celis marketplace.
 *
 * Replaces the hard-coded `carsCategorySchema` and per-category `metadata_schema`
 * jsonb with the new `category_fields` / `category_field_options` model.
 *
 * Each field is identified by its own `category_field_id`. Two categories may
 * both expose a "condition" field but with DIFFERENT option sets because options
 * are scoped to the field row, not to the shared `field_key`.
 *
 * After seeding, the trigger on `category_fields` keeps `metadata_schema`
 * (used by celis.so) in sync automatically.
 *
 * Run:
 *   pnpm db:seed-fields
 * (uses DATABASE_URL / DIRECT_URL from .env). Safe to re-run.
 */

type FieldDef = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  searchable?: boolean;
  isFilter?: boolean;
  helpText?: string;
  options?: Array<{ value: string; label: string; group?: string }>;
  /**
   * Conditional display: shown only while field `parentKey` (same category)
   * equals `parentValue`. Mobile compatibility (see docs/domain/marketplace.md):
   * - `parentValue` must be ONE exact value — the mobile app does not support
   *   comma-separated "any of" lists.
   * - For "required when visible" use `rules.requiredWhenVisible`, never
   *   `required` or `rules.required`: mobile validates those on every field,
   *   including hidden ones.
   */
  parentKey?: string;
  parentValue?: string;
  minValue?: number;
  maxValue?: number;
  rules?: { requiredWhenVisible?: boolean; integer?: boolean; min?: number; max?: number };
};

/** Condition & Warranty: duration is asked only when a warranty exists. */
const WARRANTY_FIELDS: FieldDef[] = [
  { key: "warranty_available", label: "Warranty available?", type: "single-select",
    helpText: "Choose Yes only if the item comes with a seller or manufacturer warranty.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ] },
  { key: "warranty_months", label: "Warranty duration (months)", type: "number",
    helpText: "Whole number of months, for example 12.",
    parentKey: "warranty_available", parentValue: "yes",
    minValue: 1, maxValue: 120,
    rules: { requiredWhenVisible: true, integer: true, min: 1, max: 120 } },
];

const REGION_FIELD: FieldDef = {
  key: "region", label: "Region", type: "single-select", required: true, isFilter: true, searchable: true,
  options: [
    { value: "mogadishu", label: "Mogadishu" },
    { value: "hargeisa", label: "Hargeisa" },
    { value: "kismayo", label: "Kismayo" },
    { value: "bosaso", label: "Bosaso" },
    { value: "merka", label: "Merca" },
    { value: "baidoa", label: "Baidoa" },
  ],
};

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const COMMON_FIELDS: FieldDef[] = [
  { key: "condition", label: "Condition", type: "single-select", required: true, isFilter: true, searchable: true,
    options: [
      { value: "brand_new", label: "Brand New" },
      { value: "refurbished", label: "Refurbished" },
      { value: "used_excellent", label: "Used - Excellent" },
      { value: "used_good", label: "Used - Good" },
      { value: "used_fair", label: "Used - Fair" },
    ] },
  { key: "region", label: "Region", type: "single-select", required: true, isFilter: true, searchable: true,
    options: [
      { value: "mogadishu", label: "Mogadishu" },
      { value: "hargeisa", label: "Hargeisa" },
      { value: "kismayo", label: "Kismayo" },
      { value: "bosaso", label: "Bosaso" },
      { value: "merka", label: "Merca" },
      { value: "baidoa", label: "Baidoa" },
    ] },
  { key: "exchange", label: "Exchange Possible", type: "single-select", options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ] },
];

const CARS_FIELDS: FieldDef[] = [
  { key: "make", label: "Make / Brand", type: "single-select", required: true, isFilter: true, searchable: true,
    options: [
      { value: "toyota", label: "Toyota" },
      { value: "lexus", label: "Lexus" },
      { value: "honda", label: "Honda" },
      { value: "nissan", label: "Nissan" },
      { value: "hyundai", label: "Hyundai" },
      { value: "kia", label: "Kia" },
      { value: "benz", label: "Mercedes-Benz" },
      { value: "bmw", label: "BMW" },
    ] },
  { key: "model", label: "Model", type: "text", required: true },
  { key: "color", label: "Color", type: "single-select", searchable: true,
    options: [
      { value: "black", label: "Black", group: "POPULAR" },
      { value: "gray", label: "Gray", group: "POPULAR" },
      { value: "white", label: "White", group: "POPULAR" },
      { value: "silver", label: "Silver", group: "POPULAR" },
      { value: "blue", label: "Blue", group: "POPULAR" },
      { value: "beige", label: "Beige", group: "OTHER" },
      { value: "brown", label: "Brown", group: "OTHER" },
      { value: "green", label: "Green", group: "OTHER" },
      { value: "red", label: "Red", group: "OTHER" },
    ] },
  { key: "transmission", label: "Transmission", type: "single-select", required: true,
    options: [
      { value: "amt", label: "AMT" },
      { value: "automatic", label: "Automatic" },
      { value: "cvt", label: "CVT" },
      { value: "manual", label: "Manual" },
    ] },
  { key: "fuel_type", label: "Fuel Type", type: "single-select",
    options: [
      { value: "petrol", label: "Petrol" },
      { value: "diesel", label: "Diesel" },
      { value: "hybrid", label: "Hybrid" },
      { value: "electric", label: "Electric" },
    ] },
  { key: "year", label: "Year of Manufacture", type: "number", required: true, isFilter: true,
    minValue: 1950, maxValue: 2027, rules: { integer: true, min: 1950, max: 2027 } },
  { key: "mileage", label: "Mileage (km)", type: "number",
    minValue: 0, rules: { integer: true, min: 0 } },
  { key: "engine_size", label: "Engine Size (L)", type: "number",
    minValue: 0, maxValue: 20, rules: { min: 0, max: 20 } },
  { key: "vin", label: "VIN / Chassis Number", type: "text",
    helpText: "It is safe to indicate Chassis number. Celis will hide 6 symbols." },
  { key: "registered", label: "Registered Car", type: "boolean" },
  { key: "features", label: "Key Features", type: "multi-select", searchable: true,
    options: [
      { value: "air_conditioning", label: "Air Conditioning", group: "POPULAR" },
      { value: "radio", label: "AM/FM Radio", group: "POPULAR" },
      { value: "cd", label: "CD Player", group: "POPULAR" },
      { value: "wheels", label: "Alloy Wheels", group: "POPULAR" },
      { value: "airbags", label: "Airbags", group: "POPULAR" },
      { value: "android_auto", label: "Android Auto", group: "OTHER" },
      { value: "abs", label: "Anti-Lock Brakes", group: "OTHER" },
      { value: "carplay", label: "CarPlay", group: "OTHER" },
      { value: "cruise", label: "Cruise Control", group: "OTHER" },
    ] },
];

const PHONES_FIELDS: FieldDef[] = [
  { key: "brand", label: "Brand", type: "single-select", required: true, isFilter: true, searchable: true,
    options: [
      { value: "apple", label: "Apple" },
      { value: "samsung", label: "Samsung" },
      { value: "huawei", label: "Huawei" },
      { value: "xiaomi", label: "Xiaomi" },
      { value: "oppo", label: "Oppo" },
      { value: "tecno", label: "Tecno" },
      { value: "infinix", label: "Infinix" },
    ] },
  { key: "model", label: "Model", type: "text", required: true },
  { key: "storage", label: "Storage", type: "single-select",
    options: [
      { value: "16gb", label: "16 GB" },
      { value: "32gb", label: "32 GB" },
      { value: "64gb", label: "64 GB" },
      { value: "128gb", label: "128 GB" },
      { value: "256gb", label: "256 GB" },
      { value: "512gb", label: "512 GB" },
      { value: "1tb", label: "1 TB" },
    ] },
  { key: "ram", label: "RAM", type: "single-select",
    options: [
      { value: "2gb", label: "2 GB" },
      { value: "3gb", label: "3 GB" },
      { value: "4gb", label: "4 GB" },
      { value: "6gb", label: "6 GB" },
      { value: "8gb", label: "8 GB" },
      { value: "12gb", label: "12 GB" },
    ] },
  { key: "color", label: "Color", type: "single-select", searchable: true,
    options: [
      { value: "black", label: "Black", group: "POPULAR" },
      { value: "white", label: "White", group: "POPULAR" },
      { value: "blue", label: "Blue", group: "POPULAR" },
      { value: "gold", label: "Gold", group: "OTHER" },
      { value: "silver", label: "Silver", group: "OTHER" },
      { value: "green", label: "Green", group: "OTHER" },
    ] },
  // Optional for every condition: gating it on "used" would need several
  // condition codes, which the mobile app's exact-match conditions can't do.
  { key: "battery_health", label: "Battery Health", type: "single-select",
    options: [
      { value: "100", label: "100%" },
      { value: "90_99", label: "90% - 99%" },
      { value: "80_89", label: "80% - 89%" },
      { value: "below_80", label: "Below 80%" },
    ] },
  { key: "sim_slots", label: "SIM Slots", type: "number",
    minValue: 0, maxValue: 4, rules: { integer: true, min: 0, max: 4 } },
  ...WARRANTY_FIELDS,
];

const FASHION_FIELDS: FieldDef[] = [
  { key: "brand", label: "Brand", type: "single-select", searchable: true,
    options: [
      { value: "nike", label: "Nike" },
      { value: "adidas", label: "Adidas" },
      { value: "puma", label: "Puma" },
      { value: "zara", label: "Zara" },
      { value: "gucci", label: "Gucci" },
      { value: "local", label: "Local / Unbranded" },
    ] },
  { key: "size", label: "Size", type: "single-select",
    options: [
      { value: "xs", label: "XS" },
      { value: "s", label: "S" },
      { value: "m", label: "M" },
      { value: "l", label: "L" },
      { value: "xl", label: "XL" },
      { value: "xxl", label: "XXL" },
    ] },
  { key: "color", label: "Color", type: "single-select", searchable: true,
    options: [
      { value: "black", label: "Black" },
      { value: "white", label: "White" },
      { value: "blue", label: "Blue" },
      { value: "red", label: "Red" },
      { value: "green", label: "Green" },
    ] },
  { key: "material", label: "Material", type: "text" },
];

// Property: no item condition / exchange; size and layout instead.
const PROPERTY_SIZE: FieldDef = {
  key: "size_sqm", label: "Size (m²)", type: "number", isFilter: true,
  minValue: 1, rules: { min: 1 },
};
const PROPERTY_ROOMS: FieldDef[] = [
  { key: "bedrooms", label: "Bedrooms", type: "number", required: true, isFilter: true,
    minValue: 0, maxValue: 50, rules: { integer: true, min: 0, max: 50 } },
  { key: "bathrooms", label: "Bathrooms", type: "number", isFilter: true,
    minValue: 0, maxValue: 50, rules: { integer: true, min: 0, max: 50 } },
  { key: "furnished", label: "Furnished", type: "single-select", isFilter: true,
    options: [
      { value: "furnished", label: "Furnished" },
      { value: "semi_furnished", label: "Semi-furnished" },
      { value: "unfurnished", label: "Unfurnished" },
    ] },
];
const TITLE_DEED: FieldDef = {
  key: "title_deed", label: "Title deed available", type: "single-select", options: YES_NO,
};
const RENT_PERIOD: FieldDef = {
  key: "rent_period", label: "Rent period", type: "single-select", required: true, isFilter: true,
  options: [
    { value: "monthly", label: "Per month" },
    { value: "yearly", label: "Per year" },
  ],
};

// Jobs: the price is the offered pay; describe the role, not an item.
const JOB_FIELDS: FieldDef[] = [
  REGION_FIELD,
  { key: "job_title", label: "Job title", type: "text", required: true, searchable: true },
  { key: "company", label: "Company / employer", type: "text", searchable: true },
  { key: "pay_period", label: "Pay period", type: "single-select", required: true,
    options: [
      { value: "hourly", label: "Per hour" },
      { value: "daily", label: "Per day" },
      { value: "monthly", label: "Per month" },
    ] },
  { key: "experience_level", label: "Experience level", type: "single-select", isFilter: true,
    options: [
      { value: "entry", label: "Entry level" },
      { value: "mid", label: "Mid level" },
      { value: "senior", label: "Senior" },
    ] },
  { key: "education_level", label: "Minimum education", type: "single-select",
    options: [
      { value: "none", label: "No requirement" },
      { value: "secondary", label: "Secondary school" },
      { value: "diploma", label: "Diploma" },
      { value: "bachelor", label: "Bachelor's degree" },
      { value: "master", label: "Master's degree or higher" },
    ] },
];

// Services: how the service is priced and delivered.
const SERVICE_FIELDS: FieldDef[] = [
  REGION_FIELD,
  { key: "pricing_type", label: "Pricing", type: "single-select", required: true,
    options: [
      { value: "fixed", label: "Fixed price" },
      { value: "hourly", label: "Per hour" },
      { value: "quote", label: "Starting price / on quote" },
    ] },
  { key: "experience_years", label: "Years of experience", type: "number",
    minValue: 0, maxValue: 60, rules: { integer: true, min: 0, max: 60 } },
  { key: "home_service", label: "Comes to your location", type: "single-select", options: YES_NO },
];

// slug -> fields. Sets are listed per subcategory (not inherited) so the
// mobile app, which reads each category's own metadata_schema, sees them too.
const SEED: Record<string, FieldDef[]> = {
  "vehicles-cars": [...COMMON_FIELDS, ...CARS_FIELDS],
  "electronics-phones-tablets": [...COMMON_FIELDS, ...PHONES_FIELDS],
  "property-houses-sale": [REGION_FIELD, PROPERTY_SIZE, ...PROPERTY_ROOMS, TITLE_DEED],
  "property-houses-rent": [REGION_FIELD, RENT_PERIOD, PROPERTY_SIZE, ...PROPERTY_ROOMS],
  "property-apartments": [REGION_FIELD, PROPERTY_SIZE, ...PROPERTY_ROOMS],
  "property-land": [REGION_FIELD, { ...PROPERTY_SIZE, required: true }, TITLE_DEED],
  "property-commercial": [REGION_FIELD, PROPERTY_SIZE, TITLE_DEED],
  "jobs-full-time": JOB_FIELDS,
  "jobs-part-time": JOB_FIELDS,
  "jobs-remote": JOB_FIELDS.filter((f) => f.key !== "region"),
  "services-repair": SERVICE_FIELDS,
  "services-construction": SERVICE_FIELDS,
  "services-cleaning": SERVICE_FIELDS,
  "services-beauty": SERVICE_FIELDS,
  "fashion-men-clothing": [...COMMON_FIELDS, ...FASHION_FIELDS],
  "fashion-women-clothing": [...COMMON_FIELDS, ...FASHION_FIELDS],
  fashion: [...COMMON_FIELDS, ...FASHION_FIELDS],
};

async function getCategoryBySlug(slug: string) {
  const rows = await db.select().from(categories).where(eq(categories.slug, slug));
  return rows[0] ?? null;
}

async function seedField(categoryId: string, def: FieldDef, sortOrder: number) {
  const [field] = await db
    .insert(categoryFields)
    .values({
      categoryId,
      fieldKey: def.key,
      label: def.label,
      type: def.type,
      required: def.required ?? false,
      searchable: def.searchable ?? false,
      isFilter: def.isFilter ?? false,
      helpText: def.helpText ?? null,
      minValue: def.minValue?.toString() ?? null,
      maxValue: def.maxValue?.toString() ?? null,
      validationRules: def.rules ?? {},
      sortOrder,
    })
    .onConflictDoUpdate({
      target: [categoryFields.categoryId, categoryFields.fieldKey],
      set: {
        label: def.label,
        type: def.type,
        required: def.required ?? false,
        searchable: def.searchable ?? false,
        isFilter: def.isFilter ?? false,
        helpText: def.helpText ?? null,
        minValue: def.minValue?.toString() ?? null,
        maxValue: def.maxValue?.toString() ?? null,
        validationRules: def.rules ?? {},
        sortOrder,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (def.options && def.options.length) {
    const opts = def.options.map((o, i) => ({
      categoryFieldId: field.id,
      value: o.value,
      label: o.label,
      group: o.group ?? "OTHER",
      sortOrder: i,
      isActive: true,
    }));
    await db
      .insert(categoryFieldOptions)
      .values(opts)
      .onConflictDoUpdate({
        target: [categoryFieldOptions.categoryFieldId, categoryFieldOptions.value],
        set: {
          label: sql`EXCLUDED.label`,
          group: sql`EXCLUDED.group`,
          sortOrder: sql`EXCLUDED.sort_order`,
          isActive: true,
        },
      });
  }
  return field;
}

async function main() {
  for (const [slug, fields] of Object.entries(SEED)) {
    const category = await getCategoryBySlug(slug);
    if (!category) {
      console.warn(`Category "${slug}" not found; skipping field seed.`);
      continue;
    }
    const idsByKey = new Map<string, string>();
    for (let i = 0; i < fields.length; i++) {
      const field = await seedField(category.id, fields[i], i);
      idsByKey.set(fields[i].key, field.id);
    }
    // Second pass: link conditional fields to their parent field.
    for (const def of fields) {
      const id = idsByKey.get(def.key)!;
      const parentId = def.parentKey ? idsByKey.get(def.parentKey) : undefined;
      if (def.parentValue?.includes(",")) {
        throw new Error(`Field "${def.key}": parentValue must be a single value (mobile app limitation).`);
      }
      if (def.parentKey && !parentId) {
        throw new Error(`Field "${def.key}" depends on unknown field "${def.parentKey}" in "${slug}".`);
      }
      await db
        .update(categoryFields)
        .set({
          parentFieldId: parentId ?? null,
          parentValue: parentId ? def.parentValue ?? null : null,
        })
        .where(eq(categoryFields.id, id));
    }
    console.log(`Seeded ${fields.length} fields for "${slug}".`);
  }

  const totalFields = await db.select().from(categoryFields);
  const totalOptions = await db.select().from(categoryFieldOptions);
  console.log(`Total: ${totalFields.length} field rows, ${totalOptions.length} option rows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
