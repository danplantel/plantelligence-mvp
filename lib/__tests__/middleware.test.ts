import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import middleware from "../../middleware";

const getToken = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({ getToken }));

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

async function run(path: string, headers: Record<string, string> = {}) {
  return middleware(request(path, headers));
}

function isPassThrough(response: { headers: Headers }) {
  return response.headers.get("x-middleware-next") === "1";
}

function redirectTarget(response: { headers: Headers }) {
  return new URL(response.headers.get("location") as string);
}

describe("middleware", () => {
  beforeEach(() => {
    getToken.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stamps the request path on pass-through responses", async () => {
    const response = await run("/acme-wealth");

    expect(isPassThrough(response)).toBe(true);
    expect(response.headers.get("x-pathname")).toBe("/acme-wealth");
  });

  it("serves the marketing page at / on a loopback host", async () => {
    const response = await run("/", { host: "localhost:3000" });

    expect(isPassThrough(response)).toBe(true);
    expect(response.headers.get("x-pathname")).toBe("/");
    expect(getToken).not.toHaveBeenCalled();
  });

  it("still keeps the app gate on other loopback paths", async () => {
    getToken.mockResolvedValue(null);

    const response = await run("/dashboard", { host: "localhost:3000" });

    expect(redirectTarget(response).pathname).toBe("/signin");
  });

  it("keeps redirecting / to sign-in on the app host", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://plantel.pro");
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://plantel.ai");

    const response = await run("/", { host: "plantel.pro" });

    expect(response.status).toBe(307);
    expect(redirectTarget(response).pathname).toBe("/signin");
  });

  it("lets static assets through without checking the session", async () => {
    const response = await run("/logo.png");

    expect(isPassThrough(response)).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });

  it("leaves portal pages public", async () => {
    const response = await run("/acme-wealth/benefits");

    expect(isPassThrough(response)).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });

  it("leaves API routes to their own auth handling", async () => {
    const response = await run("/api/teammates/landing");

    expect(isPassThrough(response)).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });

  it("does not gate paths that merely share an app route prefix", async () => {
    const response = await run("/dashboards");

    expect(isPassThrough(response)).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });

  it("sends anonymous visitors to sign-in with a relative callbackUrl", async () => {
    getToken.mockResolvedValue(null);

    const response = await run("/dashboard");

    expect(response.status).toBe(307);
    const target = redirectTarget(response);
    expect(target.pathname).toBe("/signin");
    expect(target.searchParams.get("callbackUrl")).toBe("/dashboard");
  });

  it("keeps search parameters in the callbackUrl", async () => {
    getToken.mockResolvedValue(null);

    const response = await run("/benefits?tab=plans&page=2");

    expect(redirectTarget(response).searchParams.get("callbackUrl")).toBe(
      "/benefits?tab=plans&page=2",
    );
  });

  it("protects nested app paths", async () => {
    getToken.mockResolvedValue(null);

    const response = await run("/clients/123");

    expect(redirectTarget(response).pathname).toBe("/signin");
    expect(redirectTarget(response).searchParams.get("callbackUrl")).toBe(
      "/clients/123",
    );
  });

  it("protects the onboarding wizard itself", async () => {
    getToken.mockResolvedValue(null);

    const response = await run("/onboarding");

    expect(redirectTarget(response).pathname).toBe("/signin");
  });

  it("passes an onboarded user through to app routes", async () => {
    getToken.mockResolvedValue({ onboardingComplete: true });

    const response = await run("/dashboard");

    expect(isPassThrough(response)).toBe(true);
  });

  it("sends an incomplete user to onboarding from any app route", async () => {
    getToken.mockResolvedValue({ onboardingComplete: false });

    const response = await run("/settings/profile");

    expect(response.status).toBe(307);
    expect(redirectTarget(response).pathname).toBe("/onboarding");
  });

  it("allows an incomplete user to stay on onboarding", async () => {
    getToken.mockResolvedValue({ onboardingComplete: false });

    const response = await run("/onboarding");

    expect(isPassThrough(response)).toBe(true);
  });

  it("does not bounce a completed user away from onboarding", async () => {
    getToken.mockResolvedValue({ onboardingComplete: true });

    const response = await run("/onboarding");

    expect(isPassThrough(response)).toBe(true);
  });

  it("does not gate the sign-in page", async () => {
    const response = await run("/signin");

    expect(isPassThrough(response)).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });

  it("reads the dev session cookie outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    getToken.mockResolvedValue({ onboardingComplete: true });

    await run("/dashboard");

    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "test-secret",
        cookieName: "next-auth.session-token",
      }),
    );
  });

  it("reads the secure session cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    getToken.mockResolvedValue({ onboardingComplete: true });

    await run("/dashboard");

    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        cookieName: "__Secure-next-auth.session-token",
      }),
    );
  });
});
