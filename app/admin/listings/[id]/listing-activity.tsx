"use client";

import { usePathname, useRouter } from "next/navigation";
import type { fetchListingAuditLogs } from "~/server/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Pagination } from "~/components/ui/pagination";
import { AdminTable } from "~/components/admin/admin-table";
import { formatRelativeDate } from "~/lib/format";

type ActivityData = Awaited<ReturnType<typeof fetchListingAuditLogs>>;

const ACTION_LABELS: Record<string, string> = {
  listing_created: "Created",
  listing_submitted_with_package: "Submitted (package)",
  listing_fee_paid: "Listing fee paid",
  listing_fee_payment_failed: "Listing fee payment failed",
  listing_feature_paid: "Feature fee paid",
  listing_feature_payment_failed: "Feature fee payment failed",
  listing_approved: "Approved",
  listing_rejected: "Rejected",
  listing_status_changed: "Status changed",
  listing_renewed: "Renewed",
  listing_expiry_extended: "Expiry extended",
  listing_payment_marked_paid_manually: "Payment marked paid manually",
  listing_expiry_notification_sent: "Expiry reminder sent",
  "listing.seller_edit": "Edited by seller",
};

/** Keys that are internal ids or noise in this listing-scoped view. */
const HIDDEN_KEYS = new Set(["actorId", "listingId", "sellerId"]);

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

function humanize(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDetail(value: string | number | boolean | null) {
  if (value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).replace(/_/g, " ");
}

export function ListingActivity({ data }: { data: ActivityData }) {
  const router = useRouter();
  const pathname = usePathname();
  const { items, page, totalPages, total } = data;

  return (
    <Card className="border-celis-border bg-celis-surface-base">
      <CardHeader>
        <CardTitle className="text-lg">Activity log</CardTitle>
        <p className="text-sm text-celis-ink-secondary">
          {total === 0
            ? "No recorded activity for this listing yet."
            : `${total} recorded event${total === 1 ? "" : "s"}: moderation, status, payment and seller edits.`}
        </p>
      </CardHeader>
      {total > 0 && (
        <CardContent className="space-y-4 p-0 pb-4">
          <AdminTable
            rows={items}
            keyExtractor={(l) => l.id}
            columns={[
              {
                key: "action",
                header: "Action",
                cell: (l) => (
                  <span className="font-medium text-celis-ink">{actionLabel(l.action)}</span>
                ),
              },
              {
                key: "actor",
                header: "By",
                cell: (l) => (
                  <span className="text-sm text-celis-ink-secondary">
                    {l.actorEmail ?? "System"}
                  </span>
                ),
              },
              {
                key: "details",
                header: "Details",
                cell: (l) => {
                  const entries = Object.entries(l.metadata ?? {}).filter(
                    ([key]) => !HIDDEN_KEYS.has(key)
                  );
                  if (entries.length === 0) {
                    return <span className="text-xs text-celis-ink-tertiary">—</span>;
                  }
                  return (
                    <dl className="max-w-md space-y-0.5 text-xs">
                      {entries.map(([key, value]) => (
                        <div key={key} className="flex gap-1">
                          <dt className="text-celis-ink-tertiary">{humanize(key)}:</dt>
                          <dd className="break-words text-celis-ink-secondary">
                            {formatDetail(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  );
                },
              },
              {
                key: "when",
                header: "When",
                cell: (l) => (
                  <span
                    className="text-xs text-celis-ink-secondary"
                    title={new Date(l.createdAt).toLocaleString()}
                  >
                    {formatRelativeDate(l.createdAt)}
                  </span>
                ),
              },
            ]}
          />
          {totalPages > 1 && (
            <div className="px-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) =>
                  router.push(`${pathname}${p > 1 ? `?activity=${p}` : ""}`, { scroll: false })
                }
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
