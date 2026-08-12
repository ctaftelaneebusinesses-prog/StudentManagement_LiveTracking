import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import * as notificationService from "@/services/notification.service";
import { AppNotification, NOTIFICATION_TYPE_LABEL } from "@/types/notification.types";

function showBrowserNotification(notification: AppNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(`${NOTIFICATION_TYPE_LABEL[notification.type]}: ${notification.title}`, {
    body: notification.message,
    tag: notification.id,
  });
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  permission: NotificationPermission;
  requestBrowserPermission: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * A single realtime subscription + fetch for the whole app, mounted once at
 * the root (see App.tsx). Every consumer used to call this as a plain hook
 * directly, so a page like TeacherDashboardPage.tsx (which shows a "Recent
 * activity" feed) plus the navbar's NotificationBell — both visible at
 * once — each opened their own `notifications-${user.id}` Realtime channel
 * and independently fired a browser notification for the same INSERT event.
 * That's the actual cause of "duplicate browser notifications": not a
 * server-side bug, N independent subscriptions to the same event. A single
 * provider means exactly one subscription and one browser notification per
 * event, no matter how many components read from it.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    notificationService
      .fetchMyNotifications()
      .then((data) => {
        if (isMounted) setNotifications(data);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // filter is REQUIRED, not an optimization: without it this channel
    // broadcasts every INSERT on the whole `notifications` table — every
    // school, every user — to every open browser tab, regardless of RLS.
    // Found live 2026-08-07: a leave-request notification fanned out to 4
    // different recipients (2 school_admins + super_admin) appeared as 4
    // entries in ONE of those school_admin's own notification list, because
    // this handler accepted every incoming row unconditionally. Scoping the
    // subscription itself to this user's own rows is the fix — filtering
    // client-side after the fact would still leak the payload contents
    // (title/message) into memory for a split second, and still cost a
    // wasted render per stranger's notification.
    //
    // Trade-off: this only covers 'user'-scoped rows (the overwhelming
    // majority — every notifyUsers() call). A school-wide/class/role-scoped
    // notification (announcements, emergency alerts) has no audience_user_id
    // and won't push live through this channel; it still appears on the next
    // full fetchMyNotifications() (e.g. next page load), just not instantly.
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `audience_user_id=eq.${user.id}` },
        (payload) => {
          const incoming = { ...(payload.new as AppNotification), isRead: false };
          setNotifications((prev) => {
            // The initial fetchMyNotifications() above can race a realtime
            // INSERT for something created moments earlier — without this
            // check the same row would appear twice in the list.
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
          showBrowserNotification(incoming);
          // New homework should show up on the student dashboard right away,
          // not just the next time it's remounted — reuse this already-open
          // realtime channel instead of adding a separate subscription.
          if (incoming.type === "homework") {
            queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
          }
          // A driver ending a trip must close the live map immediately, not
          // whenever PortalTransportPage's own 12s poll next happens to fire
          // (see its transportQuery comment). Invalidating here forces that
          // refetch right away; the page's existing "no active trip -> clear
          // the map" effect does the rest.
          if (incoming.type === "van" && (incoming.metadata as { event?: string } | null)?.event === "trip_ended") {
            queryClient.invalidateQueries({ queryKey: ["portal", "transport"] });
            queryClient.invalidateQueries({ queryKey: ["portal", "transport-status"] });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
    await notificationService.markNotificationRead(notificationId);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await notificationService.markAllNotificationsRead();
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount, isLoading, markAsRead, markAllAsRead, permission, requestBrowserPermission }),
    [notifications, unreadCount, isLoading, markAsRead, markAllAsRead, permission, requestBrowserPermission]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
