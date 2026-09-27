import { fetchUnverifiedSellers } from "~/server/admin.functions";
import { fetchCurrentUserPermissions } from "~/server/auth.functions";
import { VerificationsContent } from "./verifications-content";

type Status = "pending" | "rejected" | "suspended";

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[]; status?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawSearch = Array.isArray(params.search) ? params.search[0] : params.search;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const status: Status = rawStatus === "rejected" || rawStatus === "suspended" ? rawStatus : "pending";
  const page = Math.max(1, Math.floor(Number(rawPage) || 1));
  const [result, permissions] = await Promise.all([
    fetchUnverifiedSellers({ data: { search: rawSearch, status, page, limit: 10 } }),
    fetchCurrentUserPermissions(),
  ]);
  return (
    <VerificationsContent
      result={result}
      permissions={permissions}
      search={{ search: rawSearch, status, page }}
    />
  );
}