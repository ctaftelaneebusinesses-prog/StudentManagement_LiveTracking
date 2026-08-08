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

/**
 * Throwaway anon client for password verification (sign-in).
 *
 * MUST be used instead of supabaseAdmin for any auth.signInWithPassword call.
 * supabase-js stores the resulting session on the client instance and then
 * sends that user's JWT as the Authorization header on every subsequent
 * request from the same instance — even with persistSession:false, which only
 * controls writing the session to storage, not holding it in memory.
 *
 * Calling signInWithPassword on the shared `supabaseAdmin` singleton therefore
 * silently demotes it from the service role to whichever user logged in most
 * recently, so unrelated later requests get evaluated under that user's RLS
 * context. That produced spurious "not found" failures across the app and is a
 * cross-request identity leak. A fresh instance per sign-in keeps the blast
 * radius at zero — it is discarded as soon as the check completes.
 */
export function createSignInClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
