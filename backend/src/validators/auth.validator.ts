import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "refreshToken is required"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email is required"),
    redirectTo: z.string().url("redirectTo must be a valid URL"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1, "accessToken is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
