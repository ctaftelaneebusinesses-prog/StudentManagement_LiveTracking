import { create } from "zustand";
import { AppUser, RoleName } from "@/types/auth.types";

interface AuthStoreState {
  user: AppUser | null;
  roleNames: RoleName[];
  permissions: string[];
  isLoading: boolean;
  setUser: (user: AppUser | null) => void;
  setRoleNames: (roleNames: RoleName[]) => void;
  setPermissions: (permissions: string[]) => void;
  setLoading: (isLoading: boolean) => void;
  reset: () => void;
}

/**
 * Holds the current user's profile, all held role names, flattened
 * permission codes, and a loading flag. This is UI-facing state; the source
 * of truth for the session itself is Supabase's own client-side session
 * storage, read through AuthContext.
 */
export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  roleNames: [],
  permissions: [],
  isLoading: true,
  setUser: (user) => set({ user }),
  setRoleNames: (roleNames) => set({ roleNames }),
  setPermissions: (permissions) => set({ permissions }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, roleNames: [], permissions: [], isLoading: false }),
}));
