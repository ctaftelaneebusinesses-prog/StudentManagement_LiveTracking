import * as announcementService from "./announcement.service";
import { logger } from "../config/logger";

const POLL_INTERVAL_MS = 60_000;

async function publishDueAnnouncements() {
  const due = await announcementService.listDueScheduled();
  for (const announcement of due) {
    try {
      await announcementService.publishAnnouncement(announcement.school_id, announcement);
    } catch (err) {
      logger.error({ err, announcementId: announcement.id }, "Scheduled announcement publish failed");
    }
  }
}

/**
 * There's no cron/job-runner infrastructure in this codebase — scheduling an
 * announcement just means its `publish_at` is in the future. This in-process
 * poller checks once a minute for rows past their `publish_at` that haven't
 * been fanned out yet (`notified_at is null`) and publishes them. It only
 * runs while this server process is up, which is an acceptable trade-off for
 * a single-instance deployment like this one — same posture as the rest of
 * this app's "no background job infra" design.
 */
export function startAnnouncementScheduler() {
  setInterval(() => {
    publishDueAnnouncements().catch((err) => logger.error({ err }, "Announcement scheduler tick failed"));
  }, POLL_INTERVAL_MS);
}
