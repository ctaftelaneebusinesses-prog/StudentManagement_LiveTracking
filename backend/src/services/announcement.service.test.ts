import { beforeEach, describe, expect, it, vi } from "vitest";
import { chain } from "../test-support/supabaseChain";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { from: vi.fn(), storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn(), remove: vi.fn() })) } },
}));

vi.mock("./push.service", () => ({
  sendToUserIds: vi.fn().mockResolvedValue(undefined),
}));

import { supabaseAdmin } from "../config/supabase";
import * as pushService from "./push.service";
import { publishAnnouncement, listDueScheduled } from "./announcement.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

const USERS = [{ id: "user-1" }, { id: "user-2" }];
const STUDENTS = [
  { id: "student-1", class_id: "class-1" },
  { id: "student-2", class_id: "class-2" },
];
const ANNOUNCEMENT_CLASSES = [{ class_id: "class-1" }];

let insertedNotifications: unknown[] = [];
let updatedAnnouncementPatch: unknown = null;

function mockTables() {
  insertedNotifications = [];
  updatedAnnouncementPatch = null;

  fromMock.mockImplementation((table: string) => {
    if (table === "users") return chain({ data: USERS, error: null });
    if (table === "students") return chain({ data: STUDENTS, error: null });
    if (table === "announcement_classes") return chain({ data: ANNOUNCEMENT_CLASSES, error: null });
    if (table === "notifications") {
      const builder = chain({ data: null, error: null });
      const originalInsert = builder.insert as ReturnType<typeof vi.fn>;
      builder.insert = vi.fn((rows: unknown) => {
        insertedNotifications = rows as unknown[];
        return originalInsert(rows);
      });
      return builder;
    }
    if (table === "announcements") {
      const builder = chain({ data: [], error: null });
      const originalUpdate = builder.update as ReturnType<typeof vi.fn>;
      builder.update = vi.fn((patch: unknown) => {
        updatedAnnouncementPatch = patch;
        return originalUpdate(patch);
      });
      return builder;
    }
    return chain({ data: [], error: null });
  });
}

beforeEach(() => {
  fromMock.mockReset();
  vi.mocked(pushService.sendToUserIds).mockClear();
});

describe("publishAnnouncement", () => {
  it("fans out a single school-wide notification and pushes to every user for audience_type 'all'", async () => {
    mockTables();

    await publishAnnouncement("school-1", {
      id: "ann-1",
      title: "School closed",
      body: "<p>School is <strong>closed</strong> tomorrow.</p>",
      audience_type: "all",
    });

    expect(insertedNotifications).toEqual([
      expect.objectContaining({
        school_id: "school-1",
        audience_scope: "school",
        audience_class_id: null,
        audience_role: null,
        related_announcement_id: "ann-1",
        message: "School is closed tomorrow.",
      }),
    ]);
    expect(pushService.sendToUserIds).toHaveBeenCalledWith(
      expect.arrayContaining(["user-1", "user-2"]),
      expect.objectContaining({ title: "School closed" })
    );
    expect(updatedAnnouncementPatch).toEqual(expect.objectContaining({ notified_at: expect.any(String) }));
  });

  it("resolves a role-scoped notification for 'teachers'", async () => {
    mockTables();

    await publishAnnouncement("school-1", {
      id: "ann-2",
      title: "Staff meeting",
      body: "Meeting at 4pm.",
      audience_type: "teachers",
    });

    expect(insertedNotifications).toEqual([
      expect.objectContaining({ audience_scope: "role", audience_role: "teacher", related_announcement_id: "ann-2" }),
    ]);
  });

  it("fans out one notification per selected class and pushes to the students in it", async () => {
    mockTables();

    await publishAnnouncement("school-1", {
      id: "ann-3",
      title: "Field trip",
      body: "Permission slips due Friday.",
      audience_type: "classes",
    });

    expect(insertedNotifications).toEqual([
      expect.objectContaining({ audience_scope: "class", audience_class_id: "class-1" }),
    ]);
    expect(pushService.sendToUserIds).toHaveBeenCalledWith(expect.arrayContaining(["student-1"]), expect.anything());
  });
});

describe("listDueScheduled", () => {
  it("returns announcements whose publish_at has passed and haven't been notified yet", async () => {
    fromMock.mockImplementation(() =>
      chain({ data: [{ id: "ann-4", school_id: "school-1", title: "t", body: "b", audience_type: "all", publish_at: "2020-01-01T00:00:00Z", notified_at: null }], error: null })
    );

    const result = await listDueScheduled();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ann-4");
  });
});
