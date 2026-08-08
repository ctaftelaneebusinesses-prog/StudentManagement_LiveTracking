import { z } from "zod";

// staff_id is not part of the body — the parent staff member is the `:id`
// route param it's nested under (mirrors teacherDocument.validator.ts,
// where teacherId likewise comes from the URL, not the payload).
export const addAchievementSchema = z.object({
  body: z.object({
    activity_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    achieved_on: z.string().date().optional(),
    file_name: z.string().min(1),
    storage_path: z.string().min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listAchievementsQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    studentId: z.string().uuid().optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export const deleteAchievementSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), achievementId: z.string().uuid() }),
});
