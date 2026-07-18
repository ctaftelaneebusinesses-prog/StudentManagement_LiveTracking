import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

/** Access the current user, loading state, and login/logout actions. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
