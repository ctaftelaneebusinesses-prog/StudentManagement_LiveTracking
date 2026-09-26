import { supabaseAdmin } from "../config/supabase";
import { logger } from "../config/logger";
import { autoMarkAbsentees } from "./teacherAttendance.service";

const POLL_INTERVAL_MS = 60_000;

interface SchoolSettingsRow {
  id: string;
  settings: { attendance?: { teacherCheckinCutoff?: string } } | null;
}

// FN-05: the per-school `teacherCheckinCutoff` is a wall-clock time. Previously
// the cutoff (compared against the server's LOCAL time) and the attendance date
// (a UTC date) were computed in different zones, so on a UTC-hosted server the
// sweep could fire on the wrong day / at the wrong time. Compute BOTH in a
// single school-local zone. This app is India-based (+91 numbers, Indian region
// data); if multi-timezone schools are ever added, store a per-school zone here.
const SCHOOL_TIME_ZONE = "Asia/Kolkata";

function schoolLocalNow(): { date: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // en-CA hour12:false can emit "24" at midnight
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hhmm: `${hour}:${get("minute")}` };
}

async function sweepSchoolsPastCutoff() {
  const { data, error } = await supabaseAdmin.from("schools").select("id, settings").eq("is_active", true);
  if (error) {
    logger.error({ err: error }, "Teacher attendance scheduler: failed to list schools");
    return;
  }

  const { date: today, hhmm: nowHHMM } = schoolLocalNow();

  for (const school of (data ?? []) as SchoolSettingsRow[]) {
    const cutoff = school.settings?.attendance?.teacherCheckinCutoff;
    if (!cutoff || nowHHMM < cutoff) continue;
    try {
      await autoMarkAbsentees(school.id, today);
    } catch (err) {
      logger.error({ err, schoolId: school.id }, "Teacher attendance scheduler: auto-absent sweep failed");
    }
  }
}

/**
 * Same in-process-poller posture as announcementScheduler.ts — no cron infra
 * in this codebase. Runs every minute; for any school whose configured
 * teacher check-in cutoff has passed for today, marks teachers who haven't
 * tapped "Check In" yet as absent. autoMarkAbsentees only inserts for
 * teachers with no attendance row yet, so repeated ticks after cutoff are
 * harmless no-ops once everyone's been swept.
 */
export function startTeacherAttendanceScheduler() {
  setInterval(() => {
    sweepSchoolsPastCutoff().catch((err) => logger.error({ err }, "Teacher attendance scheduler tick failed"));
  }, POLL_INTERVAL_MS);
}
