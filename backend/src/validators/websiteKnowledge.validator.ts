import { z } from "zod";
import { QUIZ_ROLES, QUESTION_COUNT_OPTIONS, PASSING_PERCENTAGE_OPTIONS } from "../config/websiteKnowledge";

const empty = z.object({}).optional();
const roleEnum = z.enum(QUIZ_ROLES);

const optionSchema = z.object({ key: z.string().min(1), text: z.string().min(1) });

export const idParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

export const listQuestionsSchema = z.object({
  body: empty,
  query: z.object({
    role_name: roleEnum.optional(),
    category: z.string().optional(),
    is_active: z.enum(["true", "false"]).optional(),
    search: z.string().optional(),
  }),
  params: empty,
});

export const createQuestionSchema = z.object({
  body: z.object({
    role_name: roleEnum,
    question_text: z.string().min(3),
    options: z.array(optionSchema).length(4),
    correct_option: z.string().min(1),
    explanation: z.string().optional(),
    category: z.string().optional(),
  }),
  query: empty,
  params: empty,
});

export const updateQuestionSchema = z.object({
  body: z.object({
    question_text: z.string().min(3).optional(),
    options: z.array(optionSchema).length(4).optional(),
    correct_option: z.string().min(1).optional(),
    explanation: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
  }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const listQuestionSetsSchema = z.object({
  body: empty,
  query: z.object({ role_name: roleEnum.optional() }),
  params: empty,
});

export const createQuestionSetSchema = z.object({
  body: z.object({ role_name: roleEnum, set_number: z.number().int().min(1).max(10), name: z.string().min(1) }),
  query: empty,
  params: empty,
});

export const updateQuestionSetSchema = z.object({
  body: z.object({ name: z.string().min(1).optional(), is_active: z.boolean().optional() }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const addQuestionToSetSchema = z.object({
  body: z.object({ question_id: z.string().uuid(), order_index: z.number().int().min(0).optional() }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const removeQuestionFromSetSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ id: z.string().uuid(), questionId: z.string().uuid() }),
});

export const updateSettingsSchema = z.object({
  body: z.object({
    question_count: z.number().int().refine((v) => (QUESTION_COUNT_OPTIONS as readonly number[]).includes(v), "Must be 20, 30, or 50").optional(),
    passing_percentage: z
      .number()
      .int()
      .refine((v) => (PASSING_PERCENTAGE_OPTIONS as readonly number[]).includes(v), "Must be 70, 75, 80, 85, or 90")
      .optional(),
  }),
  query: empty,
  params: empty,
});

export const submitAnswerSchema = z.object({
  body: z.object({ question_id: z.string().uuid(), selected_option: z.string().min(1) }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const attemptIdParamSchema = z.object({ body: empty, query: empty, params: z.object({ id: z.string().uuid() }) });

export const userIdParamSchema = (paramName: string) =>
  z.object({ body: empty, query: empty, params: z.object({ [paramName]: z.string().uuid() }) });
