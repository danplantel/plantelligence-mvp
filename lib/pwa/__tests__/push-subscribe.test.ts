import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Subscribing when a subscription ALREADY exists.
 *
 * A `PushSubscription` outlives the VAPID pair that created it. Re-posting a stale one stores a row
 * the push service will reject with 403 forever, and the UI then reports "registered" for a device
 * that can never receive anything. These tests pin the three behaviours that prevent that:
 *
 *  1. a subscription made with the CURRENT key is reused, keeping its endpoint stable;
 *  2. one made with a DIFFERENT key is replaced, and the superseded server row is dropped;
 *  3. such a subscription is not reported as "subscribed", so the UI offers the button that repairs it.
 */

const CURRENT_KEY = `B${"A".repeat(86)}`;
const OTHER_KEY = `C${"A".repeat(86)}`;
const OLD_ENDPOINT = "https://push.test/old";
const NEW_ENDPOINT = "https://push.test/new";

function decode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function fakeSubscription(key: string, endpoint: string) {
  const bytes = decode(key);
  return {
    endpoint,
    options: {
      userVisibleOnly: true,
      applicationServerKey: bytes.buffer as ArrayBuffer,
    },
    toJSON: () => ({
      endpoint,
      keys: { p256dh: "p".repeat(40), auth: "a".repeat(20) },
    }),
    unsubscribe: vi.fn(async () => true),
  };
}

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
  register: vi.fn(),
  getRegistration: vi.fn(),
}));

const registration = {
  scope: "/",
  pushManager: {
    getSubscription: mocks.getSubscription,
    subscribe: mocks.subscribe,
  },
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", CURRENT_KEY);

  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

  vi.stubGlobal(
    "Notification",
    Object.assign(function Notification() {}, {
      permission: "granted",
      requestPermission: vi.fn(async () => "granted"),
    }),
  );
  vi.stubGlobal("PushManager", function PushManager() {});

  mocks.register.mockResolvedValue(registration);
  mocks.getRegistration.mockResolvedValue(registration);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: mocks.register,
      getRegistration: mocks.getRegistration,
    },
  });
});

async function loadPushModule() {
  return import("@/lib/pwa/push");
}

describe("subscribeToPush with an existing subscription", () => {
  it("reuses a subscription created with the current key", async () => {
    const existing = fakeSubscription(CURRENT_KEY, OLD_ENDPOINT);
    mocks.getSubscription.mockResolvedValue(existing);

    const push = await loadPushModule();
    const result = await push.subscribeToPush({ surface: "dashboard" });

    expect(result).toEqual({ ok: true });
    // No churn: the endpoint survives a repeat tap.
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(existing.unsubscribe).not.toHaveBeenCalled();

    const [url, init] = mocks.fetch.mock.calls[0];
    expect(String(url)).toContain("/api/push/subscribe");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ endpoint: OLD_ENDPOINT });
  });

  it("replaces a subscription created with a different key", async () => {
    const stale = fakeSubscription(OTHER_KEY, OLD_ENDPOINT);
    mocks.getSubscription.mockResolvedValue(stale);
    mocks.subscribe.mockResolvedValue(fakeSubscription(CURRENT_KEY, NEW_ENDPOINT));

    const push = await loadPushModule();
    const result = await push.subscribeToPush({ surface: "dashboard" });

    expect(result).toEqual({ ok: true });
    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);

    // The new endpoint is recorded...
    const post = mocks.fetch.mock.calls.find(
      ([, init]) => init?.method === "POST",
    );
    expect(JSON.parse(post![1].body)).toMatchObject({ endpoint: NEW_ENDPOINT });

    // ...and the superseded row is forgotten, so it cannot linger as an unreachable device.
    const del = mocks.fetch.mock.calls.find(
      ([, init]) => init?.method === "DELETE",
    );
    expect(del).toBeDefined();
    expect(JSON.parse(del![1].body)).toMatchObject({ endpoint: OLD_ENDPOINT });
  });

  it("still creates a subscription when the browser has none", async () => {
    mocks.getSubscription.mockResolvedValue(null);
    mocks.subscribe.mockResolvedValue(fakeSubscription(CURRENT_KEY, NEW_ENDPOINT));

    const push = await loadPushModule();
    const result = await push.subscribeToPush({ surface: "portal", planSlug: "acme" });

    expect(result).toEqual({ ok: true });
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    const post = mocks.fetch.mock.calls.find(
      ([, init]) => init?.method === "POST",
    );
    expect(JSON.parse(post![1].body)).toMatchObject({
      endpoint: NEW_ENDPOINT,
      surface: "portal",
      planSlug: "acme",
    });
  });
});

describe("readPushCapability with a mismatched key", () => {
  it("treats a differently-keyed subscription as NOT subscribed", async () => {
    // Otherwise the card says "registered", offers no button, and the repair path is unreachable.
    mocks.getSubscription.mockResolvedValue(fakeSubscription(OTHER_KEY, OLD_ENDPOINT));

    const push = await loadPushModule();
    const capability = await push.readPushCapability();

    expect(capability.support).toBe("supported");
    expect(capability.subscribed).toBe(false);
  });

  it("reports a correctly-keyed subscription as subscribed", async () => {
    mocks.getSubscription.mockResolvedValue(
      fakeSubscription(CURRENT_KEY, OLD_ENDPOINT),
    );

    const push = await loadPushModule();
    const capability = await push.readPushCapability();

    expect(capability.subscribed).toBe(true);
  });
});
