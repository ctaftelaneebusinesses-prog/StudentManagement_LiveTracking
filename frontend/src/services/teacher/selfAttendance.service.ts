import { api } from "@/lib/axios";

export interface TodayAttendanceStatus {
  date: string;
  status: "present" | "absent" | "half_day" | "leave" | null;
  check_in_at: string | null;
  check_out_at: string | null;
  checkin_cutoff: string | null;
}

export async function fetchTodayStatus(): Promise<TodayAttendanceStatus> {
  const { data } = await api.get("/teacher-portal/attendance/today");
  return data.data;
}

export async function checkIn(): Promise<TodayAttendanceStatus> {
  const { data } = await api.post("/teacher-portal/attendance/check-in");
  return data.data;
}

export async function checkOut(): Promise<TodayAttendanceStatus> {
  const { data } = await api.post("/teacher-portal/attendance/check-out");
  return data.data;
}
