import { createClient } from "@supabase/supabase-js";

/**
 * Single shared Supabase client for the whole app, using only the public
 * anon key. All data access is governed by Postgres RLS policies — this
 * client can never see more than the signed-in user's own role/school allow.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
