import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("../utils/scopeGuards", () => ({
  assertClassInSchool: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./notification.service", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  notifyUsers: vi.fn().mockResolvedValue([]),
  resolveClassUserIds: vi.fn().mockResolvedValue([]),
}));
vi.mock("./push.service", () => ({
  sendToUserIds: vi.fn().mockResolvedValue(undefined),
}));

import { supabaseAdmin } from "../config/supabase";
import * as notificationService from "./notification.service";
import { createHomework, updateHomework } from "./homework.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => {
  fromMock.mockReset();
  vi.clearAllMocks();
});

const baseInput = { class_id: "class-1", title: "Chapter 4 problems", due_date: "2026-02-01" };

describe("createHomework", () => {
  it("auto-approves and publishes when the creator is the class's homeroom teacher", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "classes") return chain({ data: { id: "class-1", class_teacher_id: "teacher-1" }, error: null });
      if (table === "homework") {
        return chain({
          data: { id: "hw-1", class_id: "class-1", title: baseInput.title, due_date: baseInput.due_date, status: "approved", classes: null, subjects: null, users: null },
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await createHomework("school-1", "teacher-1", baseInput);

    expect(result).toMatchObject({ status: "approved" });
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      "school-1",
      "teacher-1",
      expect.objectContaining({ audience_scope: "class" })
    );
    expect(notificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it("stays pending and notifies the class teacher when the creator is a different subject teacher", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "classes") return chain({ data: { id: "class-1", class_teacher_id: "class-teacher-1" }, error: null });
      if (table === "homework") {
        return chain({
          data: { id: "hw-1", class_id: "class-1", title: baseInput.title, due_date: baseInput.due_date, status: "pending", classes: null, subjects: null, users: null },
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await createHomework("school-1", "subject-teacher-1", baseInput);

    expect(result).toMatchObject({ status: "pending" });
    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(notificationService.notifyUsers).toHaveBeenCalledWith(
      "school-1",
      "subject-teacher-1",
      ["class-teacher-1"],
      expect.objectContaining({ title: "Homework awaiting your review" })
    );
  });
});

describe("updateHomework", () => {
  it("resubmits (needs_changes -> pending) when a non-class-teacher edits it", async () => {
    const updateSpy = vi.fn(() => chain({ data: { id: "hw-1" }, error: null }));
    fromMock.mockImplementation((table: string) => {
      if (table === "homework") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { class_id: "class-1", status: "needs_changes" }, error: null }),
              })),
            })),
          })),
          update: updateSpy,
        };
      }
      if (table === "classes") return chain({ data: { id: "class-1", class_teacher_id: "class-teacher-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await updateHomework("school-1", "hw-1", "subject-teacher-1", { title: "Revised title" });

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Revised title", status: "pending", review_note: null }));
  });

  it("does not force resubmission when the class teacher edits their own approved homework", async () => {
    const updateSpy = vi.fn(() => chain({ data: { id: "hw-1" }, error: null }));
    fromMock.mockImplementation((table: string) => {
      if (table === "homework") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { class_id: "class-1", status: "approved" }, error: null }),
              })),
            })),
          })),
          update: updateSpy,
        };
      }
      if (table === "classes") return chain({ data: { id: "class-1", class_teacher_id: "class-teacher-1" }, error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await updateHomework("school-1", "hw-1", "class-teacher-1", { title: "Tweaked" });

    expect(updateSpy).toHaveBeenCalledWith(expect.not.objectContaining({ status: expect.anything() }));
  });
});
