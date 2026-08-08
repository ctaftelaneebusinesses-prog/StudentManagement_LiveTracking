export type FuelType = "petrol" | "diesel" | "cng" | "electric" | "other";
export type MaintenanceType = "service" | "repair" | "inspection" | "tire_change" | "insurance_renewal" | "other";
export type TransportDirection = "morning" | "evening" | "both";

export interface DriverSummary {
  id: string;
  users: { full_name: string };
}

export interface Driver {
  id: string;
  license_number: string;
  license_expiry: string | null;
  address?: string | null;
  emergency_contact_phone?: string | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
}

export interface DriverDetail extends Driver {
  vehicle: { id: string; vehicle_number: string; make_model: string | null } | null;
  route: { id: string; name: string; route_code: string | null } | null;
}

export interface PickupPoint {
  id: string;
  route_id?: string;
  name: string;
  address: string | null;
  stop_order: number;
  pickup_time: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Route {
  id: string;
  name: string;
  route_code: string | null;
  description: string | null;
  is_active: boolean;
  to_location: string | null;
  vehicle_id: string | null;
  primary_driver_id: string | null;
  secondary_driver_id: string | null;
  vehicle: { id: string; vehicle_number: string; name: string | null } | null;
  primary_driver: DriverSummary | null;
  secondary_driver: DriverSummary | null;
  pickup_points: PickupPoint[];
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  name?: string | null;
  capacity: number;
  make_model: string | null;
  gps_device_id: string | null;
  registration_number?: string | null;
  insurance_expiry?: string | null;
  fuel_type?: FuelType | null;
  is_active: boolean;
  created_at?: string;
  drivers: DriverSummary | null;
  secondary_driver: DriverSummary | null;
  routes: { id: string; name: string; route_code: string | null } | null;
}

export interface DriverDashboard {
  vehicle: Vehicle | null;
  pickup_points: PickupPoint[];
  students: { pickup_point_id: string; students: { id: string; admission_no: string; users: { full_name: string }; classes: { name: string; section: string } | null } }[];
  trips: { id: string; trip_date: string; direction: string; status: string; last_latitude: number | null; last_longitude: number | null; last_location_at: string | null }[];
}

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string | null;
  cost: number | null;
  performed_at: string;
  odometer_reading: number | null;
  next_due_date: string | null;
  next_due_odometer: number | null;
  performed_by: string | null;
  created_at: string;
  vehicles?: { vehicle_number: string; make_model: string | null };
}

export type TransportPaymentStatus = "paid" | "unpaid" | "partial";

export interface RouteStudentAssignment {
  student_id: string;
  pickup_point_id: string;
  is_active: boolean;
  transport_direction: TransportDirection;
  fee_amount: number | null;
  payment_status: TransportPaymentStatus;
  fee_due_date: string | null;
  fee_paid_date: string | null;
  pickup_points: { name: string } | null;
  students: {
    id: string;
    admission_no: string;
    father_name: string | null;
    father_phone: string | null;
    mother_name: string | null;
    mother_phone: string | null;
    users: { full_name: string; avatar_url?: string | null };
    classes: { name: string; section: string } | null;
  };
}

export interface TransportFeeRecord {
  student_id: string;
  fee_amount: number | null;
  payment_status: TransportPaymentStatus;
  fee_due_date: string | null;
  fee_paid_date: string | null;
  fee_updated_at: string | null;
  students: { id: string; admission_no: string; users: { full_name: string } | null; classes: { name: string; section: string } | null } | null;
  pickup_points: { routes: { name: string; route_code: string | null } | null } | null;
}

export interface StudentSearchResult {
  id: string;
  admission_no: string;
  users: { full_name: string };
  classes: { name: string; section: string } | null;
}
