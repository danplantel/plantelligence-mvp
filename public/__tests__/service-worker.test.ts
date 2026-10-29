import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

/**
 * `public/sw.js`, evaluated in a VM sandbox with a stubbed `self`.
 *
 * This file ships as plain JavaScript outside the bundle, so nothing else in the build would catch a
 * broken `push` handler — a typo here fails silently, in the field, on somebody's phone.
 *
 * Two rules matter more than the rest:
 *  - a notification tap is a navigation the reader never typed, so an off-origin `url` must be
 *    refused rather than followed;
 *  - the `fetch` listener must stay a pass-through. The portal's data is live and per-participant,
 *    and a cached copy of somebody's benefits is worse than no copy.
 */

const ORIGIN = "https://plantel.pro";

interface Harness {
  listeners: Map<string, (event: unknown) => void>;
  shown: Array<{ title: string; options: Record<string, unknown> }>;
  clients: {
    matchAll: ReturnType<typeof vi.fn>;
    openWindow: ReturnType<typeof vi.fn>;
  };
}

function loadWorker(): Harness {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const listeners = new Map<string, (event: unknown) => void>();
  const shown: Harness["shown"] = [];

  const clients = {
    claim: vi.fn(async () => undefined),
    matchAll: vi.fn(async () => [] as unknown[]),
    openWindow: vi.fn(async () => null),
  };

  const self = {
    location: { origin: ORIGIN },
    skipWaiting: vi.fn(),
    clients,
    registration: {
      showNotification: vi.fn(
        async (title: string, options: Record<string, unknown>) => {
          shown.push({ title, options });
        },
      ),
    },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler);
    },
  };

  const context = createContext({
    self,
    URL,
    JSON,
    String,
    Boolean,
    Array,
    Object,
    Promise,
    console,
  });
  runInContext(source, context);

  return { listeners, shown, clients };
}

/** Run a listener and settle everything it asked the browser to wait for. */
async function dispatch(
  harness: Harness,
  type: string,
  event: Record<string, unknown>,
): Promise<void> {
  const pending: Array<Promise<unknown>> = [];
  event.waitUntil = (promise: Promise<unknown>) => {
    pending.push(promise);
    return promise;
  };
  const listener = harness.listeners.get(type);
  if (!listener) throw new Error(`no ${type} listener`);
  listener(event);
  await Promise.all(pending);
}

function pushEvent(data: unknown) {
  return {
    data: data === undefined
      ? null
      : {
          json: () => {
            if (typeof data === "string") throw new Error("not json");
            return data;
          },
          text: () => String(data),
        },
  };
}

describe("service worker", () => {
  it("keeps the fetch listener as a pass-through", async () => {
    const harness = loadWorker();
    const event: Record<string, unknown> = {
      waitUntil: vi.fn(),
      respondWith: vi.fn(),
      request: { url: `${ORIGIN}/acme` },
    };

    harness.listeners.get("fetch")?.(event);

    // No caching, no respondWith: the network answers everything (see the file header).
    expect(event.respondWith).not.toHaveBeenCalled();
    expect(event.waitUntil).not.toHaveBeenCalled();
  });

  it("shows a notification with the payload and an absolute same-origin url", async () => {
    const harness = loadWorker();

    await dispatch(
      harness,
      "push",
      pushEvent({
        title: "A reply on Group Health",
        body: "Can you confirm the deductible?",
        url: "/acme/health-insurance?comment=thread_9",
        tag: "thread_9",
      }),
    );

    const [notification] = harness.shown;
    expect(notification.title).toBe("A reply on Group Health");
    expect(notification.options).toMatchObject({
      body: "Can you confirm the deductible?",
      tag: "thread_9",
      renotify: true,
      data: {
        url: `${ORIGIN}/acme/health-insurance?comment=thread_9`,
        type: null,
        id: null,
      },
    });
  });

  it("refuses an off-origin destination", async () => {
    const harness = loadWorker();

    await dispatch(
      harness,
      "push",
      pushEvent({ title: "Hi", url: "https://evil.test/phish" }),
    );

    // A tap is a navigation the reader did not type; anything off-origin collapses to the app root.
    expect(harness.shown[0].options.data).toMatchObject({ url: `${ORIGIN}/` });
  });

  it("still shows something for a payload that is not JSON", async () => {
    const harness = loadWorker();

    await dispatch(harness, "push", pushEvent("plain text body"));

    expect(harness.shown[0].title).toBe("PlanTelligence");
    expect(harness.shown[0].options.body).toBe("plain text body");
  });

  it("falls back to the brand title when the payload carries none", async () => {
    const harness = loadWorker();

    await dispatch(harness, "push", pushEvent({ body: "no title here" }));

    expect(harness.shown[0].title).toBe("PlanTelligence");
  });

  it("focuses and navigates an existing window on click", async () => {
    const harness = loadWorker();
    const client = {
      focus: vi.fn(async () => undefined),
      navigate: vi.fn(async () => undefined),
    };
    harness.clients.matchAll.mockResolvedValue([client]);

    const notification = {
      close: vi.fn(),
      data: { url: `${ORIGIN}/acme?comment=thread_9` },
    };
    await dispatch(harness, "notificationclick", { notification });

    expect(notification.close).toHaveBeenCalled();
    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith(
      `${ORIGIN}/acme?comment=thread_9`,
    );
    expect(harness.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens a window when none is running", async () => {
    const harness = loadWorker();
    harness.clients.matchAll.mockResolvedValue([]);

    const notification = {
      close: vi.fn(),
      data: { url: `${ORIGIN}/dashboard` },
    };
    await dispatch(harness, "notificationclick", { notification });

    expect(harness.clients.openWindow).toHaveBeenCalledWith(
      `${ORIGIN}/dashboard`,
    );
  });

  it("opens the app root when the click carries no destination", async () => {
    const harness = loadWorker();
    harness.clients.matchAll.mockResolvedValue([]);

    await dispatch(harness, "notificationclick", {
      notification: { close: vi.fn(), data: null },
    });

    expect(harness.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });
});
