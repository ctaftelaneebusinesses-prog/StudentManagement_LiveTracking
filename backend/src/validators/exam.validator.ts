import { z } from "zod";

export const listExamsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ classId: z.string().uuid().optional() }),
  params: z.object({}).optional(),
});

export const createExamSchema = z.object({
  body: z
    .object({
      class_id: z.string().uuid().optional(),
      class_ids: z.array(z.string().uuid()).min(1).optional(),
      scope: z.enum(["class", "selected", "all"]).default("class"),
      academic_year_id: z.string().uuid().optional(),
      name: z.string().min(1),
      exam_date: z.string().date().optional(),
    })
    .refine((v) => v.scope !== "class" || !!v.class_id, {
      message: "class_id is required when scope is \"class\"",
      path: ["class_id"],
    })
    .refine((v) => v.scope !== "selected" || (v.class_ids && v.class_ids.length > 0), {
      message: "class_ids is required when scope is \"selected\"",
      path: ["class_ids"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateExamSchema = z.object({
  body: z.object({
    class_id: z.string().uuid().optional(),
    academic_year_id: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    exam_date: z.string().date().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const publishExamSchema = z.object({
  body: z.object({
    is_published: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM format");

export const createScheduleEntrySchema = z.object({
  body: z.object({
    subject_id: z.string().uuid(),
    exam_date: z.string().date(),
    start_time: timeString,
    end_time: timeString,
    room: z.string().optional(),
    max_marks: z.coerce.number().positive().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const updateScheduleEntrySchema = z.object({
  body: z.object({
    subject_id: z.string().uuid().optional(),
    exam_date: z.string().date().optional(),
    start_time: timeString.optional(),
    end_time: timeString.optional(),
    room: z.string().optional(),
    max_marks: z.coerce.number().positive().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), scheduleId: z.string().uuid() }),
});

export const scheduleIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), scheduleId: z.string().uuid() }),
});

export const addExamDocumentSchema = z.object({
  body: z
    .object({
      doc_type: z.enum(["question_paper", "answer_key", "hall_ticket", "result_sheet", "circular", "other"]),
      file_name: z.string().min(1).optional(),
      storage_path: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
      notes: z.string().optional(),
    })
    .refine((v) => (!!v.storage_path && !!v.file_name) || !!v.content, {
      message: "Provide either an uploaded file (file_name + storage_path) or written content",
    }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const deleteExamDocumentSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), docId: z.string().uuid() }),
});

export const publishExamDocumentSchema = z.object({
  body: z.object({ is_published: z.boolean() }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), docId: z.string().uuid() }),
});

export const upsertMarksSchema = z.object({
  body: z.object({
    records: z
      .array(
        z.object({
          student_id: z.string().uuid(),
          subject_id: z.string().uuid(),
          marks_obtained: z.coerce.number().min(0),
          max_marks: z.coerce.number().positive().optional(),
          grade: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const examIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const studentIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const studentExamParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), examId: z.string().uuid() }),
});

export const classSubjectStatusSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ classId: z.string().uuid() }),
  params: z.object({ id: z.string().uuid() }),
});

export const marksReminderSchema = z.object({
  body: z.object({ classId: z.string().uuid() }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), subjectId: z.string().uuid() }),
});

export const classIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ classId: z.string().uuid() }),
});
