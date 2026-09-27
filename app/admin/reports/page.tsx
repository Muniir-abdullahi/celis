import { z } from "zod";
import {
  fetchAdminLedger,
  fetchFailedPaymentsReport,
  fetchNewListingsReport,
  fetchNewUsersReport,
} from "~/server/admin.functions";
import { ReportsContent } from "./reports-content";

export const metadata = { title: "Reports | Admin | Celis" };

const tabSchema = z.enum(["ledger", "failed-payments", "new-users", "new-listings"]);
const typeSchema = z.enum(["all", "payment", "payout", "refund"]);

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const tab = tabSchema.catch("ledger").parse(first(params.tab));
  const type = typeSchema.catch("all").parse(first(params.type));
  const from = first(params.from);
  const to = first(params.to);
  const includePending = first(params.includePending) === "true";
  const page = Math.max(1, Math.floor(Number(first(params.page)) || 1));
  const common = { from, to, page, limit: 10 };
  const [ledger, failedPayments, newUsers, newListings] = await Promise.all([
    fetchAdminLedger({ data: { ...common, type } }),
    fetchFailedPaymentsReport({ data: { ...common, includePending } }),
    fetchNewUsersReport({ data: common }),
    fetchNewListingsReport({ data: common }),
  ]);
  return <ReportsContent ledger={ledger} failedPayments={failedPayments} newUsers={newUsers} newListings={newListings} search={{ tab, type, from, to, includePending, page }} />;
}
