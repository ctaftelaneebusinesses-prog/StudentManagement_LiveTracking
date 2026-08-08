import { z } from "zod";
import { optionalPassword, optionalPhone, optionalDate, optionalGender } from "./common";

export const createExtracurricularStaffSchema = z.object({
  body: z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
    phone: optionalPhone,
    password: optionalPassword,
    gender: optionalGender,
    date_of_birth: optionalDate,
    address: z.string().optional(),
    staff_type_activity_id: z.string().uuid(),
    qualification: z.string().optional(),
    experience_years: z.coerce.number().int().min(0).max(80).optional(),
    bio: z.string().optional(),
    joining_date: optionalDate,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// No email/staff_code changes here — mirrors updateTeacherSchema, which
// likewise never lets email or employee_id be patched post-creation.
export const updateExtracurricularStaffSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: optionalPhone,
    gender: optionalGender,
    date_of_birth: optionalDate,
    address: z.string().optional(),
    staff_type_activity_id: z.string().uuid().optional(),
    qualification: z.string().optional(),
    experience_years: z.coerce.number().int().min(0).max(80).nullable().optional(),
    bio: z.string().optional(),
    avatar_url: z.string().url().optional().nullable(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listExtracurricularStaffQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().optional(),
    staff_type_activity_id: z.string().uuid().optional(),
    activity_id: z.string().uuid().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    class_id: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  }),
  params: z.object({}).optional(),
});

export const staffIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const updateStaffStatusSchema = z.object({
  body: z.object({ is_active: z.boolean() }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const assignActivitiesSchema = z.object({
  body: z.object({
    activity_ids: z.array(z.string().uuid()).default([]),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const createBatchSchema = z.object({
  body: z
    .object({
      activity_id: z.string().uuid(),
      academic_year_id: z.string().uuid(),
      class_id: z.string().uuid(),
      scope: z.enum(["entire_class", "selected_students"]),
      name: z.string().optional(),
      student_ids: z.array(z.string().uuid()).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.scope === "selected_students") {
        if (!data.student_ids || data.student_ids.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["student_ids"],
            message: "student_ids is required and must be non-empty when scope is 'selected_students'",
          });
        }
      } else if (data.student_ids && data.student_ids.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["student_ids"],
          message: "student_ids is not applicable when scope is 'entire_class'",
        });
      }
    }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

// Only `name` is patchable post-creation — changing class/activity/academic
// year/scope would have cascading effects (existing batch_students,
// schedule slots, attendance history) that aren't specified, so those are
// handled by deleting and recreating the batch instead.
export const updateBatchSchema = z.object({
  body: z.object({
    name: z.string().optional().nullable(),
  }),
  query: z.object({}).optional(),
  params: z.object({ batchId: z.string().uuid() }),
});

export const batchIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ batchId: z.string().uuid() }),
});

export const addBatchStudentsSchema = z.object({
  body: z.object({
    student_ids: z.array(z.string().uuid()).min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({ batchId: z.string().uuid() }),
});

export const removeBatchStudentSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ batchId: z.string().uuid(), studentId: z.string().uuid() }),
});

const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:mm time");

export const scheduleSlotSchema = z.object({
  body: z.object({
    batch_id: z.string().uuid(),
    day_of_week: z.coerce.number().int().min(0).max(6),
    start_time: timeString,
    end_time: timeString,
    venue: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const slotIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ slotId: z.string().uuid() }),
});
