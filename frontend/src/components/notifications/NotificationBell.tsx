import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { AppNotification, NOTIFICATION_TYPE_LABEL } from "@/types/notification.types";

/** Where clicking a notification of this type should take the viewer, based on their role. Only "van" is wired up for now — other types just mark-as-read as before. */
function vanNotificationRoute(roleNames: string[]): string {
  if (roleNames.includes("driver")) return "/dashboard/driver";
  if (roleNames.includes("student")) return "/dashboard/portal/transport";
  return "/dashboard/admin/transport?tab=monitoring";
}

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, permission, requestBrowserPermission } = useNotifications();
  const { roleNames } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleItemClick(notification: AppNotification) {
    if (!notification.isRead) markAsRead(notification.id);
    if (notification.type === "van") {
      setOpen(false);
      navigate(vanNotificationRoute(roleNames));
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/[0.08] dark:bg-[#17171a]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
            <div className="flex items-center gap-3">
              {permission === "default" && (
                <button
                  type="button"
                  onClick={requestBrowserPermission}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Enable alerts
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/10">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={`block w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
                        n.isRead ? "" : "bg-brand-50/60 dark:bg-brand-500/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-medium uppercase tracking-wide ${
                            n.type === "emergency" ? "text-red-600 dark:text-red-400" : "text-brand-600 dark:text-brand-100"
                          }`}
                        >
                          {NOTIFICATION_TYPE_LABEL[n.type]}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
