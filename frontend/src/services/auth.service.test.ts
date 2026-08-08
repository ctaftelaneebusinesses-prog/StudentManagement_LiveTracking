import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentProfile, fetchMyPermissions, fetchMyRoles, signInWithPassword, signOut } from "./auth.service";

describe("demo auth fallback", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_DEMO_MODE", "true");
    vi.stubEnv("VITE_DEMO_EMAIL", "demo@school.local");
    vi.stubEnv("VITE_DEMO_PASSWORD", "demo123456");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("allows a demo sign-in without Supabase credentials", async () => {
    const session = await signInWithPassword("demo@school.local", "demo123456");

    expect(session).toBeDefined();

    const profile = await fetchCurrentProfile();
    expect(profile?.email).toBe("teacher@school.local");
    expect(await fetchMyRoles()).toContain("teacher");
    expect(await fetchMyPermissions()).toContain("attendance.read");
  });

  it("clears demo state on sign out", async () => {
    await signInWithPassword("demo@school.local", "demo123456");
    await signOut();

    expect(await fetchCurrentProfile()).toBeNull();
  });
});
