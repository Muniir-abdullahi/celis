import { fetchAdminAuditLogs } from "~/server/admin.functions";
import { AuditLogContent } from "./audit-log-content";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const raw = (await searchParams).page;
  const page = Math.max(1, Math.floor(Number(Array.isArray(raw) ? raw[0] : raw) || 1));
  const data = await fetchAdminAuditLogs({ data: { page, limit: 25 } });
  return <AuditLogContent data={data} />;
}