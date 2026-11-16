/**
 * Category metadata ("Category details") field model shared by the listing
 * wizard, server-side listing validation, search filters and listing detail.
 *
 * Field definitions come from `categories.metadata_schema`, which the
 * `category_fields` trigger keeps in sync. That trigger emits the
 * `category_fields.type` values (`single-select`, `multi-select`, `textarea`,
 * …) while older hand-edited schemas use `select`. Both are supported here so
 * existing categories, listings and the mobile app keep working.
 */

export const METADATA_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "boolean",
  "select",
  "single-select",
  "multi-select",
] as const;

export type MetadataFieldType = (typeof METADATA_FIELD_TYPES)[number];

export type MetadataValue = string | number | boolean | string[] | null;

export interface MetadataField {
  key: string;
  type: MetadataFieldType;
  label: string;
  required?: boolean;
  /** Stored option values (e.g. `brand_new`). */
  options?: string[];
  /** Human labels keyed by option value (e.g. `brand_new` → `Brand New`). */
  optionLabels?: Record<string, string>;
  helpText?: string | null;
  maxLength?: number | null;
  /** Numeric bounds / whole-number rule for `number` fields. */
  min?: number | null;
  max?: number | null;
  integer?: boolean;
  /**
   * Conditional display (from `category_fields.parent_field_id/parent_value`):
   * the field is shown, validated and stored only while the field `field`
   * holds `value`.
   */
  showWhen?: { field: string; value: string } | null;
}

export interface CategoryMetadataSchema {
  fields: MetadataField[];
}

const SUPPORTED_TYPES = new Set<string>(METADATA_FIELD_TYPES);

/**
 * Keys owned by first-class listing columns rather than category details.
 * `condition` lives in `listings.condition` (options from
 * `category_conditions`), so a `condition` category field is never rendered
 * or stored as metadata — it would duplicate the main Condition row.
 * Conditional fields may still depend on it via `showWhen.field = "condition"`;
 * callers pass the listing condition in the visibility `context`.
 */
export const RESERVED_METADATA_KEYS = new Set(["condition"]);

/**
 * Single-choice fields drawn as one-choice chips (radio semantics) instead of
 * a dropdown: one click selects a value and replaces the previous one.
 */
export const SINGLE_CHOICE_CHIP_KEYS = new Set(["color"]);

/** Category fields shown in the wizard's "Condition & Warranty" group. */
export const CONDITION_GROUP_KEYS = new Set(["warranty_available", "warranty_months"]);

/** Listing-level values that conditional fields may depend on. */
export type MetadataContext = Record<string, unknown>;

export function isSingleSelectType(type: MetadataFieldType) {
  return type === "select" || type === "single-select";
}

export function isSelectType(type: MetadataFieldType) {
  return isSingleSelectType(type) || type === "multi-select";
}

export function isValidMetadataSchema(value: unknown): value is CategoryMetadataSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "fields" in value &&
    Array.isArray((value as CategoryMetadataSchema).fields) &&
    (value as CategoryMetadataSchema).fields.every(
      (f) =>
        typeof f === "object" &&
        f !== null &&
        typeof f.key === "string" &&
        typeof f.label === "string" &&
        SUPPORTED_TYPES.has(f.type)
    )
  );
}

/**
 * Coerce a raw `metadata_schema` jsonb value into a schema the UI can render.
 * Fields with types the web form cannot render (e.g. `photo-grid`,
 * `video-link`) are dropped so they never block submission with an
 * unfillable required field.
 */
export function normalizeCategoryMetadataSchema(
  value: unknown
): CategoryMetadataSchema | null {
  if (typeof value !== "object" || value === null || !("fields" in value)) {
    return null;
  }
  const rawFields = (value as { fields: unknown }).fields;
  if (!Array.isArray(rawFields)) return null;

  const fields: MetadataField[] = [];
  const seen = new Set<string>();
  for (const raw of rawFields) {
    if (typeof raw !== "object" || raw === null) continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.key !== "string" || !f.key) continue;
    if (typeof f.label !== "string") continue;
    if (typeof f.type !== "string" || !SUPPORTED_TYPES.has(f.type)) continue;
    if (seen.has(f.key) || RESERVED_METADATA_KEYS.has(f.key)) continue;
    seen.add(f.key);

    const options = Array.isArray(f.options)
      ? f.options.filter((o): o is string => typeof o === "string" && o !== "")
      : undefined;
    const optionLabels =
      typeof f.optionLabels === "object" && f.optionLabels !== null
        ? (f.optionLabels as Record<string, string>)
        : undefined;
    const rawShowWhen = f.showWhen as { field?: unknown; value?: unknown } | null | undefined;
    const showWhen =
      rawShowWhen &&
      typeof rawShowWhen.field === "string" &&
      typeof rawShowWhen.value === "string"
        ? { field: rawShowWhen.field, value: rawShowWhen.value }
        : null;

    fields.push({
      key: f.key,
      type: f.type as MetadataFieldType,
      label: f.label,
      required: f.required === true,
      options,
      optionLabels,
      helpText: typeof f.helpText === "string" ? f.helpText : null,
      maxLength: typeof f.maxLength === "number" ? f.maxLength : null,
      min: typeof f.min === "number" ? f.min : null,
      max: typeof f.max === "number" ? f.max : null,
      integer: f.integer === true,
      showWhen,
    });
  }
  return { fields };
}

export function isEmptyMetadataValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Storage formats shared with the mobile app (same Supabase rows, read and
 * written by the `save_listing_with_fields` RPC):
 * - multi-select → comma-joined string, e.g. "black,white"
 * - boolean      → "yes" / "no"
 * The web keeps arrays / booleans in form state and accepts both formats when
 * reading, then writes these formats via `serializeMetadataForStorage`.
 */
export function toBooleanValue(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["yes", "true", "1"].includes(text)) return true;
  if (["no", "false", "0"].includes(text)) return false;
  return null;
}

export function toMultiValues(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const parts = Array.isArray(value) ? value.map(String) : String(value).split(",");
  return Array.from(new Set(parts.map((v) => v.trim()).filter((v) => v !== "")));
}

/** Convert form/server values into the shared (mobile-compatible) format. */
export function serializeMetadataForStorage<T>(
  schema: CategoryMetadataSchema | undefined | null,
  metadata: Record<string, T>
): Record<string, T | string> {
  if (!schema) return metadata;
  const types = new Map(schema.fields.map((f) => [f.key, f.type]));
  const out: Record<string, T | string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const type = types.get(key);
    if (type === "multi-select") {
      const values = toMultiValues(value);
      if (values.length > 0) out[key] = values.join(",");
    } else if (type === "boolean") {
      const bool = toBooleanValue(value);
      if (bool !== null) out[key] = bool ? "yes" : "no";
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * `expected` may list several accepted values separated by commas
 * (`parent_value = "used,used_good,refurbished"`); any one of them matches.
 */
function valueMatches(value: unknown, expected: string): boolean {
  if (isEmptyMetadataValue(value)) return false;
  const wanted = expected
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v !== "");
  if (wanted.length === 0) return false;
  const matchOne = (v: unknown) => wanted.includes(String(v).trim().toLowerCase());
  if (Array.isArray(value)) return value.some(matchOne);
  if (typeof value === "boolean") {
    const accepted = value ? ["true", "yes", "1"] : ["false", "no", "0"];
    return wanted.some((w) => accepted.includes(w));
  }
  return matchOne(value);
}

/**
 * Fields currently applicable for the given values. A conditional field is
 * visible only while its parent is visible and holds the expected value, so
 * chains (A → B → C) collapse when an ancestor changes.
 */
export function getVisibleFields(
  schema: CategoryMetadataSchema | undefined | null,
  metadata: Record<string, unknown>,
  context: MetadataContext = {}
): MetadataField[] {
  if (!schema) return [];
  const byKey = new Map(schema.fields.map((f) => [f.key, f]));
  const memo = new Map<string, boolean>();

  const isVisible = (field: MetadataField, trail: Set<string>): boolean => {
    const cached = memo.get(field.key);
    if (cached !== undefined) return cached;
    let visible = true;
    if (field.showWhen) {
      const parent = byKey.get(field.showWhen.field);
      if (!parent && field.showWhen.field in context) {
        // Depends on a listing-level value such as the listing condition.
        visible = valueMatches(context[field.showWhen.field], field.showWhen.value);
      } else if (!parent || trail.has(parent.key)) {
        // Missing parent or a cycle: never show a field we cannot gate.
        visible = false;
      } else {
        trail.add(field.key);
        const parentValue =
          parent.type === "multi-select"
            ? toMultiValues(metadata[parent.key])
            : parent.type === "boolean"
            ? toBooleanValue(metadata[parent.key])
            : metadata[parent.key];
        visible =
          isVisible(parent, trail) && valueMatches(parentValue, field.showWhen.value);
        trail.delete(field.key);
      }
    }
    memo.set(field.key, visible);
    return visible;
  };

  return schema.fields.filter((f) => isVisible(f, new Set()));
}

/** Drop values of fields that are hidden by their conditions. */
export function stripHiddenMetadata<T>(
  schema: CategoryMetadataSchema | undefined | null,
  metadata: Record<string, T>,
  context: MetadataContext = {}
): Record<string, T> {
  if (!schema) return metadata;
  const visible = new Set(getVisibleFields(schema, metadata, context).map((f) => f.key));
  const known = new Set(schema.fields.map((f) => f.key));
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !known.has(key) || visible.has(key))
  );
}

export function validateMetadata(
  schema: CategoryMetadataSchema | undefined | null,
  metadata: Record<string, unknown>,
  context: MetadataContext = {}
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!schema) return errors;

  // Hidden conditional fields are neither required nor validated.
  for (const field of getVisibleFields(schema, metadata, context)) {
    const value = metadata[field.key];
    if (isEmptyMetadataValue(value)) {
      if (field.required) errors[field.key] = `${field.label} is required`;
      continue;
    }

    if (field.type === "number") {
      const n = typeof value === "boolean" ? Number.NaN : Number(value);
      if (Number.isNaN(n)) {
        errors[field.key] = `${field.label} must be a number`;
      } else if (field.integer && !Number.isInteger(n)) {
        errors[field.key] = `${field.label} must be a whole number`;
      } else if (field.min != null && n < field.min) {
        errors[field.key] = `${field.label} must be at least ${field.min}`;
      } else if (field.max != null && n > field.max) {
        errors[field.key] = `${field.label} must be at most ${field.max}`;
      }
      continue;
    }

    if ((field.type === "text" || field.type === "textarea") && field.maxLength) {
      if (String(value).length > field.maxLength) {
        errors[field.key] = `${field.label} must be at most ${field.maxLength} characters`;
        continue;
      }
    }

    const allowed = field.options && field.options.length > 0 ? field.options : null;
    if (isSingleSelectType(field.type)) {
      if (Array.isArray(value) || (allowed && !allowed.includes(String(value)))) {
        errors[field.key] = `${field.label} is invalid`;
      }
    } else if (field.type === "multi-select") {
      const values = toMultiValues(value);
      if (allowed && values.some((v) => !allowed.includes(v))) {
        errors[field.key] = `${field.label} is invalid`;
      }
    }
  }
  return errors;
}

/**
 * Normalize a value for storage/form state. Empty input becomes `null` so
 * optional fields are never persisted as `0`, `false` or `""` by accident.
 */
export function normalizeMetadataValue(
  type: MetadataFieldType,
  value: unknown
): MetadataValue {
  if (type === "boolean") {
    return toBooleanValue(value);
  }
  if (type === "number") {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  if (type === "multi-select") {
    // Accepts arrays and mobile's comma-joined strings.
    const values = toMultiValues(value);
    return values.length > 0 ? values : null;
  }
  if (value === undefined || value === null) return null;
  const text = String(value);
  return text === "" ? null : text;
}

/** Remove empty values so optional fields are not persisted as blanks. */
export function compactMetadata(
  metadata: Record<string, MetadataValue | undefined>
): Record<string, Exclude<MetadataValue, null>> {
  const out: Record<string, Exclude<MetadataValue, null>> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isEmptyMetadataValue(value)) continue;
    out[key] = value as Exclude<MetadataValue, null>;
  }
  return out;
}

export function metadataOptionLabel(field: MetadataField, value: string): string {
  return field.optionLabels?.[value] ?? value;
}

export function formatMetadataValue(field: MetadataField, value: unknown): string {
  if (isEmptyMetadataValue(value)) return "—";
  if (field.type === "boolean") {
    const bool = toBooleanValue(value);
    return bool === null ? String(value) : bool ? "Yes" : "No";
  }
  if (field.type === "multi-select" || Array.isArray(value)) {
    return toMultiValues(value)
      .map((v) => metadataOptionLabel(field, v))
      .join(", ");
  }
  if (isSelectType(field.type)) {
    return metadataOptionLabel(field, String(value));
  }
  return String(value);
}

export interface InheritableFieldRow {
  categoryId: string;
  fieldKey: string;
  label: string;
  sortOrder: number;
  appliesToDescendants: boolean;
}

/**
 * Pick the applicable field per key: the category's own fields plus ancestor
 * fields with `applies_to_descendants` (the rule the listing RPC enforces).
 * The nearest category wins a key; ancestor fields are listed first, then
 * subcategory-specific ones. Pure so it can be unit-tested.
 */
export function resolveInheritedFields<T extends InheritableFieldRow>(rows: T[], categoryId: string, depthById: Map<string, number>): T[] {
  const winners = new Map<string, T>();
  for (const f of rows) {
    const depth = depthById.get(f.categoryId);
    if (depth === undefined) continue;
    if (f.categoryId !== categoryId && !f.appliesToDescendants) continue;
    const existing = winners.get(f.fieldKey);
    if (!existing || depth < depthById.get(existing.categoryId)!) {
      winners.set(f.fieldKey, f);
    }
  }
  return [...winners.values()].sort((a, b) => {
    const depthDiff = depthById.get(b.categoryId)! - depthById.get(a.categoryId)!;
    if (depthDiff !== 0) return depthDiff;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Display label for a listing's condition. `listings.condition` is the source
 * of truth; listings created before it replaced the duplicate `condition`
 * category field may only have `metadata.condition`, so fall back to that.
 */
export function resolveListingConditionLabel(
  condition: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  conditions: { code: string; label: string }[]
): string | null {
  const legacy = metadata?.condition;
  const code = condition || (typeof legacy === "string" && legacy ? legacy : null);
  if (!code) return null;
  const match = conditions.find((c) => c.code === code);
  if (match) return match.label;
  return code
    .replace(/_/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
