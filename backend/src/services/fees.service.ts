import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { escapeOrFilterValue } from "../utils/searchFilter";
import { assertStudentInSchool } from "../utils/scopeGuards";
import { resolveSchoolAdminRecipientIds } from "../utils/notificationRecipients";
import { ROLE_ID } from "../config/roles";
import * as notificationService from "./notification.service";
import * as pushService from "./push.service";

const FEE_STRUCTURE_SELECT =
  "id, school_id, class_id, student_id, academic_year_id, term, amount, discount_amount, scholarship_amount, due_date, created_at, classes(name, section)";
const FEE_PAYMENT_SELECT =
  "id, student_id, fee_structure_id, amount, payment_date, payment_method, reference_no, notes, recorded_by, receipt_no, created_at";

/** Net amount actually owed for one fee_structures row, after discount/scholarship. */
function netDue(s: { amount: number | string; discount_amount?: number | string | null; scholarship_amount?: number | string | null }): number {
  return Math.max(Number(s.amount) - Number(s.discount_amount ?? 0) - Number(s.scholarship_amount ?? 0), 0);
}

/**
 * The school's classes (id/name/section/academic year), gated by `fees.view`
 * rather than `classes.manage` — the class-picking dropdowns throughout the
 * fees module (structures, payment history, bulk management) need this list,
 * but `GET /classes` requires `classes.manage`, which the accountant role
 * deliberately doesn't hold (it can view/manage fees, not academic
 * settings). Read-only, so granting broader read access here is safe.
 */
export async function listClassesForFees(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, school_id, name, section, academic_year_id, academic_years(name)")
    .eq("school_id", schoolId)
    .order("name")
    .order("section");
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Class-wide fee structures only — per-student ad hoc fee items (student_id set) live outside this list; see getStudentFeeItems. */
export async function listFeeStructures(schoolId: string, classId?: string) {
  let query = supabaseAdmin.from("fee_structures").select(FEE_STRUCTURE_SELECT).eq("school_id", schoolId).is("student_id", null);
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query.order("term");
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Resolves every user holding a given role at this school, via `user_roles` (multi-role aware) — mirrors leaveRequest.service.ts's/announcement.service.ts's role-audience lookup. */
async function resolveUserIdsByRole(schoolId: string, roleId: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("school_id", schoolId).eq("role_id", roleId);
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((r) => r.user_id as string);
}

/**
 * Notifies the class teacher(s) of the affected class(es) plus every
 * principal/school_admin/super_admin at the school — one `notifyUsers` call
 * (so exactly one notification row per staff recipient, never one per
 * class), excluding the actor themself. Fire-and-forget: logged, never
 * thrown, so a notification hiccup never fails the fee write that triggered
 * it.
 */
async function notifyStaffForFee(
  schoolId: string,
  actorId: string,
  classIds: (string | null | undefined)[],
  input: { title: string; message: string; type: notificationService.NotificationType; metadata?: Record<string, unknown> }
): Promise<void> {
  try {
    const uniqueClassIds = Array.from(new Set(classIds.filter((id): id is string => !!id)));

    const [classTeacherRows, principalIds, adminTierIds] = await Promise.all([
      uniqueClassIds.length > 0
        ? supabaseAdmin.from("classes").select("class_teacher_id").in("id", uniqueClassIds)
        : Promise.resolve({ data: [], error: null }),
      resolveUserIdsByRole(schoolId, ROLE_ID.PRINCIPAL),
      resolveSchoolAdminRecipientIds(schoolId), // multi-school- and super_admin-aware
    ]);
    if (classTeacherRows.error) throw ApiError.internal(classTeacherRows.error.message);

    const classTeacherIds = (classTeacherRows.data ?? []).map((c) => c.class_teacher_id as string | null).filter((id): id is string => !!id);
    const recipientIds = Array.from(new Set([...classTeacherIds, ...principalIds, ...adminTierIds])).filter(
      (id) => id !== actorId
    );
    if (recipientIds.length === 0) return;

    await notificationService.notifyUsers(schoolId, actorId, recipientIds, input);
    await pushService.sendToUserIds(recipientIds, { title: input.title, body: input.message });
  } catch (err) {
    // Never let a notification failure fail the fee write that triggered it.
    // eslint-disable-next-line no-console
    console.error("Failed to notify staff of fee change", err);
  }
}

/**
 * Notifies the affected student(s), and the relevant staff (class teacher +
 * principal + admin), that a fee was added, updated, or removed — a single
 * student if the fee targets one directly, otherwise every student in the
 * class it targets.
 */
async function notifyFeeChange(
  schoolId: string,
  actorId: string,
  target: { class_id: string | null; student_id: string | null },
  term: string,
  amount: number,
  action: "added" | "updated" | "removed"
): Promise<void> {
  let studentIds: string[];
  let classIdForStaff: string | null = target.class_id;
  if (target.student_id) {
    studentIds = [target.student_id];
    if (!classIdForStaff) classIdForStaff = await getStudentClass(schoolId, target.student_id);
  } else if (target.class_id) {
    const { data, error } = await supabaseAdmin.from("students").select("id").eq("school_id", schoolId).eq("class_id", target.class_id);
    if (error) throw ApiError.internal(error.message);
    studentIds = (data ?? []).map((s) => s.id as string);
  } else {
    return;
  }

  const amountLabel = `₹${amount.toFixed(2)}`;
  const title = action === "added" ? "New fee added" : action === "updated" ? "Fee updated" : "Fee removed";
  const message =
    action === "added"
      ? `A ${term} fee of ${amountLabel} has been added to your account.`
      : action === "updated"
        ? `Your ${term} fee has been updated to ${amountLabel}.`
        : `Your ${term} fee of ${amountLabel} has been removed.`;
  const type: notificationService.NotificationType = action === "added" ? "fee_due" : action === "updated" ? "fee_updated" : "fee_removed";

  if (studentIds.length > 0) {
    await notificationService.notifyStudents(schoolId, actorId, studentIds, { title, message, type, metadata: { term, amount } });
    await pushService.sendToUserIds(studentIds, { title, body: message });
  }

  await notifyStaffForFee(schoolId, actorId, [classIdForStaff], {
    title,
    message: `${title} for ${term} (${amountLabel}).`,
    type,
    metadata: { term, amount },
  });
}

interface FeeStructureInput {
  class_id?: string;
  student_id?: string;
  academic_year_id?: string;
  term: string;
  amount: number;
  due_date?: string;
  discount_amount?: number;
  scholarship_amount?: number;
}

export async function createFeeStructure(schoolId: string, actorId: string, input: FeeStructureInput) {
  if (input.class_id) {
    const { data: klass, error: classError } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", input.class_id)
      .eq("school_id", schoolId)
      .single();
    if (classError || !klass) throw ApiError.notFound("Class not found");
  }
  if (input.student_id) {
    await assertStudentInSchool(schoolId, input.student_id);
  }

  const { data, error } = await supabaseAdmin
    .from("fee_structures")
    .insert({ school_id: schoolId, ...input })
    .select(FEE_STRUCTURE_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("A fee structure for this class/student, term, and academic year already exists");
    throw ApiError.internal(error.message);
  }

  await notifyFeeChange(schoolId, actorId, { class_id: data.class_id, student_id: data.student_id }, data.term, netDue(data), "added");

  return data;
}

export async function updateFeeStructure(
  schoolId: string,
  actorId: string,
  feeStructureId: string,
  patch: Partial<FeeStructureInput>
) {
  if (patch.class_id) {
    const { data: klass, error: classError } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", patch.class_id)
      .eq("school_id", schoolId)
      .single();
    if (classError || !klass) throw ApiError.notFound("Class not found");
  }
  if (patch.student_id) {
    await assertStudentInSchool(schoolId, patch.student_id);
  }

  const { data, error } = await supabaseAdmin
    .from("fee_structures")
    .update(patch)
    .eq("id", feeStructureId)
    .eq("school_id", schoolId)
    .select(FEE_STRUCTURE_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("A fee structure for this class/student, term, and academic year already exists");
    throw ApiError.internal(error.message);
  }
  if (!data) throw ApiError.notFound("Fee structure not found");

  if (patch.amount !== undefined || patch.discount_amount !== undefined || patch.scholarship_amount !== undefined) {
    await notifyFeeChange(schoolId, actorId, { class_id: data.class_id, student_id: data.student_id }, data.term, netDue(data), "updated");
  }

  return data;
}

/**
 * Removing a fee that already has payments recorded against it would orphan
 * that payment history (its balance math would no longer make sense) — the
 * concrete "business rule" gate for Remove Fees. Callers must clear/reassign
 * the payments first.
 */
export async function deleteFeeStructure(schoolId: string, actorId: string, feeStructureId: string) {
  const { count, error: countError } = await supabaseAdmin
    .from("fee_payments")
    .select("id", { count: "exact", head: true })
    .eq("fee_structure_id", feeStructureId);
  if (countError) throw ApiError.internal(countError.message);
  if ((count ?? 0) > 0) {
    throw ApiError.conflict("Cannot remove a fee that already has payments recorded against it");
  }

  const { data, error } = await supabaseAdmin
    .from("fee_structures")
    .delete()
    .eq("id", feeStructureId)
    .eq("school_id", schoolId)
    .select(FEE_STRUCTURE_SELECT)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Fee structure not found");

  await notifyFeeChange(schoolId, actorId, { class_id: data.class_id, student_id: data.student_id }, data.term, netDue(data), "removed");
}

/**
 * Sets or updates a per-student override on a class-level fee line — what
 * this one student owes for that term, replacing the class's shared amount
 * for them alone (every other student in the class is unaffected).
 * `feeStructureId` must reference a class-level row (class_id set); a
 * per-student ad hoc row (student_id set, from createFeeStructure) is
 * already that student's own amount and has nothing to override.
 */
export async function upsertStudentFeeOverride(
  schoolId: string,
  actorId: string,
  studentId: string,
  feeStructureId: string,
  input: { override_amount: number; reason?: string }
) {
  await assertStudentInSchool(schoolId, studentId);

  const { data: structure, error: structureError } = await supabaseAdmin
    .from("fee_structures")
    .select("id, class_id, student_id, term")
    .eq("id", feeStructureId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (structureError) throw ApiError.internal(structureError.message);
  if (!structure) throw ApiError.notFound("Fee structure not found");
  if (!structure.class_id || structure.student_id) {
    throw ApiError.badRequest("Only a class-level fee can be overridden for a specific student");
  }

  const { data, error } = await supabaseAdmin
    .from("student_fee_overrides")
    .upsert(
      {
        school_id: schoolId,
        student_id: studentId,
        fee_structure_id: feeStructureId,
        override_amount: input.override_amount,
        reason: input.reason ?? null,
        created_by: actorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,fee_structure_id" }
    )
    .select("id, student_id, fee_structure_id, override_amount, reason, created_at, updated_at")
    .single();
  if (error) throw ApiError.internal(error.message);

  await notifyFeeChange(schoolId, actorId, { class_id: null, student_id: studentId }, structure.term, input.override_amount, "updated");

  return data;
}

/** Removes a student's fee override, reverting that line back to the class's shared amount. */
export async function deleteStudentFeeOverride(schoolId: string, actorId: string, studentId: string, feeStructureId: string) {
  const { data: structure, error: structureError } = await supabaseAdmin
    .from("fee_structures")
    .select("id, term, amount, discount_amount, scholarship_amount")
    .eq("id", feeStructureId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (structureError) throw ApiError.internal(structureError.message);
  if (!structure) throw ApiError.notFound("Fee structure not found");

  const { data, error } = await supabaseAdmin
    .from("student_fee_overrides")
    .delete()
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("fee_structure_id", feeStructureId)
    .select("id")
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("No override found for this student and fee");

  await notifyFeeChange(schoolId, actorId, { class_id: null, student_id: studentId }, structure.term, netDue(structure), "updated");
}

async function getStudentClass(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Student not found");
  return data.class_id as string | null;
}

/** The student's transport fee (set from the Transport > Fees tab), if they have a transport assignment with a fee amount. */
async function getStudentTransportFee(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("student_pickup_points")
    .select("fee_amount, payment_status, fee_due_date, fee_paid_date")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data || data.fee_amount == null) return null;
  return data as { fee_amount: number; payment_status: "paid" | "unpaid" | "partial"; fee_due_date: string | null; fee_paid_date: string | null };
}

/** This student's own ad hoc fee items (fee_structures rows targeting them directly, not a whole class). */
async function getStudentFeeItems(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("fee_structures")
    .select(FEE_STRUCTURE_SELECT)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("term");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

const STUDENT_HEADER_SELECT =
  "id, admission_no, roll_no, class_id, father_name, father_phone, mother_name, mother_phone, classes(name, section), users(full_name, avatar_url, phone)";

/** Student info + the father/mother quick-contact fields for the accountant's Student Fee Profile header — prefers father, falls back to mother. */
async function getStudentFeeProfileHeader(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(STUDENT_HEADER_SELECT)
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Student not found");
  const row = data as any;

  return {
    id: row.id as string,
    admissionNo: row.admission_no as string,
    rollNo: (row.roll_no as string | null) ?? null,
    name: (row.users?.full_name as string) ?? "",
    avatarUrl: (row.users?.avatar_url as string | null) ?? null,
    contactNumber: (row.users?.phone as string | null) ?? null,
    className: row.classes ? [row.classes.name, row.classes.section].filter(Boolean).join(" ") : "Unassigned",
    classId: row.class_id as string | null,
    parentName: (row.father_name as string | null) ?? (row.mother_name as string | null) ?? null,
    parentContact: (row.father_phone as string | null) ?? (row.mother_phone as string | null) ?? null,
  };
}

/** Total due (from the student's class fee structures, their own per-student fee items, plus their transport fee if set) vs. total paid, plus the underlying rows. */
export async function getFeeSummary(schoolId: string, studentId: string) {
  const classId = await getStudentClass(schoolId, studentId);

  const [classStructures, studentFeeItems, transportFee, paymentsResult, student, overridesResult] = await Promise.all([
    classId ? listFeeStructures(schoolId, classId) : Promise.resolve([]),
    getStudentFeeItems(schoolId, studentId),
    getStudentTransportFee(schoolId, studentId),
    supabaseAdmin
      .from("fee_payments")
      .select(FEE_PAYMENT_SELECT)
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .order("payment_date", { ascending: false }),
    getStudentFeeProfileHeader(schoolId, studentId),
    supabaseAdmin
      .from("student_fee_overrides")
      .select("fee_structure_id, override_amount, reason")
      .eq("school_id", schoolId)
      .eq("student_id", studentId),
  ]);
  if (paymentsResult.error) throw ApiError.internal(paymentsResult.error.message);
  if (overridesResult.error) throw ApiError.internal(overridesResult.error.message);
  const payments = paymentsResult.data;

  // A class-level fee line can be overridden for this one student (see
  // upsertStudentFeeOverride) — the override fully replaces that line's net
  // due for them, while every other student in the class keeps paying the
  // class's shared amount.
  const overrideByFeeStructureId = new Map(
    (overridesResult.data ?? []).map((o) => [
      o.fee_structure_id as string,
      { override_amount: Number(o.override_amount), reason: o.reason as string | null },
    ])
  );
  const structures = [
    ...(classStructures ?? []).map((s: any) => {
      const override = overrideByFeeStructureId.get(s.id);
      return {
        ...s,
        original_amount: Number(s.amount),
        override_amount: override ? override.override_amount : null,
        override_reason: override ? override.reason : null,
      };
    }),
    ...studentFeeItems.map((s: any) => ({ ...s, original_amount: Number(s.amount), override_amount: null, override_reason: null })),
  ];
  const effectiveDue = (s: { override_amount: number | null } & Parameters<typeof netDue>[0]) =>
    s.override_amount != null ? s.override_amount : netDue(s);

  const totalGross = structures.reduce((sum, s) => sum + Number(s.amount), 0) + (transportFee ? Number(transportFee.fee_amount) : 0);
  const totalDiscount = structures.reduce((sum, s) => sum + Number((s as any).discount_amount ?? 0), 0);
  const totalScholarship = structures.reduce((sum, s) => sum + Number((s as any).scholarship_amount ?? 0), 0);
  const totalDue = structures.reduce((sum, s) => sum + effectiveDue(s), 0) + (transportFee ? Number(transportFee.fee_amount) : 0);
  const totalPaid =
    (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0) +
    (transportFee?.payment_status === "paid" ? Number(transportFee.fee_amount) : 0);
  const nextDueDate = structures
    .map((s) => s.due_date as string | null)
    .filter((d): d is string => !!d)
    .sort()[0];

  return {
    student,
    totalGross,
    totalDue,
    totalPaid,
    totalDiscount,
    totalScholarship,
    balance: totalDue - totalPaid,
    dueDate: nextDueDate ?? null,
    structures: structures ?? [],
    transportFee,
    payments: payments ?? [],
  };
}

export async function listPayments(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("fee_payments")
    .select(FEE_PAYMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("payment_date", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function recordPayment(
  schoolId: string,
  studentId: string,
  recordedBy: string,
  input: {
    fee_structure_id?: string;
    amount: number;
    payment_date?: string;
    payment_method?: string;
    reference_no?: string;
    notes?: string;
  }
) {
  // Ensure the student exists in this school before recording anything against it.
  const classId = await getStudentClass(schoolId, studentId);

  const { data, error } = await supabaseAdmin
    .from("fee_payments")
    .insert({
      school_id: schoolId,
      student_id: studentId,
      recorded_by: recordedBy,
      ...input,
    })
    .select(FEE_PAYMENT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);

  const amountLabel = `₹${Number(data.amount).toFixed(2)}`;
  const title = "Payment received";
  const message = `A payment of ${amountLabel} has been recorded${data.receipt_no ? ` (receipt ${data.receipt_no})` : ""}.`;
  await notificationService.notifyStudents(schoolId, recordedBy, [studentId], {
    title,
    message,
    type: "payment_received",
    metadata: { amount: Number(data.amount), receiptNo: data.receipt_no },
  });
  await pushService.sendToUserIds([studentId], { title, body: message });
  await notifyStaffForFee(schoolId, recordedBy, [classId], {
    title,
    message: `${title}: ${amountLabel} from a student.`,
    type: "payment_received",
    metadata: { amount: Number(data.amount), receiptNo: data.receipt_no, studentId },
  });

  return data;
}

// ----------------------------------------------------------------------------
// Dashboard / analytics / school-wide listings. These derive everything from
// fee_structures (what's due, per class) and fee_payments (what's actually
// been paid, per student) rather than a dedicated aggregation table.
// ----------------------------------------------------------------------------

export type FeeStatus = "paid" | "partial" | "unpaid";

function classifyFeeStatus(due: number, paid: number): FeeStatus {
  if (paid >= due) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

interface FeeAggregates {
  /** Total net (post discount/scholarship) amount due per class, for the current academic year (or year-agnostic structures) — the class's shared amount, unadjusted by any individual student's override. */
  classDueMap: Map<string, number>;
  /** Total net amount due from per-student ad hoc fee items (fee_structures rows with student_id set), keyed by student id. */
  studentDueMap: Map<string, number>;
  /** Total amount paid per student, across all time. */
  studentPaidMap: Map<string, number>;
  payments: { id: string; student_id: string; amount: number; payment_date: string }[];
  /** Class-level fee_structures row ids grouped by their class_id, for computing a per-student override-aware due. */
  classStructureIdsByClass: Map<string, string[]>;
  /** Net due per class-level fee_structures row id, before any per-student override is applied. */
  classStructureNetDueById: Map<string, number>;
  /** Per-student overrides of a class-level fee_structures row, keyed by student id then fee_structure_id. */
  overridesByStudent: Map<string, Map<string, number>>;
}

/**
 * A student's total due = the sum of their class's fee lines (each replaced
 * by the student's own override amount when one exists for that line) plus
 * their own ad hoc fee items.
 */
function totalDueForStudent(
  agg: Pick<FeeAggregates, "classStructureIdsByClass" | "classStructureNetDueById" | "overridesByStudent" | "studentDueMap">,
  classId: string | null,
  studentId: string
): number {
  const structureIds = classId ? agg.classStructureIdsByClass.get(classId) ?? [] : [];
  const overridesForStudent = agg.overridesByStudent.get(studentId);
  const classDue = structureIds.reduce((sum, id) => {
    const override = overridesForStudent?.get(id);
    return sum + (override !== undefined ? override : agg.classStructureNetDueById.get(id) ?? 0);
  }, 0);
  const studentDue = agg.studentDueMap.get(studentId) ?? 0;
  return classDue + studentDue;
}

/** Shared building blocks for dashboard stats, analytics, and the student fee details list. */
async function getFeeAggregates(schoolId: string): Promise<FeeAggregates> {
  const { data: currentYear, error: yearError } = await supabaseAdmin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (yearError) throw ApiError.internal(yearError.message);

  const { data: structures, error: structuresError } = await supabaseAdmin
    .from("fee_structures")
    .select("id, class_id, student_id, academic_year_id, amount, discount_amount, scholarship_amount")
    .eq("school_id", schoolId);
  if (structuresError) throw ApiError.internal(structuresError.message);

  const classDueMap = new Map<string, number>();
  const studentDueMap = new Map<string, number>();
  const classStructureIdsByClass = new Map<string, string[]>();
  const classStructureNetDueById = new Map<string, number>();
  for (const s of structures ?? []) {
    // Only count structures for the current academic year, or year-agnostic
    // ones (null academic_year_id) — anything tied to a past year is excluded
    // so totals don't silently double-count across years.
    if (s.academic_year_id && s.academic_year_id !== currentYear?.id) continue;
    if (s.student_id) {
      studentDueMap.set(s.student_id, (studentDueMap.get(s.student_id) ?? 0) + netDue(s));
    } else if (s.class_id) {
      classDueMap.set(s.class_id, (classDueMap.get(s.class_id) ?? 0) + netDue(s));
      classStructureNetDueById.set(s.id, netDue(s));
      const ids = classStructureIdsByClass.get(s.class_id) ?? [];
      ids.push(s.id);
      classStructureIdsByClass.set(s.class_id, ids);
    }
  }

  const { data: overrides, error: overridesError } = await supabaseAdmin
    .from("student_fee_overrides")
    .select("student_id, fee_structure_id, override_amount")
    .eq("school_id", schoolId);
  if (overridesError) throw ApiError.internal(overridesError.message);

  const overridesByStudent = new Map<string, Map<string, number>>();
  for (const o of overrides ?? []) {
    const forStudent = overridesByStudent.get(o.student_id) ?? new Map<string, number>();
    forStudent.set(o.fee_structure_id, Number(o.override_amount));
    overridesByStudent.set(o.student_id, forStudent);
  }

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("fee_payments")
    .select("id, student_id, amount, payment_date")
    .eq("school_id", schoolId);
  if (paymentsError) throw ApiError.internal(paymentsError.message);

  const studentPaidMap = new Map<string, number>();
  for (const p of payments ?? []) {
    studentPaidMap.set(p.student_id, (studentPaidMap.get(p.student_id) ?? 0) + Number(p.amount));
  }

  return {
    classDueMap,
    studentDueMap,
    studentPaidMap,
    payments: (payments ?? []) as FeeAggregates["payments"],
    classStructureIdsByClass,
    classStructureNetDueById,
    overridesByStudent,
  };
}

/** Sum of payments with payment_date >= fromDate (inclusive), ISO yyyy-mm-dd. */
function collectionSince(payments: FeeAggregates["payments"], fromDate: string): number {
  return payments.filter((p) => p.payment_date >= fromDate).reduce((sum, p) => sum + Number(p.amount), 0);
}

/** Dashboard stat cards: totals, collections (today/week/month/year), and paid/pending student headcounts. */
export async function getDashboardStats(schoolId: string) {
  const { studentDueMap, studentPaidMap, payments, classStructureIdsByClass, classStructureNetDueById, overridesByStudent } =
    await getFeeAggregates(schoolId);

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId);
  if (studentsError) throw ApiError.internal(studentsError.message);

  let totalFees = 0;
  let paidStudentsCount = 0;
  let pendingStudentsCount = 0;

  for (const s of students ?? []) {
    const due = totalDueForStudent(
      { classStructureIdsByClass, classStructureNetDueById, overridesByStudent, studentDueMap },
      s.class_id,
      s.id
    );
    if (due <= 0) continue;
    totalFees += due;
    const paid = studentPaidMap.get(s.id) ?? 0;
    if (paid >= due) paidStudentsCount += 1;
    else pendingStudentsCount += 1;
  }

  const collectedFees = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingFees = Math.max(totalFees - collectedFees, 0);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const todaysCollection = collectionSince(payments, today);
  const weekCollection = collectionSince(payments, startOfWeek.toISOString().slice(0, 10));
  const monthCollection = collectionSince(payments, startOfMonth.toISOString().slice(0, 10));
  const yearCollection = collectionSince(payments, startOfYear.toISOString().slice(0, 10));

  return {
    totalFees,
    collectedFees,
    pendingFees,
    todaysCollection,
    weekCollection,
    monthCollection,
    yearCollection,
    paidStudentsCount,
    pendingStudentsCount,
  };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Chart-ready data for the Overview tab: monthly bar, daily trend line, and a status pie. */
export async function getAnalytics(schoolId: string) {
  const { studentDueMap, studentPaidMap, payments, classStructureIdsByClass, classStructureNetDueById, overridesByStudent } =
    await getFeeAggregates(schoolId);
  const now = new Date();

  const monthTotals = new Map<string, number>();
  for (const p of payments) monthTotals.set(p.payment_date.slice(0, 7), (monthTotals.get(p.payment_date.slice(0, 7)) ?? 0) + Number(p.amount));

  const monthlyCollection = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: d.toLocaleString("en-US", { month: "short" }), value: monthTotals.get(monthKey(d)) ?? 0 };
  });

  const dayTotals = new Map<string, number>();
  for (const p of payments) dayTotals.set(p.payment_date, (dayTotals.get(p.payment_date) ?? 0) + Number(p.amount));

  const collectionTrend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString("en-US", { day: "2-digit", month: "short" }), value: dayTotals.get(key) ?? 0 };
  });

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId);
  if (studentsError) throw ApiError.internal(studentsError.message);

  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  for (const s of students ?? []) {
    const due = totalDueForStudent(
      { classStructureIdsByClass, classStructureNetDueById, overridesByStudent, studentDueMap },
      s.class_id,
      s.id
    );
    if (due <= 0) continue;
    const status = classifyFeeStatus(due, studentPaidMap.get(s.id) ?? 0);
    if (status === "paid") paidCount += 1;
    else if (status === "partial") partialCount += 1;
    else unpaidCount += 1;
  }

  const statusBreakdown = [
    { label: "Paid", value: paidCount },
    { label: "Partially Paid", value: partialCount },
    { label: "Unpaid", value: unpaidCount },
  ];

  return { monthlyCollection, collectionTrend, statusBreakdown };
}

interface ListStudentFeeDetailsFilters {
  search?: string;
  classId?: string;
  academicYearId?: string;
  status?: "all" | FeeStatus;
  page: number;
  pageSize: number;
}

const STUDENT_FEE_SELECT =
  "id, admission_no, roll_no, class_id, father_name, father_phone, mother_name, mother_phone, classes(name, section, academic_year_id), users(full_name, avatar_url, phone)";

/** Search/filter/paginate the school's students with their computed due/paid/balance/status, photo, roll no, and the father/mother quick-contact fields — the roster behind the accountant's Students screen (and reused by the admin Fees module's Student Fee Details tab). */
export async function listStudentFeeDetails(schoolId: string, filters: ListStudentFeeDetailsFilters) {
  const { studentDueMap, studentPaidMap, classStructureIdsByClass, classStructureNetDueById, overridesByStudent } =
    await getFeeAggregates(schoolId);

  let query = supabaseAdmin
    .from("students")
    .select(STUDENT_FEE_SELECT)
    .eq("school_id", schoolId)
    .order("admission_no");
  if (filters.classId) query = query.eq("class_id", filters.classId);
  if (filters.academicYearId) query = query.eq("classes.academic_year_id", filters.academicYearId);

  if (filters.search) {
    const pattern = escapeOrFilterValue(`%${filters.search}%`);
    const { data: matchingUsers, error: userSearchError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
    if (userSearchError) throw ApiError.internal(userSearchError.message);

    const matchingIds = (matchingUsers ?? []).map((u) => u.id);
    const idFilter = matchingIds.length > 0 ? `,id.in.(${matchingIds.join(",")})` : "";
    query = query.or(`admission_no.ilike.${pattern}${idFilter}`);
  }

  const { data: students, error } = await query;
  if (error) throw ApiError.internal(error.message);

  // filters.academicYearId above is applied as an inner-join filter by
  // PostgREST (only affects which `classes` row is embedded, not which
  // students are returned) — so also drop rows whose embedded class didn't
  // survive the filter (null classes = wrong year or unassigned).
  const yearFiltered = filters.academicYearId ? (students ?? []).filter((s: any) => s.classes) : (students ?? []);

  const enriched = yearFiltered.map((s: any) => {
    const due = totalDueForStudent(
      { classStructureIdsByClass, classStructureNetDueById, overridesByStudent, studentDueMap },
      s.class_id,
      s.id
    );
    const paid = studentPaidMap.get(s.id) ?? 0;
    return {
      id: s.id as string,
      admissionNo: s.admission_no as string,
      rollNo: (s.roll_no as string | null) ?? null,
      name: (s.users?.full_name as string) ?? "",
      avatarUrl: (s.users?.avatar_url as string | null) ?? null,
      contactNumber: (s.users?.phone as string | null) ?? null,
      className: s.classes ? [s.classes.name, s.classes.section].filter(Boolean).join(" ") : "Unassigned",
      classId: s.class_id as string | null,
      parentName: (s.father_name as string | null) ?? (s.mother_name as string | null) ?? null,
      parentContact: (s.father_phone as string | null) ?? (s.mother_phone as string | null) ?? null,
      due,
      paid,
      balance: due - paid,
      status: classifyFeeStatus(due, paid),
    };
  });

  const filtered = filters.status && filters.status !== "all" ? enriched.filter((s) => s.status === filters.status) : enriched;

  const total = filtered.length;
  const from = (filters.page - 1) * filters.pageSize;
  const items = filtered.slice(from, from + filters.pageSize);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

interface ListPaymentHistoryFilters {
  search?: string;
  classId?: string;
  method?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

const PAYMENT_HISTORY_SELECT =
  "id, student_id, amount, payment_date, payment_method, reference_no, receipt_no, " +
  "students!inner(admission_no, class_id, classes(name, section), users(full_name))";

/** School-wide, paginated payment history (unlike `listPayments`, which is scoped to one student). */
export async function listPaymentHistory(schoolId: string, filters: ListPaymentHistoryFilters) {
  let query = supabaseAdmin
    .from("fee_payments")
    .select(PAYMENT_HISTORY_SELECT, { count: "exact" })
    .eq("school_id", schoolId)
    .order("payment_date", { ascending: false });

  if (filters.classId) query = query.eq("students.class_id", filters.classId);
  if (filters.method) query = query.eq("payment_method", filters.method);
  if (filters.dateFrom) query = query.gte("payment_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("payment_date", filters.dateTo);

  if (filters.search) {
    const pattern = escapeOrFilterValue(`%${filters.search}%`);
    const [{ data: matchingUsers, error: userError }, { data: matchingStudents, error: studentError }] = await Promise.all([
      supabaseAdmin.from("users").select("id").eq("school_id", schoolId).ilike("full_name", pattern),
      supabaseAdmin.from("students").select("id").eq("school_id", schoolId).ilike("admission_no", pattern),
    ]);
    if (userError) throw ApiError.internal(userError.message);
    if (studentError) throw ApiError.internal(studentError.message);

    const ids = Array.from(new Set([...(matchingUsers ?? []).map((u) => u.id), ...(matchingStudents ?? []).map((s) => s.id)]));
    query = ids.length > 0 ? query.or(`receipt_no.ilike.${pattern},student_id.in.(${ids.join(",")})`) : query.ilike("receipt_no", pattern);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);
  return { items: data, total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

/** A single payment formatted for receipt rendering (student, class, school, and recorder names flattened). */
export async function getReceipt(schoolId: string, paymentId: string) {
  const { data, error } = await supabaseAdmin
    .from("fee_payments")
    .select(
      "id, student_id, amount, payment_date, payment_method, reference_no, notes, receipt_no, created_at, " +
        "students(admission_no, classes(name, section), users(full_name)), users(full_name), schools(name)"
    )
    .eq("id", paymentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Receipt not found");

  const row = data as any;
  return {
    id: row.id as string,
    studentId: row.student_id as string,
    receiptNo: row.receipt_no as string,
    amount: Number(row.amount),
    paymentDate: row.payment_date as string,
    paymentMethod: row.payment_method as string,
    referenceNo: (row.reference_no as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    studentName: (row.students?.users?.full_name as string) ?? "",
    admissionNo: (row.students?.admission_no as string) ?? "",
    className: row.students?.classes ? [row.students.classes.name, row.students.classes.section].filter(Boolean).join(" ") : "",
    recordedByName: (row.users?.full_name as string | null) ?? null,
    schoolName: (row.schools?.name as string) ?? "",
  };
}

// ----------------------------------------------------------------------------
// Dashboard "Recent Activity" panel.
// ----------------------------------------------------------------------------

/** Last 5 payments and last 5 fee-structure changes, for the accountant dashboard's Recent Activity panel. */
export async function getRecentActivity(schoolId: string) {
  const [paymentsResult, structuresResult] = await Promise.all([
    supabaseAdmin.from("fee_payments").select(PAYMENT_HISTORY_SELECT).eq("school_id", schoolId).order("created_at", { ascending: false }).limit(5),
    supabaseAdmin
      .from("fee_structures")
      .select("id, term, amount, discount_amount, scholarship_amount, created_at, classes(name, section), students(admission_no, users(full_name))")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (paymentsResult.error) throw ApiError.internal(paymentsResult.error.message);
  if (structuresResult.error) throw ApiError.internal(structuresResult.error.message);

  const recentPayments = (paymentsResult.data ?? []).map((p: any) => ({
    id: p.id as string,
    studentName: (p.students?.users?.full_name as string) ?? "",
    admissionNo: (p.students?.admission_no as string) ?? "",
    amount: Number(p.amount),
    paymentDate: p.payment_date as string,
    receiptNo: p.receipt_no as string,
  }));

  const recentFeeUpdates = (structuresResult.data ?? []).map((s: any) => ({
    id: s.id as string,
    target: s.students?.users?.full_name ?? (s.classes ? [s.classes.name, s.classes.section].filter(Boolean).join(" ") : "School-wide"),
    term: s.term as string,
    amount: netDue(s),
    createdAt: s.created_at as string,
  }));

  return { recentPayments, recentFeeUpdates };
}

// ----------------------------------------------------------------------------
// Reports: collection breakdown by period, and class-wise collection.
// ----------------------------------------------------------------------------

export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

/** ISO-week label (year + week number) for weekly bucketing. */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Collection totals bucketed by day/week/month/year, for the Reports screen's Daily/Weekly/Monthly/Yearly Collection views. */
export async function getCollectionReport(schoolId: string, params: { period: ReportPeriod; dateFrom?: string; dateTo?: string }) {
  let query = supabaseAdmin.from("fee_payments").select("amount, payment_date").eq("school_id", schoolId);
  if (params.dateFrom) query = query.gte("payment_date", params.dateFrom);
  if (params.dateTo) query = query.lte("payment_date", params.dateTo);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);

  const totals = new Map<string, number>();
  for (const p of data ?? []) {
    const d = new Date(`${p.payment_date}T00:00:00Z`);
    const key =
      params.period === "daily"
        ? p.payment_date
        : params.period === "weekly"
          ? isoWeekKey(d)
          : params.period === "monthly"
            ? p.payment_date.slice(0, 7)
            : p.payment_date.slice(0, 4);
    totals.set(key, (totals.get(key) ?? 0) + Number(p.amount));
  }

  const rows = Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));

  return { period: params.period, rows };
}

/** Total due/paid/balance per class — the "Class-wise Collection" report. */
export async function getClassWiseCollection(schoolId: string) {
  const { classDueMap, studentDueMap, studentPaidMap } = await getFeeAggregates(schoolId);

  const [{ data: classes, error: classesError }, { data: students, error: studentsError }] = await Promise.all([
    supabaseAdmin.from("classes").select("id, name, section").eq("school_id", schoolId),
    supabaseAdmin.from("students").select("id, class_id").eq("school_id", schoolId),
  ]);
  if (classesError) throw ApiError.internal(classesError.message);
  if (studentsError) throw ApiError.internal(studentsError.message);

  const paidByClass = new Map<string, number>();
  for (const s of students ?? []) {
    if (!s.class_id) continue;
    const paid = studentPaidMap.get(s.id) ?? 0;
    paidByClass.set(s.class_id, (paidByClass.get(s.class_id) ?? 0) + paid);
  }

  return (classes ?? []).map((c) => {
    const studentIdsInClass = (students ?? []).filter((s) => s.class_id === c.id).map((s) => s.id);
    const studentLevelDue = studentIdsInClass.reduce((sum, id) => sum + (studentDueMap.get(id) ?? 0), 0);
    const due = (classDueMap.get(c.id) ?? 0) + studentLevelDue;
    const paid = paidByClass.get(c.id) ?? 0;
    return {
      classId: c.id as string,
      className: [c.name, c.section].filter(Boolean).join(" "),
      due,
      paid,
      balance: due - paid,
    };
  });
}

// ----------------------------------------------------------------------------
// Bulk fee management — assign/update/remove across a whole school, a set of
// classes, or a set of students in one action.
// ----------------------------------------------------------------------------

export type BulkFeeScope = "school" | "class" | "student";

interface BulkTargetInput {
  scope: BulkFeeScope;
  classIds?: string[];
  studentIds?: string[];
  academicYearId?: string;
}

/** Resolves a bulk-operation scope down to the concrete class ids and/or student ids it targets. */
async function resolveBulkTargets(schoolId: string, input: BulkTargetInput): Promise<{ classIds: string[]; studentIds: string[] }> {
  if (input.scope === "student") return { classIds: [], studentIds: input.studentIds ?? [] };
  if (input.scope === "class") return { classIds: input.classIds ?? [], studentIds: [] };

  // scope === "school": every class in the school (optionally narrowed to one academic year).
  let query = supabaseAdmin.from("classes").select("id").eq("school_id", schoolId);
  if (input.academicYearId) query = query.eq("academic_year_id", input.academicYearId);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return { classIds: (data ?? []).map((c) => c.id as string), studentIds: [] };
}

/** Every student in the given classes, plus the given student ids directly — the notification/audience audience for a bulk action. */
async function resolveBulkAudience(schoolId: string, classIds: string[], studentIds: string[]): Promise<string[]> {
  if (classIds.length === 0) return Array.from(new Set(studentIds));
  const { data, error } = await supabaseAdmin.from("students").select("id").eq("school_id", schoolId).in("class_id", classIds);
  if (error) throw ApiError.internal(error.message);
  return Array.from(new Set([...(data ?? []).map((s) => s.id as string), ...studentIds]));
}

interface BulkAssignInput extends BulkTargetInput {
  term: string;
  amount: number;
  due_date?: string;
  discount_amount?: number;
  scholarship_amount?: number;
}

/** Assigns the same fee to every target (a whole school, a set of classes, or a set of students) in one action, skipping any target that already has a fee for that term/year. */
export async function bulkAssignFees(schoolId: string, actorId: string, input: BulkAssignInput) {
  const { classIds, studentIds } = await resolveBulkTargets(schoolId, input);
  const targets: { class_id?: string; student_id?: string }[] =
    classIds.length > 0 ? classIds.map((id) => ({ class_id: id })) : studentIds.map((id) => ({ student_id: id }));

  let created = 0;
  let skipped = 0;
  for (const target of targets) {
    const { error } = await supabaseAdmin.from("fee_structures").insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      term: input.term,
      amount: input.amount,
      due_date: input.due_date,
      discount_amount: input.discount_amount ?? 0,
      scholarship_amount: input.scholarship_amount ?? 0,
      ...target,
    });
    if (error) {
      if (error.code === "23505") {
        skipped += 1;
        continue;
      }
      throw ApiError.internal(error.message);
    }
    created += 1;
  }

  const netAmount = Math.max(input.amount - (input.discount_amount ?? 0) - (input.scholarship_amount ?? 0), 0);
  const audience = await resolveBulkAudience(schoolId, classIds, studentIds);
  const title = "New fee added";
  const message = `A ${input.term} fee of ₹${netAmount.toFixed(2)} has been added to your account.`;
  if (audience.length > 0) {
    await notificationService.notifyStudents(schoolId, actorId, audience, { title, message, type: "fee_due", metadata: { term: input.term, amount: netAmount } });
    await pushService.sendToUserIds(audience, { title, body: message });
  }
  await notifyStaffForFee(schoolId, actorId, classIds, {
    title,
    message: `${title} for ${input.term} (₹${netAmount.toFixed(2)}) — ${created} record(s).`,
    type: "fee_due",
    metadata: { term: input.term, amount: netAmount, created },
  });

  return { created, skipped };
}

/** Finds the fee_structures ids matching a bulk filter (by class(es), student(s), and/or term/year), used by both bulkUpdateFees and bulkRemoveFees. */
async function findMatchingFeeStructureIds(
  schoolId: string,
  filter: { classIds?: string[]; studentIds?: string[]; academicYearId?: string; term?: string }
): Promise<{ id: string; class_id: string | null; student_id: string | null }[]> {
  let query = supabaseAdmin.from("fee_structures").select("id, class_id, student_id").eq("school_id", schoolId);
  if (filter.classIds && filter.classIds.length > 0) query = query.in("class_id", filter.classIds);
  if (filter.studentIds && filter.studentIds.length > 0) query = query.in("student_id", filter.studentIds);
  if (filter.academicYearId) query = query.eq("academic_year_id", filter.academicYearId);
  if (filter.term) query = query.eq("term", filter.term);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

interface BulkUpdateInput {
  classIds?: string[];
  studentIds?: string[];
  academicYearId?: string;
  term?: string;
  patch: { amount?: number; due_date?: string; discount_amount?: number; scholarship_amount?: number };
}

/** Applies the same patch (amount/due date/discount/scholarship) to every fee_structures row matching the filter, in one action. */
export async function bulkUpdateFees(schoolId: string, actorId: string, input: BulkUpdateInput) {
  const matches = await findMatchingFeeStructureIds(schoolId, input);
  if (matches.length === 0) return { updated: 0 };

  const { error } = await supabaseAdmin
    .from("fee_structures")
    .update(input.patch)
    .in("id", matches.map((m) => m.id));
  if (error) throw ApiError.internal(error.message);

  const classIds = Array.from(new Set(matches.map((m) => m.class_id).filter((id): id is string => !!id)));
  const studentIds = matches.map((m) => m.student_id).filter((id): id is string => !!id);
  const audience = await resolveBulkAudience(schoolId, classIds, studentIds);
  const title = "Fee updated";
  const message = `${matches.length} fee record(s) have been updated.`;
  if (audience.length > 0) {
    await notificationService.notifyStudents(schoolId, actorId, audience, { title, message, type: "fee_updated" });
    await pushService.sendToUserIds(audience, { title, body: message });
  }
  await notifyStaffForFee(schoolId, actorId, classIds, { title, message: `${title} — ${matches.length} record(s).`, type: "fee_updated" });

  return { updated: matches.length };
}

interface BulkRemoveInput {
  classIds?: string[];
  studentIds?: string[];
  academicYearId?: string;
  term?: string;
}

/** Removes every fee_structures row matching the filter, skipping any that already has payments recorded (same safety rule as the single deleteFeeStructure). */
export async function bulkRemoveFees(schoolId: string, actorId: string, input: BulkRemoveInput) {
  const matches = await findMatchingFeeStructureIds(schoolId, input);
  if (matches.length === 0) return { removed: 0, skipped: 0 };

  const { data: paidStructures, error: paidError } = await supabaseAdmin
    .from("fee_payments")
    .select("fee_structure_id")
    .in("fee_structure_id", matches.map((m) => m.id));
  if (paidError) throw ApiError.internal(paidError.message);
  const idsWithPayments = new Set((paidStructures ?? []).map((p) => p.fee_structure_id as string));

  const removable = matches.filter((m) => !idsWithPayments.has(m.id));
  if (removable.length === 0) return { removed: 0, skipped: matches.length };

  const { error } = await supabaseAdmin
    .from("fee_structures")
    .delete()
    .in("id", removable.map((m) => m.id));
  if (error) throw ApiError.internal(error.message);

  const classIds = Array.from(new Set(removable.map((m) => m.class_id).filter((id): id is string => !!id)));
  const studentIds = removable.map((m) => m.student_id).filter((id): id is string => !!id);
  const audience = await resolveBulkAudience(schoolId, classIds, studentIds);
  const title = "Fee removed";
  const message = `${removable.length} fee record(s) have been removed.`;
  if (audience.length > 0) {
    await notificationService.notifyStudents(schoolId, actorId, audience, { title, message, type: "fee_removed" });
    await pushService.sendToUserIds(audience, { title, body: message });
  }
  await notifyStaffForFee(schoolId, actorId, classIds, { title, message: `${title} — ${removable.length} record(s).`, type: "fee_removed" });

  return { removed: removable.length, skipped: matches.length - removable.length };
}
