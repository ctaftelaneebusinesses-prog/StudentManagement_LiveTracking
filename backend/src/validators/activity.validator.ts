import { z } from "zod";

export const createActivitySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    staff_title: z.string().min(1),
    category: z.string().optional(),
    staff_ids: z.array(z.string().uuid()).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateActivitySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    staff_title: z.string().min(1).optional(),
    category: z.string().optional(),
    is_active: z.boolean().optional(),
    staff_ids: z.array(z.string().uuid()).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listActivitiesQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().optional(),
    is_active: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  }),
  params: z.object({}).optional(),
});

export const activityIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
