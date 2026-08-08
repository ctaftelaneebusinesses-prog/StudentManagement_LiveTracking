import { supabaseAdmin, createUserScopedClient, createSignInClient } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

interface LoginGateProfile {
  id: string;
  is_active: boolean;
  schools: { is_active: boolean; name: string } | null;
}

/**
 * Rejects a sign-in whose account or school has had access switched off
 * (066_super_admin_multi_school.sql). This is the front door for the same two
 * gates requireAuth applies on every subsequent request — enforcing it here
 * too means a deactivated user gets a clear message at the login screen
 * instead of a session that 403s on the first page it loads.
 *
 * A super_admin is exempt from the school gate: their home school going
 * inactive must never lock the platform operator out of reversing it.
 *
 * Nothing here deletes or alters records — deactivation is purely an access
 * flag, so all of the school's data is still intact behind it.
 */
async function assertAccountMayLogIn(profile: LoginGateProfile): Promise<void> {
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", profile.id);

  const isSuperAdmin = (roleRows ?? []).some(
    (row) => (row as unknown as { roles: { name: string } }).roles.name === "super_admin"
  );
  if (isSuperAdmin) return;

  // School status is checked FIRST: a cascade switches off the school AND
  // every account in it, so both gates would fire — and "your school is
  // inactive" is the accurate, actionable reason, whereas "your account was
  // deactivated" would wrongly imply an individual suspension.
  if (profile.schools && profile.schools.is_active === false) {
    const err = ApiError.forbidden(
      `${profile.schools.name} is currently inactive. Please contact your administrator.`
    );
    (err as ApiError & { code?: string }).code = "SCHOOL_INACTIVE";
    throw err;
  }

  if (!profile.is_active) {
    const err = ApiError.forbidden(
      "Your account has been deactivated. Please contact your school administrator."
    );
    (err as ApiError & { code?: string }).code = "ACCOUNT_DEACTIVATED";
    throw err;
  }
}

/**
 * Thin wrapper around Supabase Auth. Kept in its own service layer (rather
 * than inline in the controller) so the auth provider can be swapped or
 * extended (e.g. MFA, SSO) without touching route/controller code.
 */
export async function loginWithPassword(email: string, password: string) {
  // Deliberately NOT supabaseAdmin — see createSignInClient's note: signing in
  // on the shared admin client leaves that user's session attached to it and
  // demotes every later service-role query to their RLS context.
  const { data, error } = await createSignInClient().auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // `schools!users_school_id_fkey` must stay explicit — see the same note in
  // auth.middleware.ts. school_admin_schools gives PostgREST a second
  // users->schools path, so a bare `schools(...)` embed is ambiguous and
  // fails the whole select.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select(
      "id, full_name, email, school_id, role_id, avatar_url, is_active, roles(name), schools!users_school_id_fkey(is_active, name)"
    )
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    throw ApiError.unauthorized("User profile not found");
  }

  await assertAccountMayLogIn(profile as unknown as LoginGateProfile);

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: profile,
  };
}

export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  };
}

/**
 * Sends a password-reset email via Supabase Auth. `redirectTo` must be an
 * allow-listed URL in the Supabase project's Auth settings (the frontend's
 * /reset-password route) — Supabase rejects anything not on that list.
 */
export async function sendPasswordResetEmail(email: string, redirectTo: string) {
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    throw ApiError.badRequest(error.message);
  }
}

/**
 * Completes a password reset. `accessToken` is the short-lived recovery
 * token Supabase issues to the browser when the user clicks the reset link;
 * the frontend forwards it here rather than calling supabase-js directly so
 * the change is validated and logged server-side. Using a client scoped to
 * the caller's own recovery token (not the admin client) means an invalid or
 * expired token is rejected by Supabase itself, not just by our own checks.
 */
export async function resetPassword(accessToken: string, newPassword: string) {
  const scopedClient = createUserScopedClient(accessToken);
  const { error } = await scopedClient.auth.updateUser({ password: newPassword });
  if (error) {
    throw ApiError.badRequest(error.message);
  }
}

/**
 * Self-service password change for an already-logged-in user. Re-verifies
 * the current password via a real sign-in (not just trusting the caller)
 * before using the service-role admin API to set the new one — no
 * access-token juggling needed since the caller is already authenticated.
 */
export async function changePassword(userId: string, email: string, currentPassword: string, newPassword: string) {
  // Throwaway client, not supabaseAdmin — see loginWithPassword above.
  const { error: verifyError } = await createSignInClient().auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) {
    throw ApiError.badRequest("Current password is incorrect");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    throw ApiError.badRequest(error.message);
  }
}
