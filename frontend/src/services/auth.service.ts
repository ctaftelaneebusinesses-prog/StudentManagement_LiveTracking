import { supabase } from "@/lib/supabaseClient";
import { api } from "@/lib/axios";
import { AppUser, RoleName } from "@/types/auth.types";

const DEMO_STORAGE_KEY = "sms-demo-auth";
const DEMO_ACCOUNTS: Record<string, { email: string; password: string; fullName: string; role: RoleName; roleNames: RoleName[]; permissions: string[] }> = {
  teacher: {
    email: "teacher@school.local",
    password: "demo123456",
    fullName: "Demo Teacher",
    role: "teacher",
    roleNames: ["teacher"],
    permissions: ["attendance.read", "attendance.write", "marks.read", "marks.write", "homework.read", "reports.read"],
  },
  driver: {
    email: "driver@school.local",
    password: "demo123456",
    fullName: "Demo Driver",
    role: "driver",
    roleNames: ["driver"],
    permissions: ["transport.read", "tracking.write"],
  },
  admin: {
    email: "admin@school.local",
    password: "demo123456",
    fullName: "Demo Admin",
    role: "school_admin",
    roleNames: ["school_admin", "super_admin"],
    permissions: ["users.read", "users.write", "students.read", "students.write", "classes.read", "classes.write"],
  },
};

function isDemoModeEnabled() {
  return import.meta.env.VITE_DEMO_MODE === "true" || import.meta.env.DEV;
}

function getDemoCredentials(email?: string) {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (normalizedEmail) {
    if (normalizedEmail === "demo@school.local") {
      return { ...DEMO_ACCOUNTS.teacher };
    }

    const accountKey = normalizedEmail.split("@", 1)[0];
    return DEMO_ACCOUNTS[accountKey] ?? null;
  }

  const configuredEmail = (import.meta.env.VITE_DEMO_EMAIL ?? "teacher@school.local").trim().toLowerCase();
  const configuredPassword = (import.meta.env.VITE_DEMO_PASSWORD ?? "demo123456").trim();

  const account = DEMO_ACCOUNTS[configuredEmail.split("@", 1)[0]] ?? DEMO_ACCOUNTS.teacher;
  return { ...account, password: configuredPassword };
}

function getDemoSession() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as { user: AppUser; roleNames: RoleName[]; permissions: string[] };
  } catch {
    return null;
  }
}

function persistDemoSession(user: AppUser, roleNames: RoleName[], permissions: string[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ user, roleNames, permissions }));
}

function clearDemoSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_STORAGE_KEY);
}

/**
 * Hard-clears whatever supabase-js has stored locally (keys are prefixed
 * `sb-`) plus our own demo marker, without going through supabase-js itself.
 * Used as a last resort when the session bootstrap hangs — a known
 * supabase-js/Chromium issue where its cross-tab `navigator.locks` guard
 * around token refresh can get stuck, leaving `getSession()`/`getUser()`
 * pending forever. A stuck lock means calling `supabase.auth.signOut()`
 * would queue behind the same lock and hang too, so this bypasses the client
 * entirely and just deletes the storage keys directly — safe because it's
 * synchronous, local-only, and the worst case is just being signed out.
 */
export function clearStuckSession() {
  if (typeof window === "undefined") return;
  clearDemoSession();
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("sb-")) window.localStorage.removeItem(key);
  }
}

/**
 * Auth actions talk to Supabase Auth directly from the client (this is the
 * standard, supported Supabase pattern — the anon key + RLS make this safe).
 * The backend's /auth routes exist for server-side flows (audited password
 * reset, provisioning), not for this login form.
 */
export async function signInWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const demoAccount = getDemoCredentials(normalizedEmail);
  const isDemoLogin = Boolean(demoAccount) && (normalizedEmail === demoAccount.email || normalizedEmail === "demo@school.local") && password === demoAccount.password;

  if (isDemoModeEnabled() && isDemoLogin) {
    const demoUser: AppUser = {
      id: `demo-${demoAccount.role}`,
      full_name: demoAccount.fullName,
      email: demoAccount.email,
      school_id: "demo-school",
      phone: null,
      role_id: demoAccount.role === "teacher" ? 3 : demoAccount.role === "student" ? 5 : demoAccount.role === "driver" ? 6 : 1,
      avatar_url: null,
      roles: { name: demoAccount.role },
    };

    persistDemoSession(demoUser, demoAccount.roleNames, demoAccount.permissions);
    return { user: demoUser };
  }

  // A previous demo login leaves `sms-demo-auth` in localStorage, and
  // fetchCurrentProfile()/fetchMyRoles()/fetchMyPermissions() all check that
  // marker before ever touching the real session — so without clearing it
  // here, a real (non-demo) sign-in below would succeed against Supabase but
  // the app would keep reading back the stale demo identity afterward.
  clearDemoSession();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  void reportLoginAttempt(email, !error);
  if (error) throw error;
  return data;
}

/**
 * Since the login form authenticates directly against Supabase (see the
 * comment above), the backend only learns about it if told — this reports
 * the outcome to Login History without affecting the actual sign-in result.
 * Fire-and-forget: a logging failure must never block or fail a login.
 */
function reportLoginAttempt(email: string, success: boolean) {
  return api.post("/auth/record-login-attempt", { email, success }).catch(() => undefined);
}

export async function signOut() {
  const demoSession = getDemoSession();
  if (demoSession) {
    clearDemoSession();
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchCurrentProfile(): Promise<AppUser | null> {
  const demoSession = getDemoSession();
  if (demoSession) {
    return demoSession.user;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, school_id, phone, role_id, avatar_url, status, roles(name)")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data as unknown as AppUser;
}

/** All roles held by the signed-in user, via the my_roles() RPC (RLS-safe, self-scoped). */
export async function fetchMyRoles(): Promise<RoleName[]> {
  const demoSession = getDemoSession();
  if (demoSession) {
    return demoSession.roleNames;
  }

  const { data, error } = await supabase.rpc("my_roles");
  if (error) throw error;
  return (data ?? []).map((row: { role_name: RoleName }) => row.role_name);
}

/** Flattened permission codes across all held roles, via the my_permissions() RPC. */
export async function fetchMyPermissions(): Promise<string[]> {
  const demoSession = getDemoSession();
  if (demoSession) {
    return demoSession.permissions;
  }

  const { data, error } = await supabase.rpc("my_permissions");
  if (error) throw error;
  return (data ?? []).map((row: { permission_code: string }) => row.permission_code);
}

/**
 * Requests a password-reset email. Goes through Supabase directly — this is
 * the flow Supabase's own auth-helpers assume (the reset link's recovery
 * token is delivered straight to the browser, never through our backend).
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/**
 * Completes a password reset. Must be called after the browser has landed on
 * /reset-password from the emailed link — supabase-js (detectSessionInUrl)
 * already parsed the recovery token into an active session by that point,
 * so updateUser applies to that session directly.
 */
export async function completePasswordReset(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Self-service password change for an already-logged-in user — goes through
 * the backend (requires the service-role admin API to set the new password
 * after re-verifying the current one), unlike the other auth actions here
 * which talk to Supabase directly.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/change-password", { currentPassword, newPassword });
}
