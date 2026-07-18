import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool, assertExamInSchool } from "../utils/scopeGuards";

export async function listExams(schoolId: string, classId?: string) {
  let query = supabaseAdmin
    .from("exams")
    .select("id, name, exam_date, class_id, academic_year_id, classes(name, section)")
    .eq("school_id", schoolId)
    .order("exam_date", { ascending: false });
  if (classId) query = query.eq("class_id", classId);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createExam(
  schoolId: string,
  input: { class_id: string; academic_year_id?: string; name: string; exam_date?: string }
) {
  await assertClassInSchool(schoolId, input.class_id);

  const { data, error } = await supabaseAdmin
    .from("exams")
    .insert({ school_id: schoolId, ...input })
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function upsertMarks(
  schoolId: string,
  examId: string,
  records: {
    student_id: string;
    subject_id: string;
    marks_obtained: number;
    max_marks?: number;
    grade?: string;
    remarks?: string;
  }[]
) {
  await assertExamInSchool(schoolId, examId);

  const rows = records.map((r) => ({
    school_id: schoolId,
    exam_id: examId,
    student_id: r.student_id,
    subject_id: r.subject_id,
    marks_obtained: r.marks_obtained,
    max_marks: r.max_marks ?? 100,
    grade: r.grade,
    remarks: r.remarks,
  }));

  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .upsert(rows, { onConflict: "exam_id,student_id,subject_id" })
    .select();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listMarksForExam(schoolId: string, examId: string) {
  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .select(
      "id, student_id, subject_id, marks_obtained, max_marks, grade, remarks, students(admission_no, users(full_name)), subjects(name, code)"
    )
    .eq("school_id", schoolId)
    .eq("exam_id", examId);
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listMarksForStudent(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .select(
      "id, marks_obtained, max_marks, grade, remarks, exam_id, exams(name, exam_date), subject_id, subjects(name, code)"
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("exam_id", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

interface ExamRow {
  exam_id: string;
  exams: { name: string; exam_date: string | null } | null;
  subject_id: string;
  subjects: { name: string; code: string } | null;
  marks_obtained: number;
  max_marks: number;
  grade: string | null;
}

/** Groups a student's marks by exam and computes each exam's overall percentage, most recent first. */
export async function getMarksSummaryForStudent(schoolId: string, studentId: string) {
  const rows = (await listMarksForStudent(schoolId, studentId)) as unknown as ExamRow[];

  const byExam = new Map<
    string,
    { examId: string; examName: string; examDate: string | null; subjects: ExamRow[]; obtained: number; max: number }
  >();

  for (const row of rows) {
    const key = row.exam_id;
    if (!byExam.has(key)) {
      byExam.set(key, {
        examId: row.exam_id,
        examName: row.exams?.name ?? "Exam",
        examDate: row.exams?.exam_date ?? null,
        subjects: [],
        obtained: 0,
        max: 0,
      });
    }
    const entry = byExam.get(key)!;
    entry.subjects.push(row);
    entry.obtained += Number(row.marks_obtained);
    entry.max += Number(row.max_marks);
  }

  const exams = Array.from(byExam.values())
    .map((e) => ({
      examId: e.examId,
      examName: e.examName,
      examDate: e.examDate,
      percentage: e.max > 0 ? Math.round((e.obtained / e.max) * 1000) / 10 : null,
      subjects: e.subjects.map((s) => ({
        subjectId: s.subject_id,
        subjectName: s.subjects?.name ?? "Subject",
        subjectCode: s.subjects?.code ?? "",
        marksObtained: Number(s.marks_obtained),
        maxMarks: Number(s.max_marks),
        grade: s.grade,
      })),
    }))
    .sort((a, b) => (b.examDate ?? "").localeCompare(a.examDate ?? ""));

  const latestExam = exams[0] ?? null;

  return { latestExam, exams };
}
