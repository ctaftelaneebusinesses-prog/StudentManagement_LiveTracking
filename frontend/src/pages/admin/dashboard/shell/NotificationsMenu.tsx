import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, BellRing, ShieldAlert } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { AppNotification, NOTIFICATION_TYPE_LABEL } from "@/types/notification.types";
import { resolveNotificationRoute } from "@/utils/notificationNavigation";

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationsMenu() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { subscribe, isSubscribing, error: pushError } = usePushNotifications();
  const { roleNames } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const notificationsPageUrl = pathname.startsWith("/dashboard/super-admin")
    ? "/dashboard/super-admin/notifications"
    : "/dashboard/admin/notifications";
  const [isOpen, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleItemClick(notification: AppNotification) {
    if (!notification.isRead) markAsRead(notification.id);
    setOpen(false);
    const route = resolveNotificationRoute(notification, roleNames);
    if (route) navigate(route);
  }

  async function handleEnableNotifications() {
    const ok = await subscribe();
    if (ok) setPermission("granted");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-secondary)] transition-all duration-150 hover:scale-105 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
      >
        <Bell size={17} strokeWidth={1.85} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--delta-bad)] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 w-80 animate-slide-up overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-xl dark:border-white/[0.1] dark:bg-[#1c1c1f]">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
            <p className="text-sm font-semibold text-[var(--ink-primary)]">Notifications</p>
            {unreadCount > 0 && <span className="text-xs text-[var(--ink-muted)]">{unreadCount} unread</span>}
          </div>

          {permission !== "granted" && (
            <div className="border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={isSubscribing}
                className="flex w-full items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-left text-xs font-medium text-accent-700
                  transition-colors hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-70
                  dark:bg-accent-500/10 dark:text-accent-300 dark:hover:bg-accent-500/20"
              >
                <BellRing size={14} strokeWidth={2} />
                {isSubscribing ? "Enabling…" : "Enable notifications"}
              </button>
              {pushError && <p className="mt-1.5 text-[11px] text-[var(--delta-bad)]">{pushError}</p>}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-[var(--ink-muted)] dark:bg-white/[0.06]">
                  <Bell size={18} strokeWidth={1.5} />
                </span>
                <p className="text-sm text-[var(--ink-muted)]">You're all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {notifications.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={`block w-full px-4 py-3 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                        n.isRead ? "" : "bg-accent-50/60 dark:bg-accent-500/[0.06]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide ${
                            n.type === "emergency" ? "text-[var(--delta-bad)]" : "text-accent-600 dark:text-accent-300"
                          }`}
                        >
                          {n.type === "emergency" && <ShieldAlert size={11} />}
                          {NOTIFICATION_TYPE_LABEL[n.type]}
                        </span>
                        <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-[var(--ink-primary)]">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--ink-muted)]">{n.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(notificationsPageUrl);
            }}
            className="block w-full border-t border-black/[0.06] px-4 py-2.5 text-center text-xs font-medium text-accent-600 transition-colors hover:bg-black/[0.03] dark:border-white/[0.08] dark:text-accent-300 dark:hover:bg-white/[0.04]"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
