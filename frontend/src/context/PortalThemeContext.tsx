import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as profileService from "@/services/portal/profile.service";

export type PortalTheme = "boy" | "girl";

const PortalThemeContext = createContext<PortalTheme>("boy");

function themeFromGender(gender: string | null | undefined): PortalTheme {
  return gender?.toLowerCase() === "female" ? "girl" : "boy";
}

function storageKey(studentId: string) {
  return `sms-portal-theme-${studentId}`;
}

/** Same localStorage-fast-path idea as ThemeContext's dark-mode toggle: avoids a flash of the wrong gender theme on every reload while the profile fetch (which carries `gender`) is still in flight — only the very first visit for a given student pays that flash. */
function getInitialTheme(studentId: string): PortalTheme {
  if (typeof window === "undefined" || !studentId) return "boy";
  const stored = window.localStorage.getItem(storageKey(studentId));
  return stored === "boy" || stored === "girl" ? stored : "boy";
}

/**
 * Resolves the Student Portal's blue/pink theme from the student's gender.
 * Shares the same `["portal","profile",studentId]` query PortalProfilePage/
 * PortalFeesPage already fetch, so this adds no extra network round trip in
 * practice.
 */
export function PortalThemeProvider({ children }: { children: ReactNode }) {
  const studentId = usePortalStudentId();
  const [theme, setTheme] = useState<PortalTheme>(() => getInitialTheme(studentId));

  const { data } = useQuery({
    queryKey: ["portal", "profile", studentId],
    queryFn: () => profileService.fetchProfile(studentId),
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setTheme(getInitialTheme(studentId));
  }, [studentId]);

  useEffect(() => {
    if (!studentId || data?.gender === undefined) return;
    const resolved = themeFromGender(data.gender);
    setTheme(resolved);
    window.localStorage.setItem(storageKey(studentId), resolved);
  }, [studentId, data?.gender]);

  return (
    <PortalThemeContext.Provider value={theme}>
      <div data-portal-theme={theme} className="contents">
        {children}
      </div>
    </PortalThemeContext.Provider>
  );
}

export function usePortalTheme(): PortalTheme {
  return useContext(PortalThemeContext);
}
