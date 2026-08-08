import { z } from "zod";
const empty = z.object({}).optional();
export const startTripSchema = z.object({ body: z.object({ direction: z.enum(["pickup", "drop"]).default("pickup") }), query: empty, params: empty });
export const locationSchema = z.object({ body: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy_meters: z.number().nonnegative().max(10000).optional(), speed_mps: z.number().min(0).max(100).optional(), heading: z.number().min(0).max(360).optional(), recorded_at: z.string().datetime().optional() }), query: empty, params: z.object({ tripId: z.string().uuid() }) });
export const tripParamSchema = z.object({ body: z.object({}).optional(), query: empty, params: z.object({ tripId: z.string().uuid() }) });

export const studentIdParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

export const recordMyLocationSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy_meters: z.number().nonnegative().max(10000).optional(),
    recorded_at: z.string().datetime().optional(),
  }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const markStudentStatusSchema = z.object({
  body: z.object({ status: z.enum(["picked_up", "absent"]) }),
  query: empty,
  params: z.object({ tripId: z.string().uuid(), studentId: z.string().uuid() }),
});

export const listTripHistorySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    vehicleId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    routeId: z.string().uuid().optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: empty,
});
