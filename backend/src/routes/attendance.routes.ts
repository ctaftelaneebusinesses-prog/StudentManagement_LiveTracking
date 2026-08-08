import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// ---------------- Teacher ----------------
router.post('/mark', requireRole('teacher'), attendanceController.markAttendance);
router.put('/:id', requireRole('teacher'), attendanceController.editAttendance);
router.get('/daily', requireRole('teacher', 'principal', 'school_admin', 'super_admin'), attendanceController.getDailyAttendance);
router.get('/history', requireRole('teacher', 'principal', 'school_admin', 'super_admin'), attendanceController.listClassHistory);
router.get('/:id/history', requireRole('teacher', 'principal', 'school_admin', 'super_admin'), attendanceController.getAttendanceHistory);

// ---------------- Staff ----------------
// Note: getStudentAttendance does not row-scope by caller — unlike
// /students/:id/attendance (listForStudent, which calls assertStudentAccess),
// this legacy route trusts the role gate alone, so it must stay staff-only.
router.get('/student/:studentId', requireRole('teacher', 'principal', 'school_admin', 'super_admin'), attendanceController.getStudentAttendance);

// ---------------- Principal / School Admin ----------------
router.get('/reports/daily', requireRole('principal', 'school_admin', 'super_admin'), attendanceController.getDailyReport);
router.get('/reports/monthly', requireRole('principal', 'school_admin', 'super_admin'), attendanceController.getMonthlyReport);
router.get('/reports/student-wise', requireRole('principal', 'school_admin', 'super_admin'), attendanceController.getStudentWiseReport);
router.get('/reports/class-wise', requireRole('principal', 'school_admin', 'super_admin'), attendanceController.getClassWiseReport);

// ---------------- Admin ----------------
router.get('/analytics/overall', requireRole('school_admin', 'super_admin'), attendanceController.getOverallAnalytics);

export default router;
