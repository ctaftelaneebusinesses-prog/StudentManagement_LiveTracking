import { z } from "zod";

export const createNotificationSchema = z.object({
  body: z
    .object({
      title: z.string().min(1),
      message: z.string().min(1),
      audience_scope: z.enum(["school", "class", "student"]),
      audience_class_id: z.string().uuid().optional(),
      audience_user_id: z.string().uuid().optional(),
    })
    .refine((v) => v.audience_scope !== "class" || !!v.audience_class_id, {
      message: "audience_class_id is required when audience_scope is 'class'",
      path: ["audience_class_id"],
    })
    .refine((v) => v.audience_scope !== "student" || !!v.audience_user_id, {
      message: "audience_user_id is required when audience_scope is 'student'",
      path: ["audience_user_id"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const markReadSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), notificationId: z.string().uuid() }),
});
