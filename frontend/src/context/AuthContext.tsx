import { createContext, ReactNode, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import {
  fetchCurrentProfile,
  fetchMyPermissions,
  fetchMyRoles,
  signInWithPassword,
  signOut,
} from "@/services/auth.service";
import { AppUser, RoleName } from "@/types/auth.types";

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

  async function loadFullIdentity() {
    const profile = await fetchCurrentProfile();
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
        await loadFullIdentity();
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    bootstrap();

    // Keeps identity in sync across tabs and on token refresh/expiry/sign-out.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setUser(null);
        setRoleNames([]);
        setPermissions([]);
        return;
      }
      await loadFullIdentity();
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    await signInWithPassword(email, password);
    return loadFullIdentity();
  }

  async function logout() {
    await signOut();
    setUser(null);
    setRoleNames([]);
    setPermissions([]);
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
