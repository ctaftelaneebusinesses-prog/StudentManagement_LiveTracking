import axios from "axios";
import { ClassRoom, Subject } from "@/types/admin.types";

/**
 * Registration is the one flow that runs before any session exists — every
 * other frontend service imports `api` from `@/lib/axios`, whose request
 * interceptor attaches a Supabase bearer token that doesn't exist yet here.
 * A bare axios instance (same baseURL/timeout) avoids that interceptor
 * entirely rather than fighting it.
 */
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

export interface RegistrationActivity {
  id: string;
  name: string;
  staff_title: string;
  category: string | null;
}

export interface RegistrationMeta {
  school: { id: string; name: string; code: string };
  // Same shape the admin-side classesService/listClasses/listSubjects return
  // (the backend's GET /auth/register/meta reuses those exact services) —
  // reusing ClassRoom/Subject here keeps this drop-in compatible with
  // ClassSectionSelects and every other picker already built for them.
  classes: ClassRoom[];
  subjects: Subject[];
  activities: RegistrationActivity[];
}

export async function fetchRegistrationMeta(schoolCode: string): Promise<RegistrationMeta> {
  const { data } = await publicApi.get("/auth/register/meta", { params: { school_code: schoolCode } });
  return data.data;
}

export type RegistrationRole = "principal" | "accountant" | "driver" | "extracurricular_staff" | "teacher" | "student";

const ROLE_PATH: Record<RegistrationRole, string> = {
  principal: "principal",
  accountant: "accountant",
  driver: "driver",
  extracurricular_staff: "extracurricular-staff",
  teacher: "teacher",
  student: "student",
};

export interface RegistrationResult {
  user_id: string;
  status: "pending";
}

export async function submitRegistration(role: RegistrationRole, payload: Record<string, unknown>): Promise<RegistrationResult> {
  const { data } = await publicApi.post(`/auth/register/${ROLE_PATH[role]}`, payload);
  return data.data;
}
