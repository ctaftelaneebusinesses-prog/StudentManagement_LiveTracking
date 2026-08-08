import { z } from "zod";
import { optionalPassword, optionalPhone, optionalAadhaar, optionalDate, optionalGender } from "./common";

/**
 * The "Class (optional)" <select>'s unselected state submits "" rather than
 * omitting the field — plain `.uuid().optional()` rejects "" as an invalid
 * uuid instead of treating it as "no class", so this normalizes "" to
 * undefined first.
 */
const optionalUuid = z.preprocess((val) => (val === "" ? undefined : val), z.string().uuid().optional());

/** Personal-info fields shared by create/update/bulk-create student payloads. */
const personalInfoFields = {
  place_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pin_code: z.string().optional(),
  blood_group: z.string().max(10).optional(),
  aadhaar_number: optionalAadhaar,
};

/** Father/Mother quick-contact fields — separate from the full Parent/Guardian login-account system. */
const parentContactFields = {
  father_name: z.string().optional(),
  father_phone: optionalPhone,
  father_email: z.string().email().optional().or(z.literal("")),
  father_occupation: z.string().optional(),
  mother_name: z.string().optional(),
  mother_phone: optionalPhone,
  mother_email: z.string().email().optional().or(z.literal("")),
  mother_occupation: z.string().optional(),
};

/** At least one parent's name + mobile number must be provided. */
function hasParentContact(body: { father_name?: string; father_phone?: string; mother_name?: string; mother_phone?: string }) {
  return (!!body.father_name && !!body.father_phone) || (!!body.mother_name && !!body.mother_phone);
}

export const createStudentSchema = z.object({
  body: z
    .object({
      email: z.string().email(),
      full_name: z.string().min(2),
      phone: optionalPhone,
      password: optionalPassword,
      admission_no: z.string().min(1),
      roll_no: z.string().optional(),
      date_of_birth: optionalDate,
      gender: optionalGender,
      address: z.string().optional(),
      class_id: optionalUuid,
      ...personalInfoFields,
      ...parentContactFields,
    })
    .refine(hasParentContact, {
      message: "Provide at least one parent's name and mobile number (father or mother)",
      path: ["father_name"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateStudentSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: optionalPhone,
    roll_no: z.string().optional(),
    date_of_birth: optionalDate,
    gender: optionalGender,
    address: z.string().optional(),
    is_active: z.boolean().optional(),
    avatar_url: z.string().url().optional().nullable(),
    allergies: z.string().optional(),
    medical_conditions: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    doctor_name: z.string().optional(),
    doctor_phone: z.string().optional(),
    ...personalInfoFields,
    ...parentContactFields,
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const assignClassSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

const bulkStudentRowSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  phone: optionalPhone,
  password: optionalPassword,
  admission_no: z.string().min(1),
  roll_no: z.string().optional(),
  date_of_birth: optionalDate,
  gender: optionalGender,
  address: z.string().optional(),
  class_id: optionalUuid,
  ...personalInfoFields,
  ...parentContactFields,
});

export const bulkCreateStudentsSchema = z.object({
  body: z.object({
    students: z.array(bulkStudentRowSchema).min(1).max(300),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const bulkAssignClassSchema = z.object({
  body: z.object({
    studentIds: z.array(z.string().uuid()).min(1).max(1000),
    classId: z.string().uuid(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const bulkDeleteStudentsSchema = z.object({
  body: z.object({
    studentIds: z.array(z.string().uuid()).min(1).max(1000),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const listStudentsQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    classId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});
