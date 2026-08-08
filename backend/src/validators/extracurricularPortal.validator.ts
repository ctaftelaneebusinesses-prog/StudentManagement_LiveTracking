import { z } from "zod";

const empty = z.object({}).optional();
const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM format");

export const batchIdParamSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ batchId: z.string().uuid() }),
});

export const activityIdParamSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ activityId: z.string().uuid() }),
});

/**
 * Self-service profile edit — mirrors teacherPortal.validator.ts's
 * updateProfileSchema shape. phone/address/bio are editable here; email,
 * staff_code and staff_type stay admin-managed (see
 * extracurricularPortal.service.ts::updateProfile). `avatar_url` is also
 * accepted even though it's not part of the typed `UpdatePortalProfileInput`
 * on the frontend — `extracurricularPortal.service.ts::uploadOwnPhoto` PATCHes
 * it directly here after uploading to the shared `avatars` bucket.
 */
export const updateProfileSchema = z.object({
  body: z.object({
    phone: z.string().min(5).nullable().optional(),
    avatar_url: z.string().max(2000).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    bio: z.string().max(2000).nullable().optional(),
  }),
  query: empty,
  params: empty,
});

const attendanceStatusEnum = z.enum(["present", "absent", "late", "excused"]);

/** Bulk upsert for one session — one row per student in `records`. */
export const markAttendanceSchema = z.object({
  body: z.object({
    batch_id: z.string().uuid(),
    session_date: z.string().date(),
    records: z
      .array(
        z.object({
          student_id: z.string().uuid(),
          status: attendanceStatusEnum,
          remarks: z.string().max(500).optional(),
        })
      )
      .min(1, "At least one attendance record is required"),
  }),
  query: empty,
  params: empty,
});

export const attendanceSummaryQuerySchema = z.object({
  body: empty,
  query: z.object({
    batch_id: z.string().uuid().optional(),
  }),
  params: empty,
});

export const createPracticeWorkSchema = z.object({
  body: z.object({
    batch_id: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional(),
    due_date: z.string().date().optional(),
    attachment_url: z.string().max(2000).optional(),
    student_ids: z.array(z.string().uuid()).optional(),
  }),
  query: empty,
  params: empty,
});

export const listPracticeWorkQuerySchema = z.object({
  body: empty,
  query: z.object({
    batch_id: z.string().uuid().optional(),
  }),
  params: empty,
});

export const createEventSchema = z.object({
  body: z.object({
    activity_id: z.string().uuid().optional(),
    batch_id: z.string().uuid().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    event_date: z.string().date(),
    start_time: timeString.optional(),
    end_time: timeString.optional(),
    venue: z.string().max(255).optional(),
    student_ids: z.array(z.string().uuid()).optional(),
  }),
  query: empty,
  params: empty,
});

/**
 * Same shape as the admin side's extracurricularAchievement.validator.ts is
 * expected to have, minus `staff_id` — the calling staff member is inferred
 * from `req.user.id`. `file_name`/`storage_path` describe an object the
 * frontend has already uploaded to the private `extracurricular-achievements`
 * bucket (see teacherDocument.service.ts's equivalent pattern).
 */
export const createAchievementSchema = z.object({
  body: z.object({
    activity_id: z.string().uuid().optional(),
    student_ids: z.array(z.string().uuid()).optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    achieved_on: z.string().date().optional(),
    file_name: z.string().min(1),
    storage_path: z.string().min(1),
  }),
  query: empty,
  params: empty,
});
