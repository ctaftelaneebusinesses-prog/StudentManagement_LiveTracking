import { z } from "zod";
import { optionalPassword } from "./common";
import { ROLE_ID } from "../config/roles";

/**
 * Roles createUser()/bulkCreateUsers() may assign — deliberately excludes
 * TEACHER/PARENT/STUDENT/DRIVER/EXTRACURRICULAR_STAFF, which each require a
 * matching extension-table row (students.admission_no, teachers.employee_id,
 * drivers.license_number, a parent-student link, ...) that only their own
 * dedicated creation flow populates (student.service.ts::createStudent,
 * teacher.service.ts::createTeacher, transport.service.ts::createDriver,
 * parent.service.ts::createAndLinkParent, extracurricularStaff.service.ts::
 * createStaff). Creating one of those roles through this generic endpoint
 * previously produced a `users` row with no matching extension row — every
 * page that looks up the student/teacher/driver/parent by id then 404s.
 */
const ASSIGNABLE_ROLE_IDS = [
  ROLE_ID.SCHOOL_ADMIN,
  ROLE_ID.PRINCIPAL,
  ROLE_ID.SUPER_ADMIN,
  ROLE_ID.SUPPORT_STAFF,
  ROLE_ID.ACCOUNTANT,
] as const;

const ASSIGNABLE_ROLE_ID = z
  .number()
  .int()
  .refine((id) => (ASSIGNABLE_ROLE_IDS as readonly number[]).includes(id), {
    message:
      "This role can't be created here — use the dedicated Students, Teachers, Transport (Drivers), or a student's Parents tab instead, which collect the extra details that role needs.",
  });

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
    phone: z.string().optional(),
    password: optionalPassword,
    role_id: ASSIGNABLE_ROLE_ID,
    designation: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateUserSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: z.string().optional(),
    is_active: z.boolean().optional(),
    designation: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const assignRoleSchema = z.object({
  body: z.object({
    role_id: z.number().int().min(1).max(10),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listUsersQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    role: z.string().optional(),
    search: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  }),
  params: z.object({}).optional(),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const bulkUserIdsSchema = z.object({
  body: z.object({
    userIds: z.array(z.string().uuid()).min(1).max(500),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const bulkUserRowSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  password: optionalPassword,
  role_id: ASSIGNABLE_ROLE_ID,
  designation: z.string().optional(),
});

export const bulkCreateUsersSchema = z.object({
  body: z.object({
    users: z.array(bulkUserRowSchema).min(1).max(300),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
