import { supabaseAdmin } from '../config/supabase';
import { AttendanceStatus, MarkAttendanceEntry } from '../types/attendance.types';
import { logger } from '../config/logger';
import * as notificationService from './notification.service';

const STATUS_FIELDS = ['present', 'absent', 'late', 'half_day', 'leave', 'excused'] as const;

function buildAttendanceSummary(rows: Array<{ status: AttendanceStatus | string }>) {
  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    half_day: 0,
    leave: 0,
    excused: 0,
  };

  for (const row of rows) {
    if (STATUS_FIELDS.includes(row.status as AttendanceStatus)) {
      counts[row.status as AttendanceStatus] += 1;
    }
  }

  const total = rows.length;
  const presentPct = total > 0 ? Math.round((100 * counts.present) / total * 100) / 100 : null;

  return {
    present_count: counts.present,
    absent_count: counts.absent,
    late_count: counts.late,
    half_day_count: counts.half_day,
    leave_count: counts.leave,
    excused_count: counts.excused,
    total_marked: total,
    present_pct: presentPct,
  };
}

export async function markAttendance(
  classId: string,
  attendanceDate: string,
  entries: MarkAttendanceEntry[],
  markedBy: string,
  schoolId: string
) {
  const records = entries.map((entry) => ({
    student_id: entry.student_id,
    school_id: schoolId,
    class_id: classId,
    date: attendanceDate,
    status: entry.status,
    remarks: entry.remarks ?? null,
    marked_by: markedBy,
    updated_by: markedBy,
  }));

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .upsert(records, { onConflict: 'student_id,date' })
    .select();

  if (error) throw error;

  const absentStudentIds = entries.filter((e) => e.status === 'absent').map((e) => e.student_id);
  if (absentStudentIds.length > 0) {
    notificationService
      .notifyStudents(schoolId, markedBy, absentStudentIds, {
        title: 'Absence recorded',
        message: `Marked absent for ${attendanceDate}.`,
        type: 'attendance',
        metadata: { class_id: classId, attendance_date: attendanceDate },
      })
      .catch((err) => logger.error({ err }, 'Failed to send attendance notifications'));
  }

  return data ?? [];
}

export async function editAttendance(
  attendanceId: string,
  status: AttendanceStatus,
  remarks: string | undefined,
  editedBy: string
) {
  const { data, error } = await supabaseAdmin
    .from('attendance')
    .update({ status, remarks: remarks ?? null, updated_by: editedBy })
    .eq('id', attendanceId)
    .select()
    .single();

  if (error) throw error;
  return data ?? null;
}

export async function getDailyAttendance(classId: string, date: string) {
  const { data: students, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, admission_no, users(full_name)')
    .eq('class_id', classId)
    .order('full_name', { foreignTable: 'users', ascending: true });

  if (studentError) throw studentError;

  const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
    .from('attendance')
    .select('id, student_id, status, remarks, updated_at')
    .eq('class_id', classId)
    .eq('date', date);

  if (attendanceError) throw attendanceError;

  const attendanceByStudent = new Map<string, { id: string; status: AttendanceStatus; remarks: string | null; updated_at: string | null }>();
  for (const row of attendanceRows ?? []) {
    if (row?.student_id) {
      attendanceByStudent.set(row.student_id, row as any);
    }
  }

  return (students ?? []).map((student: any) => {
    const record = attendanceByStudent.get(student.id);
    return {
      student_id: student.id,
      student_name: student.users?.full_name ?? '',
      attendance_id: record?.id ?? null,
      status: record?.status ?? null,
      remarks: record?.remarks ?? null,
      updated_at: record?.updated_at ?? null,
    };
  });
}

export async function getStudentAttendance(studentId: string, from?: string, to?: string) {
  let query = supabaseAdmin.from('attendance').select('date, status, remarks').eq('student_id', studentId);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  query = query.order('date', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  const records = data ?? [];
  const summary = buildAttendanceSummary(records as Array<{ status: AttendanceStatus }>);
  return { records, summary };
}

export async function listHistoryForClass(schoolId: string, classId: string, from?: string, to?: string) {
  let query = supabaseAdmin
    .from('attendance')
    .select('id, student_id, date, status, remarks, students(id, admission_no, users(full_name))')
    .eq('school_id', schoolId)
    .eq('class_id', classId);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  query = query.order('date', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return data ?? [];
}

/**
 * The vw_attendance_* reporting views join attendance/classes/users but
 * expose no school_id column, so every caller must scope by class_id
 * membership itself — this resolves "which class ids belong to this
 * school" once per report call.
 */
async function getClassIdsForSchool(schoolId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('classes').select('id').eq('school_id', schoolId);
  if (error) throw error;
  return (data ?? []).map((c) => c.id as string);
}

export async function getDailyReport(schoolId: string, date: string, classId?: string) {
  const classIds = await getClassIdsForSchool(schoolId);
  if (classIds.length === 0) return [];

  let query = supabaseAdmin.from('vw_attendance_daily_summary').select('*').eq('attendance_date', date).in('class_id', classIds);
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query.order('class_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMonthlyReport(schoolId: string, month: string, classId?: string) {
  const classIds = await getClassIdsForSchool(schoolId);
  if (classIds.length === 0) return [];

  let query = supabaseAdmin.from('vw_attendance_monthly_summary').select('*').eq('month', month).in('class_id', classIds);
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query.order('class_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getStudentWiseReport(schoolId: string, classId?: string) {
  const classIds = await getClassIdsForSchool(schoolId);
  if (classIds.length === 0) return [];

  let query = supabaseAdmin.from('vw_attendance_student_summary').select('*').in('class_id', classIds);
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query.order('student_id', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getClassWiseReport(schoolId: string) {
  const classIds = await getClassIdsForSchool(schoolId);
  if (classIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('vw_attendance_class_summary')
    .select('*')
    .in('class_id', classIds)
    .order('class_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getOverallAnalytics(schoolId: string, from?: string, to?: string) {
  let attendanceQuery = supabaseAdmin.from('attendance').select('date, status').eq('school_id', schoolId);
  if (from) attendanceQuery = attendanceQuery.gte('date', from);
  if (to) attendanceQuery = attendanceQuery.lte('date', to);

  const { data: attendanceRows, error: attendanceError } = await attendanceQuery;
  if (attendanceError) throw attendanceError;

  const trendMap = new Map<string, { present_count: number; absent_count: number; late_count: number; excused_count: number; total_marked: number }>();
  for (const row of attendanceRows ?? []) {
    const dateKey = row.date;
    if (!trendMap.has(dateKey)) {
      trendMap.set(dateKey, { present_count: 0, absent_count: 0, late_count: 0, excused_count: 0, total_marked: 0 });
    }
    const bucket = trendMap.get(dateKey)!;
    bucket.total_marked += 1;
    if (row.status === 'present') bucket.present_count += 1;
    if (row.status === 'absent') bucket.absent_count += 1;
    if (row.status === 'late') bucket.late_count += 1;
  }

  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([attendance_date, counts]) => ({
      attendance_date,
      ...counts,
      present_pct: counts.total_marked > 0 ? Math.round((100 * counts.present_count) / counts.total_marked * 100) / 100 : 0,
    }));

  const byClass = await getClassWiseReport(schoolId);

  const overallSummary = buildAttendanceSummary(attendanceRows ?? []);

  return { trend, byClass, overall: overallSummary };
}

export async function getAttendanceHistory(attendanceId: string) {
  const { data, error } = await supabaseAdmin
    .from('attendance_history')
    .select('*')
    .eq('attendance_id', attendanceId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getSummaryForStudent(schoolId: string, studentId: string, from?: string, to?: string) {
  let query = supabaseAdmin.from('attendance').select('status, date').eq('school_id', schoolId).eq('student_id', studentId);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const summary = buildAttendanceSummary(rows as Array<{ status: AttendanceStatus }>);
  return {
    from: from ?? null,
    to: to ?? null,
    total: summary.total_marked,
    percentage: summary.present_pct,
    counts: {
      present: summary.present_count,
      absent: summary.absent_count,
      late: summary.late_count,
      half_day: summary.half_day_count,
      leave: summary.leave_count,
      excused: summary.excused_count,
    },
  };
}
