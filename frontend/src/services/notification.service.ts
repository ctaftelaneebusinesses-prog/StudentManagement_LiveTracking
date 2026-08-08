import { api } from "@/lib/axios";
import { AppNotification } from "@/types/notification.types";

export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get("/notifications/me");
  return data.data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await api.put(`/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.put("/notifications/read-all");
}

export interface EmergencyAlertInput {
  title: string;
  message: string;
}

export async function sendEmergencyAlert(input: EmergencyAlertInput): Promise<AppNotification> {
  const { data } = await api.post("/notifications/emergency", input);
  return data.data;
}

/** School-wide notification log (requires notifications.view) — used to show past emergency alerts sent. */
export async function fetchSchoolNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get("/notifications");
  return data.data;
}
