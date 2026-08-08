import { supabaseAdmin } from "../config/supabase";
import { logger } from "../config/logger";
import { autoMarkAbsentees } from "./teacherAttendance.service";

const POLL_INTERVAL_MS = 60_000;

interface SchoolSettingsRow {
  id: string;
  settings: { attendance?: { teacherCheckinCutoff?: string } } | null;
}

function currentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

async function sweepSchoolsPastCutoff() {
  const { data, error } = await supabaseAdmin.from("schools").select("id, settings").eq("is_active", true);
  if (error) {
    logger.error({ err: error }, "Teacher attendance scheduler: failed to list schools");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const nowHHMM = currentHHMM();

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
