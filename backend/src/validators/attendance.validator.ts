import { z } from "zod";

const statusEnum = z.enum(["present", "absent", "late", "half_day", "leave"]);

export const upsertAttendanceSchema = z.object({
  body: z.object({
    student_id: z.string().uuid(),
    class_id: z.string().uuid(),
    date: z.string().date(),
    status: statusEnum,
    remarks: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const bulkUpsertAttendanceSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
    date: z.string().date(),
    records: z
      .array(
        z.object({
          student_id: z.string().uuid(),
          status: statusEnum,
          remarks: z.string().optional(),
        })
      )
      .min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const listClassAttendanceSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    classId: z.string().uuid(),
    date: z.string().date(),
  }),
  params: z.object({}).optional(),
});

export const listClassAttendanceHistorySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    classId: z.string().uuid(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }),
  params: z.object({}).optional(),
});

export const listStudentAttendanceSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
});
