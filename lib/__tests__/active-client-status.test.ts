import { describe, expect, it } from "vitest";

import {
  ACTIVE_CLIENT_STATUSES,
  ACTIVE_CLIENT_STATUS_FILTER,
  isActiveClientStatus,
} from "@/lib/active-client-status";

describe("isActiveClientStatus", () => {
  it.each(["Active", "active"])("treats %s as active", (status) => {
    expect(isActiveClientStatus(status)).toBe(true);
  });

  it("treats a missing or blank status as active for legacy rows", () => {
    expect(isActiveClientStatus(undefined)).toBe(true);
    expect(isActiveClientStatus(null)).toBe(true);
    expect(isActiveClientStatus("")).toBe(true);
    expect(isActiveClientStatus("   ")).toBe(true);
  });

  it.each(["Draft", "draft", "Archived", "archived", "Prospect"])(
    "rejects %s",
    (status) => {
      expect(isActiveClientStatus(status)).toBe(false);
    },
  );

  it("keeps the Prisma filter aligned with the client helper", () => {
    expect(ACTIVE_CLIENT_STATUS_FILTER).toEqual({
      in: [...ACTIVE_CLIENT_STATUSES],
    });
  });
});
