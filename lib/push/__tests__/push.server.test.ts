import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sender.
 *
 * Three behaviours are load-bearing and easy to break:
 *  - a notification type with no push design sends nothing (the allowlist lives here);
 *  - a PORTAL subscription gets a portal route, a DASHBOARD one keeps the stored href;
 *  - a 410 prunes the row, while any other failure only counts.
 */

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  prisma: {
    pushSubscription: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    client: { findMany: vi.fn() },
  },
}));

vi.mock("web-push", () => ({
  default: {
    sendNotification: mocks.sendNotification,
    setVapidDetails: mocks.setVapidDetails,
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

import { sendPushToUsers } from "@/lib/push/push.server";

const PORTAL_ENDPOINT = "https://push.test/portal-device";
const DASHBOARD_ENDPOINT = "https://push.test/desktop";

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: DASHBOARD_ENDPOINT,
    p256dh: "p256dh-key-value-1234",
    auth: "auth-key-value-5678",
    surface: "dashboard",
    clientId: null,
    preferences: null,
    ...overrides,
  };
}

function sentPayload(callIndex = 0) {
  return JSON.parse(mocks.sendNotification.mock.calls[callIndex][1] as string);
}

function sentOptions(callIndex = 0) {
  return mocks.sendNotification.mock.calls[callIndex][2] as Record<string, unknown>;
}

beforeAll(() => {
  // Must be set before the first send: the VAPID configuration is resolved once per process.
  vi.stubEnv("VAPID_PUBLIC_KEY", "public-key");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@plantel.pro");
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendNotification.mockResolvedValue({ statusCode: 201 });
  mocks.prisma.pushSubscription.findMany.mockResolvedValue([]);
  mocks.prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.pushSubscription.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.client.findMany.mockResolvedValue([{ id: "plan_1", slug: "acme" }]);
});

describe("sendPushToUsers", () => {
  it("sends nothing for a notification type it has no push design for", async () => {
    await sendPushToUsers({
      userIds: ["user_1"],
      title: "A teammate joined",
      type: "team_member_accepted",
    });

    // Returns before touching the database OR the VAPID configuration.
    expect(mocks.prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("does nothing when the recipient has no registered browser", async () => {
    await sendPushToUsers({
      userIds: ["user_1"],
      title: "New message",
      type: "direct_message",
    });

    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("routes a portal subscriber to the portal page for the thread", async () => {
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([
      subscription({
        endpoint: PORTAL_ENDPOINT,
        surface: "portal",
        clientId: "plan_1",
      }),
    ]);

    await sendPushToUsers({
      userIds: ["user_1"],
      title: "A reply on Group Health",
      body: "Can you confirm the deductible?",
      type: "comment_reply",
      href: "/edit-benefit/plan_1/group-health?comment=thread_9",
    });

    expect(sentPayload()).toMatchObject({
      title: "A reply on Group Health",
      url: "/acme/health-insurance?comment=thread_9",
    });
  });

  it("leaves a dashboard subscriber on the stored href", async () => {
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([subscription()]);

    await sendPushToUsers({
      userIds: ["user_1"],
      title: "New messages from Dana",
      type: "direct_message",
      href: "/?messages=thread_9",
    });

    expect(sentPayload().url).toBe("/?messages=thread_9");
  });

  it("refuses a destination that is not a same-origin path", async () => {
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([subscription()]);

    await sendPushToUsers({
      userIds: ["user_1"],
      title: "New messages",
      type: "direct_message",
      href: "https://evil.test/phish",
    });

    // The worker refuses this too; the sender must not be the weaker of the two.
    expect(sentPayload().url).toBe("/dashboard");
  });

  it("collapses a conversation with the thread id as tag and topic", async () => {
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([subscription()]);

    await sendPushToUsers({
      userIds: ["user_1"],
      title: "New messages",
      type: "direct_message",
      href: "/?messages=thread_9",
    });

    expect(sentPayload()).toMatchObject({ tag: "thread_9", topic: "thread_9" });
    expect(sentOptions().topic).toBe("thread_9");
    expect(sentOptions().TTL).toBeGreaterThan(0);
  });

  it("skips a device whose reader switched that category off", async () => {
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([
      subscription({ preferences: { comment: false } }),
    ]);

    await sendPushToUsers({
      userIds: ["user_1"],
      title: "A reply",
      type: "comment_reply",
      href: "/edit-client/plan_1?comment=thread_9",
    });

    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("prunes an endpoint the push service reports as gone", async () => {
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([subscription()]);
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error("gone"), { statusCode: 410 }),
    );

    await sendPushToUsers({
      userIds: ["user_1"],
      title: "New messages",
      type: "direct_message",
    });

    expect(mocks.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: [DASHBOARD_ENDPOINT] } },
    });
  });

  it("keeps the row and counts the failure for any other error", async () => {
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([subscription()]);
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error("boom"), { statusCode: 500 }),
    );

    await sendPushToUsers({
      userIds: ["user_1"],
      title: "New messages",
      type: "direct_message",
    });

    // Dropping a healthy device over one bad minute would silently unsubscribe the reader.
    expect(mocks.prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { endpoint: DASHBOARD_ENDPOINT },
      data: { failureCount: { increment: 1 } },
    });
  });

  it("never throws into the write that triggered it", async () => {
    mocks.prisma.pushSubscription.findMany.mockRejectedValue(
      new Error("database is down"),
    );

    await expect(
      sendPushToUsers({
        userIds: ["user_1"],
        title: "New messages",
        type: "direct_message",
      }),
    ).resolves.toBeUndefined();
  });
});
