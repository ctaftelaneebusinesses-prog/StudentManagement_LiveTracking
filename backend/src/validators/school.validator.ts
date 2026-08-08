import { z } from "zod";

export const schoolLookupQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ code: z.string().min(2).max(20) }),
  params: z.object({}).optional(),
});

export const createSchoolSchema = z.object({
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
    is_active: z.boolean().optional(),
    academic_year: z
      .object({
        name: z.string().min(1),
        start_date: z.string().date(),
        end_date: z.string().date(),
      })
      .optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

/** Shared body shape for both the self-service `/schools/me` update and the platform-level `/schools/:id` update. */
const updatableSchoolFields = {
  name: z.string().min(2).optional(),
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
  is_active: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
};

export const updateSchoolSchema = z.object({
  body: z.object(updatableSchoolFields),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateSchoolByIdSchema = z.object({
  body: z.object(updatableSchoolFields),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const schoolIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const deleteSchoolSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ force: z.coerce.boolean().optional() }),
  params: z.object({ id: z.string().uuid() }),
});

export const createAcademicYearSchema = z.object({
  body: z
    .object({
      name: z.string().min(4, "e.g. 2026-2027"),
      start_date: z.string().date(),
      end_date: z.string().date(),
      is_current: z.boolean().optional(),
    })
    .refine((v) => new Date(v.end_date) > new Date(v.start_date), {
      message: "end_date must be after start_date",
      path: ["end_date"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateAcademicYearSchema = z.object({
  body: z.object({
    name: z.string().min(4).optional(),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    is_current: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    address: z.string().optional(),
    is_main: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    address: z.string().optional(),
    is_main: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const updateSchoolSettingsSchema = z.object({
  body: z.object({
    key: z.enum(["email", "notifications", "backup", "workingDays"]),
    value: z.unknown(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    head_teacher_id: z.string().uuid().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    head_teacher_id: z.string().uuid().nullable().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const departmentIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const createHolidaySchema = z.object({
  body: z.object({
    name: z.string().min(2),
    date: z.string().date(),
    is_recurring_yearly: z.boolean().optional(),
    academic_year_id: z.string().uuid().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateHolidaySchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    date: z.string().date().optional(),
    is_recurring_yearly: z.boolean().optional(),
    academic_year_id: z.string().uuid().nullable().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const holidayIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
