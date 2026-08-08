import { z } from "zod";

export const subscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url(),
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
