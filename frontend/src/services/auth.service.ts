import { supabase } from "@/lib/supabaseClient";
import { AppUser, RoleName } from "@/types/auth.types";

/**
 * Auth actions talk to Supabase Auth directly from the client (this is the
 * standard, supported Supabase pattern — the anon key + RLS make this safe).
 * The backend's /auth routes exist for server-side flows (audited password
 * reset, provisioning), not for this login form.
 */
export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchCurrentProfile(): Promise<AppUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, school_id, phone, role_id, avatar_url, roles(name)")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data as unknown as AppUser;
}

/** All roles held by the signed-in user, via the my_roles() RPC (RLS-safe, self-scoped). */
export async function fetchMyRoles(): Promise<RoleName[]> {
  const { data, error } = await supabase.rpc("my_roles");
  if (error) throw error;
  return (data ?? []).map((row: { role_name: RoleName }) => row.role_name);
}

/** Flattened permission codes across all held roles, via the my_permissions() RPC. */
export async function fetchMyPermissions(): Promise<string[]> {
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
