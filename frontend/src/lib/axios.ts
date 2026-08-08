import axios, { isAxiosError } from "axios";
import { supabase } from "./supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { useSchoolStore } from "@/store/schoolStore";

/**
 * Axios instance for calling our own backend API (not Supabase directly).
 * Attaches the current Supabase access token as a Bearer header on every
 * request, so the backend's requireAuth middleware can verify identity and
 * build a request-scoped, RLS-respecting Supabase client.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Multi-school support: anyone who can switch schools (super_admin across
  // every school, school_admin across their assigned ones — see
  // 066_super_admin_multi_school.sql) gets the selector's choice attached to
  // every request.
  //
  // This is a convenience, never a grant: resolveSchoolId() on the backend
  // re-checks the id against the caller's own accessibleSchoolIds and 403s on
  // anything else, so tampering with what's sent here gains nothing.
  const canSwitchSchools = useAuthStore.getState().permissions.includes("schools.view_assigned");
  const selectedSchoolId = useSchoolStore.getState().selectedSchoolId;
  if (canSwitchSchools && selectedSchoolId) {
    config.params = { ...config.params, school_id: selectedSchoolId };
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Session is invalid/expired server-side — clear it and send the user
      // back to login. A hard redirect (not react-router) since this file
      // lives outside the component tree.
      await supabase.auth.signOut();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Every backend error response follows `{ success: false, message, details? }`
 * (see backend/src/middleware/error.middleware.ts). Use this instead of a
 * hardcoded guess so the UI shows what actually went wrong (a real conflict,
 * a validation error, a 500) rather than assuming one specific cause.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return fallback;
}
