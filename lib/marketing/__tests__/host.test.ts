import { describe, expect, it } from "vitest";

import {
  getAppHost,
  getAppOrigin,
  getMarketingApexHost,
  getMarketingHosts,
  getMarketingOrigin,
  getMarketingPageOrigins,
  getRequestOrigin,
  isLocalHost,
  isMarketingAssetPath,
  isMarketingHost,
  isWwwMarketingHost,
  normalizeHost,
  requestHostFromHeaders,
} from "@/lib/marketing/host";

const productionEnv = {
  NEXT_PUBLIC_APP_URL: "https://plantel.pro",
  NEXT_PUBLIC_MARKETING_URL: "https://plantel.ai",
  NEXTAUTH_URL: "https://plantel.pro",
};

function headers(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name] ?? null;
    },
  };
}

describe("normalizeHost", () => {
  it("lowercases, strips the port and a trailing root dot", () => {
    expect(normalizeHost("Plantel.AI:443")).toBe("plantel.ai");
    expect(normalizeHost("plantel.ai.")).toBe("plantel.ai");
  });

  it("takes the first value from a comma-separated proxy header", () => {
    expect(normalizeHost("plantel.ai, proxy.internal:8080")).toBe(
      "plantel.ai",
    );
  });

  it("keeps bracketed IPv6 hosts intact", () => {
    expect(normalizeHost("[::1]:3000")).toBe("[::1]");
  });

  it("returns an empty string for missing input", () => {
    expect(normalizeHost(undefined)).toBe("");
    expect(normalizeHost("   ")).toBe("");
  });
});

describe("requestHostFromHeaders", () => {
  it("prefers x-forwarded-host", () => {
    expect(
      requestHostFromHeaders(
        headers({
          host: "internal.vercel.local",
          "x-forwarded-host": "plantel.ai",
        }),
      ),
    ).toBe("plantel.ai");
  });

  it("falls back to host", () => {
    expect(requestHostFromHeaders(headers({ host: "plantel.pro:443" }))).toBe(
      "plantel.pro",
    );
  });
});

describe("origins", () => {
  it("defaults to plantel.ai for marketing and plantel.pro for the app", () => {
    expect(getMarketingOrigin({})).toBe("https://plantel.ai");
    expect(getAppOrigin({})).toBe("https://plantel.pro");
  });

  it("uses the configured origins and strips trailing slashes", () => {
    expect(
      getMarketingOrigin({
        NEXT_PUBLIC_MARKETING_URL: "https://www.plantel.ai/",
      }),
    ).toBe("https://www.plantel.ai");
    expect(
      getAppOrigin({ NEXT_PUBLIC_APP_URL: "https://dev.plantel.pro/" }),
    ).toBe("https://dev.plantel.pro");
  });

  it("falls back to NEXTAUTH_URL for the app origin", () => {
    expect(getAppOrigin({ NEXTAUTH_URL: "https://auth.example.com" })).toBe(
      "https://auth.example.com",
    );
  });

  it("exposes the host derived from the app origin", () => {
    expect(getAppHost(productionEnv)).toBe("plantel.pro");
  });
});

describe("marketing hosts", () => {
  it("always includes the marketing origin host and its www alias", () => {
    expect(getMarketingHosts(productionEnv)).toEqual(
      expect.arrayContaining(["plantel.ai", "www.plantel.ai"]),
    );
  });

  it("adds explicit hosts from MARKETING_HOSTS", () => {
    expect(
      getMarketingHosts({
        ...productionEnv,
        MARKETING_HOSTS: "staging.plantel.ai",
      }),
    ).toContain("staging.plantel.ai");
  });

  it("supports a localhost-only preview without inventing www.localhost", () => {
    expect(
      getMarketingHosts({
        NEXT_PUBLIC_MARKETING_URL: "http://localhost:3000",
        MARKETING_HOSTS: "localhost",
      }),
    ).toEqual(["localhost"]);
  });

  it("recognises the apex and www hosts", () => {
    expect(isMarketingHost("plantel.ai", productionEnv)).toBe(true);
    expect(isMarketingHost("www.plantel.ai", productionEnv)).toBe(true);
    expect(isMarketingHost("plantel.pro", productionEnv)).toBe(false);
    expect(isMarketingHost("api.plantel.ai", productionEnv)).toBe(false);
  });

  it("treats only the www host as an alias", () => {
    expect(isWwwMarketingHost("www.plantel.ai", productionEnv)).toBe(true);
    expect(isWwwMarketingHost("plantel.ai", productionEnv)).toBe(false);
  });

  it("picks the non-www apex", () => {
    expect(getMarketingApexHost(productionEnv)).toBe("plantel.ai");
  });
});

describe("local preview and metadata assets", () => {
  it("detects local hosts", () => {
    expect(isLocalHost("localhost")).toBe(true);
    expect(isLocalHost("127.0.0.1")).toBe(true);
    expect(isLocalHost("[::1]:3000")).toBe(true);
    expect(isLocalHost("plantel.ai")).toBe(false);
  });

  it("keeps the loopback origin, port included", () => {
    expect(getRequestOrigin(headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
    expect(getRequestOrigin(headers({ host: "127.0.0.1:3100" }))).toBe(
      "http://127.0.0.1:3100",
    );
  });

  it("prefers the proxy headers and their protocol", () => {
    expect(
      getRequestOrigin(
        headers({
          host: "internal:80",
          "x-forwarded-host": "plantel.pro",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://plantel.pro");
  });

  it("returns null when the request carries no host", () => {
    expect(getRequestOrigin(headers({}))).toBeNull();
  });

  it("uses the serving origin on a loopback host", () => {
    expect(
      getMarketingPageOrigins(headers({ host: "localhost:3000" }), productionEnv),
    ).toEqual({
      appOrigin: "http://localhost:3000",
      marketingOrigin: "http://localhost:3000",
    });
  });

  it("uses the serving origin when the app host renders the landing page", () => {
    expect(
      getMarketingPageOrigins(
        headers({ host: "plantel.pro", "x-forwarded-proto": "https" }),
        productionEnv,
      ),
    ).toEqual({
      appOrigin: "https://plantel.pro",
      marketingOrigin: "https://plantel.pro",
    });
  });

  it("keeps the configured split on the marketing host", () => {
    expect(
      getMarketingPageOrigins(headers({ host: "plantel.ai" }), productionEnv),
    ).toEqual({
      appOrigin: "https://plantel.pro",
      marketingOrigin: "https://plantel.ai",
    });
  });

  it("keeps generated metadata routes on the marketing host", () => {
    expect(isMarketingAssetPath("/opengraph-image")).toBe(true);
    expect(isMarketingAssetPath("/twitter-image")).toBe(true);
    expect(isMarketingAssetPath("/signin")).toBe(false);
    expect(isMarketingAssetPath("/dashboard")).toBe(false);
  });
});
