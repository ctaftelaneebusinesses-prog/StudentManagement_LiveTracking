import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Admin client — uses the service role key and bypasses Row Level Security.
 * Reserved for privileged, backend-only operations (provisioning users,
 * cross-tenant admin tasks). Never expose this client or its key to the
 * frontend, and never use it to serve a plain authenticated request.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Request-scoped client — created per-request with the caller's own JWT,
 * so every query runs through Postgres RLS as that specific user. This is
 * the client that should back almost all authenticated API routes.
 */
export function createUserScopedClient(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
