import { z } from "zod";
import { fetchAdminCategories } from "~/server/admin.functions";
import { fetchCurrentUserPermissions } from "~/server/auth.functions";
import { CategoriesContent } from "./categories-content";

export const metadata = { title: "Categories | Admin | Celis" };

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const categoryIdValue = first(params.categoryId);
  const categoryId = z.string().uuid().safeParse(categoryIdValue).success ? categoryIdValue : undefined;
  const page = Math.max(1, Math.floor(Number(first(params.page)) || 1));
  const [categories, permissions, subcategories] = await Promise.all([
    fetchAdminCategories({ data: { parentId: null, page, limit: 10 } }),
    fetchCurrentUserPermissions(),
    categoryId ? fetchAdminCategories({ data: { parentId: categoryId, page: 1, limit: 100 } }) : Promise.resolve(null),
  ]);
  return <CategoriesContent categories={categories} subcategories={subcategories} permissions={permissions} search={{ categoryId, page }} />;
}
