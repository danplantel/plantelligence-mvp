import { describe, expect, it } from "vitest";

import {
  DEFAULT_LANDING_PATH,
  getCallbackUrl,
  resolvePostSignInPath,
  resolveSignInRedirect,
} from "../sign-in-redirect";

describe("resolveSignInRedirect", () => {
  it("does not redirect while the session is still loading", () => {
    expect(resolveSignInRedirect("loading", "/dashboard")).toBeNull();
  });

  it("does not redirect a signed-out visitor", () => {
    expect(resolveSignInRedirect("unauthenticated", "/dashboard")).toBeNull();
  });

  it("does not redirect an authenticated visitor without a callbackUrl", () => {
    expect(resolveSignInRedirect("authenticated", null)).toBeNull();
    expect(resolveSignInRedirect("authenticated", undefined)).toBeNull();
    expect(resolveSignInRedirect("authenticated", "")).toBeNull();
  });

  it("sends an authenticated visitor to a non-onboarding deep link as-is", () => {
    expect(resolveSignInRedirect("authenticated", "/dashboard?tab=plans")).toBe(
      "/dashboard?tab=plans",
    );
  });

  it("collapses any onboarding deep link to /onboarding", () => {
    expect(
      resolveSignInRedirect("authenticated", "/onboarding/step-3"),
    ).toBe("/onboarding");
    expect(
      resolveSignInRedirect(
        "authenticated",
        "/onboarding?email=ada%40example.com",
      ),
    ).toBe("/onboarding");
  });
});

describe("resolvePostSignInPath", () => {
  it("prefers the URL resolved by NextAuth", () => {
    expect(
      resolvePostSignInPath("/dashboard", "/benefits"),
    ).toBe("/dashboard");
  });

  it("falls back to the callbackUrl from the query", () => {
    expect(resolvePostSignInPath(undefined, "/onboarding")).toBe(
      "/onboarding",
    );
    expect(resolvePostSignInPath(null, "/benefits")).toBe("/benefits");
  });

  it("falls back to the role-aware landing route", () => {
    expect(resolvePostSignInPath(undefined, null)).toBe(DEFAULT_LANDING_PATH);
    expect(resolvePostSignInPath("", "")).toBe(DEFAULT_LANDING_PATH);
  });

  it("never navigates back to /signin", () => {
    expect(
      resolvePostSignInPath("/signin?callbackUrl=%2Fonboarding", null),
    ).toBe("/onboarding");
    expect(resolvePostSignInPath("/signin", "/dashboard")).toBe("/onboarding");
  });
});

describe("getCallbackUrl", () => {
  it("reads and decodes the callbackUrl parameter", () => {
    expect(
      getCallbackUrl("?callbackUrl=%2Fonboarding%3Femail%3Da%2540b.com"),
    ).toBe("/onboarding?email=a%40b.com");
  });

  it("returns null when the parameter is absent", () => {
    expect(getCallbackUrl("")).toBeNull();
    expect(getCallbackUrl("?email=ada%40example.com")).toBeNull();
  });

  it("treats an empty callbackUrl as absent", () => {
    expect(getCallbackUrl("?callbackUrl=")).toBeNull();
  });
});
