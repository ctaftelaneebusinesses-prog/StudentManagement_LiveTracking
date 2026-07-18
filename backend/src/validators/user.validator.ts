import { z } from "zod";

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
    phone: z.string().optional(),
    role_id: z.number().int().min(1).max(7),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateUserSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: z.string().optional(),
    is_active: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const assignRoleSchema = z.object({
  body: z.object({
    role_id: z.number().int().min(1).max(7),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listUsersQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    role: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});
