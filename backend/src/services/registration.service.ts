import { supabaseAdmin } from "../config/supabase";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "../utils/ApiError";
import { resolveSchoolAdminRecipientIds } from "../utils/notificationRecipients";
import { logger } from "../config/logger";
import * as schoolService from "./school.service";
import * as teacherService from "./teacher.service";
import * as studentService from "./student.service";
import * as transportService from "./transport.service";
import * as extracurricularStaffService from "./extracurricularStaff.service";
import * as userService from "./user.service";
import * as notificationService from "./notification.service";
import * as classService from "./class.service";
import * as activityService from "./activity.service";
import { z } from "zod";
import {
  RegistrationRole,
  registerPrincipalSchema,
  registerAccountantSchema,
  registerDriverSchema,
  registerExtracurricularStaffSchema,
  registerTeacherSchema,
  registerStudentSchema,
} from "../validators/registration.validator";

type RegisterPrincipalInput = z.infer<typeof registerPrincipalSchema>["body"];
type RegisterAccountantInput = z.infer<typeof registerAccountantSchema>["body"];
type RegisterDriverInput = z.infer<typeof registerDriverSchema>["body"];
type RegisterExtracurricularStaffInput = z.infer<typeof registerExtracurricularStaffSchema>["body"];
type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>["body"];
type RegisterStudentInput = z.infer<typeof registerStudentSchema>["body"];

const ROLE_LABEL: Record<RegistrationRole, string> = {
  principal: "Principal",
  accountant: "Accountant",
  driver: "Driver",
  extracurricular_staff: "Extracurricular Staff",
  teacher: "Teacher",
  student: "Student",
};

const REGISTRATION_ROLE_ID: Record<RegistrationRole, number> = {
  principal: ROLE_ID.PRINCIPAL,
  accountant: ROLE_ID.ACCOUNTANT,
  driver: ROLE_ID.DRIVER,
  extracurricular_staff: ROLE_ID.EXTRACURRICULAR_STAFF,
  teacher: ROLE_ID.TEACHER,
  student: ROLE_ID.STUDENT,
};

interface RegistrationRequestRow {
  id: string;
  school_id: string;
  user_id: string;
  role_id: number;
  reviewer_type: "admin" | "principal" | "class_teacher";
  assigned_reviewer_id: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

const REQUEST_SELECT =
  "id, school_id, user_id, role_id, reviewer_type, assigned_reviewer_id, status, reviewed_by, reviewed_at, reviewer_notes, payload, created_at, " +
  "users!registration_requests_user_id_fkey(full_name, email, phone), roles(name)";

/** Marks a just-provisioned account pending — every create-service/createUser/createAndLinkParent call defaults a new account to 'approved' (see 061_registration_approval.sql), so self-registration always overrides it right after. */
async function markPending(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("users").update({ status: "pending" }).eq("id", userId);
  if (error) throw ApiError.internal(error.message);
}

/**
 * Public registration-support data (GET /auth/register/meta?school_code=X) —
 * classes/subjects/activities for the Academic Year -> Class -> Section and
 * Subjects/Staff-Type pickers on the registration form. None of the
 * dedicated list endpoints (/classes, /subjects, /activities) are reachable
 * without an authenticated session (they all sit behind classes.manage), and
 * a public registration page has no session yet — this bundles the same
 * data those admin-side services already return, scoped to one school
 * resolved by code, in a single request.
 */
export async function getRegistrationMeta(schoolCode: string) {
  const school = await schoolService.lookupSchoolByCode(schoolCode);
  const [classes, subjects, activitiesResult] = await Promise.all([
    classService.listClasses(school.id),
    classService.listSubjects(school.id),
    // listActivities returns a paginated { items, total, page, pageSize }
    // shape, not a bare array — this page only ever wants the flat list.
    activityService.listActivities(school.id, { page: 1, pageSize: 200 }),
  ]);
  return { school, classes, subjects, activities: activitiesResult.items };
}

async function resolveRoleUserIds(schoolId: string, roleIds: number[]): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("school_id", schoolId)
    .in("role_id", roleIds);
  if (error) throw ApiError.internal(error.message);
  return Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
}

/** The class teacher (if any) of a given class — same lookup as studentLeaveRequest.service.ts::getClassTeacherId, resolved directly from a class_id rather than via a student row (none exists yet at registration time). */
async function resolveClassTeacherId(schoolId: string, classId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("class_teacher_id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  return (data?.class_teacher_id as string | null) ?? null;
}

async function createRequestAndNotify(
  schoolId: string,
  userId: string,
  role: RegistrationRole,
  reviewerType: "admin" | "principal" | "class_teacher",
  assignedReviewerId: string | null,
  payload: Record<string, unknown>
): Promise<RegistrationRequestRow> {
  const { data, error } = await supabaseAdmin
    .from("registration_requests")
    .insert({
      school_id: schoolId,
      user_id: userId,
      role_id: REGISTRATION_ROLE_ID[role],
      reviewer_type: reviewerType,
      assigned_reviewer_id: assignedReviewerId,
      payload,
    })
    .select("id, school_id, user_id, role_id, reviewer_type, assigned_reviewer_id, status, reviewed_by, reviewed_at, reviewer_notes, payload, created_at")
    .single();
  if (error) throw ApiError.internal(error.message);
  const row = data as unknown as RegistrationRequestRow;

  let recipientIds: string[] = [];
  if (reviewerType === "class_teacher" && assignedReviewerId) {
    recipientIds = [assignedReviewerId];
  } else if (reviewerType === "principal") {
    recipientIds = await resolveRoleUserIds(schoolId, [ROLE_ID.PRINCIPAL]);
  } else {
    // Multi-school- and super_admin-aware — see notificationRecipients.ts.
    recipientIds = await resolveSchoolAdminRecipientIds(schoolId);
  }

  if (recipientIds.length > 0) {
    notificationService
      .notifyUsers(schoolId, null, recipientIds, {
        title: `${ROLE_LABEL[role]} registration awaiting approval`,
        message: `A new ${ROLE_LABEL[role]} registration request is awaiting approval.`,
        type: "registration_submitted",
        metadata: { registration_request_id: row.id, role },
      })
      .catch((err) => logger.error({ err, requestId: row.id }, "Failed to send registration-submitted notification"));
  }

  return row;
}

// ---------------------------------------------------------------------------
// Submission — one function per role, each calling the SAME create-service
// the admin-side "Add X" forms already use, so field handling/validation/
// duplicate-detection/password-generation is identical either way.
// ---------------------------------------------------------------------------

export async function registerPrincipal(input: RegisterPrincipalInput) {
  const school = await schoolService.lookupSchoolByCode(input.school_code);
  const user = await userService.createUser(school.id, {
    email: input.email,
    full_name: input.full_name,
    phone: input.phone,
    password: input.password,
    role_id: ROLE_ID.PRINCIPAL,
  });
  await markPending(user.id);
  await createRequestAndNotify(school.id, user.id, "principal", "admin", null, {});
  return { user_id: user.id, status: "pending" as const };
}

export async function registerAccountant(input: RegisterAccountantInput) {
  const school = await schoolService.lookupSchoolByCode(input.school_code);
  const user = await userService.createUser(school.id, {
    email: input.email,
    full_name: input.full_name,
    phone: input.phone,
    password: input.password,
    role_id: ROLE_ID.ACCOUNTANT,
  });
  await markPending(user.id);
  await createRequestAndNotify(school.id, user.id, "accountant", "principal", null, {});
  return { user_id: user.id, status: "pending" as const };
}

export async function registerDriver(input: RegisterDriverInput) {
  const school = await schoolService.lookupSchoolByCode(input.school_code);
  const driver = await transportService.createDriver(school.id, {
    email: input.email,
    full_name: input.full_name,
    phone: input.phone,
    password: input.password,
    license_number: input.license_number,
    license_expiry: input.license_expiry,
  });
  if (input.address || input.emergency_contact_phone) {
    const { error } = await supabaseAdmin
      .from("drivers")
      .update({ address: input.address, emergency_contact_phone: input.emergency_contact_phone })
      .eq("id", driver.id);
    if (error) throw ApiError.internal(error.message);
  }
  await markPending(driver.id);
  await createRequestAndNotify(school.id, driver.id, "driver", "principal", null, {});
  return { user_id: driver.id, status: "pending" as const };
}

export async function registerExtracurricularStaff(input: RegisterExtracurricularStaffInput) {
  const school = await schoolService.lookupSchoolByCode(input.school_code);
  const staff = await extracurricularStaffService.createStaff(school.id, input);
  await markPending((staff as unknown as { id: string }).id);
  await createRequestAndNotify(school.id, (staff as unknown as { id: string }).id, "extracurricular_staff", "principal", null, {});
  return { user_id: (staff as unknown as { id: string }).id, status: "pending" as const };
}

export async function registerTeacher(input: RegisterTeacherInput) {
  const school = await schoolService.lookupSchoolByCode(input.school_code);
  const teacher = await teacherService.createTeacher(school.id, {
    email: input.email,
    full_name: input.full_name,
    phone: input.phone,
    password: input.password,
    employee_id: input.employee_id,
    qualification: input.qualification,
    experience_years: input.experience_years,
    joining_date: input.joining_date,
  });
  const teacherId = (teacher as unknown as { id: string }).id;
  await markPending(teacherId);

  // Homeroom/subject assignments are NOT applied yet — a pending, unapproved
  // account must never show up as a live class teacher or subject owner.
  // Stored here and applied by review() only once a Principal approves.
  const payload = {
    is_class_teacher: input.is_class_teacher,
    homeroom_class_id: input.homeroom_class_id,
    assignments: input.assignments,
  };

  await createRequestAndNotify(school.id, teacherId, "teacher", "principal", null, payload);
  return { user_id: teacherId, status: "pending" as const };
}

export async function registerStudent(input: RegisterStudentInput) {
  const school = await schoolService.lookupSchoolByCode(input.school_code);

  const student = await studentService.createStudent(school.id, {
    email: input.email,
    full_name: input.full_name,
    phone: input.phone,
    password: input.password,
    admission_no: input.admission_no || `SELF-${Date.now()}`,
    roll_no: input.roll_no,
    date_of_birth: input.date_of_birth,
    gender: input.gender,
    address: input.address,
    class_id: input.class_id,
    religion: input.religion,
    category: input.category,
    state: input.state,
    district: input.district,
    city: input.city,
    pin_code: input.pin_code,
    blood_group: input.blood_group,
    aadhaar_number: input.aadhaar_number,
    father_name: input.father_name,
    father_phone: input.father_phone,
    father_email: input.father_email,
    father_occupation: input.father_occupation,
    mother_name: input.mother_name,
    mother_phone: input.mother_phone,
    mother_email: input.mother_email,
    mother_occupation: input.mother_occupation,
  });
  const studentId = (student as unknown as { id: string }).id;
  await markPending(studentId);

  const classTeacherId = await resolveClassTeacherId(school.id, input.class_id);
  const reviewerType = classTeacherId ? "class_teacher" : "admin";

  await createRequestAndNotify(school.id, studentId, "student", reviewerType, classTeacherId, {});
  return { user_id: studentId, status: "pending" as const };
}

// ---------------------------------------------------------------------------
// Approval queue
// ---------------------------------------------------------------------------

/** Admin/Super Admin see Principal requests; Principal sees Teacher/Accountant/Driver/EC-Staff requests; a Teacher sees only rows assigned to them (Student/Parent requests for their own class). */
export async function listQueueForAdmin(schoolId: string, status?: "pending" | "approved" | "rejected") {
  let query = supabaseAdmin.from("registration_requests").select(REQUEST_SELECT).eq("school_id", schoolId).eq("reviewer_type", "admin").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function listQueueForPrincipal(schoolId: string, status?: "pending" | "approved" | "rejected") {
  let query = supabaseAdmin.from("registration_requests").select(REQUEST_SELECT).eq("school_id", schoolId).eq("reviewer_type", "principal").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function listQueueForClassTeacher(schoolId: string, teacherId: string, status?: "pending" | "approved" | "rejected") {
  let query = supabaseAdmin
    .from("registration_requests")
    .select(REQUEST_SELECT)
    .eq("school_id", schoolId)
    .eq("reviewer_type", "class_teacher")
    .eq("assigned_reviewer_id", teacherId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

/**
 * Applies a Teacher registration's deferred homeroom/subject proposal —
 * only ever called after approval. Mirrors TeacherFormModal.tsx's own
 * create flow exactly: homeroom (if any) and subject assignments are two
 * independent operations, not tied to each other — a class teacher's
 * subject assignments can span classes other than their own homeroom.
 */
async function applyTeacherPayload(schoolId: string, teacherId: string, payload: Record<string, unknown>) {
  if (payload.is_class_teacher && payload.homeroom_class_id) {
    await teacherService.setHomeroomTeacher(schoolId, teacherId, payload.homeroom_class_id as string, false);
  }

  const assignments = (payload.assignments as { class_id: string; subject_id: string }[] | undefined) ?? [];
  if (assignments.length > 0) {
    await teacherService.bulkAssignSubjects(schoolId, teacherId, assignments);
  }
}

/**
 * Approve/reject a registration request. Race-safe (conditional update on
 * status='pending'), mirroring studentLeaveRequest.service.ts::review.
 * `reviewerId`/`allowedReviewerCheck` is enforced by the caller (controller),
 * which already scoped the row to the right queue.
 */
export async function review(
  schoolId: string,
  requestId: string,
  reviewerId: string,
  action: "approve" | "reject",
  notes?: string
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("registration_requests")
    .select("id, user_id, role_id, status, payload")
    .eq("id", requestId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);
  if (!existing) throw ApiError.notFound("Registration request not found");

  const status = action === "approve" ? "approved" : "rejected";

  const { data, error } = await supabaseAdmin
    .from("registration_requests")
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), reviewer_notes: notes ?? null })
    .eq("id", requestId)
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .select("id, user_id, role_id, payload")
    .single();

  if (error && error.code !== "PGRST116") throw ApiError.internal(error.message);
  if (!data) return { id: requestId, alreadyReviewed: true };

  const row = data as unknown as { id: string; user_id: string; role_id: number; payload: Record<string, unknown> };

  const { error: userUpdateError } = await supabaseAdmin
    .from("users")
    .update({ status, approval_reviewed_by: reviewerId, approval_reviewed_at: new Date().toISOString(), approval_reviewer_notes: notes ?? null })
    .eq("id", row.user_id);
  if (userUpdateError) throw ApiError.internal(userUpdateError.message);

  if (action === "approve" && row.role_id === ROLE_ID.TEACHER) {
    await applyTeacherPayload(schoolId, row.user_id, row.payload ?? {});
  }

  notificationService
    .notifyUsers(schoolId, reviewerId, [row.user_id], {
      title: `Your registration was ${status}`,
      message:
        status === "approved"
          ? "Your registration has been approved. You can now log in."
          : "Your registration request has been rejected. Please contact your school administrator for more information.",
      type: status === "approved" ? "registration_approved" : "registration_rejected",
      metadata: { registration_request_id: requestId },
    })
    .catch((err) => logger.error({ err, requestId }, "Failed to send registration-reviewed notification"));

  return { id: requestId, alreadyReviewed: false, status };
}

/** For RegistrationStatusPage — GET /auth/me (via requireAuthAllowUnapproved) calls this when status isn't 'approved' to show who reviewed it, if anyone yet has. */
export async function getApprovalStatus(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("status, approval_reviewed_at, approval_reviewer_notes, reviewer:approval_reviewed_by(full_name)")
    .eq("id", userId)
    .single();
  if (error || !data) throw ApiError.notFound("User not found");

  const row = data as unknown as {
    status: "pending" | "approved" | "rejected";
    approval_reviewed_at: string | null;
    approval_reviewer_notes: string | null;
    reviewer: { full_name: string } | null;
  };
  return {
    status: row.status,
    reviewed_at: row.approval_reviewed_at,
    reviewer_notes: row.approval_reviewer_notes,
    reviewer_name: row.reviewer?.full_name ?? null,
  };
}
