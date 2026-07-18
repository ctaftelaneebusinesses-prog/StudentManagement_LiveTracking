import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "../config/supabase";
import { getDashboard, listStudentsForClass } from "./teacherPortal.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
});

describe("getDashboard", () => {
  it("merges class_subjects assignments with homeroom classes and counts students per class", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "class_subjects") {
        return chain({
          data: [
            {
              class_id: "class-1",
              classes: { id: "class-1", name: "Grade 8", section: "A", school_id: "school-1" },
              subject_id: "subject-math",
              subjects: { id: "subject-math", name: "Math", code: "MTH" },
            },
            {
              class_id: "class-1",
              classes: { id: "class-1", name: "Grade 8", section: "A", school_id: "school-1" },
              subject_id: "subject-sci",
              subjects: { id: "subject-sci", name: "Science", code: "SCI" },
            },
          ],
          error: null,
        });
      }
      if (table === "classes") {
        return chain({ data: [{ id: "class-2", name: "Grade 9", section: "B" }], error: null });
      }
      if (table === "students") {
        return chain({
          data: [{ class_id: "class-1" }, { class_id: "class-1" }, { class_id: "class-2" }],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await getDashboard("school-1", "teacher-1");

    expect(result.totalClasses).toBe(2);
    expect(result.totalSubjects).toBe(2);
    expect(result.totalStudents).toBe(3);

    const class1 = result.classes.find((c) => c.id === "class-1")!;
    expect(class1.isHomeroom).toBe(false);
    expect(class1.subjects).toHaveLength(2);
    expect(class1.studentCount).toBe(2);

    const class2 = result.classes.find((c) => c.id === "class-2")!;
    expect(class2.isHomeroom).toBe(true);
    expect(class2.subjects).toHaveLength(0);
    expect(class2.studentCount).toBe(1);
  });

  it("marks a class as homeroom even when the teacher also teaches a subject there", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "class_subjects") {
        return chain({
          data: [
            {
              class_id: "class-1",
              classes: { id: "class-1", name: "Grade 8", section: "A", school_id: "school-1" },
              subject_id: "subject-math",
              subjects: { id: "subject-math", name: "Math", code: "MTH" },
            },
          ],
          error: null,
        });
      }
      if (table === "classes") {
        return chain({ data: [{ id: "class-1", name: "Grade 8", section: "A" }], error: null });
      }
      if (table === "students") {
        return chain({ data: [], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await getDashboard("school-1", "teacher-1");

    expect(result.classes).toHaveLength(1);
    expect(result.classes[0].isHomeroom).toBe(true);
    expect(result.classes[0].subjects).toHaveLength(1);
  });

  it("returns an empty dashboard for a teacher with no assignments", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "class_subjects") return chain({ data: [], error: null });
      if (table === "classes") return chain({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });

    const result = await getDashboard("school-1", "teacher-1");
    expect(result).toEqual({ classes: [], totalClasses: 0, totalSubjects: 0, totalStudents: 0 });
    // No classes means the student-count lookup should be skipped entirely.
    expect(fromMock).not.toHaveBeenCalledWith("students");
  });
});

describe("listStudentsForClass", () => {
  it("queries students scoped to the school and class", async () => {
    const rows = [{ id: "student-1", admission_no: "A001" }];
    fromMock.mockImplementation(() => chain({ data: rows, error: null }));

    const result = await listStudentsForClass("school-1", "class-1");
    expect(result).toEqual(rows);
    expect(fromMock).toHaveBeenCalledWith("students");
  });
});
