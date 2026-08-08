import { z } from "zod";

export const getDailyTeacherAttendanceSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    date: z.string().date(),
  }),
  params: z.object({}).optional(),
});

export const markTeacherAttendanceSchema = z.object({
  body: z.object({
    teacher_id: z.string().uuid(),
    date: z.string().date(),
    status: z.enum(["present", "absent", "half_day", "leave"]),
    remarks: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const listTeacherAttendanceSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export const getMonthlySummarySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  params: z.object({}).optional(),
});

export const teacherIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
