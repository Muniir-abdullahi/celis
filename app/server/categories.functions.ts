"use server";

import { z } from "zod";
import {
  getRootCategories,
  getChildCategories,
  getCategoryCounts,
  getMinMaxPrices,
  getCategoryConditions as getCategoryConditionsDb,
  getCategoryMetadataSchema,
  updateCategoryMetadataSchema,
} from "./categories.server";
import { db } from "~/db";
import { categoryConditions } from "~/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "./auth.server";
import type { CategoryMetadataSchema } from "~/lib/category-metadata";

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryConditionItem = {
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

export async function listCategories() {

  const rows = await getRootCategories();
  return rows.map<CategoryListItem>((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

const parentCategoryIdSchema = z.object({ parentId: z.string().uuid() });

export async function listChildCategories(input: { data: unknown }) {
  const data = (parentCategoryIdSchema).parse(input.data);

    const rows = await getChildCategories(data.parentId);
    return rows.map<CategoryListItem>((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
}

export async function fetchCategoryCounts() {

    return getCategoryCounts();
}

export async function fetchPriceRange() {

    return getMinMaxPrices();
}

const categoryIdSchema = z.object({ categoryId: z.string().uuid() });

export async function fetchCategoryConditions(input: { data: unknown }) {
  const data = (categoryIdSchema).parse(input.data);

    const rows = await getCategoryConditionsDb(data.categoryId);
    return rows.map<CategoryConditionItem>((r) => ({
      code: r.code,
      label: r.label,
      description: r.description,
      sortOrder: r.sortOrder,
    }));
}

const saveConditionsSchema = z.object({
  categoryId: z.string().uuid(),
  conditions: z.array(
    z.object({
      code: z.string().min(1),
      label: z.string().min(1),
      description: z.string().optional(),
      sortOrder: z.coerce.number().int().default(0),
      isActive: z.boolean().default(true),
    })
  ),
});

export async function saveCategoryConditions(input: { data: unknown }) {
  const data = (saveConditionsSchema).parse(input.data);

    await requirePermission("categories:manage");
    await db.transaction(async (tx) => {
      await tx
        .delete(categoryConditions)
        .where(eq(categoryConditions.categoryId, data.categoryId));
      if (data.conditions.length > 0) {
        await tx.insert(categoryConditions).values(
          data.conditions.map((c) => ({
            categoryId: data.categoryId,
            code: c.code,
            label: c.label,
            description: c.description ?? null,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
          }))
        );
      }
    });
    return { success: true };
}

export async function fetchCategoryMetadataSchema(input: { data: unknown }) {
  const data = (categoryIdSchema).parse(input.data);

    return getCategoryMetadataSchema(data.categoryId);
}

const saveMetadataSchemaValidator = z.object({
  categoryId: z.string().uuid(),
  schema: z.object({
    fields: z.array(
      z.object({
        key: z.string().min(1),
        type: z.enum(["text", "number", "boolean", "select"]),
        label: z.string().min(1),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
      })
    ),
  }),
});

export async function saveCategoryMetadataSchema(input: { data: unknown }) {
  const data = (saveMetadataSchemaValidator).parse(input.data);

    await requirePermission("categories:manage");
    await updateCategoryMetadataSchema(data.categoryId, data.schema as CategoryMetadataSchema);
    return { success: true };
}
