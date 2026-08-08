export interface StudentStatusCounts { picked_up: number; absent: number; pending: number }
export interface LiveTrip { id: string; vehicle_id: string; route_id?: string | null; direction: string; status: string; started_at: string; last_latitude: number | null; last_longitude: number | null; last_location_at: string | null; vehicles?: { vehicle_number: string; name?: string | null } | null; routes?: { name: string; route_code: string } | null; drivers?: { users: { full_name: string } | null } | null; studentCounts?: StudentStatusCounts; }
export interface LiveLocation { vehicleId: string; latitude: number; longitude: number; label: string; updatedAt?: string | null; etaMinutes?: number | null; }
export interface MyVehicleAssignment {
  students: { id: string; users: { full_name: string } | null };
  pickup_points: {
    id: string;
    name: string;
    pickup_time: string | null;
    routes: {
      id: string;
      name: string;
      route_code: string;
      vehicles: { id: string; vehicle_number: string; name: string | null; trips: LiveTrip[]; drivers: { users: { full_name: string; phone: string | null } } | null }[];
    };
  };
  drop_point: { id: string; name: string; pickup_time: string | null } | null;
}

export type StudentTripStatusValue =
  | "waiting_for_pickup"
  | "vehicle_approaching"
  | "picked_up"
  | "reached_school"
  | "return_trip_started"
  | "returning_home"
  | "dropped_at_home"
  | "absent";

export interface StudentTripStatusResult {
  status: StudentTripStatusValue;
  direction: "pickup" | "drop" | null;
  etaMinutes: number | null;
  distanceKm: number | null;
  trip: { id: string; status: string } | null;
}

export interface StopEta {
  pickupPointId: string;
  name: string;
  stopOrder: number;
  distanceKm: number;
  etaMinutes: number;
}

export type PickupStatus = "pending" | "picked_up" | "absent";

export interface TripStudentStatus {
  id: string;
  student_id: string;
  pickup_point_id: string | null;
  status: PickupStatus;
  marked_at: string | null;
  students: { id: string; admission_no: string; users: { full_name: string } | null; classes: { name: string; section: string } | null } | null;
  pickup_points: { name: string } | null;
}

export interface StudentTransportHistoryItem {
  id: string;
  status: PickupStatus;
  marked_at: string | null;
  trips: {
    id: string;
    trip_date: string;
    direction: string;
    status: string;
    vehicles: { vehicle_number: string; name: string | null } | null;
    drivers: { users: { full_name: string } | null } | null;
    routes: { name: string; route_code: string } | null;
  };
}

export interface TripHistoryItem {
  id: string;
  vehicle_id: string;
  driver_id: string;
  route_id: string | null;
  trip_date: string;
  direction: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  vehicles: { vehicle_number: string } | null;
  drivers: { users: { full_name: string } | null } | null;
  routes: { name: string; route_code: string } | null;
}
