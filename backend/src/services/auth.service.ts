import { supabaseAdmin, createUserScopedClient } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

/**
 * Thin wrapper around Supabase Auth. Kept in its own service layer (rather
 * than inline in the controller) so the auth provider can be swapped or
 * extended (e.g. MFA, SSO) without touching route/controller code.
 */
export async function loginWithPassword(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, full_name, email, school_id, role_id, avatar_url, roles(name)")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    throw ApiError.unauthorized("User profile not found");
  }

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
