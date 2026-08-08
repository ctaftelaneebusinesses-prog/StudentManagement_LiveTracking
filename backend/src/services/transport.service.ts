import { supabaseAdmin } from "../config/supabase";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "../utils/ApiError";
import { provisionUser } from "../utils/provisionUser";
import { generateDefaultPassword } from "../utils/defaultPassword";
import { escapeOrFilterValue } from "../utils/searchFilter";
import { listTeacherStudentIds } from "../utils/teacherAccess";
import * as notificationService from "./notification.service";
const check = (error: { message: string; code?: string } | null) => { if (error) { if (error.code === "23505") throw ApiError.conflict(error.message); throw ApiError.internal(error.message); } };

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "route";
}

// ----------------------------------------------------------------------------
// Route ownership — a route (not a vehicle) owns its vehicle + up to two
// drivers, assigned only while creating/editing the route. These helpers
// reverse-lookup "which route (if any) owns this vehicle/driver" so
// Vehicle/Driver responses can keep the same `drivers`/`routes` nested
// shape the frontend already expects.
// ----------------------------------------------------------------------------

interface RouteOwnershipRow {
  id: string;
  name: string;
  route_code: string | null;
  vehicle_id: string;
  primary_driver: { id: string; users: { full_name: string } } | null;
  secondary_driver: { id: string; users: { full_name: string } } | null;
}

const ROUTE_OWNERSHIP_SELECT =
  "id, name, route_code, vehicle_id, " +
  "primary_driver:drivers!routes_primary_driver_id_fkey(id, users(full_name)), " +
  "secondary_driver:drivers!routes_secondary_driver_id_fkey(id, users(full_name))";

async function routesByVehicleIds(schoolId: string, vehicleIds: string[]): Promise<Map<string, RouteOwnershipRow>> {
  if (vehicleIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from("routes").select(ROUTE_OWNERSHIP_SELECT).eq("school_id", schoolId).in("vehicle_id", vehicleIds);
  if (error) throw ApiError.internal(error.message);
  const map = new Map<string, RouteOwnershipRow>();
  for (const row of (data ?? []) as unknown as RouteOwnershipRow[]) map.set(row.vehicle_id, row);
  return map;
}

function withRouteOwnership<T extends { id: string }>(vehicle: T, route: RouteOwnershipRow | undefined) {
  return {
    ...vehicle,
    drivers: route?.primary_driver ?? null,
    secondary_driver: route?.secondary_driver ?? null,
    routes: route ? { id: route.id, name: route.name, route_code: route.route_code } : null,
  };
}

export async function listVehicles(schoolId: string) {
  const r = await supabaseAdmin
    .from("vehicles")
    .select("id, vehicle_number, name, capacity, make_model, gps_device_id, is_active")
    .eq("school_id", schoolId)
    .order("vehicle_number");
  check(r.error);
  const vehicles = r.data ?? [];
  const routeMap = await routesByVehicleIds(schoolId, vehicles.map((v) => v.id));
  return vehicles.map((v) => withRouteOwnership(v, routeMap.get(v.id)));
}

export async function createVehicle(schoolId: string, input: Record<string, unknown>) { const r = await supabaseAdmin.from("vehicles").insert({ school_id: schoolId, ...input }).select().single(); check(r.error); return r.data; }
export async function listDrivers(schoolId: string) { const r = await supabaseAdmin.from("drivers").select("id, license_number, license_expiry, users(full_name, email, phone, avatar_url, is_active)").eq("school_id", schoolId).order("license_number"); check(r.error); return r.data; }
export async function createDriver(schoolId: string, input: { email: string; full_name: string; phone?: string; password?: string; license_number: string; license_expiry?: string }) { const password = input.password || generateDefaultPassword(input.full_name, input.license_number); const provisioned = await provisionUser({ email: input.email, password, full_name: input.full_name, role_id: ROLE_ID.DRIVER, school_id: schoolId }); const id = provisioned.id; if (input.phone) await supabaseAdmin.from("users").update({ phone: input.phone }).eq("id", id); const result = await supabaseAdmin.from("drivers").insert({ id, school_id: schoolId, license_number: input.license_number, license_expiry: input.license_expiry }); if (result.error) { await supabaseAdmin.auth.admin.deleteUser(id); check(result.error); } return { id }; }

const ROUTE_SELECT =
  "id, name, route_code, description, is_active, to_location, vehicle_id, primary_driver_id, secondary_driver_id, " +
  "vehicle:vehicles!routes_vehicle_id_fkey(id, vehicle_number, name), " +
  "primary_driver:drivers!routes_primary_driver_id_fkey(id, users(full_name)), " +
  "secondary_driver:drivers!routes_secondary_driver_id_fkey(id, users(full_name)), " +
  "pickup_points(id, name, address, stop_order, pickup_time, latitude, longitude)";

export async function listRoutes(schoolId: string) { const r = await supabaseAdmin.from("routes").select(ROUTE_SELECT).eq("school_id", schoolId).order("route_code"); check(r.error); return r.data; }

export async function getRoute(schoolId: string, routeId: string) {
  const { data, error } = await supabaseAdmin.from("routes").select(ROUTE_SELECT).eq("id", routeId).eq("school_id", schoolId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Route not found");
  return data;
}

/** route_code is a legacy display label the new Route form no longer collects — auto-generated from the name (plus a short random suffix, so the school_id+route_code unique constraint can't collide) when omitted. */
export async function createRoute(schoolId: string, input: Record<string, unknown>) {
  const body = { ...input };
  if (!body.route_code && typeof body.name === "string") {
    body.route_code = `${slugify(body.name)}-${Math.random().toString(16).slice(2, 6)}`;
  }
  const r = await supabaseAdmin.from("routes").insert({ school_id: schoolId, ...body }).select(ROUTE_SELECT).single();
  check(r.error);
  return r.data;
}

export async function createPickupPoint(schoolId: string, input: Record<string, unknown>) { const r = await supabaseAdmin.from("pickup_points").insert({ school_id: schoolId, ...input }).select().single(); check(r.error); return r.data; }

/** A student's transport assignment is one stop, used for both pickup and drop — drop_point_id is kept in sync internally (always equal to pickup_point_id) purely so existing per-trip-direction reads elsewhere in the codebase keep resolving to the right stop without themselves needing to change. */
export async function assignStudentPickup(schoolId: string, input: { student_id: string; pickup_point_id: string; transport_direction?: "morning" | "evening" | "both" }) {
  const point = await supabaseAdmin.from("pickup_points").select("id").eq("id", input.pickup_point_id).eq("school_id", schoolId).maybeSingle();
  check(point.error);
  if (!point.data) throw ApiError.notFound("Pickup point not found");
  const r = await supabaseAdmin
    .from("student_pickup_points")
    .upsert(
      {
        school_id: schoolId,
        student_id: input.student_id,
        pickup_point_id: input.pickup_point_id,
        drop_point_id: input.pickup_point_id,
        transport_direction: input.transport_direction ?? "both",
      },
      { onConflict: "student_id" }
    )
    .select()
    .single();
  check(r.error);
  return r.data;
}

interface StudentTransportRow {
  pickup_point_id: string;
  is_active: boolean;
  transport_direction: "morning" | "evening" | "both";
  pickup_points: {
    id: string;
    name: string;
    address: string | null;
    stop_order: number;
    pickup_time: string | null;
    routes: {
      id: string;
      name: string;
      route_code: string;
      vehicle: { id: string; vehicle_number: string; name: string | null; make_model: string | null } | null;
      primary_driver: { users: { full_name: string; phone: string | null } } | null;
    } | null;
  } | null;
}

export async function getStudentTransport(schoolId: string, studentId: string) {
  const assignment = await supabaseAdmin
    .from("student_pickup_points")
    .select(
      "pickup_point_id, is_active, transport_direction, " +
        "pickup_points!student_pickup_points_pickup_point_id_fkey(id, name, address, stop_order, pickup_time, " +
        "routes(id, name, route_code, vehicle:vehicles!routes_vehicle_id_fkey(id, vehicle_number, name, make_model), " +
        "primary_driver:drivers!routes_primary_driver_id_fkey(users(full_name, phone))))"
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .maybeSingle();
  check(assignment.error);
  return (assignment.data as unknown as StudentTransportRow) ?? null;
}

export async function getDriverDashboard(schoolId: string, driverId: string) {
  const routeResult = await supabaseAdmin
    .from("routes")
    .select("id, name, route_code, description, to_location, vehicle:vehicles!routes_vehicle_id_fkey(id, vehicle_number, name, capacity, make_model)")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .or(`primary_driver_id.eq.${driverId},secondary_driver_id.eq.${driverId}`)
    .limit(1);
  check(routeResult.error);
  const route = (routeResult.data ?? [])[0] ?? null;
  if (!route || !route.vehicle) return { vehicle: null, pickup_points: [], students: [], trips: [] };

  const vehicle = { ...(route.vehicle as unknown as Record<string, unknown>), routes: { id: route.id, name: route.name, route_code: route.route_code } };

  const points = await supabaseAdmin.from("pickup_points").select("id, name, address, stop_order, pickup_time").eq("route_id", route.id).order("stop_order");
  check(points.error);
  const ids = (points.data ?? []).map((p) => p.id);
  const students = ids.length
    ? await supabaseAdmin.from("student_pickup_points").select("pickup_point_id, students(id, admission_no, users(full_name), classes(name, section))").eq("school_id", schoolId).eq("is_active", true).in("pickup_point_id", ids)
    : { data: [], error: null };
  check(students.error);
  const trips = await supabaseAdmin.from("trips").select("id, trip_date, direction, status, last_latitude, last_longitude, last_location_at").eq("driver_id", driverId).eq("trip_date", new Date().toISOString().slice(0, 10)).order("created_at", { ascending: false });
  check(trips.error);
  return { vehicle, pickup_points: points.data ?? [], students: students.data ?? [], trips: trips.data ?? [] };
}

// ----------------------------------------------------------------------------
// Vehicle CRUD — list/create above are the original Phase 7 functions; the
// rest (get/update/delete + driver/route/pickup-point management + student
// assignment lookups) are this module's upgrade.
// ----------------------------------------------------------------------------

const VEHICLE_SELECT = "id, vehicle_number, name, capacity, make_model, gps_device_id, registration_number, insurance_expiry, fuel_type, is_active, created_at";

export async function getVehicle(schoolId: string, vehicleId: string) {
  const { data, error } = await supabaseAdmin.from("vehicles").select(VEHICLE_SELECT).eq("id", vehicleId).eq("school_id", schoolId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Vehicle not found");
  const routeMap = await routesByVehicleIds(schoolId, [vehicleId]);
  return withRouteOwnership(data, routeMap.get(vehicleId));
}

export async function updateVehicle(schoolId: string, vehicleId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.from("vehicles").update(patch).eq("id", vehicleId).eq("school_id", schoolId).select(VEHICLE_SELECT).maybeSingle();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict(error.message);
    throw ApiError.internal(error.message);
  }
  if (!data) throw ApiError.notFound("Vehicle not found");
  const routeMap = await routesByVehicleIds(schoolId, [vehicleId]);
  return withRouteOwnership(data, routeMap.get(vehicleId));
}

/** Blocks deleting a vehicle that's mid-trip — dropping it out from under a driver/students currently on the road would be unsafe. */
export async function deleteVehicle(schoolId: string, vehicleId: string) {
  const { data: activeTrip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (tripError) throw ApiError.internal(tripError.message);
  if (activeTrip) throw ApiError.conflict("Cannot delete a vehicle with a trip in progress");

  const { error } = await supabaseAdmin.from("vehicles").delete().eq("id", vehicleId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

// ----------------------------------------------------------------------------
// Driver CRUD. Drivers are provisioned auth users, so "delete" is
// deactivation (users.is_active = false) — matching how Students/Teachers
// handle removal elsewhere in this app — rather than a hard row delete.
// ----------------------------------------------------------------------------

const DRIVER_SELECT = "id, license_number, license_expiry, address, emergency_contact_phone, users(full_name, email, phone, avatar_url, is_active)";

export async function getDriver(schoolId: string, driverId: string) {
  const { data, error } = await supabaseAdmin.from("drivers").select(DRIVER_SELECT).eq("id", driverId).eq("school_id", schoolId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Driver not found");

  const routeResult = await supabaseAdmin
    .from("routes")
    .select("id, name, route_code, vehicle:vehicles!routes_vehicle_id_fkey(id, vehicle_number, make_model)")
    .eq("school_id", schoolId)
    .or(`primary_driver_id.eq.${driverId},secondary_driver_id.eq.${driverId}`)
    .limit(1);
  if (routeResult.error) throw ApiError.internal(routeResult.error.message);
  const route = (routeResult.data ?? [])[0] ?? null;

  return { ...data, vehicle: route?.vehicle ?? null, route: route ? { id: route.id, name: route.name, route_code: route.route_code } : null };
}

export async function updateDriver(
  schoolId: string,
  driverId: string,
  input: { license_number?: string; license_expiry?: string; address?: string; emergency_contact_phone?: string; full_name?: string; phone?: string; avatar_url?: string | null }
) {
  const { full_name, phone, avatar_url, ...driverPatch } = input;

  if (Object.keys(driverPatch).length > 0) {
    const { error } = await supabaseAdmin.from("drivers").update(driverPatch).eq("id", driverId).eq("school_id", schoolId);
    if (error) {
      if (error.code === "23505") throw ApiError.conflict(error.message);
      throw ApiError.internal(error.message);
    }
  }

  if (full_name !== undefined || phone !== undefined || avatar_url !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (full_name !== undefined) userPatch.full_name = full_name;
    if (phone !== undefined) userPatch.phone = phone;
    if (avatar_url !== undefined) userPatch.avatar_url = avatar_url;
    const { error } = await supabaseAdmin.from("users").update(userPatch).eq("id", driverId);
    if (error) throw ApiError.internal(error.message);
  }

  return getDriver(schoolId, driverId);
}

export async function deactivateDriver(schoolId: string, driverId: string) {
  const { data: driver, error: driverError } = await supabaseAdmin
    .from("drivers")
    .select("id")
    .eq("id", driverId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (driverError) throw ApiError.internal(driverError.message);
  if (!driver) throw ApiError.notFound("Driver not found");

  const { error } = await supabaseAdmin.from("users").update({ is_active: false }).eq("id", driverId);
  if (error) throw ApiError.internal(error.message);
}

// ----------------------------------------------------------------------------
// Route / stop CRUD.
// ----------------------------------------------------------------------------

export async function updateRoute(schoolId: string, routeId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.from("routes").update(patch).eq("id", routeId).eq("school_id", schoolId).select(ROUTE_SELECT).maybeSingle();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict(error.message);
    throw ApiError.internal(error.message);
  }
  if (!data) throw ApiError.notFound("Route not found");
  return data;
}

export async function deleteRoute(schoolId: string, routeId: string) {
  const { error } = await supabaseAdmin.from("routes").delete().eq("id", routeId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

export async function updatePickupPoint(schoolId: string, pointId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("pickup_points")
    .update(patch)
    .eq("id", pointId)
    .eq("school_id", schoolId)
    .select("id, route_id, name, address, stop_order, pickup_time, latitude, longitude")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict(error.message);
    throw ApiError.internal(error.message);
  }
  if (!data) throw ApiError.notFound("Pickup point not found");
  return data;
}

export async function deletePickupPoint(schoolId: string, pointId: string) {
  const { error } = await supabaseAdmin.from("pickup_points").delete().eq("id", pointId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

// ----------------------------------------------------------------------------
// Student assignment — a student's whole transport assignment lives on one
// student_pickup_points row (a single stop + a morning/evening/both
// preference), kept up to date by assignStudentPickup() above.
// ----------------------------------------------------------------------------

export async function unassignStudentTransport(schoolId: string, studentId: string) {
  const { error } = await supabaseAdmin.from("student_pickup_points").delete().eq("student_id", studentId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

/** Roster for a route's "Assign Students" view / detail-page student list — every student assigned to one of this route's stops. */
export async function listStudentsForRoute(schoolId: string, routeId: string) {
  const { data: pointRows, error: pointsError } = await supabaseAdmin.from("pickup_points").select("id").eq("route_id", routeId).eq("school_id", schoolId);
  if (pointsError) throw ApiError.internal(pointsError.message);

  const pointIds = (pointRows ?? []).map((p) => p.id as string);
  if (pointIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("student_pickup_points")
    .select(
      "student_id, pickup_point_id, is_active, transport_direction, fee_amount, payment_status, fee_due_date, fee_paid_date, " +
        "students(id, admission_no, father_name, father_phone, mother_name, mother_phone, users(full_name, avatar_url), classes(name, section)), " +
        "pickup_points!student_pickup_points_pickup_point_id_fkey(name)"
    )
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .in("pickup_point_id", pointIds);
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

/** Vehicle/Driver detail pages both delegate to listStudentsForRoute via the one route each currently owns. */
export async function listStudentsForVehicle(schoolId: string, vehicleId: string) {
  const { data, error } = await supabaseAdmin.from("routes").select("id").eq("school_id", schoolId).eq("vehicle_id", vehicleId).limit(1);
  if (error) throw ApiError.internal(error.message);
  const route = (data ?? [])[0];
  return route ? listStudentsForRoute(schoolId, route.id) : [];
}

export async function listStudentsForDriver(schoolId: string, driverId: string) {
  const { data, error } = await supabaseAdmin
    .from("routes")
    .select("id")
    .eq("school_id", schoolId)
    .or(`primary_driver_id.eq.${driverId},secondary_driver_id.eq.${driverId}`)
    .limit(1);
  if (error) throw ApiError.internal(error.message);
  const route = (data ?? [])[0];
  return route ? listStudentsForRoute(schoolId, route.id) : [];
}

/**
 * Create/update a student's transport fee. Same function backs both the
 * POST (first time setting an amount) and PATCH (e.g. later marking paid)
 * routes — both are just an update against the student's existing
 * student_pickup_points row, same as updatePickupPoint() above.
 */
export async function setTransportFee(
  schoolId: string,
  studentId: string,
  updatedBy: string,
  input: { fee_amount?: number; payment_status?: "paid" | "unpaid" | "partial"; fee_due_date?: string; fee_paid_date?: string }
) {
  const { data, error } = await supabaseAdmin
    .from("student_pickup_points")
    .update({ ...input, fee_updated_by: updatedBy, fee_updated_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .select("student_id, fee_amount, payment_status, fee_due_date, fee_paid_date, fee_updated_by, fee_updated_at")
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Student has no transport assignment yet");

  if (input.fee_amount !== undefined) {
    await notificationService.notifyStudents(schoolId, updatedBy, [studentId], {
      title: "Transport fee updated",
      message: `Your transport (bus) fee has been set to ₹${input.fee_amount.toFixed(2)}.`,
      type: "fee_due",
      metadata: { fee_amount: input.fee_amount },
    });
  }

  return data;
}

interface TransportFeeRow {
  student_id: string;
  fee_amount: number | null;
  payment_status: "paid" | "unpaid" | "partial";
  fee_due_date: string | null;
  fee_paid_date: string | null;
  fee_updated_at: string | null;
  students: { id: string; admission_no: string; users: { full_name: string } | null; classes: { name: string; section: string } | null } | null;
  pickup_points: { routes: { name: string; route_code: string | null } | null } | null;
}

/** Every transport-assigned student in the school with their fee/payment status — the "Fees" tab's list, so admin/principal don't have to open each route's Assign Students modal to find a student. */
export async function listTransportFees(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("student_pickup_points")
    .select(
      "student_id, fee_amount, payment_status, fee_due_date, fee_paid_date, fee_updated_at, " +
        "students(id, admission_no, users(full_name), classes(name, section)), " +
        "pickup_points!student_pickup_points_pickup_point_id_fkey(routes(name, route_code))"
    )
    .eq("school_id", schoolId)
    .eq("is_active", true);
  if (error) throw ApiError.internal(error.message);
  return (data ?? []) as unknown as TransportFeeRow[];
}

/** Route ids carrying at least one of this teacher's own students — used to scope the live-vehicle/monitoring views a `transport.view`-only teacher may see (staff bypass this and see every route, checked at the call site via isStaff). */
export async function listTeacherRouteIds(schoolId: string, teacherId: string): Promise<string[]> {
  const studentIds = await listTeacherStudentIds(teacherId);
  if (studentIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("student_pickup_points")
    .select("pickup_points!inner(route_id)")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .in("student_id", studentIds);
  if (error) throw ApiError.internal(error.message);

  return Array.from(new Set((data ?? []).map((row: any) => row.pickup_points?.route_id).filter(Boolean)));
}

/** Search-as-you-type student picker for the "Assign Students" modal. */
export async function searchStudentsForAssignment(schoolId: string, search: string) {
  const rawPattern = `%${search}%`;

  // `.ilike()` is a real supabase-js method call, not raw `.or()` DSL — it
  // must get the plain pattern. Only the string interpolated into `.or()`
  // below needs escapeOrFilterValue's quote-wrapping (that's the raw-DSL
  // injection guard); applying it here too made every search literal-match
  // an unmatchable quoted string and silently returned zero results.
  const { data: matchingUsers, error: userSearchError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("school_id", schoolId)
    .ilike("full_name", rawPattern);
  if (userSearchError) throw ApiError.internal(userSearchError.message);

  const matchingIds = (matchingUsers ?? []).map((u) => u.id);
  const idFilter = matchingIds.length > 0 ? `,id.in.(${matchingIds.join(",")})` : "";

  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, admission_no, users(full_name), classes(name, section)")
    .eq("school_id", schoolId)
    .or(`admission_no.ilike.${escapeOrFilterValue(rawPattern)}${idFilter}`)
    .limit(20);
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}
