import { z } from "zod";
import {
  fetchAdminListingPackages,
  fetchAdminListings,
} from "~/server/admin.functions";
import { listCategories } from "~/server/categories.functions";
import { ListingsContent } from "./listings-content";

export const metadata = { title: "Listings | Admin | Celis" };

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    categoryId?: string | string[];
    packageId?: string | string[];
    expiryWindow?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const status = first(params.status);
  const categoryIdValue = first(params.categoryId);
  const packageIdValue = first(params.packageId);
  const categoryId = z.string().uuid().safeParse(categoryIdValue).success
    ? categoryIdValue
    : undefined;
  const packageId = z.string().uuid().safeParse(packageIdValue).success
    ? packageIdValue
    : undefined;
  const expiryValue = first(params.expiryWindow);
  const expiryParsed = expiryValue === undefined ? undefined : Number(expiryValue);
  const expiryWindow =
    expiryParsed !== undefined &&
    Number.isInteger(expiryParsed) &&
    expiryParsed >= 0
      ? expiryParsed
      : undefined;
  const page = Math.max(1, Math.floor(Number(first(params.page)) || 1));
  const [listings, categories, packages] = await Promise.all([
    fetchAdminListings({
      data: {
        status: status ?? (expiryWindow !== undefined ? "active" : undefined),
        categoryId,
        packageId,
        expiryWindow,
        page,
        limit: 10,
      },
    }),
    listCategories(),
    fetchAdminListingPackages(),
  ]);

  return (
    <ListingsContent
      data={{ listings, categories, packages }}
      search={{ status, categoryId, packageId, expiryWindow, page }}
    />
  );
}
