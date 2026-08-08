import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

const MAINTENANCE_SELECT =
  "id, vehicle_id, maintenance_type, description, cost, performed_at, odometer_reading, " +
  "next_due_date, next_due_odometer, performed_by, created_by, created_at";

export interface MaintenanceRecordInput {
  maintenance_type: string;
  description?: string;
  cost?: number;
  performed_at?: string;
  odometer_reading?: number;
  next_due_date?: string;
  next_due_odometer?: number;
  performed_by?: string;
}

async function assertVehicleInSchool(schoolId: string, vehicleId: string) {
  const { data, error } = await supabaseAdmin.from("vehicles").select("id").eq("id", vehicleId).eq("school_id", schoolId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Vehicle not found");
}

/** All maintenance records for one vehicle, or the whole fleet's when vehicleId is omitted (the Maintenance tab's fleet-wide view). */
export async function listMaintenanceRecords(schoolId: string, vehicleId?: string) {
  let query = supabaseAdmin
    .from("vehicle_maintenance_records")
    .select(`${MAINTENANCE_SELECT}, vehicles(vehicle_number, make_model)`)
    .eq("school_id", schoolId)
    .order("performed_at", { ascending: false });
  if (vehicleId) query = query.eq("vehicle_id", vehicleId);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function createMaintenanceRecord(
  schoolId: string,
  vehicleId: string,
  createdBy: string,
  input: MaintenanceRecordInput
) {
  await assertVehicleInSchool(schoolId, vehicleId);

  const { data, error } = await supabaseAdmin
    .from("vehicle_maintenance_records")
    .insert({ school_id: schoolId, vehicle_id: vehicleId, created_by: createdBy, ...input })
    .select(MAINTENANCE_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function updateMaintenanceRecord(schoolId: string, recordId: string, patch: Partial<MaintenanceRecordInput>) {
  const { data, error } = await supabaseAdmin
    .from("vehicle_maintenance_records")
    .update(patch)
    .eq("id", recordId)
    .eq("school_id", schoolId)
    .select(MAINTENANCE_SELECT)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Maintenance record not found");
  return data;
}

export async function deleteMaintenanceRecord(schoolId: string, recordId: string) {
  const { error } = await supabaseAdmin.from("vehicle_maintenance_records").delete().eq("id", recordId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}
