import { fetchAdminListingPackages } from "~/server/admin.functions";
import { fetchCurrentUserPermissions } from "~/server/auth.functions";
import { PackagesContent } from "./packages-content";

export const metadata = { title: "Listing packages | Admin | Celis" };

export default async function AdminPackagesPage() {
  const [packages, permissions] = await Promise.all([
    fetchAdminListingPackages(),
    fetchCurrentUserPermissions(),
  ]);
  return <PackagesContent packages={packages} permissions={permissions} />;
}
