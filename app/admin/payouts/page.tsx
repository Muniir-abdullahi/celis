import { fetchAdminPayouts } from "~/server/admin.functions";
import { PayoutsContent } from "./payouts-content";

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; status?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const page = Math.max(1, Math.floor(Number(rawPage) || 1));
  const status = rawStatus ?? "";
  const data = await fetchAdminPayouts({
    data: { status: status || undefined, page, limit: 10 },
  });
  return <PayoutsContent data={data} initialStatus={status} />;
}