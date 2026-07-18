import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { DashboardHome } from "@/pages/dashboard/DashboardHome";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { UnauthorizedPage } from "@/pages/errors/UnauthorizedPage";
import { SchoolSettingsPage } from "@/pages/admin/SchoolSettingsPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { StudentsPage } from "@/pages/admin/StudentsPage";
import { StudentProfilePage } from "@/pages/admin/StudentProfilePage";
import { TeachersPage } from "@/pages/admin/TeachersPage";
import { ClassesPage } from "@/pages/admin/ClassesPage";
import { StudentDashboardPage } from "@/pages/student/StudentDashboardPage";
import { TeacherDashboardPage } from "@/pages/teacher/TeacherDashboardPage";
import { TeacherAttendancePage } from "@/pages/teacher/TeacherAttendancePage";
import { TeacherMarksPage } from "@/pages/teacher/TeacherMarksPage";
import { TeacherHomeworkPage } from "@/pages/teacher/TeacherHomeworkPage";
import { TeacherReportsPage } from "@/pages/teacher/TeacherReportsPage";
import { ParentDashboardPage } from "@/pages/parent/ParentDashboardPage";
import { DriverDashboardPage } from "@/pages/transport/DriverDashboardPage";
import { TransportAdminPage } from "@/pages/transport/TransportAdminPage";
import { ParentVanTrackingPage } from "@/pages/tracking/ParentVanTrackingPage";
import { AdminVehicleTrackingPage } from "@/pages/tracking/AdminVehicleTrackingPage";

/**
 * Route tree: public auth flows + one protected dashboard shell shared by
 * all seven roles, plus a shared /dashboard/profile route. The School
 * Administration Module (Phase 3) mounts under /dashboard/admin/*, gated to
 * school_admin/super_admin. The Teacher Module (Phase 5) mounts under
 * /dashboard/teacher/*, gated to teacher — principal/parent/driver get their
 * own portals in later phases.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard/super-admin" element={<DashboardHome />} />
          <Route path="/dashboard/school-admin" element={<DashboardHome />} />
          <Route path="/dashboard/principal" element={<DashboardHome />} />
          <Route path="/dashboard/teacher" element={<TeacherDashboardPage />} />
          <Route path="/dashboard/parent" element={<ParentDashboardPage />} />
          <Route path="/dashboard/student" element={<StudentDashboardPage />} />
          <Route path="/dashboard/driver" element={<DriverDashboardPage />} />
          <Route path="/dashboard/profile" element={<ProfilePage />} />

          <Route element={<ProtectedRoute allowedRoles={["school_admin", "super_admin"]} />}>
            <Route path="/dashboard/admin/school" element={<SchoolSettingsPage />} />
            <Route path="/dashboard/admin/users" element={<UsersPage />} />
            <Route path="/dashboard/admin/students" element={<StudentsPage />} />
            <Route path="/dashboard/admin/students/:id" element={<StudentProfilePage />} />
            <Route path="/dashboard/admin/teachers" element={<TeachersPage />} />
            <Route path="/dashboard/admin/classes" element={<ClassesPage />} />
            <Route path="/dashboard/admin/transport" element={<TransportAdminPage />} />
            <Route path="/dashboard/admin/vehicle-tracking" element={<AdminVehicleTrackingPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["parent"]} />}>
            <Route path="/dashboard/parent/van-tracking" element={<ParentVanTrackingPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["teacher"]} />}>
            <Route path="/dashboard/teacher/attendance" element={<TeacherAttendancePage />} />
            <Route path="/dashboard/teacher/marks" element={<TeacherMarksPage />} />
            <Route path="/dashboard/teacher/homework" element={<TeacherHomeworkPage />} />
            <Route path="/dashboard/teacher/reports" element={<TeacherReportsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
