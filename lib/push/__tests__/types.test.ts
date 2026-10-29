import { describe, expect, it } from "vitest";

import {
  isCategoryEnabled,
  isPushCategory,
  isPushSurface,
  pushCategoryForType,
} from "@/lib/push/types";

/**
 * The bridge between a notification's TYPE and the switch that governs it.
 *
 * The header bell distinguishes four comment events; Settings offers one "Comments" switch. If this
 * mapping drifts, a reader turns comments off and still gets three of the four kinds — a silent
 * failure of the only control they have.
 */
describe("pushCategoryForType", () => {
  it("maps the direct-message type to its own category", () => {
    expect(pushCategoryForType("direct_message")).toBe("direct_message");
  });

  it("maps every comment event to the comments switch", () => {
    expect(pushCategoryForType("comment_thread_created")).toBe("comment");
    expect(pushCategoryForType("comment_reply")).toBe("comment");
    expect(pushCategoryForType("comment_mention")).toBe("comment");
  });

  it("separates an assigned task from the conversation it came from", () => {
    // Work handed to you is not chatter, and the plan gives it its own type for that reason.
    expect(pushCategoryForType("comment_task_assigned")).toBe("task");
  });

  it("returns null for notification types with no push design", () => {
    // The first release is comments and DMs only. The sender treats null as "do not push", so this
    // is what keeps the team/ownership events out of the tray.
    expect(pushCategoryForType("team_member_accepted")).toBeNull();
    expect(pushCategoryForType("profile_self_deleted")).toBeNull();
    expect(pushCategoryForType("organization_ownership_transferred")).toBeNull();
    expect(pushCategoryForType(null)).toBeNull();
    expect(pushCategoryForType("")).toBeNull();
  });
});

describe("isCategoryEnabled", () => {
  it("treats a missing key as enabled", () => {
    // Every row written before preferences existed has no stored value, and it must keep delivering.
    expect(isCategoryEnabled(null, "comment")).toBe(true);
    expect(isCategoryEnabled({}, "comment")).toBe(true);
    expect(isCategoryEnabled({ direct_message: false }, "comment")).toBe(true);
  });

  it("honours an explicit opt-out", () => {
    expect(isCategoryEnabled({ comment: false }, "comment")).toBe(false);
  });

  it("never silences a type that has no switch", () => {
    expect(isCategoryEnabled({ comment: false }, null)).toBe(true);
  });
});

describe("guards", () => {
  it("accepts only the two known surfaces", () => {
    expect(isPushSurface("portal")).toBe(true);
    expect(isPushSurface("dashboard")).toBe(true);
    expect(isPushSurface("mobile")).toBe(false);
    expect(isPushSurface(null)).toBe(false);
  });

  it("accepts only the known categories", () => {
    expect(isPushCategory("direct_message")).toBe(true);
    expect(isPushCategory("comment")).toBe(true);
    expect(isPushCategory("task")).toBe(true);
    expect(isPushCategory("marketing")).toBe(false);
  });
});
