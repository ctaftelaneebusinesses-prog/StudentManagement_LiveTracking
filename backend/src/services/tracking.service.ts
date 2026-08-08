import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import * as notificationService from "./notification.service";
import { isStaff } from "../utils/teacherAccess";
import { listTeacherRouteIds } from "./transport.service";
import { ROLE_ID } from "../config/roles";
import { resolveSchoolAdminRecipientIds } from "../utils/notificationRecipients";
const fail = (error: { message: string } | null) => { if (error) throw ApiError.internal(error.message); };
/** A driver's active vehicle is now reached via the route that names them primary/secondary driver (routes own vehicle+driver assignment, not the vehicle), not a driver_id column on vehicles. */
async function assignedVehicle(schoolId: string, driverId: string): Promise<{ id: string; route_id: string | null }> {
  const r = await supabaseAdmin
    .from("routes")
    .select("vehicle_id, id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .or(`primary_driver_id.eq.${driverId},secondary_driver_id.eq.${driverId}`)
    .limit(1);
  fail(r.error);
  const route = (r.data ?? [])[0];
  if (!route || !route.vehicle_id) throw ApiError.forbidden("No active vehicle is assigned to this driver");
  return { id: route.vehicle_id, route_id: route.id };
}
async function notifyRouteStudents(schoolId: string, driverId: string, routeId: string | null, direction: "pickup" | "drop") {
  if (!routeId) return;
  const r = await supabaseAdmin
    .from("student_pickup_points")
    .select("students!inner(id), pickup_points!inner(route_id)")
    .eq("pickup_points.route_id", routeId)
    .eq("is_active", true);
  if (r.error) { logger.error({ err: r.error }, "Failed to look up route students for van notification"); return; }
  const studentIds = Array.from(new Set((r.data ?? []).map((row: any) => row.students?.id).filter(Boolean)));
  if (studentIds.length === 0) return;
  await notificationService.notifyStudents(schoolId, driverId, studentIds, {
    title: direction === "pickup" ? "Van is on the way" : "Van has started the drop route",
    message: direction === "pickup" ? "Your school van has started its pickup route." : "Your school van has started its drop route.",
    type: "van",
    metadata: { route_id: routeId, direction },
  });
}
/** Every user holding a given role at this school — mirrors leaveRequest.service.ts's resolveUserIdsByRole (duplicated locally rather than shared, matching this codebase's per-domain-helper convention). */
async function resolveUserIdsByRole(schoolId: string, roleId: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("school_id", schoolId).eq("role_id", roleId);
  if (error) {
    logger.error({ err: error }, "Failed to resolve users by role for van notification");
    return [];
  }
  return (data ?? []).map((r) => r.user_id as string);
}

/** students.class_id -> classes.class_teacher_id -> users.id — the homeroom teacher's user id for a student, or null if the student has no class/homeroom teacher set. */
async function resolveClassTeacherId(studentId: string): Promise<string | null> {
  const student = await supabaseAdmin.from("students").select("class_id").eq("id", studentId).maybeSingle();
  if (student.error || !student.data?.class_id) return null;
  const cls = await supabaseAdmin.from("classes").select("class_teacher_id").eq("id", student.data.class_id).maybeSingle();
  if (cls.error) return null;
  return cls.data?.class_teacher_id ?? null;
}

/** "8:15 AM" — hand-rolled rather than toLocaleTimeString so the AM/PM casing in notification text is guaranteed regardless of the server's ICU data. */
function formatTimeLabel(date: Date): string {
  const period = date.getHours() >= 12 ? "PM" : "AM";
  const hours = date.getHours() % 12 || 12;
  return `${hours}:${date.getMinutes().toString().padStart(2, "0")} ${period}`;
}

/** Fired when a driver marks a student picked-up/absent — notifies the student plus the student's class teacher and every admin/principal at the school. Message wording is direction-aware: a pickup-leg mark means boarded/didn't board, a drop-leg mark (same status values, reused) means dropped home/not dropped. */
async function notifyPickupStatus(schoolId: string, driverId: string, studentId: string, status: "picked_up" | "absent", direction: "pickup" | "drop") {
  const [classTeacherId, principalIds, adminTierIds, studentRow] = await Promise.all([
    resolveClassTeacherId(studentId),
    resolveUserIdsByRole(schoolId, ROLE_ID.PRINCIPAL),
    resolveSchoolAdminRecipientIds(schoolId), // multi-school- and super_admin-aware
    supabaseAdmin.from("students").select("users(full_name)").eq("id", studentId).maybeSingle(),
  ]);
  const staffRecipients = Array.from(
    new Set([...(classTeacherId ? [classTeacherId] : []), ...principalIds, ...adminTierIds])
  );

  const studentName = (studentRow.data?.users as unknown as { full_name: string } | null)?.full_name ?? "The student";
  const timeLabel = formatTimeLabel(new Date());

  let title: string;
  let message: string;
  if (direction === "pickup") {
    title = status === "picked_up" ? "Student boarded the school bus" : "Student did not board the school bus";
    message =
      status === "picked_up"
        ? `${studentName} has boarded the school bus at ${timeLabel}.`
        : `${studentName} was absent and did not board the school bus at ${timeLabel}.`;
  } else {
    title = status === "picked_up" ? "Student dropped home safely" : "Student not dropped home";
    message =
      status === "picked_up"
        ? `${studentName} has been dropped home safely at ${timeLabel}.`
        : `${studentName} was not dropped home at ${timeLabel}.`;
  }

  await notificationService.notifyStudents(schoolId, driverId, [studentId], { title, message, type: "van", metadata: { student_id: studentId, status, direction } });
  if (staffRecipients.length > 0) {
    await notificationService.notifyUsers(schoolId, driverId, staffRecipients, { title, message, type: "van", metadata: { student_id: studentId, status, direction } });
  }
}

/** Fired once a trip ends — tells every student marked picked-up on that trip they've arrived (school for a pickup leg, home for a drop leg). Students marked absent or never marked are not notified. */
async function notifyTripCompleted(schoolId: string, driverId: string, tripId: string, direction: "pickup" | "drop") {
  const r = await supabaseAdmin.from("trip_student_status").select("student_id").eq("trip_id", tripId).eq("status", "picked_up");
  if (r.error) {
    logger.error({ err: r.error }, "Failed to look up picked-up students for trip-completed notification");
    return;
  }
  const studentIds = (r.data ?? []).map((row) => row.student_id as string);
  if (studentIds.length === 0) return;

  await notificationService.notifyStudents(schoolId, driverId, studentIds, {
    title: direction === "pickup" ? "Reached school safely" : "Dropped home safely",
    message: direction === "pickup" ? "Your child has reached school safely." : "Your child has been dropped home safely.",
    type: "van",
    metadata: { trip_id: tripId, direction },
  });
}

const ETA_ARRIVED_DISTANCE_KM = 0.2;
const LIVE_LOCATION_FRESHNESS_MS = 3 * 60 * 1000;

interface EtaTarget {
  latitude: number;
  longitude: number;
  source: "self" | "stop";
}

/** Resolves what a student's ETA/threshold-notification distance should be measured against: their own live location if it's been shared recently (within LIVE_LOCATION_FRESHNESS_MS), otherwise their assigned stop's fixed coordinates — so tracking degrades gracefully instead of breaking when nobody has the Transport page open. */
async function resolveEtaTarget(studentId: string, fallbackStopId: string | null): Promise<EtaTarget | null> {
  const liveLoc = await supabaseAdmin.from("student_live_locations").select("latitude, longitude, recorded_at").eq("student_id", studentId).maybeSingle();
  if (!liveLoc.error && liveLoc.data) {
    const ageMs = Date.now() - new Date(liveLoc.data.recorded_at).getTime();
    if (ageMs <= LIVE_LOCATION_FRESHNESS_MS) {
      return { latitude: Number(liveLoc.data.latitude), longitude: Number(liveLoc.data.longitude), source: "self" };
    }
  }
  if (!fallbackStopId) return null;
  const stop = await supabaseAdmin.from("pickup_points").select("latitude, longitude").eq("id", fallbackStopId).maybeSingle();
  if (stop.error || stop.data?.latitude == null || stop.data?.longitude == null) return null;
  return { latitude: Number(stop.data.latitude), longitude: Number(stop.data.longitude), source: "stop" };
}

/** Marks off + notifies once per trip+student when the vehicle crosses the 10-minute, 5-minute, and arrived thresholds — the `.is(column, null)` guard is what makes this safe to call on every ~5-10s GPS ping: once a threshold is marked for a student, later pings update zero rows and send nothing further. */
async function notifyStudentThreshold(
  schoolId: string,
  driverId: string,
  tripId: string,
  studentId: string,
  column: "notified_10min_at" | "notified_5min_at" | "notified_arrived_at",
  title: string,
  message: string
) {
  const r = await supabaseAdmin
    .from("trip_student_status")
    .update({ [column]: new Date().toISOString() })
    .eq("trip_id", tripId)
    .eq("student_id", studentId)
    .eq("status", "pending")
    .is(column, null)
    .select("student_id");
  if (r.error) {
    logger.error({ err: r.error }, "Failed to mark ETA-threshold notification dedup state");
    return;
  }
  if ((r.data ?? []).length === 0) return;

  await notificationService.notifyStudents(schoolId, driverId, [studentId], { title, message, type: "van", metadata: { trip_id: tripId } });
}

/** Checks every student still awaiting pickup/drop on this trip against the vehicle's current position — measured against that student's own live location when fresh, else their stop — firing the 10-min/5-min/arrived notifications as each threshold is first crossed. Runs on every recordLocation ping — cheap (only pending students are considered) and safe to call repeatedly thanks to notifyStudentThreshold's dedup guard. */
async function checkEtaThresholds(schoolId: string, driverId: string, tripId: string, latitude: number, longitude: number) {
  const pending = await supabaseAdmin.from("trip_student_status").select("student_id, pickup_point_id").eq("trip_id", tripId).eq("status", "pending");
  if (pending.error) {
    logger.error({ err: pending.error }, "Failed to load pending students for ETA notifications");
    return;
  }
  const pendingRows = pending.data ?? [];
  if (pendingRows.length === 0) return;

  const recent = await supabaseAdmin.from("vehicle_locations").select("latitude, longitude, recorded_at").eq("trip_id", tripId).order("recorded_at", { ascending: false }).limit(5);
  const averageSpeedKmh = estimateAverageSpeedKmh(recent.data ?? []);

  for (const row of pendingRows) {
    const target = await resolveEtaTarget(row.student_id, row.pickup_point_id);
    if (!target) continue;

    const distanceKm = haversineKm(latitude, longitude, target.latitude, target.longitude);
    const etaMinutes = (distanceKm / averageSpeedKmh) * 60;
    const nearYou = target.source === "self";

    if (distanceKm <= ETA_ARRIVED_DISTANCE_KM) {
      await notifyStudentThreshold(
        schoolId,
        driverId,
        tripId,
        row.student_id,
        "notified_arrived_at",
        "Van has arrived",
        nearYou ? "Your school van has arrived near your location." : "Your school van has arrived at your stop."
      );
    }
    if (etaMinutes <= 5) {
      await notifyStudentThreshold(schoolId, driverId, tripId, row.student_id, "notified_5min_at", "Van is 5 minutes away", "Your school van is about 5 minutes away.");
    }
    if (etaMinutes <= 10) {
      await notifyStudentThreshold(schoolId, driverId, tripId, row.student_id, "notified_10min_at", "Van is 10 minutes away", "Your school van is about 10 minutes away.");
    }
  }
}

interface StudentStopRow {
  student_id: string;
  pickup_point_id: string;
  drop_point_id: string | null;
  pickup_points: { route_id: string } | null;
  drop_pp: { route_id: string } | null;
}

/** Seeds one 'pending' trip_student_status row per student assigned to this route+direction — the driver's present/absent list, and the pool ETA-threshold notifications check off as they're notified. Only ever called once per trip (startTrip returns early, before this runs, when reusing an already in_progress trip), but upserts with ignoreDuplicates defensively. */
async function createTripStudentStatusRows(schoolId: string, tripId: string, routeId: string | null, direction: "pickup" | "drop") {
  if (!routeId) return;

  const r = await supabaseAdmin
    .from("student_pickup_points")
    .select(
      "student_id, pickup_point_id, drop_point_id, " +
        "pickup_points!student_pickup_points_pickup_point_id_fkey(route_id), " +
        "drop_pp:pickup_points!student_pickup_points_drop_point_id_fkey(route_id)"
    )
    .eq("school_id", schoolId)
    .eq("is_active", true);
  if (r.error) {
    logger.error({ err: r.error }, "Failed to look up route students for trip_student_status seeding");
    return;
  }

  const rows = (r.data ?? []) as unknown as StudentStopRow[];
  const seedRows = rows
    .map((row) => {
      const stopId = direction === "pickup" ? row.pickup_point_id : row.drop_point_id ?? row.pickup_point_id;
      const stopRouteId = direction === "pickup" ? row.pickup_points?.route_id : row.drop_pp?.route_id ?? row.pickup_points?.route_id;
      return stopRouteId === routeId
        ? { school_id: schoolId, trip_id: tripId, student_id: row.student_id, pickup_point_id: stopId, status: "pending" as const }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  if (seedRows.length === 0) return;

  const { error } = await supabaseAdmin.from("trip_student_status").upsert(seedRows, { onConflict: "trip_id,student_id", ignoreDuplicates: true });
  if (error) logger.error({ err: error }, "Failed to seed trip_student_status rows");
}

export async function startTrip(schoolId: string, driverId: string, direction: "pickup" | "drop") { const vehicle = await assignedVehicle(schoolId, driverId); const existing = await supabaseAdmin.from("trips").select("id, vehicle_id, route_id, trip_date, direction, status, started_at").eq("vehicle_id", vehicle.id).eq("status", "in_progress").maybeSingle(); fail(existing.error); if (existing.data) return existing.data; const r = await supabaseAdmin.from("trips").insert({ school_id: schoolId, driver_id: driverId, vehicle_id: vehicle.id, route_id: vehicle.route_id, direction, status: "in_progress", started_at: new Date().toISOString() }).select().single(); fail(r.error); await supabaseAdmin.from("trip_history").insert({ school_id: schoolId, trip_id: r.data.id, event_type: "started" }); await createTripStudentStatusRows(schoolId, r.data.id, vehicle.route_id, direction); notifyRouteStudents(schoolId, driverId, vehicle.route_id, direction).catch((err) => logger.error({ err }, "Failed to send van notifications")); return r.data; }

/** Driver marks a student picked-up/absent (or a monitoring-side correction, if extended to staff later) for their active trip — upserts rather than requiring the seeded row to already exist, so marking still works if a student was assigned to the route after the trip started. */
export async function markStudentStatus(schoolId: string, driverId: string, tripId: string, studentId: string, status: "picked_up" | "absent") {
  const trip = await supabaseAdmin.from("trips").select("id, status, direction").eq("id", tripId).eq("school_id", schoolId).eq("driver_id", driverId).maybeSingle();
  fail(trip.error);
  if (!trip.data || trip.data.status !== "in_progress") throw ApiError.forbidden("Marking pickup status requires your active trip");

  const assignment = await supabaseAdmin
    .from("student_pickup_points")
    .select("pickup_point_id, drop_point_id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .maybeSingle();
  fail(assignment.error);
  if (!assignment.data) throw ApiError.notFound("Student has no transport assignment");
  const stopId = trip.data.direction === "pickup" ? assignment.data.pickup_point_id : assignment.data.drop_point_id ?? assignment.data.pickup_point_id;

  const now = new Date().toISOString();
  const r = await supabaseAdmin
    .from("trip_student_status")
    .upsert(
      { school_id: schoolId, trip_id: tripId, student_id: studentId, pickup_point_id: stopId, status, marked_at: now, marked_by: driverId, updated_at: now },
      { onConflict: "trip_id,student_id" }
    )
    .select("id, student_id, pickup_point_id, status, marked_at")
    .single();
  fail(r.error);
  notifyPickupStatus(schoolId, driverId, studentId, status, trip.data.direction as "pickup" | "drop").catch((err) =>
    logger.error({ err }, "Failed to send pickup-status notification")
  );
  return r.data;
}

/** Roster + live pickup/absent status for a trip — the driver's present/absent list and the monitoring page's per-vehicle counts. */
export async function listTripStudentStatus(schoolId: string, tripId: string) {
  const r = await supabaseAdmin
    .from("trip_student_status")
    .select("id, student_id, pickup_point_id, status, marked_at, students(id, admission_no, users(full_name), classes(name, section)), pickup_points(name)")
    .eq("school_id", schoolId)
    .eq("trip_id", tripId)
    .order("created_at");
  fail(r.error);
  return r.data ?? [];
}
export async function recordLocation(schoolId: string, driverId: string, tripId: string, input: { latitude: number; longitude: number; accuracy_meters?: number; speed_mps?: number; heading?: number; recorded_at?: string }) { const trip = await supabaseAdmin.from("trips").select("id, vehicle_id, driver_id, status").eq("id", tripId).eq("school_id", schoolId).eq("driver_id", driverId).maybeSingle(); fail(trip.error); if (!trip.data || trip.data.status !== "in_progress") throw ApiError.forbidden("Location updates require your active trip"); const now = input.recorded_at ?? new Date().toISOString(); const location = await supabaseAdmin.from("vehicle_locations").insert({ school_id: schoolId, trip_id: tripId, vehicle_id: trip.data.vehicle_id, driver_id: driverId, ...input, recorded_at: now }).select().single(); fail(location.error); const update = await supabaseAdmin.from("trips").update({ last_latitude: input.latitude, last_longitude: input.longitude, last_location_at: now }).eq("id", tripId).eq("driver_id", driverId); fail(update.error); await supabaseAdmin.from("trip_history").insert({ school_id: schoolId, trip_id: tripId, event_type: "location", latitude: input.latitude, longitude: input.longitude, occurred_at: now, metadata: { accuracy_meters: input.accuracy_meters, speed_mps: input.speed_mps, heading: input.heading } }); checkEtaThresholds(schoolId, driverId, tripId, input.latitude, input.longitude).catch((err) => logger.error({ err }, "Failed to check ETA thresholds")); return location.data; }
/** Upserts the student's latest known GPS position from their own Transport page — feeds resolveEtaTarget so the next ETA-threshold check personalizes to it instead of the student's fixed stop. */
export async function recordMyLocation(
  schoolId: string,
  studentId: string,
  userId: string,
  input: { latitude: number; longitude: number; accuracy_meters?: number; recorded_at?: string }
) {
  const now = input.recorded_at ?? new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("student_live_locations")
    .upsert(
      { student_id: studentId, school_id: schoolId, latitude: input.latitude, longitude: input.longitude, accuracy_meters: input.accuracy_meters, recorded_at: now, updated_by: userId },
      { onConflict: "student_id" }
    );
  if (error) throw ApiError.internal(error.message);
  return { student_id: studentId, recorded_at: now };
}

export async function endTrip(schoolId: string, driverId: string, tripId: string) { const r = await supabaseAdmin.from("trips").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", tripId).eq("school_id", schoolId).eq("driver_id", driverId).eq("status", "in_progress").select("id, direction").maybeSingle(); fail(r.error); if (!r.data) throw ApiError.notFound("Active trip not found"); await supabaseAdmin.from("trip_history").insert({ school_id: schoolId, trip_id: tripId, event_type: "completed" }); notifyTripCompleted(schoolId, driverId, tripId, r.data.direction).catch((err) => logger.error({ err }, "Failed to send trip-completed notification")); return r.data; }
export async function myVehicles(schoolId: string, studentId: string) {
  const r = await supabaseAdmin
    .from("student_pickup_points")
    .select(
      "students!inner(id, users(full_name)), " +
        "pickup_points!student_pickup_points_pickup_point_id_fkey(id, name, pickup_time, " +
        "routes!inner(id, name, route_code, " +
        "vehicle:vehicles!routes_vehicle_id_fkey(id, vehicle_number, name, trips(id, status, last_latitude, last_longitude, last_location_at, direction, started_at)), " +
        "primary_driver:drivers!routes_primary_driver_id_fkey(users(full_name, phone))))"
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("is_active", true);
  fail(r.error);
  return r.data ?? [];
}
/** Staff (school_admin/principal/super_admin) see every in-progress trip; a `transport.view`-only teacher only sees trips on a route carrying at least one of their own students. `viewer` is omitted by trusted internal callers (e.g. the admin dashboard aggregator) that always want the unscoped, full-school result. */
export async function activeVehicles(schoolId: string, viewer?: { roles: string[]; userId: string }) {
  let query = supabaseAdmin
    .from("trips")
    .select("id, vehicle_id, route_id, direction, started_at, last_latitude, last_longitude, last_location_at, vehicles(vehicle_number, name), routes(name, route_code), drivers(users(full_name))")
    .eq("school_id", schoolId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false });

  if (viewer && !isStaff(viewer.roles)) {
    const routeIds = await listTeacherRouteIds(schoolId, viewer.userId);
    if (routeIds.length === 0) return [];
    query = query.in("route_id", routeIds);
  }

  const r = await query;
  fail(r.error);
  const trips = r.data ?? [];
  if (trips.length === 0) return [];

  const tripIds = trips.map((t) => t.id);
  const statusRows = await supabaseAdmin.from("trip_student_status").select("trip_id, status").in("trip_id", tripIds);
  fail(statusRows.error);

  const counts = new Map<string, { picked_up: number; absent: number; pending: number }>();
  for (const row of statusRows.data ?? []) {
    const c = counts.get(row.trip_id) ?? { picked_up: 0, absent: 0, pending: 0 };
    c[row.status as "picked_up" | "absent" | "pending"]++;
    counts.set(row.trip_id, c);
  }

  return trips.map((trip) => ({ ...trip, studentCounts: counts.get(trip.id) ?? { picked_up: 0, absent: 0, pending: 0 } }));
}

/** Per-student transport history — every trip this student had a pickup/absent mark on, newest first. */
export async function listStudentTransportHistory(schoolId: string, studentId: string) {
  const r = await supabaseAdmin
    .from("trip_student_status")
    .select(
      "id, status, marked_at, " +
        "trips!inner(id, trip_date, direction, status, vehicles(vehicle_number, name), drivers(users(full_name)), routes(name, route_code))"
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("trip_date", { foreignTable: "trips", ascending: false });
  fail(r.error);
  return r.data ?? [];
}

// ----------------------------------------------------------------------------
// Trip History + ETA. No external routing API is configured in this repo, so
// ETA is a local haversine-distance-over-recent-average-speed estimate
// rather than a real road-network calculation.
// ----------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const FALLBACK_SPEED_KMH = 25;

/** Average speed from the last few GPS pings (newest-first) — falls back to an assumed city/school-van speed when there isn't enough recent movement to measure. */
function estimateAverageSpeedKmh(recentLocationsNewestFirst: { latitude: number; longitude: number; recorded_at: string }[]): number {
  if (recentLocationsNewestFirst.length < 2) return FALLBACK_SPEED_KMH;

  const speedSamples: number[] = [];
  for (let i = 0; i < recentLocationsNewestFirst.length - 1; i++) {
    const a = recentLocationsNewestFirst[i];
    const b = recentLocationsNewestFirst[i + 1];
    const hours = Math.abs(new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()) / 3_600_000;
    if (hours > 0) {
      speedSamples.push(haversineKm(Number(a.latitude), Number(a.longitude), Number(b.latitude), Number(b.longitude)) / hours);
    }
  }

  if (speedSamples.length === 0) return FALLBACK_SPEED_KMH;
  const average = speedSamples.reduce((sum, speed) => sum + speed, 0) / speedSamples.length;
  // GPS jitter while stationary can otherwise produce a near-zero "creeping" speed.
  return average > 0.5 ? average : FALLBACK_SPEED_KMH;
}

interface ListTripHistoryFilters {
  vehicleId?: string;
  driverId?: string;
  routeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

/** Past trips (completed/cancelled) with computed duration and a distance estimate from the trip's own GPS pings. */
export async function listTripHistory(schoolId: string, filters: ListTripHistoryFilters) {
  let query = supabaseAdmin
    .from("trips")
    .select(
      "id, vehicle_id, driver_id, route_id, trip_date, direction, status, started_at, completed_at, " +
        "vehicles(vehicle_number), drivers(users(full_name)), routes(name, route_code)",
      { count: "exact" }
    )
    .eq("school_id", schoolId)
    .in("status", ["completed", "cancelled"])
    .order("trip_date", { ascending: false })
    .order("started_at", { ascending: false });

  if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
  if (filters.driverId) query = query.eq("driver_id", filters.driverId);
  if (filters.routeId) query = query.eq("route_id", filters.routeId);
  if (filters.dateFrom) query = query.gte("trip_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("trip_date", filters.dateTo);

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);

  interface TripHistoryRow {
    id: string;
    vehicle_id: string;
    driver_id: string;
    route_id: string | null;
    trip_date: string;
    direction: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    vehicles: { vehicle_number: string } | null;
    drivers: { users: { full_name: string } | null } | null;
    routes: { name: string; route_code: string } | null;
  }
  const trips = (data ?? []) as unknown as TripHistoryRow[];

  const items = await Promise.all(
    trips.map(async (trip) => {
      const durationMinutes =
        trip.started_at && trip.completed_at
          ? Math.round((new Date(trip.completed_at).getTime() - new Date(trip.started_at).getTime()) / 60000)
          : null;

      const { data: locations, error: locationsError } = await supabaseAdmin
        .from("vehicle_locations")
        .select("latitude, longitude, recorded_at")
        .eq("trip_id", trip.id)
        .order("recorded_at", { ascending: true });
      if (locationsError) throw ApiError.internal(locationsError.message);

      const rows = locations ?? [];
      let distanceKm = 0;
      for (let i = 1; i < rows.length; i++) {
        distanceKm += haversineKm(Number(rows[i - 1].latitude), Number(rows[i - 1].longitude), Number(rows[i].latitude), Number(rows[i].longitude));
      }

      return { ...trip, durationMinutes, distanceKm: rows.length > 1 ? Math.round(distanceKm * 10) / 10 : null };
    })
  );

  return { items, total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

/** Per-stop ETA for a trip's route, from its last known GPS position and recent average speed. */
export async function getTripEta(schoolId: string, tripId: string) {
  const { data: trip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("id, route_id, last_latitude, last_longitude, last_location_at")
    .eq("id", tripId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (tripError) throw ApiError.internal(tripError.message);
  if (!trip) throw ApiError.notFound("Trip not found");
  if (!trip.route_id || trip.last_latitude === null || trip.last_longitude === null) return [];

  const { data: recentLocations, error: locationsError } = await supabaseAdmin
    .from("vehicle_locations")
    .select("latitude, longitude, recorded_at")
    .eq("trip_id", tripId)
    .order("recorded_at", { ascending: false })
    .limit(5);
  if (locationsError) throw ApiError.internal(locationsError.message);

  const averageSpeedKmh = estimateAverageSpeedKmh(recentLocations ?? []);

  const { data: stops, error: stopsError } = await supabaseAdmin
    .from("pickup_points")
    .select("id, name, stop_order, latitude, longitude")
    .eq("route_id", trip.route_id)
    .order("stop_order");
  if (stopsError) throw ApiError.internal(stopsError.message);

  return (stops ?? [])
    .filter((stop) => stop.latitude !== null && stop.longitude !== null)
    .map((stop) => {
      const distanceKm = haversineKm(Number(trip.last_latitude), Number(trip.last_longitude), Number(stop.latitude), Number(stop.longitude));
      return {
        pickupPointId: stop.id,
        name: stop.name,
        stopOrder: stop.stop_order,
        distanceKm: Math.round(distanceKm * 10) / 10,
        etaMinutes: Math.round((distanceKm / averageSpeedKmh) * 60),
      };
    });
}

// ----------------------------------------------------------------------------
// Derived student-facing transport status. No geofencing exists anywhere in
// this codebase (no school/home lat-long), so "reached school"/"dropped at
// home" are approximated from trip completion + this student's own
// trip_student_status mark, and "return trip started" vs "returning home" is
// approximated from whether the drop trip has any GPS pings yet.
// ----------------------------------------------------------------------------

export type StudentTripStatus =
  | "waiting_for_pickup"
  | "vehicle_approaching"
  | "picked_up"
  | "reached_school"
  | "return_trip_started"
  | "returning_home"
  | "dropped_at_home"
  | "absent";

/** Today's most relevant trip + derived status for one student, for the student portal. */
export async function getStudentTripStatus(schoolId: string, studentId: string) {
  const assignment = await supabaseAdmin
    .from("student_pickup_points")
    .select("pickup_point_id, drop_point_id, pickup_points!student_pickup_points_pickup_point_id_fkey(route_id)")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle();
  fail(assignment.error);

  const routeId = (assignment.data?.pickup_points as unknown as { route_id: string } | null)?.route_id ?? null;
  if (!assignment.data || !routeId)
    return { status: "waiting_for_pickup" as StudentTripStatus, direction: null, etaMinutes: null, distanceKm: null, trip: null };

  const today = new Date().toISOString().slice(0, 10);
  const tripsResult = await supabaseAdmin
    .from("trips")
    .select("id, direction, status, last_latitude, last_longitude, last_location_at, started_at")
    .eq("school_id", schoolId)
    .eq("route_id", routeId)
    .eq("trip_date", today)
    .order("started_at", { ascending: false });
  fail(tripsResult.error);
  const trips = tripsResult.data ?? [];
  const trip = trips.find((t) => t.status === "in_progress") ?? trips[0] ?? null;
  if (!trip) return { status: "waiting_for_pickup" as StudentTripStatus, direction: null, etaMinutes: null, distanceKm: null, trip: null };

  const statusRow = await supabaseAdmin.from("trip_student_status").select("status").eq("trip_id", trip.id).eq("student_id", studentId).maybeSingle();
  fail(statusRow.error);
  const pickupStatus = statusRow.data?.status ?? "pending";

  let etaMinutes: number | null = null;
  let distanceKm: number | null = null;
  if (trip.status === "in_progress" && trip.last_latitude !== null && trip.last_longitude !== null) {
    const stopId = trip.direction === "pickup" ? assignment.data.pickup_point_id : assignment.data.drop_point_id ?? assignment.data.pickup_point_id;
    const target = await resolveEtaTarget(studentId, stopId);
    if (target) {
      const recent = await supabaseAdmin
        .from("vehicle_locations")
        .select("latitude, longitude, recorded_at")
        .eq("trip_id", trip.id)
        .order("recorded_at", { ascending: false })
        .limit(5);
      const averageSpeedKmh = estimateAverageSpeedKmh(recent.data ?? []);
      const distance = haversineKm(Number(trip.last_latitude), Number(trip.last_longitude), target.latitude, target.longitude);
      distanceKm = Math.round(distance * 10) / 10;
      etaMinutes = Math.round((distance / averageSpeedKmh) * 60);
    }
  }

  let status: StudentTripStatus;
  if (pickupStatus === "absent") {
    status = "absent";
  } else if (trip.direction === "pickup") {
    if (trip.status === "completed") status = pickupStatus === "picked_up" ? "reached_school" : "waiting_for_pickup";
    else status = pickupStatus === "picked_up" ? "picked_up" : "vehicle_approaching";
  } else {
    if (trip.status === "completed" || pickupStatus === "picked_up") status = "dropped_at_home";
    else status = trip.last_location_at ? "returning_home" : "return_trip_started";
  }

  return { status, direction: trip.direction as "pickup" | "drop", etaMinutes, distanceKm, trip: { id: trip.id, status: trip.status } };
}
