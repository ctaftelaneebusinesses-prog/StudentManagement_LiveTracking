import { z } from "zod";

const uuid = z.string().uuid();

/** Proposed school fields a school_admin can submit — mirrors createSchoolSchema minus is_active/academic_year, which only make sense once a school actually exists. */
export const createSchoolRequestSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(2).max(20).optional(),
    branch_name: z.string().optional(),
    principal_name: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    alternate_phone: z.string().optional(),
    email: z.string().email().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    pin_code: z.string().optional(),
    country: z.string().optional(),
    logo_url: z.string().url().optional(),
    /** Free-text note to the reviewing super_admin — why this school is needed. */
    requester_notes: z.string().max(2000).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const listSchoolRequestsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }),
  params: z.object({}).optional(),
});

export const requestIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: uuid }),
});

export const reviewSchoolRequestSchema = z.object({
  body: z.object({ reviewer_notes: z.string().max(2000).optional() }),
  query: z.object({}).optional(),
  params: z.object({ id: uuid }),
});
