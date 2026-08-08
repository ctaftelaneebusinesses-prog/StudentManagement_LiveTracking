import { supabase } from "@/lib/supabaseClient";
import { AppUser } from "@/types/auth.types";

export interface ProfileUpdateInput {
  full_name: string;
  phone: string | null;
}

/**
 * Updates the caller's own profile fields. Relies on the `users_update_self`
 * RLS policy (id = auth.uid()) — a user can never update anyone else's row
 * through this call, regardless of what id is passed in.
 */
export async function updateOwnProfile(userId: string, input: ProfileUpdateInput): Promise<AppUser> {
  const { data, error } = await supabase
    .from("users")
    .update(input)
    .eq("id", userId)
    .select("id, full_name, email, school_id, phone, role_id, avatar_url, roles(name)")
    .single();

  if (error) throw error;
  return data as unknown as AppUser;
}

/**
 * Uploads a new avatar to the private-per-user `avatars` bucket, keyed as
 * `{userId}/{filename}` so the avatars_write_own storage policy (which checks
 * the first path segment equals auth.uid()) allows it, then stores the
 * public URL on the user's profile row.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const extension = file.name.split(".").pop();
  const path = `${userId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: data.publicUrl })
    .eq("id", userId);

  if (updateError) throw updateError;

  return data.publicUrl;
}

/**
 * Removes any uploaded avatar(s) under the user's own storage prefix and
 * clears `avatar_url` — the prefix (not a fixed filename) is listed first
 * since the original upload's extension isn't tracked separately.
 */
export async function removeAvatar(userId: string): Promise<void> {
  const { data: files, error: listError } = await supabase.storage.from("avatars").list(userId);
  if (listError) throw listError;

  if (files && files.length > 0) {
    const paths = files.map((f) => `${userId}/${f.name}`);
    const { error: removeError } = await supabase.storage.from("avatars").remove(paths);
    if (removeError) throw removeError;
  }

  const { error: updateError } = await supabase.from("users").update({ avatar_url: null }).eq("id", userId);
  if (updateError) throw updateError;
}
