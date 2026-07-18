import { z } from "zod";

export const createSchoolSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(2).max(20),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateSchoolSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    logo_url: z.string().url().optional(),
    settings: z.record(z.unknown()).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const createAcademicYearSchema = z.object({
  body: z
    .object({
      name: z.string().min(4, "e.g. 2026-2027"),
      start_date: z.string().date(),
      end_date: z.string().date(),
    })
    .refine((v) => new Date(v.end_date) > new Date(v.start_date), {
      message: "end_date must be after start_date",
      path: ["end_date"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateAcademicYearSchema = z.object({
  body: z.object({
    name: z.string().min(4).optional(),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    address: z.string().optional(),
    is_main: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    address: z.string().optional(),
    is_main: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
