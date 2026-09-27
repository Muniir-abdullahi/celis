import type { Metadata } from "next";
import { requireNextUser } from "~/lib/require-next-user";
import { fetchNotifications } from "~/server/notifications.functions";
import { NotificationsList } from "./notifications-list";

export const metadata: Metadata = {
  title: "Notifications | Celis",
  description: "View your Celis notifications.",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireNextUser("/notifications");
  const value = (await searchParams).page;
  const requestedPage = Number(Array.isArray(value) ? value[0] : value) || 1;
  const page = Math.max(1, Math.floor(requestedPage));
  const data = await fetchNotifications({ data: { page, limit: 10 } });
  return <NotificationsList data={data} />;
}