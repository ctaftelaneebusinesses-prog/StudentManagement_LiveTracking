import { api } from "@/lib/axios";
import {
  RosterStudent,
  TeacherDashboard,
  TeacherProfile,
  TeacherProfileUpdateInput,
  TeacherStudentListItem,
  TeacherStudentDetail,
  TeacherTodayPeriod,
  TeacherTimetableDay,
} from "@/types/teacher.types";

export async function fetchDashboard(): Promise<TeacherDashboard> {
  const { data } = await api.get("/teacher-portal/dashboard");
  return data.data;
}

export async function fetchRoster(classId: string): Promise<RosterStudent[]> {
  const { data } = await api.get(`/teacher-portal/classes/${classId}/students`);
  return data.data;
}

export async function fetchProfile(): Promise<TeacherProfile> {
  const { data } = await api.get("/teacher-portal/profile");
  return data.data;
}

export async function updateProfile(input: TeacherProfileUpdateInput): Promise<TeacherProfile> {
  const { data } = await api.patch("/teacher-portal/profile", input);
  return data.data;
}

export async function fetchMyStudents(params: { classId: string; subjectId?: string }): Promise<TeacherStudentListItem[]> {
  const { data } = await api.get("/teacher-portal/students", { params });
  return data.data;
}

export async function fetchStudentDetail(studentId: string): Promise<TeacherStudentDetail> {
  const { data } = await api.get(`/teacher-portal/students/${studentId}`);
  return data.data;
}

export async function fetchTodayTimetable(): Promise<TeacherTodayPeriod[]> {
  const { data } = await api.get("/teacher-portal/timetable/today");
  return data.data;
}

export async function fetchWeeklyTimetable(): Promise<TeacherTimetableDay[]> {
  const { data } = await api.get("/teacher-portal/timetable");
  return data.data;
}
