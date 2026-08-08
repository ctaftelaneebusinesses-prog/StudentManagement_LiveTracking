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
    user_metadata: { full_name: input.full_name, role_id: input.role_id, school_id: input.school_id },
  });

  if (error) {
    if (error.status === 422 || error.code === "email_exists") {
      throw ApiError.conflict("A user with this email already exists");
    }
    throw ApiError.internal(error.message);
  }

  return data.user;
}
