import { api } from "@/lib/axios";
import { LiveTrip, ParentVehicleAssignment } from "@/types/tracking.types";
export const startTrip = async (direction: "pickup" | "drop" = "pickup"): Promise<LiveTrip> => (await api.post("/tracking/driver/trips", { direction })).data.data;
export const sendLocation = async (tripId: string, input: { latitude: number; longitude: number; accuracy_meters?: number; speed_mps?: number; heading?: number; recorded_at?: string }) => api.post(`/tracking/driver/trips/${tripId}/location`, input);
export const endTrip = async (tripId: string) => (await api.post(`/tracking/driver/trips/${tripId}/end`)).data.data;
export const fetchParentVehicles = async (): Promise<ParentVehicleAssignment[]> => (await api.get("/tracking/parent/vehicles")).data.data;
export const fetchActiveVehicles = async (): Promise<LiveTrip[]> => (await api.get("/tracking/admin/active-vehicles")).data.data;
