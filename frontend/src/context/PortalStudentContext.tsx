import { createContext, ReactNode, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";

interface PortalStudentContextValue {
  /** The effective student id every portal page should fetch data for — always the logged-in student's own id. */
  studentId: string;
}

const PortalStudentContext = createContext<PortalStudentContextValue | undefined>(undefined);

/**
 * Resolves "which student's records is this portal session looking at" once,
 * at the top of the portal route tree, so every page below (Dashboard,
 * Attendance, Profile, Timetable) can just call usePortalStudentId() instead
 * of each re-deriving it from useAuth() directly.
 */
export function PortalStudentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const value: PortalStudentContextValue = { studentId: user?.id ?? "" };
  return <PortalStudentContext.Provider value={value}>{children}</PortalStudentContext.Provider>;
}

function usePortalStudentContext(): PortalStudentContextValue {
  const ctx = useContext(PortalStudentContext);
  if (!ctx) throw new Error("usePortalStudentId must be used within PortalStudentProvider");
  return ctx;
}

/** The effective student id the current portal page should fetch data for. */
export function usePortalStudentId(): string {
  return usePortalStudentContext().studentId;
}
