import { z } from "zod";
const empty = z.object({}).optional();
export const startTripSchema = z.object({ body: z.object({ direction: z.enum(["pickup", "drop"]).default("pickup") }), query: empty, params: empty });
export const locationSchema = z.object({ body: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy_meters: z.number().nonnegative().max(10000).optional(), speed_mps: z.number().min(0).max(100).optional(), heading: z.number().min(0).max(360).optional(), recorded_at: z.string().datetime().optional() }), query: empty, params: z.object({ tripId: z.string().uuid() }));
export const tripParamSchema = z.object({ body: z.object({}).optional(), query: empty, params: z.object({ tripId: z.string().uuid() }) });
