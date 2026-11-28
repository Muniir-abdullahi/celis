import { fetchAdminUsers } from "~/server/admin.functions";
import {
  fetchCurrentUser,
  fetchCurrentUserPermissions,
  fetchRoles,
} from "~/server/auth.functions";
import { UsersContent } from "./users-content";
import { listStaffDepartments } from "~/server/staff-identity.functions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string | string[];
    role?: string | string[];
    domain?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const query = first(params.search);
  const role = first(params.role);
  const domain = first(params.domain) === "internal" ? "internal" : "customer";
  const page = Math.max(1, Math.floor(Number(first(params.page)) || 1));
  const [result, currentUser, permissions, roles, departments] = await Promise.all([
    fetchAdminUsers({
      data: { search: query, role, domain, page, limit: 10 },
    }),
    fetchCurrentUser(),
    fetchCurrentUserPermissions(),
    fetchRoles(),
    listStaffDepartments(),
  ]);
  return (
    <UsersContent
      result={result}
      currentUser={currentUser}
      permissions={permissions}
      roles={roles}
      departments={departments}
      search={{ search: query, role, domain, page }}
    />
  );
}
