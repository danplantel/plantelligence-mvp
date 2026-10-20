import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `fetchProfileOnce` is the portal's single-flight profile read: several
 * components on one page (the portal layout, this page's own-card override, the
 * settings forms) all want `/api/profile`, and without coordination each fires
 * its own request against a slow Prisma route.
 *
 * Three rules, all pinned here: concurrent callers share one request, a resolved
 * profile is served from a 60-second cache, and a failure is **not** cached so
 * the next caller retries. `invalidateProfileCache` — called by the Settings
 * saves and the Disclaimers section — must clear both this cache and the
 * header's slim one, which is what makes the portal show a freshly saved logo.
 *
 * The module keeps its state at module scope, so each test re-imports it after
 * `vi.resetModules()`.
 */

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  invalidateHeaderProfileCache: vi.fn(),
}));

vi.mock("@/lib/fetch-header-profile", () => ({
  invalidateHeaderProfileCache: mocks.invalidateHeaderProfileCache,
}));

async function loadModule() {
  vi.resetModules();
  return import("../fetch-profile");
}

function okResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue(okResponse({ organizationName: "Acme Advisory" }));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchProfileOnce", () => {
  it("coalesces concurrent callers onto one request", async () => {
    const { fetchProfileOnce } = await loadModule();

    const [first, second] = await Promise.all([
      fetchProfileOnce(),
      fetchProfileOnce(),
    ]);

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ organizationName: "Acme Advisory" });
    expect(second).toBe(first);
  });

  it("serves a resolved profile from the cache", async () => {
    const { fetchProfileOnce } = await loadModule();

    await fetchProfileOnce();
    await fetchProfileOnce();

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches once the cache has expired", async () => {
    vi.useFakeTimers();
    const { fetchProfileOnce } = await loadModule();

    await fetchProfileOnce();
    vi.advanceTimersByTime(60_001);
    await fetchProfileOnce();

    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("resolves null for a non-2xx response and does not cache it", async () => {
    const { fetchProfileOnce } = await loadModule();
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    expect(await fetchProfileOnce()).toBeNull();

    mocks.fetch.mockResolvedValue(okResponse({ organizationName: "Acme" }));
    expect(await fetchProfileOnce()).toEqual({ organizationName: "Acme" });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("resolves null when the request rejects, and retries later", async () => {
    const { fetchProfileOnce } = await loadModule();
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));

    expect(await fetchProfileOnce()).toBeNull();

    mocks.fetch.mockResolvedValue(okResponse({ organizationName: "Acme" }));
    expect(await fetchProfileOnce()).toEqual({ organizationName: "Acme" });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("drops both caches when invalidated", async () => {
    const { fetchProfileOnce, invalidateProfileCache } = await loadModule();

    await fetchProfileOnce();
    invalidateProfileCache();
    await fetchProfileOnce();

    expect(mocks.invalidateHeaderProfileCache).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
