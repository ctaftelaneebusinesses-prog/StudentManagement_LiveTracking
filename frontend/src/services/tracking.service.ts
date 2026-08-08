import { api } from "@/lib/axios";
import { PaginatedResult } from "@/types/admin.types";
import {
  LiveTrip,
  MyVehicleAssignment,
  PickupStatus,
  StopEta,
  StudentTransportHistoryItem,
  StudentTripStatusResult,
  TripHistoryItem,
  TripStudentStatus,
} from "@/types/tracking.types";
export const startTrip = async (direction: "pickup" | "drop" = "pickup"): Promise<LiveTrip> => (await api.post("/tracking/driver/trips", { direction })).data.data;
export const sendLocation = async (tripId: string, input: { latitude: number; longitude: number; accuracy_meters?: number; speed_mps?: number; heading?: number; recorded_at?: string }) => api.post(`/tracking/driver/trips/${tripId}/location`, input);
export const endTrip = async (tripId: string) => (await api.post(`/tracking/driver/trips/${tripId}/end`)).data.data;
export const markStudentStatus = async (tripId: string, studentId: string, status: Extract<PickupStatus, "picked_up" | "absent">) =>
  (await api.post(`/tracking/driver/trips/${tripId}/students/${studentId}/status`, { status })).data.data;
export const fetchTripStudentStatus = async (tripId: string): Promise<TripStudentStatus[]> =>
  (await api.get(`/tracking/driver/trips/${tripId}/student-status`)).data.data;
export const fetchMyVehicles = async (): Promise<MyVehicleAssignment[]> => (await api.get("/tracking/student/vehicles")).data.data;
export const fetchActiveVehicles = async (): Promise<LiveTrip[]> => (await api.get("/tracking/admin/active-vehicles")).data.data;

export interface TripHistoryParams {
  vehicleId?: string;
  driverId?: string;
  routeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export const fetchTripHistory = async (params: TripHistoryParams): Promise<PaginatedResult<TripHistoryItem>> =>
  (await api.get("/tracking/trips", { params })).data.data;

export const fetchTripEta = async (tripId: string): Promise<StopEta[]> => (await api.get(`/tracking/trips/${tripId}/eta`)).data.data;

export const fetchStudentTripStatus = async (studentId: string): Promise<StudentTripStatusResult> =>
  (await api.get(`/tracking/students/${studentId}/status`)).data.data;

export const fetchStudentTransportHistory = async (studentId: string): Promise<StudentTransportHistoryItem[]> =>
  (await api.get(`/tracking/students/${studentId}/history`)).data.data;

export const sendMyLocation = async (studentId: string, input: { latitude: number; longitude: number; accuracy_meters?: number; recorded_at?: string }) =>
  api.post(`/tracking/students/${studentId}/location`, input);
