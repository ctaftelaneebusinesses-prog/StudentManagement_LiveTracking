import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

interface ClassSubjectRow {
  class_id: string;
  classes: { id: string; name: string; section: string; school_id: string } | null;
  subject_id: string;
  subjects: { id: string; name: string; code: string } | null;
}

interface HomeroomClassRow {
  id: string;
  name: string;
  section: string;
}

interface TeacherClassSummary {
  id: string;
  name: string;
  section: string;
  isHomeroom: boolean;
  subjects: { id: string; name: string; code: string }[];
  studentCount: number;
}

/** Assigned classes + subjects (from class_subjects) merged with homeroom classes (classes.class_teacher_id), each with a student count. */
export async function getDashboard(schoolId: string, teacherId: string) {
  const [assignmentsResult, homeroomResult] = await Promise.all([
    supabaseAdmin
      .from("class_subjects")
      .select("class_id, classes!inner(id, name, section, school_id), subject_id, subjects(id, name, code)")
      .eq("teacher_id", teacherId)
      .eq("classes.school_id", schoolId),
    supabaseAdmin
      .from("classes")
      .select("id, name, section")
      .eq("class_teacher_id", teacherId)
      .eq("school_id", schoolId),
  ]);

  if (assignmentsResult.error) throw ApiError.internal(assignmentsResult.error.message);
  if (homeroomResult.error) throw ApiError.internal(homeroomResult.error.message);

  const assignments = (assignmentsResult.data ?? []) as unknown as ClassSubjectRow[];
  const homeroomClasses = (homeroomResult.data ?? []) as HomeroomClassRow[];

  const byClass = new Map<string, TeacherClassSummary>();

  for (const row of assignments) {
    if (!row.classes) continue;
    if (!byClass.has(row.class_id)) {
      byClass.set(row.class_id, {
        id: row.classes.id,
        name: row.classes.name,
        section: row.classes.section,
        isHomeroom: false,
        subjects: [],
        studentCount: 0,
      });
    }
    if (row.subjects) {
      byClass.get(row.class_id)!.subjects.push(row.subjects);
    }
  }

  for (const klass of homeroomClasses) {
    if (!byClass.has(klass.id)) {
      byClass.set(klass.id, {
        id: klass.id,
        name: klass.name,
        section: klass.section,
        isHomeroom: true,
        subjects: [],
        studentCount: 0,
      });
    } else {
      byClass.get(klass.id)!.isHomeroom = true;
    }
  }

  const classIds = Array.from(byClass.keys());
  if (classIds.length > 0) {
    const { data: students, error: studentsError } = await supabaseAdmin
      .from("students")
      .select("class_id")
      .eq("school_id", schoolId)
      .in("class_id", classIds);
    if (studentsError) throw ApiError.internal(studentsError.message);

    for (const student of students ?? []) {
      const entry = byClass.get(student.class_id as string);
      if (entry) entry.studentCount += 1;
    }
  }

  const classes = Array.from(byClass.values()).sort((a, b) => a.name.localeCompare(b.name) || a.section.localeCompare(b.section));
  const totalSubjects = new Set(classes.flatMap((c) => c.subjects.map((s) => s.id))).size;
  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);

  return { classes, totalClasses: classes.length, totalSubjects, totalStudents };
}

/** Roster for one of the teacher's own classes — ownership is checked by the caller (assertTeacherOwnsClass). */
export async function listStudentsForClass(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, admission_no, roll_no, date_of_birth, gender, users(full_name, email, phone, avatar_url)")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("roll_no");
  if (error) throw ApiError.internal(error.message);
  return data;
}
