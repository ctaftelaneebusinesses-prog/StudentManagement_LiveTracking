import { api } from "@/lib/axios";
import { AttendancePeriodSummary, FeeSummary, StudentTransportAssignment, UpcomingExam } from "@/types/portal.types";
import { HomeworkItem, MarksSummary, StudentNotification, TimetableDay } from "@/types/dashboard.types";

export async function fetchAttendanceSummary(studentId: string, from?: string, to?: string): Promise<AttendancePeriodSummary> {
  const { data } = await api.get(`/students/${studentId}/attendance/summary`, { params: { from, to } });
  return data.data;
}

export async function fetchPendingFees(studentId: string): Promise<FeeSummary> {
  const { data } = await api.get(`/students/${studentId}/fees/summary`);
  return data.data;
}

export async function fetchUpcomingExams(studentId: string): Promise<UpcomingExam[]> {
  const { data } = await api.get(`/students/${studentId}/exams/upcoming`);
  return data.data;
}

export async function fetchHomeworkToday(studentId: string): Promise<HomeworkItem[]> {
  const { data } = await api.get(`/students/${studentId}/homework`);
  return data.data;
}

export async function fetchTodayTimetable(studentId: string): Promise<TimetableDay[]> {
  const { data } = await api.get(`/students/${studentId}/timetable`);
  return data.data;
}

export async function fetchTransport(studentId: string): Promise<StudentTransportAssignment | null> {
  const { data } = await api.get(`/students/${studentId}/transport`);
  return data.data;
}

export async function fetchAnnouncements(studentId: string): Promise<StudentNotification[]> {
  const { data } = await api.get(`/students/${studentId}/notifications`);
  return data.data;
}

export async function markAnnouncementRead(studentId: string, notificationId: string): Promise<void> {
  await api.post(`/students/${studentId}/notifications/${notificationId}/read`);
}

export async function fetchMarksSummary(studentId: string): Promise<MarksSummary> {
  const { data } = await api.get(`/students/${studentId}/marks/summary`);
  return data.data;
}
