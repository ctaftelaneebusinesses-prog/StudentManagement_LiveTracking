import { createContext, ReactNode, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/authStore";
import {
  clearStuckSession,
  fetchCurrentProfile,
  fetchMyPermissions,
  fetchMyRoles,
  signInWithPassword,
  signOut,
} from "@/services/auth.service";
import { AppUser, RoleName } from "@/types/auth.types";

const IDENTITY_LOAD_TIMEOUT_MS = 8000;

/**
 * supabase-js's cross-tab `navigator.locks` guard around token refresh can
 * get stuck (a known Chromium issue, seen in both Chrome and Edge), leaving
 * `getSession()`/`getUser()` pending forever. Without a timeout here, that
 * hang propagates straight into `isLoading` never resolving, and
 * ProtectedRoute is stuck showing "Checking your session..." with no way out
 * short of manually clearing site storage.
 */
/** Distinguishes a genuine stuck-lock hang (see withTimeout) from any other error thrown while loading identity. */
class SessionLoadTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new SessionLoadTimeoutError("Timed out loading your session")),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

interface AuthContextValue {
  user: AppUser | null;
  roleNames: RoleName[];
  permissions: string[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AppUser | null>;
  logout: () => Promise<void>;
  hasRole: (role: RoleName) => boolean;
  hasPermission: (permissionCode: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, roleNames, permissions, isLoading, setUser, setRoleNames, setPermissions, setLoading } =
    useAuthStore();

  /**
   * Tracks whose data the QueryClient cache currently belongs to.
   *
   * QueryClient is one app-wide singleton (see lib/queryClient.ts) — it is
   * NOT reset by React Router navigation or by Zustand's auth store being
   * cleared. Every cached query result (school lists, dashboard stats, user
   * lists, ...) sits keyed only by its own query key, with no per-user
   * scoping. If user A logs out and user B logs in in the SAME browser tab
   * without a hard reload, B's freshly-mounted components would read A's
   * still-`staleTime`-fresh cached data under the same keys — e.g. a
   * super_admin's full school list bleeding into the very next school_admin
   * who signs in on that device, well within the query's 30s staleTime.
   * Wiping the cache on every identity change closes that window entirely.
   */
  const identityRef = useRef<string | null>(null);

  /** Clears local identity state AND the query cache — see identityRef's note above. */
  function resetToSignedOut() {
    if (identityRef.current !== null) {
      queryClient.clear();
      identityRef.current = null;
    }
    setUser(null);
    setRoleNames([]);
    setPermissions([]);
  }

  async function loadFullIdentity() {
    const profile = await fetchCurrentProfile();

    if (profile?.id !== identityRef.current) {
      queryClient.clear();
      identityRef.current = profile?.id ?? null;
    }

    setUser(profile);

    if (!profile) {
      setRoleNames([]);
      setPermissions([]);
      return profile;
    }

    const [roles, perms] = await Promise.all([fetchMyRoles(), fetchMyPermissions()]);
    setRoleNames(roles);
    setPermissions(perms);
    return profile;
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      setLoading(true);
      try {
        await withTimeout(loadFullIdentity(), IDENTITY_LOAD_TIMEOUT_MS);
      } catch (err) {
        // Only a genuine hang (the stuck navigator.locks issue) justifies
        // wiping the session — any other error (a transient network/DB blip
        // while fetching the profile) does NOT mean the session is invalid,
        // and must not force a sign-out. On first load there's no prior user
        // to preserve, so this just leaves ProtectedRoute to redirect once
        // loading finishes, same as before.
        if (err instanceof SessionLoadTimeoutError) {
          clearStuckSession();
          if (isMounted) resetToSignedOut();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    bootstrap();

    // Keeps identity in sync across tabs and on token refresh/expiry/sign-out.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        resetToSignedOut();
        return;
      }
      try {
        await withTimeout(loadFullIdentity(), IDENTITY_LOAD_TIMEOUT_MS);
      } catch (err) {
        // Same reasoning as bootstrap above — this fires on every background
        // token refresh while the user is actively using the app, so a
        // transient error here must NOT force an already-logged-in user back
        // to /login. Only the genuine stuck-lock hang does.
        if (err instanceof SessionLoadTimeoutError) {
          clearStuckSession();
          resetToSignedOut();
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    await signInWithPassword(email, password);
    try {
      return await withTimeout(loadFullIdentity(), IDENTITY_LOAD_TIMEOUT_MS);
    } catch (err) {
      // The password check already succeeded at this point — a hang here is
      // the same stuck-session-lock issue bootstrap() guards against, not a
      // credentials problem. Clear it so the retry the caller shows an error
      // for actually has a clean slate to work with.
      clearStuckSession();
      throw err;
    }
  }

  async function logout() {
    await signOut();
    resetToSignedOut();
  }

  function hasRole(role: RoleName) {
    return roleNames.includes(role);
  }

  function hasPermission(permissionCode: string) {
    return permissions.includes(permissionCode);
  }

  return (
    <AuthContext.Provider
      value={{ user, roleNames, permissions, isLoading, login, logout, hasRole, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}
