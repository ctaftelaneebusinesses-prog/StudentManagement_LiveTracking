import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as dashboardService from "@/services/portal/dashboard.service";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { staggerContainer, fadeSlideUp } from "./components/ui/portalMotion";

/** Published school events reach students as `type: "announcement"` notifications (see announcement.service.ts::publishAnnouncement) — this page lists that same feed in full, already scoped server-side to this student's school/class. */
export function PortalEventsPage() {
  const studentId = usePortalStudentId();
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["portal", "events", studentId],
    queryFn: () => dashboardService.fetchEvents(studentId),
    enabled: !!studentId,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => dashboardService.markAnnouncementRead(studentId, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "events", studentId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "dashboard", "announcements", studentId] });
    },
  });

  const events = (eventsQuery.data ?? []).filter((n) => n.type === "announcement");

  return (
    <div className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Events</h1>
        <p className="text-sm text-[var(--ink-muted)]">School and class events published for you.</p>
      </div>

      <PortalGlassCard noHover className="space-y-4">
        {eventsQuery.isLoading ? (
          <PortalSkeleton className="h-32 w-full" />
        ) : events.length === 0 ? (
          <PortalEmptyState title="No events yet" description="Published events for your school or class will show up here." icon={CalendarDays} />
        ) : (
          <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2.5">
            {events.map((event) => (
              <motion.li
                key={event.id}
                variants={fadeSlideUp}
                className="rounded-xl border p-3 text-sm"
                style={{
                  borderColor: event.isRead ? "var(--portal-glass-border)" : "var(--portal-accent)",
                  background: event.isRead ? "transparent" : "var(--portal-accent-soft)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--ink-primary)]">{event.title}</p>
                    <p className="text-[var(--ink-muted)]">{event.message}</p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      {new Date(event.created_at).toLocaleDateString()} {event.classes ? `· ${event.classes.name} - ${event.classes.section}` : "· School-wide"}
                    </p>
                  </div>
                  {!event.isRead && (
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1 text-xs"
                      onClick={() => markReadMutation.mutate(event.id)}
                      isLoading={markReadMutation.isPending && markReadMutation.variables === event.id}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </PortalGlassCard>
    </div>
  );
}
