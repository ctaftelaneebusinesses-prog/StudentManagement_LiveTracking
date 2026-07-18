import { Router } from "express";
import authRoutes from "./auth.routes";
import healthRoutes from "./health.routes";
import schoolRoutes from "./school.routes";
import userRoutes from "./user.routes";
import classRoutes from "./class.routes";
import studentRoutes from "./student.routes";
import teacherRoutes from "./teacher.routes";
import teacherPortalRoutes from "./teacherPortal.routes";
import parentRoutes from "./parent.routes";
import attendanceRoutes from "./attendance.routes";
import examRoutes from "./exam.routes";
import homeworkRoutes from "./homework.routes";
import timetableRoutes from "./timetable.routes";
import notificationRoutes from "./notification.routes";
import parentPortalRoutes from "./parentPortal.routes";
import transportRoutes from "./transport.routes";
import trackingRoutes from "./tracking.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/schools", schoolRoutes);
router.use("/users", userRoutes);
router.use("/students", studentRoutes);
router.use("/teachers", teacherRoutes);
router.use("/teacher-portal", teacherPortalRoutes);
router.use("/parents", parentRoutes);
router.use("/parent-portal", parentPortalRoutes);
router.use("/transport", transportRoutes);
router.use("/tracking", trackingRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/exams", examRoutes);
router.use("/homework", homeworkRoutes);
router.use("/timetable", timetableRoutes);
router.use("/notifications", notificationRoutes);
// classRoutes mounts both /classes and /subjects itself (see class.routes.ts)
router.use("/", classRoutes);

export default router;
