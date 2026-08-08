import { z } from "zod";
import { optionalPassword, optionalPhone, optionalAadhaar, optionalDate, optionalGender } from "./common";

/**
 * Self-registration — one schema per role, each mirroring its admin-side
 * counterpart field-for-field (see teacher.validator.ts::createTeacherSchema,
 * student.validator.ts::createStudentSchema, transport.validator.ts::
 * driverSchema, extracurricularStaff.validator.ts::createExtracurricularStaffSchema,
 * user.validator.ts::createUserSchema for Accountant/Principal) so an
 * applicant never sees a stricter or looser rule than what Admin/Principal
 * already use. `school_code` is the one field none of those have — a public
 * multi-tenant registration form has no req.user to resolve a school_id from,
 * so the applicant identifies their school explicitly (resolved server-side
 * via schoolService.lookupSchoolByCode before any of the schemas below run).
 */

const schoolCode = z.string().min(2).max(20);

const baseAccountFields = {
  school_code: schoolCode,
  email: z.string().email(),
  full_name: z.string().min(2),
  phone: optionalPhone,
  password: optionalPassword,
};

export const registerPrincipalSchema = z.object({
  body: z.object({ ...baseAccountFields }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const registerAccountantSchema = z.object({
  body: z.object({ ...baseAccountFields }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const registerDriverSchema = z.object({
  body: z.object({
    ...baseAccountFields,
    license_number: z.string().min(2),
    license_expiry: z.string().date().optional(),
    address: z.string().optional(),
    emergency_contact_phone: optionalPhone,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const registerExtracurricularStaffSchema = z.object({
  body: z.object({
    ...baseAccountFields,
    gender: optionalGender,
    date_of_birth: optionalDate,
    address: z.string().optional(),
    staff_type_activity_id: z.string().uuid(),
    qualification: z.string().optional(),
    experience_years: z.coerce.number().int().min(0).max(80).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const teacherClassAssignment = z.object({
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
});

/**
 * Mirrors the admin's actual "Add teacher" form (TeacherFormModal.tsx)
 * exactly: "Is class teacher?" is a single independent toggle (+ homeroom
 * class picker when Yes) — it does NOT restrict which classes/subjects can
 * appear in Subjects Assigned. A class teacher may still teach a subject in
 * a different class than the one they're homeroom of, so `assignments` is
 * always the same free-form class+subject repeater either way, always
 * required (matches the admin form's unconditional "Add at least one
 * subject assignment" check).
 */
export const registerTeacherSchema = z.object({
  body: z
    .object({
      ...baseAccountFields,
      employee_id: z.string().min(1),
      qualification: z.string().optional(),
      experience_years: z.coerce.number().int().min(0).max(80).optional(),
      joining_date: optionalDate,
      is_class_teacher: z.boolean(),
      homeroom_class_id: z.string().uuid().optional(),
      assignments: z.array(teacherClassAssignment).min(1, "Add at least one subject assignment"),
    })
    .superRefine((body, ctx) => {
      if (body.is_class_teacher && !body.homeroom_class_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["homeroom_class_id"], message: "Select the class you'll be class teacher for" });
      }
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

/**
 * Student self-registration — a single login for the student, with Father/
 * Mother/Guardian kept as plain contact fields on the student record itself
 * (no separate Parent login account or `parents`/`student_parents` link —
 * the Parent role/portal has been removed from this codebase).
 */
export const registerStudentSchema = z.object({
  body: z
    .object({
      school_code: schoolCode,
      email: z.string().email(),
      full_name: z.string().min(2),
      phone: optionalPhone,
      password: optionalPassword,
      admission_no: z.string().optional(),
      roll_no: z.string().optional(),
      class_id: z.string().uuid(),
      date_of_birth: optionalDate,
      gender: optionalGender,
      blood_group: z.string().max(10).optional(),
      aadhaar_number: optionalAadhaar,
      address: z.string().optional(),
      religion: z.string().optional(),
      category: z.string().optional(),
      state: z.string().optional(),
      district: z.string().optional(),
      city: z.string().optional(),
      pin_code: z.string().optional(),
      // Parent contact fields — same shape as createStudentSchema.
      father_name: z.string().optional(),
      father_phone: optionalPhone,
      father_email: z.string().email().optional().or(z.literal("")),
      father_occupation: z.string().optional(),
      mother_name: z.string().optional(),
      mother_phone: optionalPhone,
      mother_email: z.string().email().optional().or(z.literal("")),
      mother_occupation: z.string().optional(),
      guardian_name: z.string().optional(),
      guardian_phone: optionalPhone,
      guardian_email: z.string().email().optional().or(z.literal("")),
      guardian_occupation: z.string().optional(),
    })
    .superRefine((body, ctx) => {
      const hasFather = !!body.father_name && !!body.father_phone;
      const hasMother = !!body.mother_name && !!body.mother_phone;
      const hasGuardian = !!body.guardian_name && !!body.guardian_phone;
      if (!hasFather && !hasMother && !hasGuardian) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["father_name"],
          message: "Provide at least one parent/guardian's name and mobile number",
        });
      }
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const registrationMetaQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ school_code: schoolCode }),
  params: z.object({}).optional(),
});

export const REGISTRATION_ROLE_SCHEMAS = {
  principal: registerPrincipalSchema,
  accountant: registerAccountantSchema,
  driver: registerDriverSchema,
  extracurricular_staff: registerExtracurricularStaffSchema,
  teacher: registerTeacherSchema,
  student: registerStudentSchema,
} as const;

export type RegistrationRole = keyof typeof REGISTRATION_ROLE_SCHEMAS;

export const registrationRoleParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ role: z.enum(["principal", "accountant", "driver", "extracurricular_staff", "teacher", "student"]) }),
});

export const listRegistrationRequestsQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    status: z.enum(["pending", "approved", "rejected"]).optional(),
  }),
  params: z.object({}).optional(),
});

export const reviewRegistrationRequestSchema = z.object({
  body: z.object({
    action: z.enum(["approve", "reject"]),
    notes: z.string().max(1000).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
