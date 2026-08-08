import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Spinner } from "@/components/ui/Spinner";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const RegistrationStatusPage = lazy(() =>
  import("@/pages/auth/RegistrationStatusPage").then((m) => ({ default: m.RegistrationStatusPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("@/pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage }))
);
const RegistrationApprovalsPage = lazy(() =>
  import("@/pages/admin/RegistrationApprovalsPage").then((m) => ({ default: m.RegistrationApprovalsPage }))
);
const SyllabusPage = lazy(() => import("@/pages/admin/syllabus/SyllabusPage").then((m) => ({ default: m.SyllabusPage })));
const TeacherRegistrationApprovalsPage = lazy(() =>
  import("@/pages/teacher/TeacherRegistrationApprovalsPage").then((m) => ({ default: m.TeacherRegistrationApprovalsPage }))
);
const TeacherSyllabusPage = lazy(() =>
  import("@/pages/teacher/TeacherSyllabusPage").then((m) => ({ default: m.TeacherSyllabusPage }))
);
const PortalSyllabusPage = lazy(() =>
  import("@/pages/portal/PortalSyllabusPage").then((m) => ({ default: m.PortalSyllabusPage }))
);
const AdminDashboardPage = lazy(() =>
  import("@/pages/admin/dashboard/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage }))
);
const ProfileRoute = lazy(() => import("@/routes/ProfileRoute").then((m) => ({ default: m.ProfileRoute })));
const UnauthorizedPage = lazy(() =>
  import("@/pages/errors/UnauthorizedPage").then((m) => ({ default: m.UnauthorizedPage }))
);
const SettingsPage = lazy(() => import("@/pages/admin/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const UsersPage = lazy(() => import("@/pages/admin/users/UsersPage").then((m) => ({ default: m.UsersPage })));
const StudentsPage = lazy(() => import("@/pages/admin/StudentsPage").then((m) => ({ default: m.StudentsPage })));
const StudentProfilePage = lazy(() =>
  import("@/pages/admin/StudentProfilePage").then((m) => ({ default: m.StudentProfilePage }))
);
const TeachersPage = lazy(() => import("@/pages/admin/TeachersPage").then((m) => ({ default: m.TeachersPage })));
const TeacherProfilePage = lazy(() =>
  import("@/pages/admin/teachers/TeacherProfilePage").then((m) => ({ default: m.TeacherProfilePage }))
);
const AdminTeacherAttendancePage = lazy(() =>
  import("@/pages/admin/teachers/TeacherAttendancePage").then((m) => ({ default: m.TeacherAttendancePage }))
);
const ExtracurricularStaffPage = lazy(() =>
  import("@/pages/admin/ExtracurricularStaffPage").then((m) => ({ default: m.ExtracurricularStaffPage }))
);
const ExtracurricularStaffProfilePage = lazy(() =>
  import("@/pages/admin/extracurricularStaff/StaffProfilePage").then((m) => ({ default: m.StaffProfilePage }))
);
const ActivitiesPage = lazy(() =>
  import("@/pages/admin/activities/ActivitiesPage").then((m) => ({ default: m.ActivitiesPage }))
);
const ClassesPage = lazy(() => import("@/pages/admin/ClassesPage").then((m) => ({ default: m.ClassesPage })));
const ClassDetailPage = lazy(() =>
  import("@/pages/admin/classes/ClassDetailPage").then((m) => ({ default: m.ClassDetailPage }))
);
const TimetablePage = lazy(() =>
  import("@/pages/admin/TimetablePage").then((m) => ({ default: m.TimetablePage }))
);
const ExamsPage = lazy(() => import("@/pages/admin/exams/ExamsPage").then((m) => ({ default: m.ExamsPage })));
const EmergencyAlertsPage = lazy(() =>
  import("@/pages/admin/EmergencyAlertsPage").then((m) => ({ default: m.EmergencyAlertsPage }))
);
const ReportsPage = lazy(() => import("@/pages/admin/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const StudentLeavePage = lazy(() =>
  import("@/pages/student/StudentLeavePage").then((m) => ({ default: m.StudentLeavePage }))
);
const TeacherDashboardPage = lazy(() =>
  import("@/pages/teacher/TeacherDashboardPage").then((m) => ({ default: m.TeacherDashboardPage }))
);
const TeacherOwnAttendancePage = lazy(() =>
  import("@/pages/teacher/TeacherAttendancePage").then((m) => ({ default: m.TeacherAttendancePage }))
);
const TeacherMarksPage = lazy(() =>
  import("@/pages/teacher/TeacherMarksPage").then((m) => ({ default: m.TeacherMarksPage }))
);
const TeacherHomeworkPage = lazy(() =>
  import("@/pages/teacher/TeacherHomeworkPage").then((m) => ({ default: m.TeacherHomeworkPage }))
);
const TeacherReportsPage = lazy(() =>
  import("@/pages/teacher/TeacherReportsPage").then((m) => ({ default: m.TeacherReportsPage }))
);
const TeacherOwnProfilePage = lazy(() =>
  import("@/pages/teacher/TeacherProfilePage").then((m) => ({ default: m.TeacherProfilePage }))
);
const TeacherStudentsPage = lazy(() =>
  import("@/pages/teacher/TeacherStudentsPage").then((m) => ({ default: m.TeacherStudentsPage }))
);
const TeacherStudentProfilePage = lazy(() =>
  import("@/pages/teacher/TeacherStudentProfilePage").then((m) => ({ default: m.TeacherStudentProfilePage }))
);
const TeacherTimetablePage = lazy(() =>
  import("@/pages/teacher/TeacherTimetablePage").then((m) => ({ default: m.TeacherTimetablePage }))
);
const TeacherAssessmentsPage = lazy(() =>
  import("@/pages/teacher/TeacherAssessmentsPage").then((m) => ({ default: m.TeacherAssessmentsPage }))
);
const TeacherQuestionPapersPage = lazy(() =>
  import("@/pages/teacher/TeacherQuestionPapersPage").then((m) => ({ default: m.TeacherQuestionPapersPage }))
);
const TeacherLeavePage = lazy(() =>
  import("@/pages/teacher/TeacherLeavePage").then((m) => ({ default: m.TeacherLeavePage }))
);
const ExtracurricularDashboardPage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularDashboardPage").then((m) => ({ default: m.ExtracurricularDashboardPage }))
);
const ExtracurricularProfilePage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularProfilePage").then((m) => ({ default: m.ExtracurricularProfilePage }))
);
const ExtracurricularActivitiesPage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularActivitiesPage").then((m) => ({ default: m.ExtracurricularActivitiesPage }))
);
const ExtracurricularStudentsPage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularStudentsPage").then((m) => ({ default: m.ExtracurricularStudentsPage }))
);
const ExtracurricularSchedulePage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularSchedulePage").then((m) => ({ default: m.ExtracurricularSchedulePage }))
);
const ExtracurricularTimetablePage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularTimetablePage").then((m) => ({ default: m.ExtracurricularTimetablePage }))
);
const ExtracurricularAttendancePage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularAttendancePage").then((m) => ({ default: m.ExtracurricularAttendancePage }))
);
const ExtracurricularPracticeWorkPage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularPracticeWorkPage").then((m) => ({
    default: m.ExtracurricularPracticeWorkPage,
  }))
);
const ExtracurricularEventsPage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularEventsPage").then((m) => ({ default: m.ExtracurricularEventsPage }))
);
const ExtracurricularAchievementsPage = lazy(() =>
  import("@/pages/extracurricular/ExtracurricularAchievementsPage").then((m) => ({
    default: m.ExtracurricularAchievementsPage,
  }))
);
const PortalShell = lazy(() => import("@/pages/portal/PortalShell").then((m) => ({ default: m.PortalShell })));
const PortalDashboardPage = lazy(() =>
  import("@/pages/portal/PortalDashboardPage").then((m) => ({ default: m.PortalDashboardPage }))
);
const PortalAttendancePage = lazy(() =>
  import("@/pages/portal/PortalAttendancePage").then((m) => ({ default: m.PortalAttendancePage }))
);
const PortalProfilePage = lazy(() =>
  import("@/pages/portal/PortalProfilePage").then((m) => ({ default: m.PortalProfilePage }))
);
const PortalTimetablePage = lazy(() =>
  import("@/pages/portal/PortalTimetablePage").then((m) => ({ default: m.PortalTimetablePage }))
);
const PortalExtracurricularPage = lazy(() =>
  import("@/pages/portal/PortalExtracurricularPage").then((m) => ({ default: m.PortalExtracurricularPage }))
);
const PortalHomeworkPage = lazy(() =>
  import("@/pages/portal/PortalHomeworkPage").then((m) => ({ default: m.PortalHomeworkPage }))
);
const PortalMarksPage = lazy(() => import("@/pages/portal/PortalMarksPage").then((m) => ({ default: m.PortalMarksPage })));
const PortalExamsPage = lazy(() => import("@/pages/portal/PortalExamsPage").then((m) => ({ default: m.PortalExamsPage })));
const PortalFeesPage = lazy(() => import("@/pages/portal/PortalFeesPage").then((m) => ({ default: m.PortalFeesPage })));
const PortalReportsPage = lazy(() =>
  import("@/pages/portal/PortalReportsPage").then((m) => ({ default: m.PortalReportsPage }))
);
const PortalEvaluatedPapersPage = lazy(() =>
  import("@/pages/portal/PortalEvaluatedPapersPage").then((m) => ({ default: m.PortalEvaluatedPapersPage }))
);
const PortalTransportPage = lazy(() =>
  import("@/pages/portal/PortalTransportPage").then((m) => ({ default: m.PortalTransportPage }))
);
const DriverDashboardPage = lazy(() =>
  import("@/pages/transport/DriverDashboardPage").then((m) => ({ default: m.DriverDashboardPage }))
);
const FeesPage = lazy(() => import("@/pages/admin/fees/FeesPage").then((m) => ({ default: m.FeesPage })));
const AnnouncementsPage = lazy(() =>
  import("@/pages/admin/announcements/AnnouncementsPage").then((m) => ({ default: m.AnnouncementsPage }))
);
const TransportPage = lazy(() => import("@/pages/admin/transport/TransportPage").then((m) => ({ default: m.TransportPage })));
const TransportMonitoringPage = lazy(() =>
  import("@/pages/admin/transport/TransportMonitoringPage").then((m) => ({ default: m.TransportMonitoringPage }))
);
const VehicleDetailPage = lazy(() =>
  import("@/pages/admin/transport/vehicles/VehicleDetailPage").then((m) => ({ default: m.VehicleDetailPage }))
);
const DriverDetailPage = lazy(() =>
  import("@/pages/admin/transport/drivers/DriverDetailPage").then((m) => ({ default: m.DriverDetailPage }))
);
const RouteDetailPage = lazy(() =>
  import("@/pages/admin/transport/routes/RouteDetailPage").then((m) => ({ default: m.RouteDetailPage }))
);
const SchoolProfilePage = lazy(() =>
  import("@/pages/admin/schools/SchoolProfilePage").then((m) => ({ default: m.SchoolProfilePage }))
);
const SchoolManagementEntry = lazy(() =>
  import("@/pages/admin/schools/SchoolManagementEntry").then((m) => ({ default: m.SchoolManagementEntry }))
);
const RequestSchoolPage = lazy(() =>
  import("@/pages/admin/schools/RequestSchoolPage").then((m) => ({ default: m.RequestSchoolPage }))
);
const NotificationsPage = lazy(() =>
  import("@/pages/shared/NotificationsPage").then((m) => ({ default: m.NotificationsPage }))
);
const LeaveRequestsPage = lazy(() =>
  import("@/pages/admin/LeaveRequestsPage").then((m) => ({ default: m.LeaveRequestsPage }))
);
const MyLeavePage = lazy(() => import("@/pages/admin/MyLeavePage").then((m) => ({ default: m.MyLeavePage })));
const AccountantDashboardPage = lazy(() =>
  import("@/pages/accountant/AccountantDashboardPage").then((m) => ({ default: m.AccountantDashboardPage }))
);
const AccountantStudentsPage = lazy(() =>
  import("@/pages/accountant/AccountantStudentsPage").then((m) => ({ default: m.AccountantStudentsPage }))
);
const AccountantStudentFeeProfilePage = lazy(() =>
  import("@/pages/accountant/AccountantStudentFeeProfilePage").then((m) => ({ default: m.AccountantStudentFeeProfilePage }))
);
const AccountantFeesPage = lazy(() =>
  import("@/pages/accountant/AccountantFeesPage").then((m) => ({ default: m.AccountantFeesPage }))
);
const AccountantReportsPage = lazy(() =>
  import("@/pages/accountant/AccountantReportsPage").then((m) => ({ default: m.AccountantReportsPage }))
);
const WebsiteKnowledgePage = lazy(() =>
  import("@/pages/websiteKnowledge/WebsiteKnowledgePage").then((m) => ({ default: m.WebsiteKnowledgePage }))
);
const PortalLearningGamesPage = lazy(() =>
  import("@/pages/portal/PortalLearningGamesPage").then((m) => ({ default: m.PortalLearningGamesPage }))
);

// Platform console (super_admin only) — see SuperAdminLayout / superAdmin.routes.ts.
const SuperAdminDashboardPage = lazy(() =>
  import("@/pages/superAdmin/SuperAdminDashboardPage").then((m) => ({ default: m.SuperAdminDashboardPage }))
);
const SuperAdminSchoolsPage = lazy(() =>
  import("@/pages/superAdmin/SuperAdminSchoolsPage").then((m) => ({ default: m.SuperAdminSchoolsPage }))
);
const SuperAdminSchoolRequestsPage = lazy(() =>
  import("@/pages/superAdmin/SuperAdminSchoolRequestsPage").then((m) => ({
    default: m.SuperAdminSchoolRequestsPage,
  }))
);
const SuperAdminSchoolOverviewPage = lazy(() =>
  import("@/pages/superAdmin/SuperAdminSchoolOverviewPage").then((m) => ({
    default: m.SuperAdminSchoolOverviewPage,
  }))
);
const SuperAdminSchoolAdminsPage = lazy(() =>
  import("@/pages/superAdmin/SuperAdminSchoolAdminsPage").then((m) => ({ default: m.SuperAdminSchoolAdminsPage }))
);
const SuperAdminAuditLogPage = lazy(() =>
  import("@/pages/superAdmin/SuperAdminAuditLogPage").then((m) => ({ default: m.SuperAdminAuditLogPage }))
);

/**
 * Route tree: public auth flows + one protected dashboard shell shared by
 * all roles, plus a shared /dashboard/profile route. The Admin Console
 * mounts under /dashboard/admin/* (plus a few legacy aliases) and is shared
 * by school_admin, super_admin, AND principal — principal reuses the exact
 * same pages with no separate portal; the only differences are enforced
 * inside individual pages/components (School Management is redirected to a
 * single read-only school via SchoolManagementEntry, and Users & Roles hides
 * admin-tier account management) rather than at the route level. The Teacher
 * Module mounts under /dashboard/teacher/*, gated to teacher; driver gets its
 * own portal under the generic DashboardLayout below. The Student Portal
 * (PortalShell) brings its own full-page shell, like AdminLayout, so it's
 * mounted as its own top-level sibling instead.
 *
 * Every page is code-split via React.lazy so a given role's login only
 * downloads the bundles for the portals it can reach — a single Suspense
 * boundary around the whole tree covers the brief gap between route change
 * and chunk load with the same full-page spinner used during auth checks.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<Spinner label="Loading..." />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Reachable by an authenticated-but-not-yet-approved user — must sit outside ProtectedRoute, which is what redirects here in the first place (see ProtectedRoute.tsx). */}
        <Route path="/registration-status" element={<RegistrationStatusPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          {/*
            The Admin Console brings its own full-page shell (sidebar, navbar,
            search, school selector, etc.) instead of the shared
            DashboardLayout, so it's mounted outside that wrapper. AdminLayout
            itself is pathless (no role gate) and is the SINGLE shared parent
            for both the School Console (school_admin/principal/super_admin)
            AND, for super_admin, the Platform Console too — both route
            groups are siblings under it. That's deliberate: React Router
            keeps a parent layout route mounted across navigation between its
            child routes, so a super_admin switching between Platform and
            School Console pages never remounts the sidebar/topbar (which is
            what made that switch feel broken before — see
            SuperAdminMergedSidebar's comment for the full story). AdminLayout
            picks SuperAdminMergedSidebar vs the plain AdminSidebar based on
            role, via AdminDashboardShell.
          */}
          <Route element={<AdminLayout />}>
            {/*
              Platform console — super_admin ONLY. /dashboard/super-admin is
              super_admin's ROLE_HOME_ROUTE, so this is where they land after
              login.
            */}
            <Route element={<ProtectedRoute allowedRoles={["super_admin"]} />}>
              <Route path="/dashboard/super-admin" element={<SuperAdminDashboardPage />} />
              <Route path="/dashboard/super-admin/schools" element={<SuperAdminSchoolsPage />} />
              <Route path="/dashboard/super-admin/school-requests" element={<SuperAdminSchoolRequestsPage />} />
              <Route path="/dashboard/super-admin/schools/:schoolId" element={<SuperAdminSchoolOverviewPage />} />
              <Route path="/dashboard/super-admin/school-admins" element={<SuperAdminSchoolAdminsPage />} />
              <Route path="/dashboard/super-admin/audit-log" element={<SuperAdminAuditLogPage />} />
              <Route path="/dashboard/super-admin/notifications" element={<NotificationsPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["school_admin", "super_admin", "principal"]} />}>
              <Route path="/dashboard/school-admin" element={<AdminDashboardPage />} />
              <Route path="/dashboard/admin/overview" element={<AdminDashboardPage />} />
              <Route path="/dashboard/admin/notifications" element={<NotificationsPage />} />
              <Route path="/dashboard/admin/classes" element={<ClassesPage />} />
              <Route path="/dashboard/admin/classes/:id" element={<ClassDetailPage />} />
              <Route path="/dashboard/admin/timetable" element={<TimetablePage />} />
              <Route path="/dashboard/admin/teachers" element={<TeachersPage />} />
              <Route path="/dashboard/admin/teachers/:id" element={<TeacherProfilePage />} />
              <Route path="/dashboard/admin/teacher-attendance" element={<AdminTeacherAttendancePage />} />
              <Route path="/dashboard/admin/extracurricular-staff" element={<ExtracurricularStaffPage />} />
              <Route path="/dashboard/admin/extracurricular-staff/:id" element={<ExtracurricularStaffProfilePage />} />
              <Route path="/dashboard/admin/activities" element={<ActivitiesPage />} />
              <Route path="/dashboard/admin/students" element={<StudentsPage />} />
              <Route path="/dashboard/admin/students/:id" element={<StudentProfilePage />} />
              <Route path="/dashboard/admin/fees" element={<FeesPage />} />
              <Route path="/dashboard/admin/exams" element={<ExamsPage />} />
              <Route path="/dashboard/admin/users" element={<UsersPage />} />
              <Route path="/dashboard/admin/announcements" element={<AnnouncementsPage />} />
              <Route path="/dashboard/admin/reports" element={<ReportsPage />} />
              <Route path="/dashboard/admin/settings" element={<SettingsPage />} />
              <Route path="/dashboard/emergency-alerts" element={<EmergencyAlertsPage />} />
              <Route path="/dashboard/admin/schools" element={<SchoolManagementEntry />} />
              <Route path="/dashboard/admin/schools/request" element={<RequestSchoolPage />} />
              <Route path="/dashboard/admin/schools/:id" element={<SchoolProfilePage />} />
              <Route path="/dashboard/admin/leave-requests" element={<LeaveRequestsPage />} />
              <Route path="/dashboard/admin/registration-approvals" element={<RegistrationApprovalsPage />} />
              <Route path="/dashboard/admin/syllabus" element={<SyllabusPage />} />
              <Route path="/dashboard/admin/website-knowledge" element={<WebsiteKnowledgePage />} />
            </Route>
            {/* Principal-only self-service — admin/super_admin don't apply for their own leave per the spec, only review others'. */}
            <Route element={<ProtectedRoute allowedRoles={["principal"]} />}>
              <Route path="/dashboard/admin/my-leave" element={<MyLeavePage />} />
            </Route>
            {/* Transport also opens to teachers (matches the transport.manage permission grant) — everything else in the Admin Console stays admin/principal only. */}
            <Route element={<ProtectedRoute allowedRoles={["school_admin", "super_admin", "principal", "teacher"]} />}>
              <Route path="/dashboard/admin/transport" element={<TransportPage />} />
              <Route path="/dashboard/admin/transport/vehicles/:id" element={<VehicleDetailPage />} />
              <Route path="/dashboard/admin/transport/drivers/:id" element={<DriverDetailPage />} />
              <Route path="/dashboard/admin/transport/routes/:id" element={<RouteDetailPage />} />
            </Route>
          </Route>

          {/*
            The Student Portal (see PortalShell.tsx). PortalShell brings its
            own full-page shell (PortalSidebar/PortalNavbar, gender-themed)
            instead of the shared DashboardLayout, the same way AdminLayout
            above brings its own — so it's mounted here as a sibling, not
            nested inside DashboardLayout. StudentLeavePage is a role-guarded
            child of the same PortalShell so it shares its visual system too.
          */}
          <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
            <Route element={<PortalShell />}>
              <Route path="/dashboard/portal/dashboard" element={<PortalDashboardPage />} />
              <Route path="/dashboard/portal/attendance" element={<PortalAttendancePage />} />
              <Route path="/dashboard/portal/profile" element={<PortalProfilePage />} />
              <Route path="/dashboard/portal/timetable" element={<PortalTimetablePage />} />
              <Route path="/dashboard/portal/extracurricular" element={<PortalExtracurricularPage />} />
              <Route path="/dashboard/portal/homework" element={<PortalHomeworkPage />} />
              <Route path="/dashboard/portal/marks" element={<PortalMarksPage />} />
              <Route path="/dashboard/portal/exams" element={<PortalExamsPage />} />
              <Route path="/dashboard/portal/fees" element={<PortalFeesPage />} />
              <Route path="/dashboard/portal/reports" element={<PortalReportsPage />} />
              <Route path="/dashboard/portal/evaluated-papers" element={<PortalEvaluatedPapersPage />} />
              <Route path="/dashboard/portal/transport" element={<PortalTransportPage />} />
              <Route path="/dashboard/portal/syllabus" element={<PortalSyllabusPage />} />
              <Route path="/dashboard/portal/website-knowledge" element={<WebsiteKnowledgePage />} />
              <Route path="/dashboard/portal/learning-games" element={<PortalLearningGamesPage />} />
              <Route path="/dashboard/student/leave" element={<StudentLeavePage />} />
            </Route>
            <Route path="/dashboard/student" element={<Navigate to="/dashboard/portal/dashboard" replace />} />
            <Route path="/dashboard/student/homework" element={<Navigate to="/dashboard/portal/homework" replace />} />
          </Route>

          {/*
            Reachable by every role, but school_admin/super_admin need the
            premium AdminDashboardShell while everyone else needs the generic
            DashboardShell — ProfileRoute picks the right one itself so this
            path is registered exactly once (see ProfileRoute.tsx for why
            nesting it under both layouts instead would silently break it for
            one side).
          */}
          <Route path="/dashboard/profile" element={<ProfileRoute />} />

          <Route element={<DashboardLayout />}>
            <Route path="/dashboard/teacher" element={<TeacherDashboardPage />} />
            <Route path="/dashboard/driver" element={<DriverDashboardPage />} />
            <Route path="/dashboard/extracurricular" element={<ExtracurricularDashboardPage />} />
            <Route path="/dashboard/accountant" element={<AccountantDashboardPage />} />

            <Route element={<ProtectedRoute allowedRoles={["teacher"]} />}>
              <Route path="/dashboard/teacher/attendance" element={<TeacherOwnAttendancePage />} />
              <Route path="/dashboard/teacher/marks" element={<TeacherMarksPage />} />
              <Route path="/dashboard/teacher/homework" element={<TeacherHomeworkPage />} />
              <Route path="/dashboard/teacher/reports" element={<TeacherReportsPage />} />
              <Route path="/dashboard/teacher/profile" element={<TeacherOwnProfilePage />} />
              <Route path="/dashboard/teacher/students" element={<TeacherStudentsPage />} />
              <Route path="/dashboard/teacher/students/:studentId" element={<TeacherStudentProfilePage />} />
              <Route path="/dashboard/teacher/timetable" element={<TeacherTimetablePage />} />
              <Route path="/dashboard/teacher/assessments" element={<TeacherAssessmentsPage />} />
              <Route path="/dashboard/teacher/question-papers" element={<TeacherQuestionPapersPage />} />
              <Route path="/dashboard/teacher/leave" element={<TeacherLeavePage />} />
              <Route path="/dashboard/teacher/transport" element={<TransportMonitoringPage />} />
              <Route path="/dashboard/teacher/registration-approvals" element={<TeacherRegistrationApprovalsPage />} />
              <Route path="/dashboard/teacher/syllabus" element={<TeacherSyllabusPage />} />
              <Route path="/dashboard/teacher/website-knowledge" element={<WebsiteKnowledgePage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["driver"]} />}>
              <Route path="/dashboard/driver/website-knowledge" element={<WebsiteKnowledgePage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["extracurricular_staff"]} />}>
              <Route path="/dashboard/extracurricular/profile" element={<ExtracurricularProfilePage />} />
              <Route path="/dashboard/extracurricular/activities" element={<ExtracurricularActivitiesPage />} />
              <Route path="/dashboard/extracurricular/students" element={<ExtracurricularStudentsPage />} />
              <Route path="/dashboard/extracurricular/timetable" element={<ExtracurricularTimetablePage />} />
              <Route path="/dashboard/extracurricular/schedule" element={<ExtracurricularSchedulePage />} />
              <Route path="/dashboard/extracurricular/attendance" element={<ExtracurricularAttendancePage />} />
              <Route path="/dashboard/extracurricular/practice-work" element={<ExtracurricularPracticeWorkPage />} />
              <Route path="/dashboard/extracurricular/events" element={<ExtracurricularEventsPage />} />
              <Route path="/dashboard/extracurricular/achievements" element={<ExtracurricularAchievementsPage />} />
              <Route path="/dashboard/extracurricular/website-knowledge" element={<WebsiteKnowledgePage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["accountant"]} />}>
              <Route path="/dashboard/accountant/students" element={<AccountantStudentsPage />} />
              <Route path="/dashboard/accountant/students/:studentId" element={<AccountantStudentFeeProfilePage />} />
              <Route path="/dashboard/accountant/fees" element={<AccountantFeesPage />} />
              <Route path="/dashboard/accountant/reports" element={<AccountantReportsPage />} />
              <Route path="/dashboard/accountant/website-knowledge" element={<WebsiteKnowledgePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
