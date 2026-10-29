import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, PATCH, POST } from "../route";

/**
 * `/api/push/subscribe`.
 *
 * The rule under test throughout: every write is scoped to the SESSION user, and a POST always
 * rebinds the endpoint to the caller. An endpoint is a bearer capability, so a caller who knows
 * somebody else's must not be able to move it, read it back, or unregister the device.
 */

const mocks = vi.hoisted(() => ({
  getOrgSession: vi.fn(),
  prisma: {
    client: { findFirst: vi.fn() },
    pushSubscription: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/organization-session", () => ({
  getOrgSession: mocks.getOrgSession,
}));

vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123:def";
const P256DH =
  "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
const AUTH = "tBHItJI5svbpez7KI4CCXg";

function postRequest(body: unknown) {
  return new NextRequest(new URL("/api/push/subscribe", "http://localhost"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": "TestAgent/1" },
    body: JSON.stringify(body),
  });
}

function jsonRequest(method: "DELETE" | "PATCH", body: unknown) {
  return new NextRequest(new URL("/api/push/subscribe", "http://localhost"), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  endpoint: ENDPOINT,
  keys: { p256dh: P256DH, auth: AUTH },
  surface: "dashboard",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrgSession.mockResolvedValue({
    userId: "user_1",
    organizationId: "org_1",
  });
  mocks.prisma.client.findFirst.mockResolvedValue(null);
  mocks.prisma.pushSubscription.upsert.mockResolvedValue({});
  mocks.prisma.pushSubscription.findFirst.mockResolvedValue(null);
  mocks.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.pushSubscription.updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/push/subscribe", () => {
  it("refuses an anonymous caller", async () => {
    mocks.getOrgSession.mockResolvedValue(null);
    const response = await POST(postRequest(validBody));
    expect(response.status).toBe(401);
    expect(mocks.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it("requires an endpoint and both keys", async () => {
    const response = await POST(
      postRequest({ endpoint: ENDPOINT, keys: { p256dh: P256DH } }),
    );
    expect(response.status).toBe(400);
    expect(mocks.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it("binds the endpoint to the session user and records the user agent", async () => {
    const response = await POST(postRequest(validBody));
    expect(response.status).toBe(200);

    const args = mocks.prisma.pushSubscription.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ endpoint: ENDPOINT });
    expect(args.create).toMatchObject({
      endpoint: ENDPOINT,
      userId: "user_1",
      surface: "dashboard",
      clientId: null,
      userAgent: "TestAgent/1",
    });
    // A save proves the endpoint works, so a previous failure streak must not survive it.
    expect(args.update.failureCount).toBe(0);
  });

  it("resolves a portal plan slug to a client id", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: "plan_1" });

    await POST(
      postRequest({ ...validBody, surface: "portal", planSlug: "acme" }),
    );

    expect(mocks.prisma.client.findFirst).toHaveBeenCalled();
    expect(
      mocks.prisma.pushSubscription.upsert.mock.calls[0][0].create,
    ).toMatchObject({ surface: "portal", clientId: "plan_1" });
  });

  it("clears the plan for a dashboard opt-in", async () => {
    // Otherwise a subscription made from the dashboard would look like it belongs to a portal and
    // receive portal-deep-linked notifications.
    await POST(
      postRequest({ ...validBody, surface: "dashboard", planSlug: "acme" }),
    );

    expect(
      mocks.prisma.pushSubscription.upsert.mock.calls[0][0].create,
    ).toMatchObject({ surface: "dashboard", clientId: null });
  });

  it("falls back to the dashboard surface for an unknown value", async () => {
    await POST(postRequest({ ...validBody, surface: "mobile" }));

    expect(
      mocks.prisma.pushSubscription.upsert.mock.calls[0][0].create,
    ).toMatchObject({ surface: "dashboard" });
  });
});

describe("GET /api/push/subscribe", () => {
  function getRequest(query: string) {
    return new NextRequest(
      new URL(`/api/push/subscribe${query}`, "http://localhost"),
    );
  }

  it("rejects a missing endpoint", async () => {
    const response = await GET(getRequest(""));
    expect(response.status).toBe(400);
  });

  it("answers not-subscribed when this browser has no row", async () => {
    const response = await GET(getRequest(`?endpoint=${ENDPOINT}`));
    const body = await response.json();

    expect(body).toMatchObject({ success: true, subscribed: false });
    expect(mocks.prisma.pushSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: ENDPOINT, userId: "user_1" },
      }),
    );
  });

  it("returns the stored preferences so the switches paint correctly", async () => {
    mocks.prisma.pushSubscription.findFirst.mockResolvedValue({
      surface: "portal",
      clientId: "plan_1",
      preferences: { comment: false },
    });

    const body = await (
      await GET(getRequest(`?endpoint=${ENDPOINT}`))
    ).json();

    expect(body).toMatchObject({
      subscribed: true,
      surface: "portal",
      preferences: { comment: false },
    });
  });
});

describe("DELETE /api/push/subscribe", () => {
  it("scopes the delete to the caller", async () => {
    const response = await DELETE(
      jsonRequest("DELETE", { endpoint: ENDPOINT }),
    );
    expect(response.status).toBe(200);

    expect(mocks.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT, userId: "user_1" },
    });
  });

  it("reports when nothing matched", async () => {
    mocks.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 0 });
    const body = await (
      await DELETE(jsonRequest("DELETE", { endpoint: ENDPOINT }))
    ).json();

    expect(body).toMatchObject({ success: true, removed: false });
  });
});

describe("PATCH /api/push/subscribe", () => {
  it("stores only the categories it recognises", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", {
        endpoint: ENDPOINT,
        preferences: { comment: false, direct_message: true, nonsense: false },
      }),
    );
    expect(response.status).toBe(200);

    // Only an explicit `false` is stored: `true` is the default, and freezing today's defaults into
    // the row would make a future default change silently ineffective.
    expect(mocks.prisma.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT, userId: "user_1" },
      data: { preferences: { comment: false } },
    });
  });

  it("refuses a body of nothing but unknown keys", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", {
        endpoint: ENDPOINT,
        preferences: { nonsense: false },
      }),
    );

    // A contract mismatch must be loud, not an accidental wipe of the reader's opt-outs.
    expect(response.status).toBe(400);
    expect(mocks.prisma.pushSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("refuses without an endpoint", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", { preferences: { comment: false } }),
    );
    expect(response.status).toBe(400);
  });
});
