import { ApiError } from "./ApiError";

/** Leave applications close for "today" at 6 PM local (server) time — after that, only tomorrow onwards is selectable. Mirrors frontend/src/utils/date.ts exactly, so the client-side date picker and this server-side check never disagree about which dates are valid. */
export const LEAVE_CUTOFF_HOUR = 18;

function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Earliest applyable leave start date: today, or tomorrow once the 6 PM cutoff has passed. */
export function getMinLeaveDate(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() >= LEAVE_CUTOFF_HOUR) d.setDate(d.getDate() + 1);
  return localIsoDate(d);
}

/**
 * Server-side enforcement of the same past-date/6-PM-cutoff rule the
 * frontend date picker applies — never trust the client alone. Throws with a
 * message that distinguishes "that's just in the past" from "today closed at
 * 6 PM", since only one of those is actually true for a given rejected date.
 */
export function assertNotPastLeaveDate(startDate: string, now: Date = new Date()): void {
  const todayStr = localIsoDate(now);
  if (startDate < todayStr) {
    throw ApiError.badRequest("You cannot apply for leave on a past date.");
  }

  const minDate = getMinLeaveDate(now);
  if (startDate < minDate) {
    throw ApiError.badRequest(
      "It's past 6:00 PM, so today is no longer available for a new leave application. Please choose tomorrow or a later date."
    );
  }
}
