"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { fetchAdminPackageDetail } from "~/server/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Pagination } from "~/components/ui/pagination";
import { AdminTable } from "~/components/admin/admin-table";
import { PageHeader } from "~/components/admin/page-header";
import { formatDate, formatPrice } from "~/lib/format";
import { ArrowLeft, Search } from "lucide-react";
import { CancelAssignmentDialog } from "~/components/admin/cancel-assignment-dialog";
import { cancelSellerPackageAssignment } from "~/server/package-assignment.functions";

type DetailData = Awaited<ReturnType<typeof fetchAdminPackageDetail>>;
type Filter = DetailData["filter"];

const FILTER_LABELS: Record<Filter, string> = {
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
  all: "All",
};

function statusBadge(status: string) {
  const variant = status === "active" ? "success" : status === "cancelled" ? "outline" : "secondary";
  return (
    <Badge variant={variant as never} className="capitalize">
      {status}
    </Badge>
  );
}

export function PackageDetailContent({ data }: { data: DetailData }) {
  const router = useRouter();
  const pathname = usePathname();
  const { package: pkg, counts, subscribers, filter } = data;
  const [search, setSearch] = useState(data.search);

  const go = (next: { status?: Filter; q?: string; page?: number }) => {
    const params = new URLSearchParams();
    const status = next.status ?? filter;
    const q = next.q ?? data.search;
    if (status !== "active") params.set("status", status);
    if (q) params.set("q", q);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    go({ q: search.trim(), page: 1 });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={pkg.name}
        description={pkg.description ?? "Listing package"}
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/packages">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to packages
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active sellers" value={counts.activeSellers} />
        <Stat label="Sellers ever assigned" value={counts.uniqueSellers} />
        <Stat label="Total assignments" value={counts.totalAssignments} />
      </div>

      <Card className="border-celis-border bg-celis-surface-base">
        <CardHeader>
          <CardTitle className="text-lg">Package</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status">
            <Badge variant={pkg.isActive ? "success" : "outline"}>
              {pkg.isActive ? "Active" : "Inactive"}
            </Badge>
          </Field>
          <Field label="Listings">{pkg.isUnlimited ? "Unlimited" : pkg.listingAllowance}</Field>
          <Field label="Duration">{pkg.durationDays} days</Field>
          <Field label="Price">{formatPrice(pkg.price, pkg.currency)}</Field>
          <Field label="Seller type">
            <span className="capitalize">{pkg.sellerTypeEligibility ?? "Any"}</span>
          </Field>
          <Field label="Featured allowance">{pkg.featuredAllowance ?? "—"}</Field>
          <Field label="Renewal">
            {pkg.autoRenew ? "Auto" : "Manual"}
            {pkg.gracePeriodDays ? ` · ${pkg.gracePeriodDays}d grace` : ""}
          </Field>
          <Field label="Code">{pkg.code ?? "—"}</Field>
        </CardContent>
      </Card>

      <Card className="border-celis-border bg-celis-surface-base">
        <CardHeader className="space-y-4">
          <CardTitle className="text-lg">Sellers with this package</CardTitle>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
                <Button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => go({ status: f, page: 1 })}
                >
                  {FILTER_LABELS[f]}
                </Button>
              ))}
            </div>
            <form onSubmit={onSearch} className="flex w-full gap-2 lg:w-auto">
              <Input
                aria-label="Search sellers"
                placeholder="Search name, business or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="lg:w-72"
              />
              <Button type="submit" variant="outline" aria-label="Search">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-0 pb-4">
          {subscribers.items.length === 0 ? (
            <p className="px-6 pb-2 text-sm text-celis-ink-secondary">
              {data.search
                ? "No sellers match this search."
                : filter === "active"
                ? "No seller currently has this package."
                : "No sellers in this view."}
            </p>
          ) : (
            <AdminTable
              rows={subscribers.items}
              keyExtractor={(s) => s.subscriptionId}
              columns={[
                {
                  key: "seller",
                  header: "Seller",
                  cell: (s) => (
                    <div>
                      <Link
                        href={`/admin/users?search=${encodeURIComponent(s.email)}`}
                        className="font-medium text-celis-ink hover:text-celis-primary"
                      >
                        {s.businessName || s.sellerName || "Unnamed seller"}
                      </Link>
                      <p className="text-xs text-celis-ink-secondary">
                        {s.email}
                        {s.sellerType ? ` · ${s.sellerType}` : ""}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (s) => statusBadge(s.effectiveStatus),
                },
                {
                  key: "usage",
                  header: "Listings used",
                  cell: (s) => (
                    <span className="tabular-nums">
                      {s.listingsUsed}
                      {pkg.isUnlimited ? "" : ` / ${pkg.listingAllowance}`}
                    </span>
                  ),
                },
                {
                  key: "period",
                  header: "Period",
                  cell: (s) => (
                    <span className="text-xs text-celis-ink-secondary">
                      {formatDate(s.startedAt)} – {formatDate(s.expiresAt)}
                    </span>
                  ),
                },
                {
                  key: "assigned",
                  header: "Assigned",
                  cell: (s) => (
                    <div className="text-xs text-celis-ink-secondary">
                      <p>{s.assignedByEmail ?? "Self / system"}</p>
                      {s.assignmentSource && (
                        <p className="capitalize">{s.assignmentSource.replace(/_/g, " ")}</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: "paid",
                  header: "Paid",
                  cell: (s) => (
                    <span className="tabular-nums text-sm">
                      {s.pricePaidCents != null ? formatPrice(s.pricePaidCents, pkg.currency) : "—"}
                    </span>
                  ),
                },
                { key: "actions", header: "Actions / cancellation", cell: (s) => s.effectiveStatus === "active"
                  ? <CancelAssignmentDialog seller={s.sellerName ?? s.email} packageName={pkg.name} onCancel={(input) => cancelSellerPackageAssignment({ data: { ...input, assignmentId: s.subscriptionId } })} />
                  : s.cancelledAt ? <div className="text-xs text-celis-ink-secondary"><p>{s.cancellationReason?.replaceAll("_", " ")}</p><p>{formatDate(s.cancelledAt)}</p><p>Admin: {s.cancelledBy}</p>{s.cancellationNotes && <p>{s.cancellationNotes}</p>}</div> : "—" },
              ]}
            />
          )}
          {subscribers.totalPages > 1 && (
            <div className="px-4">
              <Pagination
                page={subscribers.page}
                totalPages={subscribers.totalPages}
                onPageChange={(p) => go({ page: p })}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-celis-border bg-celis-surface-base">
      <CardContent className="p-4">
        <p className="text-sm text-celis-ink-secondary">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-celis-ink">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-celis-ink-secondary">{label}</p>
      <div className="font-medium">{children}</div>
    </div>
  );
}
