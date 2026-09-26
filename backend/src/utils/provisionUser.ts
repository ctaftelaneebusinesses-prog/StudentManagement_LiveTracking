import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "./ApiError";

/**
 * Creates an auth user directly with an admin-supplied password instead of
 * emailing an invite link. Supabase's built-in email sender is capped at a
 * very low rate not meant for real usage, and this app doesn't want an email
 * step at all — accounts are created and usable immediately, and the admin
 * shares the password with the person directly.
 */
export async function provisionUser(input: {
  email: string;
  password: string;
  full_name: string;
  role_id: number;
  school_id: string;
}) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    // Only full_name (non-privileged) travels in metadata. role_id/school_id are
    // set authoritatively below via the service role — never trusted from client
    // signup metadata (see 077_signup_trigger_privilege_fix.sql for SEC-01).
    user_metadata: { full_name: input.full_name },
  });

  if (error) {
    if (error.status === 422 || error.code === "email_exists") {
      // Tagged so the PUBLIC self-registration endpoints can return a generic
      // response instead of leaking whether the email exists (SEC-19). The
      // authenticated admin create paths still surface this as a 409.
      const conflict = ApiError.conflict("A user with this email already exists") as ApiError & { code?: string };
      conflict.code = "EMAIL_EXISTS";
      throw conflict;
    }
    throw ApiError.internal(error.message);
  }

  const userId = data.user.id;

  // REL-01 / SEC-12: the auth user now exists but the profile/role are still the
  // trigger's safe defaults (student / no school). Assign the intended role &
  // school authoritatively (service role — permitted past the SEC-02 column
  // guard). If ANY step fails, roll back the half-provisioned auth user so we
  // never leave an orphaned or partially-configured account behind.
  try {
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .update({ role_id: input.role_id, school_id: input.school_id })
      .eq("id", userId);
    if (profileError) throw ApiError.internal(profileError.message);

    // Replace the default 'student' membership the trigger inserted.
    const { error: clearError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    if (clearError) throw ApiError.internal(clearError.message);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role_id: input.role_id, school_id: input.school_id });
    if (roleError) throw ApiError.internal(roleError.message);
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw err;
  }

  return data.user;
}
