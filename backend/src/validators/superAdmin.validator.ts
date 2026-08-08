import { z } from "zod";

/**
 * Password policy for platform-created accounts. Enforced here (server-side)
 * as well as in the UI's strength meter — the meter is a convenience, this is
 * the actual gate.
 */
export const strongPassword = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

const uuid = z.string().uuid();

export const listSchoolAdminsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    school_id: uuid.optional(),
  }),
  params: z.object({}).optional(),
});

export const userIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: uuid }),
});

export const schoolIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: uuid }),
});

export const createSchoolAdminSchema = z.object({
  body: z.object({
    full_name: z.string().min(2, "Enter a full name"),
    email: z.string().email(),
    phone: z.string().min(6).max(20).optional(),
    avatar_url: z.string().url().optional(),
    designation: z.string().optional(),
    password: strongPassword,
    school_ids: z.array(uuid).min(1, "Assign at least one school"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateSchoolAdminSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: z.string().min(6).max(20).nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    designation: z.string().nullable().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: uuid }),
});

export const resetSchoolAdminPasswordSchema = z.object({
  body: z.object({ password: strongPassword }),
  query: z.object({}).optional(),
  params: z.object({ id: uuid }),
});

export const assignSchoolsSchema = z.object({
  body: z.object({ school_ids: z.array(uuid).min(1, "Assign at least one school") }),
  query: z.object({}).optional(),
  params: z.object({ id: uuid }),
});

export const removeAssignmentSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: uuid, schoolId: uuid }),
});

export const schoolIdsBodySchema = z.object({
  body: z.object({ school_ids: z.array(uuid).min(1, "Select at least one school") }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const setSchoolsActiveSchema = z.object({
  body: z.object({
    school_ids: z.array(uuid).min(1, "Select at least one school"),
    is_active: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const auditLogQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(25),
    action: z.string().optional(),
    school_id: uuid.optional(),
    search: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  params: z.object({}).optional(),
});
