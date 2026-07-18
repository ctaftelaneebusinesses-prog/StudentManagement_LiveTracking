import { z } from "zod";
const empty = z.object({}).optional();
export const vehicleSchema = z.object({ body: z.object({ vehicle_number: z.string().min(2), capacity: z.number().int().positive(), driver_id: z.string().uuid().optional(), route_id: z.string().uuid().optional(), make_model: z.string().optional(), gps_device_id: z.string().optional() }), query: empty, params: empty });
export const driverSchema = z.object({ body: z.object({ email: z.string().email(), full_name: z.string().min(2), phone: z.string().optional(), license_number: z.string().min(2), license_expiry: z.string().date().optional() }), query: empty, params: empty });
export const routeSchema = z.object({ body: z.object({ name: z.string().min(2), route_code: z.string().min(1), description: z.string().optional() }), query: empty, params: empty });
export const pickupSchema = z.object({ body: z.object({ route_id: z.string().uuid(), name: z.string().min(2), address: z.string().optional(), stop_order: z.number().int().positive(), pickup_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() }), query: empty, params: empty });
export const assignPickupSchema = z.object({ body: z.object({ student_id: z.string().uuid(), pickup_point_id: z.string().uuid() }), query: empty, params: empty });
