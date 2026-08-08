import { useNotifications } from "@/hooks/useNotifications";

/** Small unread-count pill shown next to the sidebar's "Notifications" nav item, on both the School Console and Platform Console shells. */
export function NavNotificationBadge({ to, collapsed }: { to: string; collapsed: boolean }) {
  const { unreadCount } = useNotifications();
  if (!to.endsWith("/notifications") || unreadCount === 0) return null;

  return (
    <span
      className={`flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-[var(--delta-bad)] px-1 text-[10px] font-semibold text-white ${
        collapsed ? "absolute right-1 top-1" : "ml-auto"
      }`}
    >
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );
}
