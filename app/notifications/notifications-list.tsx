"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Pagination } from "~/components/ui/pagination";
import {
  markNotificationReadFn,
  markAllNotificationsReadFn,
  type NotificationItem,
  type fetchNotifications,
} from "~/server/notifications.functions";
import { formatRelativeDate } from "~/lib/format";
import { Bell, Check } from "lucide-react";

type NotificationData = Awaited<ReturnType<typeof fetchNotifications>>;
export function NotificationsList({ data }: { data: NotificationData }) {
  const { items, page, totalPages } = data;
  const [notifications, setNotifications] = useState<NotificationItem[]>(items);
  const router = useRouter();

  const handleMarkRead = async (id: string) => {
    await markNotificationReadFn({ data: { id } });
    setNotifications((prev: NotificationItem[]) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" as const } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadFn();
    setNotifications((prev: NotificationItem[]) =>
      prev.map((n) => ({ ...n, status: "read" as const }))
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-celis-bg">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Notifications</h1>
            <p className="text-sm text-celis-ink-secondary">
              Stay updated on your listings, orders, and account.
            </p>
          </div>
          {notifications.some((n) => n.status === "unread") && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <Check className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-celis-ink-secondary">
                <Bell className="h-12 w-12 opacity-50" />
                <p>No notifications yet.</p>
                <p className="text-sm">
                  When something happens with your listings or orders, it will show up here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-celis-border">
                {notifications.map((n: NotificationItem) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 py-4 ${
                      n.status === "unread" ? "bg-celis-primary-subtle/30" : ""
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        n.status === "unread"
                          ? "bg-celis-primary"
                          : "bg-celis-border"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{n.title}</p>
                      <p className="text-sm text-celis-ink-secondary">{n.body}</p>
                      <p className="mt-1 text-xs text-celis-ink-tertiary">
                        {formatRelativeDate(n.createdAt)}
                      </p>
                      {n.link && (
                        <Button variant="ghost" size="sm" className="h-auto px-0 py-1" asChild>
                          <Link href={n.link?.startsWith("/") && !n.link.startsWith("//") ? n.link : "/notifications"}>View details</Link>
                        </Button>
                      )}
                    </div>
                    {n.status === "unread" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkRead(n.id)}
                      >
                        <Check className="mr-1.5 h-4 w-4" />
                        Mark read
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={(p) => router.push(`/notifications?page=${p}`)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
