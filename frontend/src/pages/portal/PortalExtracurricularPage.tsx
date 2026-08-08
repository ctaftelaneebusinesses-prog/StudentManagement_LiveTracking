import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Award, Bell, CalendarCheck, Clock, Image as ImageIcon, MapPin, Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as extracurricularService from "@/services/portal/extracurricular.service";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { staggerContainer, fadeSlideUp } from "./components/ui/portalMotion";

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Sparkles; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ background: "linear-gradient(135deg, var(--portal-grad-from), var(--portal-grad-to))" }}
      >
        <Icon size={16} strokeWidth={1.85} />
      </span>
      <h2 className="text-sm font-semibold text-[var(--ink-primary)]">{title}</h2>
    </div>
  );
}

export function PortalExtracurricularPage() {
  const studentId = usePortalStudentId();
  const { data, isLoading } = useQuery({
    queryKey: ["portal", "extracurricular", studentId],
    queryFn: () => extracurricularService.fetchExtracurricularOverview(studentId),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PortalSkeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PortalSkeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const overview = data ?? {
    todaysPractice: [],
    upcomingEvents: [],
    practiceWork: [],
    achievements: [],
    gallery: [],
    announcements: [],
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Extracurricular Activities</h1>
        <p className="text-sm text-[var(--ink-muted)]">Practice sessions, events, awards, and announcements from your activity teachers.</p>
      </div>

      <motion.div variants={fadeSlideUp}>
        <PortalGlassCard noHover className="space-y-3">
          <SectionHeader icon={Clock} title="Today's Practice" />
          {overview.todaysPractice.length === 0 ? (
            <PortalEmptyState title="No practice sessions today" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overview.todaysPractice.map((slot) => (
                <div key={slot.id} className="rounded-xl border p-3" style={{ borderColor: "var(--portal-glass-border)" }}>
                  <p className="text-sm font-semibold text-[var(--ink-primary)]">
                    {slot.extracurricular_batches?.activities?.name ?? "Activity"}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--ink-secondary)]">
                    <Clock size={12} strokeWidth={1.75} className="text-[var(--ink-muted)]" />
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </p>
                  {slot.venue && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                      <MapPin size={12} strokeWidth={1.75} />
                      {slot.venue}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </PortalGlassCard>
      </motion.div>

      <motion.div variants={fadeSlideUp}>
        <PortalGlassCard noHover className="space-y-3">
          <SectionHeader icon={CalendarCheck} title="Upcoming Events & Competitions" />
          {overview.upcomingEvents.length === 0 ? (
            <PortalEmptyState title="No upcoming events" />
          ) : (
            <ul className="space-y-2">
              {overview.upcomingEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                  style={{ borderColor: "var(--portal-glass-border)" }}
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-primary)]">{event.title}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{event.activities?.name ?? "General"}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--ink-secondary)]">
                    <span>{new Date(event.event_date).toLocaleDateString()}</span>
                    {event.start_time && <span>{formatTime(event.start_time)}</span>}
                    {event.venue && <span>{event.venue}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PortalGlassCard>
      </motion.div>

      <motion.div variants={fadeSlideUp}>
        <PortalGlassCard noHover className="space-y-3">
          <SectionHeader icon={Sparkles} title="Practice Work & Activity Schedule" />
          {overview.practiceWork.length === 0 ? (
            <PortalEmptyState title="No practice work assigned yet" />
          ) : (
            <ul className="space-y-2">
              {overview.practiceWork.map((work) => (
                <li key={work.id} className="rounded-xl border p-3" style={{ borderColor: "var(--portal-glass-border)" }}>
                  <p className="text-sm font-semibold text-[var(--ink-primary)]">{work.title}</p>
                  {work.description && <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">{work.description}</p>}
                  {work.due_date && <p className="mt-1 text-xs text-[var(--ink-muted)]">Due {new Date(work.due_date).toLocaleDateString()}</p>}
                </li>
              ))}
            </ul>
          )}
        </PortalGlassCard>
      </motion.div>

      <motion.div variants={fadeSlideUp}>
        <PortalGlassCard noHover className="space-y-3">
          <SectionHeader icon={Trophy} title="Awards & Certificates" />
          {overview.achievements.length === 0 ? (
            <PortalEmptyState icon={Award} title="No awards or certificates yet" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overview.achievements.map((a) => (
                <div key={a.id} className="rounded-xl border p-3" style={{ borderColor: "var(--portal-glass-border)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--ink-primary)]">{a.title}</p>
                    <Trophy size={15} strokeWidth={1.75} className="shrink-0 text-amber-500" />
                  </div>
                  {a.description && <p className="mt-1 text-xs text-[var(--ink-secondary)]">{a.description}</p>}
                  <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                    {a.achieved_on ? new Date(a.achieved_on).toLocaleDateString() : new Date(a.uploaded_at).toLocaleDateString()}
                  </p>
                  {a.signed_url && (
                    <a href={a.signed_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs font-medium hover:underline" style={{ color: "var(--portal-accent)" }}>
                      View certificate →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </PortalGlassCard>
      </motion.div>

      <motion.div variants={fadeSlideUp}>
        <PortalGlassCard noHover className="space-y-3">
          <SectionHeader icon={Bell} title="Teacher Announcements" />
          {overview.announcements.length === 0 ? (
            <PortalEmptyState title="No announcements yet" />
          ) : (
            <ul className="space-y-2">
              {overview.announcements.map((n) => (
                <li key={n.id} className="rounded-xl border p-3" style={{ borderColor: "var(--portal-glass-border)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--ink-primary)]">{n.title}</p>
                    <Badge variant="info">{new Date(n.created_at).toLocaleDateString()}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ink-secondary)]">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </PortalGlassCard>
      </motion.div>

      <motion.div variants={fadeSlideUp}>
        <PortalGlassCard noHover className="space-y-3">
          <SectionHeader icon={ImageIcon} title="Activity Gallery" />
          {overview.gallery.length === 0 ? (
            <PortalEmptyState icon={ImageIcon} title="No photos yet" description="Photos from certificates and achievements will appear here." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {overview.gallery.map((g) => (
                <a
                  key={g.id}
                  href={g.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border transition-transform hover:-translate-y-0.5"
                  style={{ borderColor: "var(--portal-glass-border)" }}
                >
                  {g.signed_url && <img src={g.signed_url} alt={g.title} className="h-28 w-full object-cover" />}
                </a>
              ))}
            </div>
          )}
        </PortalGlassCard>
      </motion.div>
    </motion.div>
  );
}
