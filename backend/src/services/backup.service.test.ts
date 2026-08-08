import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("./school.service", () => ({
  updateSchoolSettings: vi.fn(),
}));

import { supabaseAdmin } from "../config/supabase";
import * as schoolService from "./school.service";
import { exportSchoolData } from "./backup.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
  vi.mocked(schoolService.updateSchoolSettings).mockReset();
});

describe("exportSchoolData", () => {
  it("bundles every configuration/roster table and stamps lastExportAt", async () => {
    const rows: Record<string, unknown> = {
      schools: { id: "school-1", name: "Greenwood", settings: { backup: { frequency: "weekly" } } },
      users: [{ id: "u1", full_name: "Admin" }],
      students: [{ id: "s1", admission_no: "A1" }],
      teachers: [{ id: "t1", employee_id: "E1" }],
      classes: [{ id: "c1", name: "10" }],
      subjects: [{ id: "sub1", name: "Math" }],
      academic_years: [{ id: "ay1", name: "2026-2027" }],
      branches: [{ id: "b1", name: "Main" }],
      departments: [{ id: "d1", name: "Science" }],
    };

    fromMock.mockImplementation((table: string) => {
      if (table === "schools") return chain({ data: rows.schools, error: null });
      return chain({ data: rows[table], error: null });
    });
    vi.mocked(schoolService.updateSchoolSettings).mockResolvedValue({} as never);

    const result = await exportSchoolData("school-1");

    expect(result.school).toEqual(rows.schools);
    expect(result.users).toEqual(rows.users);
    expect(result.students).toEqual(rows.students);
    expect(result.teachers).toEqual(rows.teachers);
    expect(result.classes).toEqual(rows.classes);
    expect(result.subjects).toEqual(rows.subjects);
    expect(result.academicYears).toEqual(rows.academic_years);
    expect(result.branches).toEqual(rows.branches);
    expect(result.departments).toEqual(rows.departments);
    expect(result.generatedAt).toBeTruthy();

    expect(schoolService.updateSchoolSettings).toHaveBeenCalledWith(
      "school-1",
      "backup",
      expect.objectContaining({ frequency: "weekly", lastExportAt: expect.any(String) })
    );
  });

  it("throws if any table query errors", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "students") return chain({ data: null, error: { message: "boom" } });
      return chain({ data: [], error: null });
    });

    await expect(exportSchoolData("school-1")).rejects.toThrow(/students/);
  });
});
