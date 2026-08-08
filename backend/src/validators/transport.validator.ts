import { z } from "zod";
import { optionalPassword } from "./common";
const empty = z.object({}).optional();
const optionalRouteCode = z.preprocess((val) => (val === "" ? undefined : val), z.string().min(1).optional());
const transportDirection = z.enum(["morning", "evening", "both"]);
export const vehicleSchema = z.object({ body: z.object({ vehicle_number: z.string().min(2), name: z.string().optional(), capacity: z.number().int().positive(), make_model: z.string().optional(), gps_device_id: z.string().optional() }), query: empty, params: empty });
export const driverSchema = z.object({ body: z.object({ email: z.string().email(), full_name: z.string().min(2), phone: z.string().optional(), password: optionalPassword, license_number: z.string().min(2), license_expiry: z.string().date().optional() }), query: empty, params: empty });
export const routeSchema = z.object({
  body: z
    .object({
      name: z.string().min(2),
      route_code: optionalRouteCode,
      description: z.string().optional(),
      to_location: z.string().min(1),
      vehicle_id: z.string().uuid(),
      primary_driver_id: z.string().uuid(),
      secondary_driver_id: z.string().uuid().optional(),
    })
    .refine((body) => !body.secondary_driver_id || body.secondary_driver_id !== body.primary_driver_id, {
      message: "Secondary driver must be different from the primary driver",
      path: ["secondary_driver_id"],
    }),
  query: empty,
  params: empty,
});
export const pickupSchema = z.object({ body: z.object({ route_id: z.string().uuid(), name: z.string().min(2), address: z.string().optional(), stop_order: z.number().int().positive(), pickup_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() }), query: empty, params: empty });
export const assignPickupSchema = z.object({ body: z.object({ student_id: z.string().uuid(), pickup_point_id: z.string().uuid(), transport_direction: transportDirection.optional() }), query: empty, params: empty });
export const assignStudentTransportSchema = z.object({ body: z.object({ pickup_point_id: z.string().uuid(), transport_direction: transportDirection.optional() }), query: empty, params: z.object({ id: z.string().uuid() }) });

// ----------------------------------------------------------------------------
// Vehicle / driver / route / pickup-point update-and-delete + student
// assignment + maintenance — this module's upgrade.
// ----------------------------------------------------------------------------

export const vehicleIdParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

export const updateVehicleSchema = z.object({
  body: z.object({
    vehicle_number: z.string().min(2).optional(),
    name: z.string().nullable().optional(),
    capacity: z.number().int().positive().optional(),
    make_model: z.string().optional(),
    gps_device_id: z.string().optional(),
    registration_number: z.string().optional(),
    insurance_expiry: z.string().date().optional(),
    fuel_type: z.enum(["petrol", "diesel", "cng", "electric", "other"]).optional(),
    is_active: z.boolean().optional(),
  }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const driverIdParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

export const updateDriverSchema = z.object({
  body: z.object({
    license_number: z.string().min(2).optional(),
    license_expiry: z.string().date().optional(),
    address: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    full_name: z.string().min(2).optional(),
    phone: z.string().optional(),
    avatar_url: z.string().url().nullable().optional(),
  }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const routeIdParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

export const updateRouteSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      route_code: z.string().min(1).optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
      to_location: z.string().min(1).optional(),
      vehicle_id: z.string().uuid().nullable().optional(),
      primary_driver_id: z.string().uuid().optional(),
      secondary_driver_id: z.string().uuid().nullable().optional(),
    })
    .refine((body) => !body.secondary_driver_id || !body.primary_driver_id || body.secondary_driver_id !== body.primary_driver_id, {
      message: "Secondary driver must be different from the primary driver",
      path: ["secondary_driver_id"],
    }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const pickupIdParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

export const updatePickupSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    address: z.string().optional(),
    stop_order: z.number().int().positive().optional(),
    pickup_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const routeStudentsParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

export const searchStudentsQuerySchema = z.object({ body: empty, query: z.object({ search: z.string().min(1) }), params: empty });

export const maintenanceVehicleParamSchema = z.object({ body: empty, query: empty, params: z.object({ vehicleId: z.string().uuid() }) });

const maintenanceBody = z.object({
  maintenance_type: z.enum(["service", "repair", "inspection", "tire_change", "insurance_renewal", "other"]),
  description: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  performed_at: z.string().date().optional(),
  odometer_reading: z.number().nonnegative().optional(),
  next_due_date: z.string().date().optional(),
  next_due_odometer: z.number().nonnegative().optional(),
  performed_by: z.string().optional(),
});

export const createMaintenanceSchema = z.object({
  body: maintenanceBody,
  query: empty,
  params: z.object({ vehicleId: z.string().uuid() }),
});

export const updateMaintenanceSchema = z.object({
  body: maintenanceBody.partial(),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const maintenanceIdParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

// ----------------------------------------------------------------------------
// Transport fee (create/update, per student).
// ----------------------------------------------------------------------------

export const transportFeeStudentParamSchema = z.object({ body: empty, query: empty, params: z.object({ studentId: z.string().uuid() }) });

export const setTransportFeeSchema = z.object({
  body: z.object({
    fee_amount: z.number().nonnegative().optional(),
    payment_status: z.enum(["paid", "unpaid", "partial"]).optional(),
    fee_due_date: z.string().date().optional(),
    fee_paid_date: z.string().date().optional(),
  }),
  query: empty,
  params: z.object({ studentId: z.string().uuid() }),
});
