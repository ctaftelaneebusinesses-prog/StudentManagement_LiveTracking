/** Maps admin dashboard stat card ids (adminDashboardOverview.service.ts on the backend) to their detail-page route. Cards without an entry here stay non-clickable. */
export const STAT_CARD_ROUTES: Record<string, string> = {
  students: "/dashboard/admin/students",
  teachers: "/dashboard/admin/teachers",
  drivers: "/dashboard/admin/transport?tab=drivers",
  classes: "/dashboard/admin/classes",
  sections: "/dashboard/admin/classes",
  attendanceToday: "/dashboard/admin/reports?tab=attendance",
  absentToday: "/dashboard/admin/reports?tab=attendance&focus=absent",
  activitiesPending: "/dashboard/admin/activities",
  activitiesCompleted: "/dashboard/admin/activities",
};
