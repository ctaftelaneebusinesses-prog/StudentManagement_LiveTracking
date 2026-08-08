import { z } from "zod";

const attachmentSchema = z.object({
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  file_type: z.enum(["pdf", "image", "document"]),
  file_size: z.number().int().positive().optional(),
});

const audienceType = z.enum([
  "all",
  "teachers",
  "students",
  "classes",
  "principal",
  "specific_teachers",
  "accountants",
  "extracurricular_staff",
  "specific_extracurricular_staff",
]);

export const listAnnouncementsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});

export const announcementIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const createAnnouncementSchema = z.object({
  body: z
    .object({
      id: z.string().uuid(),
      title: z.string().min(1),
      body: z.string().min(1),
      audience_type: audienceType,
      class_ids: z.array(z.string().uuid()).optional(),
      teacher_ids: z.array(z.string().uuid()).optional(),
      ec_staff_ids: z.array(z.string().uuid()).optional(),
      publish_at: z.string().datetime().optional(),
      attachments: z.array(attachmentSchema).optional(),
    })
    .refine((v) => v.audience_type !== "classes" || (v.class_ids && v.class_ids.length > 0), {
      message: "class_ids is required when audience_type is 'classes'",
      path: ["class_ids"],
    })
    .refine((v) => v.audience_type !== "specific_teachers" || (v.teacher_ids && v.teacher_ids.length > 0), {
      message: "teacher_ids is required when audience_type is 'specific_teachers'",
      path: ["teacher_ids"],
    })
    .refine((v) => v.audience_type !== "specific_extracurricular_staff" || (v.ec_staff_ids && v.ec_staff_ids.length > 0), {
      message: "ec_staff_ids is required when audience_type is 'specific_extracurricular_staff'",
      path: ["ec_staff_ids"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateAnnouncementSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      audience_type: audienceType.optional(),
      class_ids: z.array(z.string().uuid()).optional(),
      teacher_ids: z.array(z.string().uuid()).optional(),
      ec_staff_ids: z.array(z.string().uuid()).optional(),
      publish_at: z.string().datetime().optional(),
      new_attachments: z.array(attachmentSchema).optional(),
      remove_attachment_ids: z.array(z.string().uuid()).optional(),
    })
    .refine((v) => v.audience_type !== "classes" || (v.class_ids && v.class_ids.length > 0), {
      message: "class_ids is required when audience_type is 'classes'",
      path: ["class_ids"],
    })
    .refine((v) => v.audience_type !== "specific_teachers" || (v.teacher_ids && v.teacher_ids.length > 0), {
      message: "teacher_ids is required when audience_type is 'specific_teachers'",
      path: ["teacher_ids"],
    })
    .refine((v) => v.audience_type !== "specific_extracurricular_staff" || (v.ec_staff_ids && v.ec_staff_ids.length > 0), {
      message: "ec_staff_ids is required when audience_type is 'specific_extracurricular_staff'",
      path: ["ec_staff_ids"],
    }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
