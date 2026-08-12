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

/**
 * Deduped so N parallel requests that all 401 around the same moment share
 * exactly one of these calls, not N of them racing against Supabase's
 * single-use rotating refresh token.
 *
 * Deliberately `getSession()`, not `refreshSession()`. `refreshSession()`
 * forces a brand-new refresh unconditionally, regardless of whether the
 * current session is actually expired — so when it happened to fire around
 * the same moment as supabase-js's own `autoRefreshToken` background timer
 * (see supabaseClient.ts), both ended up consuming the same rotating
 * refresh token, one of them got rejected as "already used", and supabase-js
 * treated that as fatal: it cleared a perfectly valid session and fired
 * SIGNED_OUT, forcing already-logged-in users back to /login with no 401
 * actually indicating their session was invalid. `getSession()` only
 * refreshes when the session is genuinely expired, through the SDK's own
 * coordinated (locked) refresh path — the same one the background timer
 * uses — instead of forcing a second, competing refresh call.
 */
let refreshPromise: Promise<boolean> | null = null;

function ensureFreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = supabase.auth
      .getSession()
      .then(({ data, error }) => !error && Boolean(data.session))
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    // A 401 doesn't necessarily mean the session is actually invalid — it
    // can also mean getSession() handed this request a token that expired
    // moments before the server saw it, or that this request just lost a
    // race with an in-flight token refresh. Try refreshing once and retrying
    // before treating the user as logged out; only a refresh that genuinely
    // fails (refresh token itself expired/revoked) means the session is
    // really over.
    if (error.response?.status === 401 && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      const refreshed = await ensureFreshSession();
      if (refreshed) {
        return api(originalRequest);
      }
    }

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
