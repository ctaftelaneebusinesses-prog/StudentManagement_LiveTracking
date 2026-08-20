import { useNavigate } from "react-router-dom";
import { Bell, BellRing, CheckCheck, ShieldAlert } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { AppNotification, NOTIFICATION_TYPE_LABEL } from "@/types/notification.types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { resolveNotificationRoute } from "@/utils/notificationNavigation";

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Full notification history for any signed-in role — a persistent sidebar
 * destination alongside the topbar bell (NotificationsMenu.tsx), which only
 * shows the latest 8. Same data source (useNotifications), same mark-as-read
 * actions, plus click-to-navigate: a notification whose `metadata.url` was
 * set server-side (see schoolRequest.service.ts's `notify` helper and
 * leaveRequest.service.ts's notifyOnApply) jumps straight to the page that
 * can act on it — everything else just marks itself read, since not every
 * notification-producing flow in the app sets that field yet.
 */
export function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const { subscribe, isSubscribing, error: pushError } = usePushNotifications();
  const { roleNames } = useAuth();
  const navigate = useNavigate();

  const permission: NotificationPermission =
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied";

  async function handleEnablePush() {
    await subscribe();
  }

  function handleClick(notification: AppNotification) {
    if (!notification.isRead) markAsRead(notification.id);
    const route = resolveNotificationRoute(notification, roleNames);
    if (route) navigate(route);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-l-[3px] border-accent-500 pl-3.5">
        <div>
          <h1 className="text-xl font-semibold leading-tight text-[var(--ink-primary)] sm:text-2xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={markAllAsRead}>
            <CheckCheck size={15} strokeWidth={2} />
            Mark all as read
          </Button>
        )}
      </div>

      {permission !== "granted" && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-500/25 bg-accent-500/[0.06] p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-600 dark:text-accent-300">
              <BellRing size={17} strokeWidth={1.9} />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--ink-primary)]">Enable desktop notifications</p>
              <p className="text-xs text-[var(--ink-muted)]">
                Get notified even when this tab is closed, like WhatsApp.
              </p>
            </div>
          </div>
          <Button onClick={handleEnablePush} isLoading={isSubscribing}>
            Enable
          </Button>
        </div>
      )}
      {pushError && <p className="mb-4 text-xs text-red-600">{pushError}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[74px] rounded-2xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-10 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState icon={Bell} title="No notifications yet" description="New activity will show up here." />
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            const hasLink = resolveNotificationRoute(notification, roleNames) !== null;
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => handleClick(notification)}
                  className={`block w-full rounded-2xl border p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                    notification.isRead
                      ? "border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-[#17171a]"
                      : "border-accent-500/25 bg-accent-500/[0.05] dark:bg-accent-500/[0.08]"
                  } ${hasLink ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${
                            notification.type === "emergency"
                              ? "text-[var(--delta-bad)]"
                              : "text-accent-600 dark:text-accent-300"
                          }`}
                        >
                          {notification.type === "emergency" && <ShieldAlert size={11} />}
                          {NOTIFICATION_TYPE_LABEL[notification.type] ?? notification.type}
                        </span>
                        {!notification.isRead && <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />}
                      </div>
                      <p className="mt-1 text-sm font-medium text-[var(--ink-primary)]">{notification.title}</p>
                      <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{notification.message}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-[var(--ink-muted)]">
                      {timeAgo(notification.created_at)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
