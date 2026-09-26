import { z } from "zod";
import { isAllowedPushEndpoint } from "../utils/pushEndpoint";

// SEC-14: the endpoint must be a real HTTPS push-provider URL, not an arbitrary
// or internal address (the server POSTs to it). Enforced server-side.
const pushEndpoint = z
  .string()
  .url()
  .refine(isAllowedPushEndpoint, "endpoint must be an HTTPS URL of a supported push service");

export const subscribeSchema = z.object({
  body: z.object({
    endpoint: pushEndpoint,
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const unsubscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
