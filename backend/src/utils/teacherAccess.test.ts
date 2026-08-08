import { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "../config/supabase";
import {
  assertTeacherOwnsClass,
  assertTeacherOwnsClassSubject,
  assertTeacherOwnsExam,
  assertOwnHomeworkOrStaff,
  assertIsClassTeacher,
  requireStudentWriteAccess,
} from "./teacherAccess";

function fakeReq(roles: string[], id = "teacher-1"): Request {
  return {
    user: { id, email: "t@example.com", schoolId: "school-1", roleId: 3, roleName: roles[0], roles, permissions: [] },
  } as unknown as Request;
}

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
});

describe("assertTeacherOwnsClass", () => {
  it("bypasses the ownership check for staff roles without querying the DB", async () => {
    await expect(assertTeacherOwnsClass(fakeReq(["school_admin"]), "class-1")).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects a caller who holds neither a staff role nor teacher", async () => {
    await expect(assertTeacherOwnsClass(fakeReq(["accountant"]), "class-1")).rejects.toThrow(ApiError);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows a teacher who is the homeroom teacher for the class", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "classes") return chain({ data: { id: "class-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    await expect(assertTeacherOwnsClass(fakeReq(["teacher"]), "class-1")).resolves.toBeUndefined();
  });

  it("allows a teacher with a matching class_subjects assignment", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "classes") return chain({ data: null, error: null });
      if (table === "class_subjects") return chain({ data: { id: "cs-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    await expect(assertTeacherOwnsClass(fakeReq(["teacher"]), "class-1")).resolves.toBeUndefined();
  });

  it("rejects a teacher with no homeroom or class_subjects row for the class", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "classes") return chain({ data: null, error: null });
      if (table === "class_subjects") return chain({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    await expect(assertTeacherOwnsClass(fakeReq(["teacher"]), "class-1")).rejects.toThrow(ApiError);
  });
});

describe("assertTeacherOwnsClassSubject", () => {
  it("bypasses for staff", async () => {
    await expect(
      assertTeacherOwnsClassSubject(fakeReq(["principal"]), "class-1", "subject-1")
    ).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows a teacher with a matching class_subjects row", async () => {
    fromMock.mockImplementation(() => chain({ data: { id: "cs-1" }, error: null }));
    await expect(
      assertTeacherOwnsClassSubject(fakeReq(["teacher"]), "class-1", "subject-1")
    ).resolves.toBeUndefined();
  });

  it("rejects a teacher who does not teach that subject in that class", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: null }));
    await expect(assertTeacherOwnsClassSubject(fakeReq(["teacher"]), "class-1", "subject-1")).rejects.toThrow(
      ApiError
    );
  });
});

describe("assertTeacherOwnsExam", () => {
  it("looks up the exam's class then delegates to assertTeacherOwnsClass", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "exams") return chain({ data: { class_id: "class-1" }, error: null });
      if (table === "classes") return chain({ data: { id: "class-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    await expect(assertTeacherOwnsExam(fakeReq(["teacher"]), "exam-1")).resolves.toBe("class-1");
  });

  it("throws not-found when the exam does not exist", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: null }));
    await expect(assertTeacherOwnsExam(fakeReq(["teacher"]), "exam-missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("assertOwnHomeworkOrStaff", () => {
  it("bypasses for staff", async () => {
    await expect(assertOwnHomeworkOrStaff(fakeReq(["school_admin"]), "hw-1")).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows the teacher who created the homework", async () => {
    fromMock.mockImplementation(() => chain({ data: { teacher_id: "teacher-1" }, error: null }));
    await expect(assertOwnHomeworkOrStaff(fakeReq(["teacher"], "teacher-1"), "hw-1")).resolves.toBeUndefined();
  });

  it("rejects a teacher who did not create the homework and is not its class teacher", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "homework") return chain({ data: { teacher_id: "someone-else", class_id: "class-1" }, error: null });
      if (table === "classes") return chain({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    await expect(assertOwnHomeworkOrStaff(fakeReq(["teacher"], "teacher-1"), "hw-1")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("throws not-found when the homework does not exist", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: null }));
    await expect(assertOwnHomeworkOrStaff(fakeReq(["teacher"]), "hw-missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("allows the class teacher to manage homework they didn't create", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "homework") return chain({ data: { teacher_id: "subject-teacher", class_id: "class-1" }, error: null });
      if (table === "classes") return chain({ data: { id: "class-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    await expect(assertOwnHomeworkOrStaff(fakeReq(["teacher"], "class-teacher-1"), "hw-1")).resolves.toBeUndefined();
  });

  it("rejects a subject teacher of the class who is neither the creator nor the class teacher", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "homework") return chain({ data: { teacher_id: "subject-teacher", class_id: "class-1" }, error: null });
      if (table === "classes") return chain({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    await expect(assertOwnHomeworkOrStaff(fakeReq(["teacher"], "other-teacher"), "hw-1")).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe("assertIsClassTeacher", () => {
  it("bypasses for staff without querying the DB", async () => {
    await expect(assertIsClassTeacher(fakeReq(["school_admin"]), "class-1")).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows the class's homeroom teacher", async () => {
    fromMock.mockImplementation(() => chain({ data: { id: "class-1" }, error: null }));
    await expect(assertIsClassTeacher(fakeReq(["teacher"], "class-teacher-1"), "class-1")).resolves.toBeUndefined();
  });

  it("rejects a subject teacher of the class who is not its class teacher", async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: null }));
    await expect(assertIsClassTeacher(fakeReq(["teacher"], "subject-teacher-1"), "class-1")).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe("requireStudentWriteAccess", () => {
  it("calls next() with no error for staff, without querying the DB", async () => {
    const req = { ...fakeReq(["school_admin"]), method: "POST", body: { class_id: "class-1" }, params: {} };
    const next = vi.fn();
    await requireStudentWriteAccess(req as unknown as Request, {} as never, next);
    expect(next).toHaveBeenCalledWith();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows a teacher creating a student in a class they own", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "classes") return chain({ data: { id: "class-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const req = { ...fakeReq(["teacher"]), method: "POST", body: { class_id: "class-1" }, params: {} };
    const next = vi.fn();
    await requireStudentWriteAccess(req as unknown as Request, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a teacher creating a student in a class they don't own", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "classes") return chain({ data: null, error: null });
      if (table === "class_subjects") return chain({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const req = { ...fakeReq(["teacher"]), method: "POST", body: { class_id: "class-1" }, params: {} };
    const next = vi.fn();
    await requireStudentWriteAccess(req as unknown as Request, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("allows a teacher updating a student already in their class, resolved from the DB", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "students") return chain({ data: { class_id: "class-1" }, error: null });
      if (table === "classes") return chain({ data: { id: "class-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const req = { ...fakeReq(["teacher"]), method: "PATCH", body: { phone: "12345" }, params: { id: "student-1" } };
    const next = vi.fn();
    await requireStudentWriteAccess(req as unknown as Request, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a teacher trying to move a student to a different class via update", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "students") return chain({ data: { class_id: "class-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const req = {
      ...fakeReq(["teacher"]),
      method: "PATCH",
      body: { class_id: "class-2" },
      params: { id: "student-1" },
    };
    const next = vi.fn();
    await requireStudentWriteAccess(req as unknown as Request, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("rejects a non-teacher, non-staff caller outright", async () => {
    const req = { ...fakeReq(["accountant"]), method: "POST", body: { class_id: "class-1" }, params: {} };
    const next = vi.fn();
    await requireStudentWriteAccess(req as unknown as Request, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(fromMock).not.toHaveBeenCalled();
  });
});
