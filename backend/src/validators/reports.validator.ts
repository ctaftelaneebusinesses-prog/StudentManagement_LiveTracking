import { z } from "zod";

export const classPerformanceQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ classId: z.string().uuid() }),
  params: z.object({}).optional(),
});

export const studentProgressParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const attendanceReportQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    classId: z.string().uuid().optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }),
  params: z.object({}).optional(),
});

export const studentReportQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    classId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});

export const teacherReportQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});

export const transportReportQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    vehicleId: z.string().uuid().optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});
