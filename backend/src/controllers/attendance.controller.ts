import { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';
import { assertStudentAccess } from '../utils/studentAccess';
import { ApiError } from '../utils/ApiError';

export async function markAttendance(req: Request, res: Response) {
  try {
    const { class_id, attendance_date, entries } = req.body;
    if (!class_id || !attendance_date || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'class_id, attendance_date and entries[] are required' });
    }
    const teacherId = req.user!.id;
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'school_id could not be resolved for the current user' });
    }
    const result = await attendanceService.markAttendance(class_id, attendance_date, entries, teacherId, schoolId);
    return res.status(201).json({ data: result });
  } catch (err) {
    console.error('markAttendance error:', err);
    return res.status(500).json({ error: 'Failed to mark attendance' });
  }
}

export async function editAttendance(req: Request, res: Response) {
  try {
    const attendanceId = req.params.id;
    const { status, remarks } = req.body;
    if (!attendanceId || !status) return res.status(400).json({ error: 'attendance id and status are required' });
    const teacherId = req.user!.id;
    const updated = await attendanceService.editAttendance(attendanceId, status, remarks, teacherId);
    if (!updated) return res.status(404).json({ error: 'Attendance record not found' });
    return res.json({ data: updated });
  } catch (err) {
    console.error('editAttendance error:', err);
    return res.status(500).json({ error: 'Failed to edit attendance' });
  }
}

export async function getDailyAttendance(req: Request, res: Response) {
  try {
    const classId = String(req.query.class_id || '');
    const date = String(req.query.date || '');
    if (!classId || !date) return res.status(400).json({ error: 'class_id and date are required' });
    const roster = await attendanceService.getDailyAttendance(classId, date);
    return res.json({ data: roster });
  } catch (err) {
    console.error('getDailyAttendance error:', err);
    return res.status(500).json({ error: 'Failed to fetch daily attendance' });
  }
}

export async function listClassHistory(req: Request, res: Response) {
  try {
    const classId = String(req.query.class_id || '');
    const schoolId = String(req.query.school_id || req.user?.schoolId || '');
    const { from, to } = req.query as { from?: string; to?: string };
    if (!classId || !schoolId) return res.status(400).json({ error: 'school_id and class_id are required' });
    const history = await attendanceService.listHistoryForClass(schoolId, classId, from, to);
    return res.json({ data: history });
  } catch (err) {
    console.error('listClassHistory error:', err);
    return res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
}

export async function getAttendanceHistory(req: Request, res: Response) {
  try {
    const attendanceId = req.params.id;
    if (!attendanceId) return res.status(400).json({ error: 'attendance id is required' });
    const history = await attendanceService.getAttendanceHistory(attendanceId);
    return res.json({ data: history });
  } catch (err) {
    console.error('getAttendanceHistory error:', err);
    return res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
}

export async function getStudentAttendance(req: Request, res: Response) {
  try {
    const studentId = req.params.studentId;
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await attendanceService.getStudentAttendance(studentId, from, to);
    return res.json({ data });
  } catch (err) {
    console.error('getStudentAttendance error:', err);
    return res.status(500).json({ error: 'Failed to fetch student attendance' });
  }
}

export async function listForStudent(req: Request, res: Response) {
  try {
    const studentId = req.params.id;
    await assertStudentAccess(req, studentId);
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await attendanceService.getStudentAttendance(studentId, from, to);
    return res.json({ data });
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    console.error('listForStudent error:', err);
    return res.status(500).json({ error: 'Failed to fetch attendance for student' });
  }
}

export async function getSummaryForStudent(req: Request, res: Response) {
  try {
    const studentId = req.params.id;
    await assertStudentAccess(req, studentId);
    const { from, to } = req.query as { from?: string; to?: string };
    const schoolId = String(req.user?.schoolId || '');
    if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
    const data = await attendanceService.getSummaryForStudent(schoolId, studentId, from, to);
    return res.json({ data });
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.statusCode).json({ error: err.message });
    console.error('getSummaryForStudent error:', err);
    return res.status(500).json({ error: 'Failed to fetch attendance summary for student' });
  }
}

export async function getDailyReport(req: Request, res: Response) {
  try {
    const date = String(req.query.date || '');
    const classId = req.query.class_id ? String(req.query.class_id) : undefined;
    const schoolId = String(req.user?.schoolId || '');
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
    const data = await attendanceService.getDailyReport(schoolId, date, classId);
    return res.json({ data });
  } catch (err) {
    console.error('getDailyReport error:', err);
    return res.status(500).json({ error: 'Failed to fetch daily report' });
  }
}

export async function getMonthlyReport(req: Request, res: Response) {
  try {
    const month = String(req.query.month || '');
    const classId = req.query.class_id ? String(req.query.class_id) : undefined;
    const schoolId = String(req.user?.schoolId || '');
    if (!month) return res.status(400).json({ error: 'month is required' });
    if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
    const data = await attendanceService.getMonthlyReport(schoolId, month, classId);
    return res.json({ data });
  } catch (err) {
    console.error('getMonthlyReport error:', err);
    return res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
}

export async function getStudentWiseReport(req: Request, res: Response) {
  try {
    const classId = req.query.class_id ? String(req.query.class_id) : undefined;
    const schoolId = String(req.user?.schoolId || '');
    if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
    const data = await attendanceService.getStudentWiseReport(schoolId, classId);
    return res.json({ data });
  } catch (err) {
    console.error('getStudentWiseReport error:', err);
    return res.status(500).json({ error: 'Failed to fetch student-wise report' });
  }
}

export async function getClassWiseReport(req: Request, res: Response) {
  try {
    const schoolId = String(req.user?.schoolId || '');
    if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
    const data = await attendanceService.getClassWiseReport(schoolId);
    return res.json({ data });
  } catch (err) {
    console.error('getClassWiseReport error:', err);
    return res.status(500).json({ error: 'Failed to fetch class-wise report' });
  }
}

export async function getOverallAnalytics(req: Request, res: Response) {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const schoolId = String(req.user?.schoolId || '');
    if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
    const data = await attendanceService.getOverallAnalytics(schoolId, from, to);
    return res.json({ data });
  } catch (err) {
    console.error('getOverallAnalytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch overall analytics' });
  }
}
