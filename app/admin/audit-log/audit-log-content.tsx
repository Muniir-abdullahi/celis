"use client";

import { useRouter } from "next/navigation";
import type { fetchAdminAuditLogs } from "~/server/admin.functions";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Pagination } from "~/components/ui/pagination";
import { AdminTable } from "~/components/admin/admin-table";
import { PageHeader } from "~/components/admin/page-header";
import { formatRelativeDate } from "~/lib/format";

type AuditData = Awaited<ReturnType<typeof fetchAdminAuditLogs>>;
function actionLabel(action: string) {
  return action.replace(/_/g, " ");
}

function resourceBadge(log: { resourceType: string }) {
  const type = log.resourceType;
  const variant =
    type === "user"
      ? "secondary"
      : type === "listing"
      ? "default"
      : type === "order"
      ? "outline"
      : type === "payout"
      ? "caution"
      : "secondary";
  return (
    <Badge variant={variant as never} className="capitalize">
      {type.replace(/_/g, " ")}
    </Badge>
  );
}

export function AuditLogContent({ data }: { data: AuditData }) {
  const { items, page, totalPages } = data;
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Record of admin actions and platform changes"
      />

      <Card className="border-celis-border bg-celis-surface-base">
        <CardContent className="p-0">
          <AdminTable
            rows={items}
            keyExtractor={(l) => l.id}
            columns={[
              {
                key: "action",
                header: "Action",
                cell: (l) => (
                  <span className="font-medium capitalize text-celis-ink">
                    {actionLabel(l.action)}
                  </span>
                ),
              },
              {
                key: "resource",
                header: "Resource",
                cell: (l) => (
                  <div className="flex items-center gap-2">
                    {resourceBadge(l)}
                    {l.resourceId && (
                      <code className="text-xs text-celis-ink-tertiary">
                        {l.resourceId.slice(0, 8)}
                      </code>
                    )}
                  </div>
                ),
              },
              {
                key: "actor",
                header: "Actor",
                cell: (l) => (
                  <span className="text-sm text-celis-ink-secondary">
                    {l.actorEmail ?? "System"}
                  </span>
                ),
              },
              {
                key: "details",
                header: "Details",
                cell: (l) =>
                  l.metadata ? (
                    <pre className="max-w-xs truncate text-xs text-celis-ink-secondary">
                      {JSON.stringify(l.metadata)}
                    </pre>
                  ) : (
                    <span className="text-xs text-celis-ink-tertiary">—</span>
                  ),
              },
              {
                key: "when",
                header: "When",
                cell: (l) => (
                  <span className="text-xs text-celis-ink-secondary">
                    {formatRelativeDate(l.createdAt)}
                  </span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(p) =>
          router.push(`/admin/audit-log${p > 1 ? `?page=${p}` : ""}`)
        }
      />
    </div>
  );
}
