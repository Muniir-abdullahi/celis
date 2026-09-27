import { fetchAdminStats, fetchAdminRecentActivity } from "~/server/admin.functions";
import { AdminDashboardContent } from "./admin-dashboard-content";

export default async function AdminDashboardPage() {
  const [stats, recentActivity] = await Promise.all([
    fetchAdminStats(),
    fetchAdminRecentActivity(),
  ]);
  return (
    <AdminDashboardContent
      data={{
        counts: stats.counts,
        ordersByStatus: stats.ordersByStatus,
        trend: stats.trend,
        recentActivity,
      }}
    />
  );
}