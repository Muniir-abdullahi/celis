"use client";

import Link from "next/link";
import type { fetchAdminStats, fetchAdminRecentActivity } from "~/server/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AdminTable } from "~/components/admin/admin-table";
import { KpiCard } from "~/components/admin/kpi-card";
import { PageHeader } from "~/components/admin/page-header";
import {
  ListingStatusBadge,
  UserRoleBadge,
  VerificationBadge,
} from "~/components/admin/status-badge";
import { TrendChart, StatusPieChart } from "~/components/admin/admin-chart";
import { formatPrice, formatRelativeDate } from "~/lib/format";
import {
  Users,
  LayoutGrid,
  Package,
  Wallet,
  TrendingUp,
  ArrowRight,
  DollarSign,
  CreditCard,
  AlertCircle,
  Clock,
} from "lucide-react";

type AdminStats = Awaited<ReturnType<typeof fetchAdminStats>>;
type AdminDashboardData = {
  counts: AdminStats["counts"];
  ordersByStatus: AdminStats["ordersByStatus"];
  trend: AdminStats["trend"];
  recentActivity: Awaited<ReturnType<typeof fetchAdminRecentActivity>>;
};
export function AdminDashboardContent({ data }: { data: AdminDashboardData }) {
  const { counts, trend, ordersByStatus, recentActivity } = data;

  const orderPieData = ordersByStatus.map((o) => ({
    name: o.status,
    value: o.value,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of marketplace activity"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total users"
          value={counts.users}
          icon={Users}
          tone="primary"
        />
        <KpiCard
          title="Active listings"
          value={counts.activeListings}
          icon={LayoutGrid}
          tone="success"
          subtitle={`${counts.suspendedListings} suspended`}
        />
        <KpiCard
          title="Total orders"
          value={counts.orders}
          icon={Package}
          tone="default"
        />
        <KpiCard
          title="Completed payments"
          value={counts.completedPayments}
          icon={CreditCard}
          tone="primary"
        />
        <KpiCard
          title="Total revenue"
          value={formatPrice(counts.totalRevenue)}
          icon={DollarSign}
          tone="success"
        />
        <KpiCard
          title="Total payouts"
          value={formatPrice(counts.totalPayouts)}
          icon={Wallet}
          tone="default"
        />
        <KpiCard
          title="Net revenue"
          value={formatPrice(counts.netRevenue)}
          icon={TrendingUp}
          tone={counts.netRevenue >= 0 ? "success" : "destructive"}
        />
        <KpiCard
          title="Pending payouts"
          value={counts.pendingPayouts}
          icon={AlertCircle}
          tone="caution"
        />
        <KpiCard
          title="Expiring soon"
          value={counts.expiringSoon}
          icon={Clock}
          tone="caution"
          href="/admin/listings?status=active&expiryWindow=3"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-celis-border bg-celis-surface-base lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">
                  Revenue trend
                </CardTitle>
                <p className="text-xs text-celis-ink-secondary">
                  Payments vs payouts over the last 14 days
                </p>
              </div>
              <Badge variant="secondary">14 days</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <TrendChart data={trend} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-celis-border bg-celis-surface-base">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Orders by status</CardTitle>
            <p className="text-xs text-celis-ink-secondary">
              Distribution of current orders
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <StatusPieChart data={orderPieData} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-celis-border bg-celis-surface-base">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivityTabs {...recentActivity} />
        </CardContent>
      </Card>
    </div>
  );
}

function RecentActivityTabs({
  recentListings,
  recentUsers,
  recentPayments,
}: {
  recentListings: {
    id: string;
    title: string;
    price: number;
    status: string;
    categoryName: string;
    sellerName: string;
    createdAt: string;
  }[];
  recentUsers: {
    id: string;
    email: string;
    role: string;
    displayName: string | null;
    isVerified: boolean;
    isSuperAdmin: boolean;
    createdAt: string;
  }[];
  recentPayments: {
    id: string;
    amount: number;
    status: string;
    userEmail: string;
    createdAt: string;
  }[];
}) {
  return (
    <Tabs defaultValue="listings" className="w-full">
      <TabsList className="mb-4 bg-celis-surface-inset">
        <TabsTrigger value="listings">Listings</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
      </TabsList>

      <TabsContent value="listings">
        <AdminTable
          rows={recentListings}
          keyExtractor={(r) => r.id}
          columns={[
            {
              key: "title",
              header: "Listing",
              cell: (r) => (
                <div>
                  <p className="font-medium text-celis-ink">{r.title}</p>
                  <p className="text-xs text-celis-ink-secondary">
                    {r.sellerName} · {r.categoryName}
                  </p>
                </div>
              ),
            },
            {
              key: "price",
              header: "Price",
              cell: (r) => (
                <span className="font-mono tabular-nums">
                  {formatPrice(r.price)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (r) => <ListingStatusBadge status={r.status} />,
            },
            {
              key: "posted",
              header: "Posted",
              cell: (r) => (
                <span className="text-xs text-celis-ink-secondary">
                  {formatRelativeDate(r.createdAt)}
                </span>
              ),
            },
          ]}
        />
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/listings">
              View all listings
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="payments">
        <AdminTable
          rows={recentPayments}
          keyExtractor={(r) => r.id}
          columns={[
            {
              key: "user",
              header: "User",
              cell: (r) => (
                <div>
                  <p className="font-medium text-celis-ink">{r.userEmail}</p>
                  <p className="text-xs text-celis-ink-secondary">{r.status}</p>
                </div>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              cell: (r) => (
                <span className="font-mono tabular-nums">
                  {formatPrice(r.amount)}
                </span>
              ),
            },
            {
              key: "date",
              header: "Date",
              cell: (r) => (
                <span className="text-xs text-celis-ink-secondary">
                  {formatRelativeDate(r.createdAt)}
                </span>
              ),
            },
          ]}
        />
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/reports">
              View ledger
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="users">
        <AdminTable
          rows={recentUsers}
          keyExtractor={(r) => r.id}
          columns={[
            {
              key: "user",
              header: "User",
              cell: (r) => (
                <div>
                  <p className="font-medium text-celis-ink">
                    {r.displayName ?? r.email}
                  </p>
                  <p className="text-xs text-celis-ink-secondary">{r.email}</p>
                </div>
              ),
            },
            {
              key: "role",
              header: "Role",
              cell: (r) => <UserRoleBadge role={r.role} />,
            },
            {
              key: "verified",
              header: "Verified",
              cell: (r) => <VerificationBadge verified={r.isVerified} />,
            },
            {
              key: "joined",
              header: "Joined",
              cell: (r) => (
                <span className="text-xs text-celis-ink-secondary">
                  {formatRelativeDate(r.createdAt)}
                </span>
              ),
            },
          ]}
        />
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/users">
              View all users
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
