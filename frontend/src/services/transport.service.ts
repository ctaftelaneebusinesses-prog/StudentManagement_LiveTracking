import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import {
  Driver,
  DriverDashboard,
  DriverDetail,
  MaintenanceRecord,
  Route,
  RouteStudentAssignment,
  StudentSearchResult,
  TransportDirection,
  TransportFeeRecord,
  Vehicle,
} from "@/types/transport.types";
import { StudentTransport } from "@/types/admin.types";

const get = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => (await api.get(url, { params })).data.data;

export const fetchVehicles = () => get<Vehicle[]>("/transport/vehicles");
export const fetchVehicle = (id: string) => get<Vehicle>(`/transport/vehicles/${id}`);
export const fetchDrivers = () => get<Driver[]>("/transport/drivers");
export const fetchDriver = (id: string) => get<DriverDetail>(`/transport/drivers/${id}`);
export const fetchRoutes = () => get<Route[]>("/transport/routes");
export const fetchRoute = (id: string) => get<Route>(`/transport/routes/${id}`);
export const fetchDriverDashboard = () => get<DriverDashboard>("/transport/driver/dashboard");

export const createVehicle = (input: {
  vehicle_number: string;
  name?: string;
  capacity: number;
  make_model?: string;
  gps_device_id?: string;
  registration_number?: string;
  insurance_expiry?: string;
  fuel_type?: string;
}) => api.post("/transport/vehicles", input);

export const updateVehicle = (id: string, patch: Partial<Parameters<typeof createVehicle>[0] & { is_active: boolean }>) =>
  api.patch(`/transport/vehicles/${id}`, patch);

export const deleteVehicle = (id: string) => api.delete(`/transport/vehicles/${id}`);
export const fetchVehicleStudents = (vehicleId: string) => get<RouteStudentAssignment[]>(`/transport/vehicles/${vehicleId}/students`);

export const createDriver = (input: { email: string; full_name: string; phone?: string; password?: string; license_number: string; license_expiry?: string }) =>
  api.post("/transport/drivers", input);

export const updateDriver = (
  id: string,
  patch: Partial<{ license_number: string; license_expiry: string; address: string; emergency_contact_phone: string; full_name: string; phone: string; avatar_url: string | null }>
) => api.patch(`/transport/drivers/${id}`, patch);

export const deactivateDriver = (id: string) => api.post(`/transport/drivers/${id}/deactivate`);
export const fetchDriverStudents = (driverId: string) => get<RouteStudentAssignment[]>(`/transport/drivers/${driverId}/students`);

/** Same `{driverId}/avatar.{ext}` convention and `avatars` bucket as uploadTeacherPhoto/uploadStudentPhoto. */
export async function uploadDriverPhoto(driverId: string, file: File): Promise<void> {
  const extension = file.name.split(".").pop();
  const path = `${driverId}/avatar.${extension}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  await updateDriver(driverId, { avatar_url: data.publicUrl });
}

export async function deleteDriverPhoto(driverId: string): Promise<void> {
  const extensions = ["jpg", "jpeg", "png", "webp", "gif"];
  await supabase.storage.from("avatars").remove(extensions.map((ext) => `${driverId}/avatar.${ext}`));
  await updateDriver(driverId, { avatar_url: null });
}

export const createRoute = (input: {
  name: string;
  route_code?: string;
  description?: string;
  to_location: string;
  vehicle_id: string;
  primary_driver_id: string;
  secondary_driver_id?: string;
}) => api.post("/transport/routes", input);

export const updateRoute = (
  id: string,
  patch: Partial<{
    name: string;
    route_code: string;
    description: string;
    is_active: boolean;
    to_location: string;
    vehicle_id: string | null;
    primary_driver_id: string;
    secondary_driver_id: string | null;
  }>
) => api.patch(`/transport/routes/${id}`, patch);
export const deleteRoute = (id: string) => api.delete(`/transport/routes/${id}`);
export const fetchRouteStudents = (routeId: string) => get<RouteStudentAssignment[]>(`/transport/routes/${routeId}/students`);

export const createPickup = (input: { route_id: string; name: string; address?: string; stop_order: number; pickup_time?: string; latitude?: number; longitude?: number }) =>
  api.post("/transport/pickup-points", input);
export const updatePickupPoint = (
  id: string,
  patch: Partial<{ name: string; address: string; stop_order: number; pickup_time: string; latitude: number; longitude: number }>
) => api.patch(`/transport/pickup-points/${id}`, patch);
export const deletePickupPoint = (id: string) => api.delete(`/transport/pickup-points/${id}`);

export const searchStudentsForAssignment = (search: string) => get<StudentSearchResult[]>("/transport/students/search", { search });

export const fetchStudentTransport = (studentId: string) => get<StudentTransport | null>(`/students/${studentId}/transport`);
export const assignStudentTransport = (studentId: string, input: { pickup_point_id: string; transport_direction?: TransportDirection }) =>
  api.patch(`/students/${studentId}/transport`, input);
export const unassignStudentTransport = (studentId: string) => api.delete(`/students/${studentId}/transport`);

export const setTransportFee = (
  studentId: string,
  input: { fee_amount?: number; payment_status?: "paid" | "unpaid" | "partial"; fee_due_date?: string; fee_paid_date?: string }
) => api.patch(`/transport/student-pickups/${studentId}/fee`, input);

export const fetchTransportFees = () => get<TransportFeeRecord[]>("/transport/fees");

export const fetchMaintenanceRecords = (vehicleId?: string) =>
  vehicleId ? get<MaintenanceRecord[]>(`/transport/vehicles/${vehicleId}/maintenance`) : get<MaintenanceRecord[]>("/transport/maintenance");

export const createMaintenanceRecord = (
  vehicleId: string,
  input: {
    maintenance_type: string;
    description?: string;
    cost?: number;
    performed_at?: string;
    odometer_reading?: number;
    next_due_date?: string;
    next_due_odometer?: number;
    performed_by?: string;
  }
) => api.post(`/transport/vehicles/${vehicleId}/maintenance`, input);

export const updateMaintenanceRecord = (id: string, patch: Record<string, unknown>) => api.patch(`/transport/maintenance/${id}`, patch);
export const deleteMaintenanceRecord = (id: string) => api.delete(`/transport/maintenance/${id}`);
