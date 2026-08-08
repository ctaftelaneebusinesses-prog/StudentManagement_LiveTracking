import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import * as feesService from "./fees.service";
import * as trackingService from "./tracking.service";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

interface StatTrend {
  direction: "up" | "down" | "flat";
  percent: number;
  upIsGood: boolean;
}

interface StatCardData {
  id: string;
  label: string;
  value: number;
  displayValue?: string;
  description: string;
  trend: StatTrend;
  spark: number[];
  icon: string;
}

/** No historical snapshot exists for this metric — an honest "no observed change" default rather than a fabricated trend, matching the flat sparkline already used for reports-page stats without a time series (see reportsHub tabs). */
function flatTrend(upIsGood = true): StatTrend {
  return { direction: "flat", percent: 0, upIsGood };
}

function flatSpark(value: number, points = 12): number[] {
  return Array.from({ length: points }, () => Math.max(0, Math.round(value)));
}

function realTrend(current: number, previous: number, upIsGood: boolean): StatTrend {
  if (previous <= 0) return flatTrend(upIsGood);
  const percent = Math.round((Math.abs(current - previous) / previous) * 1000) / 10;
  const direction: StatTrend["direction"] = current === previous ? "flat" : current > previous ? "up" : "down";
  return { direction, percent, upIsGood };
}

function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

// ---------------------------------------------------------------------------
// Headcounts
// ---------------------------------------------------------------------------
async function getCounts(schoolId: string) {
  const [students, teachers, drivers, classes] = await Promise.all([
    supabaseAdmin.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("drivers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("classes").select("id, name", { count: "exact" }).eq("school_id", schoolId),
  ]);
  for (const r of [students, teachers, drivers, classes]) {
    if (r.error) throw ApiError.internal(r.error.message);
  }

  const distinctGrades = new Set((classes.data ?? []).map((c) => c.name));

  return {
    studentCount: students.count ?? 0,
    teacherCount: teachers.count ?? 0,
    driverCount: drivers.count ?? 0,
    classCount: distinctGrades.size,
    sectionCount: classes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Student attendance — daily buckets over the last 14 days (chart + today's stat + trend + sparkline).
// ---------------------------------------------------------------------------
async function getAttendanceSeries(schoolId: string) {
  const to = new Date();
  const from = daysAgo(13);
  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("date, status")
    .eq("school_id", schoolId)
    .gte("date", isoDate(from))
    .lte("date", isoDate(to));
  if (error) throw ApiError.internal(error.message);

  const byDate = new Map<string, { present: number; absent: number; total: number }>();
  for (const row of data ?? []) {
    const bucket = byDate.get(row.date) ?? { present: 0, absent: 0, total: 0 };
    bucket.total += 1;
    if (row.status === "present") bucket.present += 1;
    if (row.status === "absent") bucket.absent += 1;
    byDate.set(row.date, bucket);
  }

  const days = Array.from({ length: 14 }, (_, i) => isoDate(daysAgo(13 - i)));
  const series = days.map((date) => {
    const b = byDate.get(date);
    const percentage = b && b.total > 0 ? Math.round((b.present / b.total) * 1000) / 10 : null;
    return { date, percentage, absent: b?.absent ?? 0, total: b?.total ?? 0 };
  });

  return series;
}

// ---------------------------------------------------------------------------
// Teacher attendance — last 7 days, present/onLeave/absent per day.
// ---------------------------------------------------------------------------
async function getTeacherAttendanceWeek(schoolId: string) {
  const to = new Date();
  const from = daysAgo(6);
  const { data, error } = await supabaseAdmin
    .from("teacher_attendance")
    .select("date, status")
    .eq("school_id", schoolId)
    .gte("date", isoDate(from))
    .lte("date", isoDate(to));
  if (error) throw ApiError.internal(error.message);

  const byDate = new Map<string, { present: number; onLeave: number; absent: number }>();
  for (const row of data ?? []) {
    const bucket = byDate.get(row.date) ?? { present: 0, onLeave: 0, absent: 0 };
    if (row.status === "present") bucket.present += 1;
    else if (row.status === "leave") bucket.onLeave += 1;
    else bucket.absent += 1; // absent + half_day
    byDate.set(row.date, bucket);
  }

  return Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i);
    const key = isoDate(d);
    const b = byDate.get(key) ?? { present: 0, onLeave: 0, absent: 0 };
    return { label: d.toLocaleDateString("en-US", { weekday: "short" }), ...b };
  });
}

// ---------------------------------------------------------------------------
// Class distribution — students bucketed by grade band, parsed from the class name.
// ---------------------------------------------------------------------------
async function getClassDistribution(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("class_id, classes(name)")
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  const bands = { "Grade 1-3": 0, "Grade 4-6": 0, "Grade 7-9": 0, "Grade 10-12": 0, Other: 0 };
  for (const row of (data ?? []) as unknown as { class_id: string | null; classes: { name: string } | null }[]) {
    const match = row.classes?.name?.match(/\d+/);
    const grade = match ? Number(match[0]) : null;
    if (grade === null) bands.Other += 1;
    else if (grade <= 3) bands["Grade 1-3"] += 1;
    else if (grade <= 6) bands["Grade 4-6"] += 1;
    else if (grade <= 9) bands["Grade 7-9"] += 1;
    else if (grade <= 12) bands["Grade 10-12"] += 1;
    else bands.Other += 1;
  }

  return Object.entries(bands)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }));
}

// ---------------------------------------------------------------------------
// Transport — On Route (live trip in progress) / Idle (active, no trip) / Off Duty (inactive).
// ---------------------------------------------------------------------------
async function getTransportUsage(schoolId: string) {
  const [{ data: vehicles, error: vehiclesError }, activeTrips] = await Promise.all([
    supabaseAdmin.from("vehicles").select("id, is_active").eq("school_id", schoolId),
    trackingService.activeVehicles(schoolId),
  ]);
  if (vehiclesError) throw ApiError.internal(vehiclesError.message);

  const onRouteVehicleIds = new Set((activeTrips ?? []).map((t: { vehicle_id: string }) => t.vehicle_id));
  const activeVehicleRows = (vehicles ?? []).filter((v) => v.is_active);
  const onRoute = activeVehicleRows.filter((v) => onRouteVehicleIds.has(v.id)).length;
  const idle = activeVehicleRows.length - onRoute;
  const offDuty = (vehicles ?? []).length - activeVehicleRows.length;

  return [
    { label: "On Route", value: onRoute },
    { label: "Idle", value: idle },
    { label: "Off Duty", value: offDuty },
  ].filter((slice) => slice.value > 0);
}

// ---------------------------------------------------------------------------
// Activity assignments — how many extracurricular-activity assignments this
// school's teachers have completed vs. still have pending, so a principal/
// super admin can see at a glance whether assigned staff have acted yet.
// ---------------------------------------------------------------------------
async function getActivityAssignmentCounts(schoolId: string) {
  const [{ count: pendingCount, error: pendingError }, { count: completedCount, error: completedError }] = await Promise.all([
    supabaseAdmin
      .from("extracurricular_staff_activities")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "assigned"),
    supabaseAdmin
      .from("extracurricular_staff_activities")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "completed"),
  ]);
  if (pendingError) throw ApiError.internal(pendingError.message);
  if (completedError) throw ApiError.internal(completedError.message);

  return { pendingCount: pendingCount ?? 0, completedCount: completedCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Recent activity — merged from the real sources that actually change day to day.
// ---------------------------------------------------------------------------
type ActivityKind = "student" | "teacher" | "fee" | "announcement" | "leave" | "transport";
interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  timestamp: string;
}

async function getRecentActivity(schoolId: string): Promise<ActivityItem[]> {
  const limit = 5;
  const [students, teachers, payments, announcements, leaves, trips] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("id, classes(name, section), users!inner(full_name, created_at)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false, foreignTable: "users" })
      .limit(limit),
    supabaseAdmin
      .from("teachers")
      .select("id, users!inner(full_name, created_at)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false, foreignTable: "users" })
      .limit(limit),
    supabaseAdmin
      .from("fee_payments")
      .select("id, amount, created_at, students(admission_no, users(full_name))")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from("announcements")
      .select("id, title, audience_type, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from("leave_requests")
      .select("id, status, created_at, teachers(users(full_name))")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from("trips")
      .select("id, direction, started_at, vehicles(vehicle_number)")
      .eq("school_id", schoolId)
      .order("started_at", { ascending: false })
      .limit(limit),
  ]);

  const items: ActivityItem[] = [];

  for (const s of (students.data ?? []) as any[]) {
    if (!s.users?.created_at) continue;
    const className = s.classes ? [s.classes.name, s.classes.section].filter(Boolean).join(" ") : "an unassigned class";
    items.push({
      id: `student-${s.id}`,
      kind: "student",
      title: `${s.users.full_name} admitted to ${className}`,
      subtitle: "New student enrollment",
      timestamp: s.users.created_at,
    });
  }

  for (const t of (teachers.data ?? []) as any[]) {
    if (!t.users?.created_at) continue;
    items.push({
      id: `teacher-${t.id}`,
      kind: "teacher",
      title: `${t.users.full_name} joined as faculty`,
      subtitle: "New teacher onboarded",
      timestamp: t.users.created_at,
    });
  }

  for (const p of (payments.data ?? []) as any[]) {
    items.push({
      id: `fee-${p.id}`,
      kind: "fee",
      title: `Fee payment of ${formatCurrency(Number(p.amount))} received`,
      subtitle: p.students?.users?.full_name ? `From ${p.students.users.full_name}` : "Payment recorded",
      timestamp: p.created_at,
    });
  }

  for (const a of (announcements.data ?? []) as any[]) {
    items.push({
      id: `announcement-${a.id}`,
      kind: "announcement",
      title: a.title,
      subtitle: `Published to ${a.audience_type === "all" ? "everyone" : a.audience_type}`,
      timestamp: a.created_at,
    });
  }

  for (const l of (leaves.data ?? []) as any[]) {
    if (!l.teachers?.users?.full_name) continue;
    items.push({
      id: `leave-${l.id}`,
      kind: "leave",
      title: `${l.teachers.users.full_name} requested leave`,
      subtitle: l.status === "approved" ? "Approved" : l.status === "rejected" ? "Rejected" : "Pending approval",
      timestamp: l.created_at,
    });
  }

  for (const t of (trips.data ?? []) as any[]) {
    if (!t.started_at) continue;
    items.push({
      id: `transport-${t.id}`,
      kind: "transport",
      title: `${t.vehicles?.vehicle_number ?? "A vehicle"} started ${t.direction ?? "a"} trip`,
      subtitle: "Live route update",
      timestamp: t.started_at,
    });
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
export async function getDashboardOverview(schoolId: string) {
  const today = isoDate(new Date());
  const todayStart = `${today}T00:00:00.000Z`;
  const tomorrowStart = `${isoDate(daysAgo(-1))}T00:00:00.000Z`;
  const in14Days = isoDate(daysAgo(-14));

  const [
    counts,
    attendanceSeries,
    teacherAttendanceWeek,
    classDistribution,
    transportUsage,
    activity,
    feeStats,
    feeAnalytics,
    activityAssignmentCounts,
    { count: teachersOnLeaveCount, error: leaveError },
    { count: upcomingExamsCount, error: examError },
    { count: announcementsTodayCount, error: announcementError },
  ] = await Promise.all([
    getCounts(schoolId),
    getAttendanceSeries(schoolId),
    getTeacherAttendanceWeek(schoolId),
    getClassDistribution(schoolId),
    getTransportUsage(schoolId),
    getRecentActivity(schoolId),
    feesService.getDashboardStats(schoolId),
    feesService.getAnalytics(schoolId),
    getActivityAssignmentCounts(schoolId),
    supabaseAdmin
      .from("leave_requests")
      .select("teacher_id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
    supabaseAdmin
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("exam_date", today)
      .lte("exam_date", in14Days),
    supabaseAdmin
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("publish_at", todayStart)
      .lt("publish_at", tomorrowStart),
  ]);
  if (leaveError) throw ApiError.internal(leaveError.message);
  if (examError) throw ApiError.internal(examError.message);
  if (announcementError) throw ApiError.internal(announcementError.message);

  const todayAttendance = attendanceSeries[attendanceSeries.length - 1];
  const yesterdayAttendance = attendanceSeries[attendanceSeries.length - 2];
  const attendancePct = todayAttendance.percentage ?? 0;
  const absentToday = todayAttendance.absent;

  const stats: StatCardData[] = [
    {
      id: "students",
      label: "Total Students",
      value: counts.studentCount,
      description: "Enrolled across all classes",
      icon: "students",
      trend: flatTrend(true),
      spark: flatSpark(counts.studentCount),
    },
    {
      id: "teachers",
      label: "Total Teachers",
      value: counts.teacherCount,
      description: "Active teaching staff",
      icon: "teachers",
      trend: flatTrend(true),
      spark: flatSpark(counts.teacherCount),
    },
    {
      id: "drivers",
      label: "Total Drivers",
      value: counts.driverCount,
      description: "Registered transport drivers",
      icon: "drivers",
      trend: flatTrend(true),
      spark: flatSpark(counts.driverCount),
    },
    {
      id: "classes",
      label: "Total Classes",
      value: counts.classCount,
      description: "Distinct grade levels",
      icon: "classes",
      trend: flatTrend(true),
      spark: flatSpark(counts.classCount),
    },
    {
      id: "sections",
      label: "Total Sections",
      value: counts.sectionCount,
      description: "Across all grade levels",
      icon: "sections",
      trend: flatTrend(true),
      spark: flatSpark(counts.sectionCount),
    },
    {
      id: "attendanceToday",
      label: "Today's Attendance",
      value: Math.round(attendancePct),
      displayValue: todayAttendance.total > 0 ? `${attendancePct.toFixed(1)}%` : "No data",
      description: todayAttendance.total > 0 ? "Students marked present today" : "Attendance not marked yet today",
      icon: "attendance",
      trend:
        yesterdayAttendance?.percentage != null && todayAttendance.total > 0
          ? realTrend(attendancePct, yesterdayAttendance.percentage, true)
          : flatTrend(true),
      spark: attendanceSeries.map((d) => d.percentage ?? 0),
    },
    {
      id: "absentToday",
      label: "Students Absent Today",
      value: absentToday,
      description: "Marked absent across all classes",
      icon: "absent",
      trend:
        yesterdayAttendance && todayAttendance.total > 0
          ? realTrend(absentToday, yesterdayAttendance.absent, false)
          : flatTrend(false),
      spark: attendanceSeries.map((d) => d.absent),
    },
    {
      id: "teachersOnLeave",
      label: "Teachers On Leave",
      value: teachersOnLeaveCount ?? 0,
      description: "Approved leave covering today",
      icon: "leave",
      trend: flatTrend(false),
      spark: flatSpark(teachersOnLeaveCount ?? 0),
    },
    {
      id: "feeToday",
      label: "Today's Fee Collection",
      value: Math.round(feeStats.todaysCollection),
      displayValue: formatCurrency(feeStats.todaysCollection),
      description: "Collected across all payment modes",
      icon: "fee",
      trend: (() => {
        const trendSeries = feeAnalytics.collectionTrend;
        const yesterday = trendSeries[trendSeries.length - 2]?.value ?? 0;
        return realTrend(feeStats.todaysCollection, yesterday, true);
      })(),
      spark: feeAnalytics.collectionTrend.slice(-12).map((p) => p.value),
    },
    {
      id: "pendingFees",
      label: "Pending Fees",
      value: Math.round(feeStats.pendingFees),
      displayValue: formatCurrency(feeStats.pendingFees),
      description: "Outstanding across all students",
      icon: "pending",
      trend: flatTrend(false),
      spark: flatSpark(feeStats.pendingFees),
    },
    {
      id: "activeVehicles",
      label: "Active Vehicles",
      value: transportUsage.find((t) => t.label === "On Route")?.value ?? 0,
      description: "Currently on a live route",
      icon: "vehicle",
      trend: flatTrend(true),
      spark: flatSpark(transportUsage.find((t) => t.label === "On Route")?.value ?? 0),
    },
    {
      id: "upcomingExams",
      label: "Upcoming Exams",
      value: upcomingExamsCount ?? 0,
      description: "Scheduled in the next 14 days",
      icon: "exam",
      trend: flatTrend(true),
      spark: flatSpark(upcomingExamsCount ?? 0),
    },
    {
      id: "announcementsToday",
      label: "Today's Announcements",
      value: announcementsTodayCount ?? 0,
      description: "Published school-wide today",
      icon: "announcement",
      trend: flatTrend(true),
      spark: flatSpark(announcementsTodayCount ?? 0),
    },
    {
      id: "activitiesPending",
      label: "Activities Pending",
      value: activityAssignmentCounts.pendingCount,
      description: "Assigned to staff, not yet marked complete",
      icon: "activityPending",
      trend: flatTrend(false),
      spark: flatSpark(activityAssignmentCounts.pendingCount),
    },
    {
      id: "activitiesCompleted",
      label: "Activities Completed",
      value: activityAssignmentCounts.completedCount,
      description: "Marked complete by assigned staff",
      icon: "activityCompleted",
      trend: flatTrend(true),
      spark: flatSpark(activityAssignmentCounts.completedCount),
    },
  ];

  return {
    stats,
    charts: {
      monthlyFeeCollection: feeAnalytics.monthlyCollection,
      studentAttendance: attendanceSeries.map((d) => ({ label: d.date.slice(5), value: d.percentage ?? 0 })),
      teacherAttendance: teacherAttendanceWeek,
      classDistribution,
      feeTrend: feeAnalytics.collectionTrend,
      transportUsage,
    },
    activity,
  };
}
