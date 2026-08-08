import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { updateSchoolSettings } from "./school.service";

/**
 * Exports a bounded, representative bundle of this school's configuration
 * and roster data — deliberately not full transactional history (every
 * attendance row, every GPS ping, every fee payment) which would be large
 * and is already reportable/exportable per-module via the Reports console.
 */
export async function exportSchoolData(schoolId: string) {
  const [school, users, students, teachers, classes, subjects, academicYears, branches, departments] = await Promise.all([
    supabaseAdmin.from("schools").select("*").eq("id", schoolId).single(),
    supabaseAdmin.from("users").select("id, full_name, email, phone, role_id, is_active, created_at").eq("school_id", schoolId),
    supabaseAdmin.from("students").select("id, admission_no, roll_no, class_id, admission_date").eq("school_id", schoolId),
    supabaseAdmin.from("teachers").select("id, employee_id, qualification, joining_date").eq("school_id", schoolId),
    supabaseAdmin.from("classes").select("id, name, section, academic_year_id, branch_id").eq("school_id", schoolId),
    supabaseAdmin.from("subjects").select("id, name, code").eq("school_id", schoolId),
    supabaseAdmin.from("academic_years").select("*").eq("school_id", schoolId),
    supabaseAdmin.from("branches").select("*").eq("school_id", schoolId),
    supabaseAdmin.from("departments").select("id, name, description, head_teacher_id").eq("school_id", schoolId),
  ]);

  for (const [label, result] of Object.entries({ school, users, students, teachers, classes, subjects, academicYears, branches, departments })) {
    if (result.error) throw ApiError.internal(`Failed to export ${label}: ${result.error.message}`);
  }

  await updateSchoolSettings(schoolId, "backup", {
    ...((school.data?.settings as Record<string, unknown> | undefined)?.backup as Record<string, unknown> | undefined),
    lastExportAt: new Date().toISOString(),
  });

  return {
    generatedAt: new Date().toISOString(),
    school: school.data,
    users: users.data,
    students: students.data,
    teachers: teachers.data,
    classes: classes.data,
    subjects: subjects.data,
    academicYears: academicYears.data,
    branches: branches.data,
    departments: departments.data,
  };
}
