import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));

import { supabaseAdmin } from "../config/supabase";
import { saveSubscription, removeSubscriptionForUser } from "./push.service";

const fromMock = (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from;

beforeEach(() => vi.clearAllMocks());

const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p", auth: "a" } };

describe("saveSubscription — SEC-14 ownership", () => {
  it("rejects taking over an endpoint already owned by another user", async () => {
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { user_id: "other-user" }, error: null }) }) }),
      upsert: vi.fn(),
    });
    await expect(saveSubscription("me", "school-1", sub)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows re-subscribing an endpoint the same user already owns", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { user_id: "me" }, error: null }) }) }),
      upsert,
    });
    await expect(saveSubscription("me", "school-1", sub)).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("allows a brand-new endpoint", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      upsert,
    });
    await expect(saveSubscription("me", "school-1", sub)).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

describe("removeSubscriptionForUser — SEC-14 isolation", () => {
  it("scopes the delete to BOTH endpoint and the caller's user_id", async () => {
    const eqCalls: unknown[][] = [];
    const chainObj: Record<string, unknown> = {};
    chainObj.eq = (...args: unknown[]) => { eqCalls.push(args); return chainObj; };
    // resolve when awaited (delete().eq().eq())
    (chainObj as { then: unknown }).then = (res: (v: unknown) => void) => res({ error: null });
    fromMock.mockReturnValue({ delete: () => chainObj });

    await removeSubscriptionForUser("me", sub.endpoint);
    expect(eqCalls).toContainEqual(["endpoint", sub.endpoint]);
    expect(eqCalls).toContainEqual(["user_id", "me"]);
  });
});
