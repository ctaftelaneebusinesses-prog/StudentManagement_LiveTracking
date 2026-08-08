import { AnnouncementStatus } from "@/types/announcement.types";

const STATUS_STYLES: Record<AnnouncementStatus, string> = {
  published: "bg-[var(--status-good)]/10 text-[var(--status-good)]",
  scheduled: "bg-[var(--status-warning)]/10 text-[var(--status-warning)]",
};

const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  published: "Published",
  scheduled: "Scheduled",
};

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
