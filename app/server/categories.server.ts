import { db } from "~/db";
import {
  categories,
  categoryClosure,
  categoryConditions,
  categoryFieldOptions,
  categoryFields,
  listings,
} from "~/db/schema";
import { eq, isNull, count, sql, and, asc, inArray } from "drizzle-orm";
import type { ValidationRules } from "~/db/schema";
import {
  normalizeCategoryMetadataSchema,
  resolveInheritedFields,
  type CategoryMetadataSchema,
} from "~/lib/category-metadata";

export async function getRootCategories() {
  return db
    .select()
    .from(categories)
    .where(and(isNull(categories.parentId), eq(categories.isActive, true)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getChildCategories(parentId: string) {
  return db
    .select()
    .from(categories)
    .where(
      and(eq(categories.parentId, parentId), eq(categories.isActive, true))
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryById(id: string) {
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}

const MAX_CATEGORY_DEPTH = 8;

type ResolvedFieldRow = {
  id: string;
  categoryId: string;
  fieldKey: string;
  label: string;
  type: string;
  helpText: string | null;
  required: boolean;
  maxLength: number | null;
  minValue: string | null;
  maxValue: string | null;
  validationRules: ValidationRules | null;
  sortOrder: number;
  parentFieldId: string | null;
  parentValue: string | null;
  appliesToDescendants: boolean;
};

/**
 * Category details for a (sub)category, resolved from `category_fields` with
 * inheritance and conditional (`parent_field_id` / `parent_value`) display.
 * Categories without any applicable `category_fields` rows fall back to the
 * legacy hand-edited `metadata_schema` jsonb of the nearest category with one.
 */
/**
 * The category and its ancestors, self first (depth 0). The hierarchy is
 * shallow, so a few primary-key lookups are cheaper than a recursive query.
 */
async function getCategoryChain(categoryId: string) {
  const chain: { id: string; depth: number; metadataSchema: unknown }[] = [];
  let currentId: string | null = categoryId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId) && chain.length < MAX_CATEGORY_DEPTH) {
    seen.add(currentId);
    const [row]: { id: string; parentId: string | null; metadataSchema: unknown }[] = await db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        metadataSchema: categories.metadataSchema,
      })
      .from(categories)
      .where(eq(categories.id, currentId))
      .limit(1);
    if (!row) break;
    chain.push({ id: row.id, depth: chain.length, metadataSchema: row.metadataSchema });
    currentId = row.parentId;
  }
  return chain;
}

export async function getCategoryMetadataSchema(categoryId: string): Promise<CategoryMetadataSchema | null> {
  const chain = await getCategoryChain(categoryId);
  if (chain.length === 0) return null;

  const depthById = new Map(chain.map((c) => [c.id, c.depth]));
  const fieldRows: ResolvedFieldRow[] = await db
    .select({
      id: categoryFields.id,
      categoryId: categoryFields.categoryId,
      fieldKey: categoryFields.fieldKey,
      label: categoryFields.label,
      type: categoryFields.type,
      helpText: categoryFields.helpText,
      required: categoryFields.required,
      maxLength: categoryFields.maxLength,
      minValue: categoryFields.minValue,
      maxValue: categoryFields.maxValue,
      validationRules: categoryFields.validationRules,
      sortOrder: categoryFields.sortOrder,
      parentFieldId: categoryFields.parentFieldId,
      parentValue: categoryFields.parentValue,
      appliesToDescendants: categoryFields.appliesToDescendants,
    })
    .from(categoryFields)
    .where(
      and(
        inArray(categoryFields.categoryId, chain.map((c) => c.id)),
        eq(categoryFields.isActive, true)
      )
    );

  const ordered = resolveInheritedFields(fieldRows, categoryId, depthById);
  if (ordered.length === 0) {
    for (const c of chain) {
      const legacy = normalizeCategoryMetadataSchema(c.metadataSchema);
      if (legacy && legacy.fields.length > 0) return legacy;
    }
    return normalizeCategoryMetadataSchema(chain[0].metadataSchema);
  }

  const optionRows = await db
    .select({
      categoryFieldId: categoryFieldOptions.categoryFieldId,
      value: categoryFieldOptions.value,
      label: categoryFieldOptions.label,
    })
    .from(categoryFieldOptions)
    .where(
      and(
        inArray(categoryFieldOptions.categoryFieldId, ordered.map((f) => f.id)),
        eq(categoryFieldOptions.isActive, true),
        isNull(categoryFieldOptions.parentOptionId)
      )
    )
    .orderBy(asc(categoryFieldOptions.sortOrder), asc(categoryFieldOptions.label));

  const optionsByField = new Map<string, { value: string; label: string }[]>();
  for (const o of optionRows) {
    const list = optionsByField.get(o.categoryFieldId) ?? [];
    list.push({ value: o.value, label: o.label });
    optionsByField.set(o.categoryFieldId, list);
  }
  const keyByFieldId = new Map(fieldRows.map((f) => [f.id, f.fieldKey]));
  const toNumber = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return normalizeCategoryMetadataSchema({
    fields: ordered.map((f) => {
      const options = optionsByField.get(f.id) ?? [];
      const rules = f.validationRules ?? {};
      const parentKey = f.parentFieldId ? keyByFieldId.get(f.parentFieldId) : undefined;
      return {
        key: f.fieldKey,
        type: f.type,
        label: f.label,
        // validateMetadata only checks visible fields, so all three mean
        // "required when shown" on the web.
        required:
          f.required || rules.required === true || rules.requiredWhenVisible === true,
        options: options.map((o) => o.value),
        optionLabels: Object.fromEntries(options.map((o) => [o.value, o.label])),
        helpText: f.helpText,
        maxLength: f.maxLength ?? rules.maxLength ?? null,
        min: toNumber(f.minValue) ?? rules.min ?? null,
        max: toNumber(f.maxValue) ?? rules.max ?? null,
        integer: rules.integer === true,
        showWhen:
          parentKey && f.parentValue ? { field: parentKey, value: f.parentValue } : null,
      };
    }),
  });
}

export async function updateCategoryMetadataSchema(
  categoryId: string,
  schema: CategoryMetadataSchema
) {
  const [row] = await db
    .update(categories)
    .set({ metadataSchema: schema as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(categories.id, categoryId))
    .returning();
  return row;
}

/**
 * Listing condition options for a (sub)category: its own active
 * `category_conditions`, or those of the nearest ancestor that defines any,
 * so subcategories without their own list still get a Condition choice.
 */
export async function getCategoryConditions(categoryId: string) {
  const chain = await getCategoryChain(categoryId);
  if (chain.length === 0) return [];
  const rows = await db
    .select()
    .from(categoryConditions)
    .where(
      and(
        inArray(categoryConditions.categoryId, chain.map((c) => c.id)),
        eq(categoryConditions.isActive, true)
      )
    )
    .orderBy(asc(categoryConditions.sortOrder), asc(categoryConditions.label));
  for (const c of chain) {
    const own = rows.filter((r) => r.categoryId === c.id);
    if (own.length > 0) return own;
  }
  return [];
}

export async function getCategoryPath(categoryId: string) {
  return db
    .select({ ancestorId: categoryClosure.ancestorId, depth: categoryClosure.depth })
    .from(categoryClosure)
    .where(eq(categoryClosure.descendantId, categoryId))
    .orderBy(categoryClosure.depth);
}

export async function getCategoryCounts() {
  const rows = await db
    .select({
      categoryId: listings.categoryId,
      listingCount: count(),
    })
    .from(listings)
    .where(eq(listings.status, "active"))
    .groupBy(listings.categoryId);

  return rows;
}

export async function getMinMaxPrices() {
  const rows = await db
    .select({
      min: sql<number>`COALESCE(MIN(${listings.price}), 0)`,
      max: sql<number>`COALESCE(MAX(${listings.price}), 0)`,
    })
    .from(listings)
    .where(eq(listings.status, "active"));

  return rows[0] ?? { min: 0, max: 0 };
}
