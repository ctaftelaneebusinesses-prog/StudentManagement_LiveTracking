/**
 * One explanatory line per real sidebar route, keyed by the exact `to` path
 * used in layouts/components/navConfig.ts, pages/admin/dashboard/shell/navConfig.ts,
 * and pages/superAdmin/shell/navConfig.ts. SidebarTour looks a route up here
 * to build each spotlight step's tooltip; anything not listed falls back to
 * a generic line built from the nav item's own label (see SidebarTour.tsx).
 */
export const TOUR_STEP_COPY: Record<string, string> = {
  // Shared / generic
  "/dashboard/profile": "Update your own name, phone, address, avatar, and password.",

  // Admin Console (school_admin / principal / super_admin school console)
  "/dashboard/admin/overview": "Your school's snapshot: enrollment, attendance, and fee collection at a glance.",
  "/dashboard/admin/notifications": "Every alert sent to or by this school, in one feed.",
  "/dashboard/admin/students": "Every enrolled student. Click \"Add student\" to enroll one, or \"Bulk import\" to add many from a spreadsheet.",
  "/dashboard/admin/teachers": "Every teacher on staff. Click the + button to add a new teacher.",
  "/dashboard/admin/teacher-attendance": "Mark and review daily attendance for teaching staff.",
  "/dashboard/admin/extracurricular-staff": "Coaches and activity staff. Add one here to let them run clubs and training.",
  "/dashboard/admin/users": "Every account with sign-in access, and the role each one holds.",
  "/dashboard/admin/registration-approvals": "Self-registered accounts waiting for you to approve or reject them.",
  "/dashboard/admin/classes": "Create classes and sections, and see how many students are in each.",
  "/dashboard/admin/timetable": "Build the weekly period-by-period schedule for every class.",
  "/dashboard/admin/exams": "Schedule exams and enter or review marks once they're graded.",
  "/dashboard/admin/syllabus": "Upload and track syllabus coverage per subject and class.",
  "/dashboard/admin/activities": "Extracurricular activities offered at your school — sports, clubs, and events.",
  "/dashboard/admin/fees": "Fee structures, dues, payments, and receipts for every student.",
  "/dashboard/admin/announcements": "Post an announcement to staff, students, or specific classes.",
  "/dashboard/admin/transport": "Bus routes, drivers, and vehicles serving your school.",
  "/dashboard/emergency-alerts": "Send an urgent alert to everyone at the school in one tap.",
  "/dashboard/admin/leave-requests": "Approve or reject leave requests from your staff.",
  "/dashboard/admin/my-leave": "Request time off and track your own leave balance.",
  "/dashboard/admin/reports": "Attendance, fee, and academic reports you can filter and export.",
  "/dashboard/admin/website-knowledge": "A searchable knowledge base explaining how to use this platform.",
  "/dashboard/admin/schools": "Every school you manage, with the option to switch between them.",
  "/dashboard/admin/schools/request": "Ask the platform team to set up a new school for you.",
  "/dashboard/admin/settings": "School-wide settings: branding, academic year, and preferences.",

  // Super Admin — Platform Console
  "/dashboard/super-admin": "Platform-wide totals: schools, staff, and students across everyone you host.",
  "/dashboard/super-admin/notifications": "Platform-level alerts across every school.",
  "/dashboard/super-admin/schools": "Every school on the platform. Click one to see its admins, staff, and student counts, or add a new school.",
  "/dashboard/super-admin/school-requests": "New-school requests waiting for your approval.",
  "/dashboard/super-admin/school-admins": "Every school admin account across the platform, and which schools they manage.",
  "/dashboard/super-admin/audit-log": "A full history of platform-level actions, for oversight.",

  // Teacher
  "/dashboard/teacher": "Today's classes, attendance, and pending tasks at a glance.",
  "/dashboard/teacher/profile": "Your own profile, contact details, and password.",
  "/dashboard/teacher/students": "The students in your classes — profiles and quick stats.",
  "/dashboard/teacher/timetable": "Your weekly teaching schedule.",
  "/dashboard/teacher/registration-approvals": "Approve or reject student registrations for your class.",
  "/dashboard/teacher/attendance": "Mark today's attendance for a class in a couple of taps.",
  "/dashboard/teacher/homework": "Assign homework and review what students have submitted.",
  "/dashboard/teacher/marks": "Enter marks for an exam or assessment.",
  "/dashboard/teacher/assessments": "Create quizzes and assessments for your classes.",
  "/dashboard/teacher/question-papers": "Upload or generate question papers for exams.",
  "/dashboard/teacher/syllabus": "Track how much of the syllabus you've covered.",
  "/dashboard/teacher/leave": "Request leave and see the status of past requests.",
  "/dashboard/teacher/transport": "Bus routes relevant to your students.",
  "/dashboard/teacher/reports": "Attendance and performance reports for your classes.",
  "/dashboard/teacher/website-knowledge": "A searchable knowledge base explaining how to use this platform.",

  // Student / Parent portal
  "/dashboard/portal/dashboard": "Everything for today: attendance, homework, timetable, and notices.",
  "/dashboard/portal/attendance": "Your day-by-day attendance record.",
  "/dashboard/portal/timetable": "Your weekly class schedule.",
  "/dashboard/portal/homework": "Homework assigned to you, and what's still due.",
  "/dashboard/portal/marks": "Your marks across every exam and assessment.",
  "/dashboard/portal/exams": "Upcoming exams and their schedule.",
  "/dashboard/portal/evaluated-papers": "Graded answer papers, scanned and returned to you.",
  "/dashboard/portal/syllabus": "How much of the syllabus has been covered in each subject.",
  "/dashboard/portal/extracurricular": "Clubs, sports, and activities you're enrolled in.",
  "/dashboard/portal/fees": "What's due, what's paid, and your payment history.",
  "/dashboard/portal/reports": "A summary report of your attendance, marks, and fees.",
  "/dashboard/portal/website-knowledge": "A searchable knowledge base explaining how to use this platform.",
  "/dashboard/portal/learning-games": "Learning games to practice what you've studied.",
  "/dashboard/portal/profile": "Your own profile and contact details.",
  "/dashboard/student/leave": "Request leave and see the status of past requests.",
  "/dashboard/portal/transport": "Live location of your school bus.",

  // Driver
  "/dashboard/driver": "Your assigned route, and a one-tap toggle to share your live location.",
  "/dashboard/driver/website-knowledge": "A searchable knowledge base explaining how to use this platform.",

  // Extracurricular staff
  "/dashboard/extracurricular": "Today's sessions and a summary of your activities.",
  "/dashboard/extracurricular/profile": "Your own profile and contact details.",
  "/dashboard/extracurricular/activities": "The clubs or sports you run. Add a new activity here.",
  "/dashboard/extracurricular/students": "Students enrolled in your activities.",
  "/dashboard/extracurricular/timetable": "Your weekly activity schedule.",
  "/dashboard/extracurricular/schedule": "Plan upcoming sessions and practice slots.",
  "/dashboard/extracurricular/attendance": "Mark attendance for a training session or practice.",
  "/dashboard/extracurricular/practice-work": "Assign and track practice work for participants.",
  "/dashboard/extracurricular/events": "Plan and record competitions or events.",
  "/dashboard/extracurricular/achievements": "Log student wins, medals, and achievements.",
  "/dashboard/extracurricular/website-knowledge": "A searchable knowledge base explaining how to use this platform.",

  // Accountant
  "/dashboard/accountant": "A snapshot of fee collection: today's payments and outstanding dues.",
  "/dashboard/accountant/students": "Look up a student to see their fee account and payment history.",
  "/dashboard/accountant/fees": "Record a payment, view dues, and print receipts.",
  "/dashboard/accountant/reports": "Fee collection and outstanding-dues reports.",
  "/dashboard/accountant/website-knowledge": "A searchable knowledge base explaining how to use this platform.",
};

/** Generic fallback when a route has no hand-written line above. */
export function fallbackTourDescription(label: string): string {
  return `Open ${label} to view and manage everything related to it.`;
}
