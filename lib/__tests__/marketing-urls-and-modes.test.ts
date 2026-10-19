import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizedClient: vi.fn(),
}));

vi.mock("@/lib/teammates/plan-guard.server", () => ({
  getAuthorizedClient: mocks.getAuthorizedClient,
}));

import {
  getAuthorizedPlanClient,
  getOwnedClient,
} from "@/lib/marketing/assert-client-owner";
import { buildFlyerBrandSnapshot } from "@/lib/marketing/flyer-brand";
import {
  FLYER_MODE_LABELS,
  FLYER_MODES,
  isFlyerMode,
} from "@/lib/marketing/flyer-modes";
import {
  getBenefitPortalSegment,
  getBenefitsHubAbsoluteUrl,
  getBenefitsHubOpenPortalUrl,
  getBenefitsHubPath,
  getBenefitsHubPathFromSlug,
} from "@/lib/marketing/hub-url";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthorizedClient.mockResolvedValue({ id: "plan-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBenefitsHubPath", () => {
  it("requires a plan id", () => {
    expect(() => getBenefitsHubPath("")).toThrow("clientId is required");
    expect(() => getBenefitsHubPath("   ")).toThrow("clientId is required");
  });

  it("returns a trimmed root path", () => {
    expect(getBenefitsHubPath(" acme ")).toBe("/acme");
    expect(getBenefitsHubPathFromSlug("acme")).toBe("/acme");
  });
});

describe("getBenefitsHubAbsoluteUrl", () => {
  it("prefers NEXT_PUBLIC_ROOT_DOMAIN", () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "plantel.pro");
    vi.stubEnv("ROOT_DOMAIN", "ignored.example");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");

    expect(getBenefitsHubAbsoluteUrl("acme")).toBe(
      "https://plantel.pro/acme",
    );
  });

  it("strips a leading dot from the root domain", () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", ".dev.plantel.pro");

    expect(getBenefitsHubAbsoluteUrl("acme")).toBe(
      "https://dev.plantel.pro/acme",
    );
  });

  it("falls back to ROOT_DOMAIN", () => {
    vi.stubEnv("ROOT_DOMAIN", "root.example");

    expect(getBenefitsHubAbsoluteUrl("acme")).toBe("https://root.example/acme");
  });

  it("falls back to the app URL and trims a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example/");

    expect(getBenefitsHubAbsoluteUrl("acme")).toBe(
      "https://app.example/acme",
    );
  });

  it("falls back to NEXTAUTH_URL", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://auth.example/");

    expect(getBenefitsHubAbsoluteUrl("acme")).toBe(
      "https://auth.example/acme",
    );
  });

  it("throws when no base URL is configured", () => {
    expect(() => getBenefitsHubAbsoluteUrl("acme")).toThrow(
      "Set NEXT_PUBLIC_ROOT_DOMAIN",
    );
  });
});

describe("getBenefitsHubOpenPortalUrl", () => {
  it("uses the current origin in development", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(getBenefitsHubOpenPortalUrl("acme")).toBe(
      `${window.location.origin}/acme`,
    );
  });

  it("uses the configured portal root outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "dev.plantel.pro");

    expect(getBenefitsHubOpenPortalUrl("acme")).toBe(
      "https://dev.plantel.pro/acme",
    );
  });

  it("defaults to plantel.pro", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(getBenefitsHubOpenPortalUrl("acme")).toBe(
      "https://plantel.pro/acme",
    );
  });
});

describe("getBenefitPortalSegment", () => {
  it("maps the core benefit categories", () => {
    expect(getBenefitPortalSegment("Retirement")).toBe("retirement");
    expect(getBenefitPortalSegment("Group Health")).toBe("health-insurance");
    expect(getBenefitPortalSegment("Group Life")).toBe("life-insurance");
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(getBenefitPortalSegment("  GROUP HEALTH  ")).toBe(
      "health-insurance",
    );
    // Slash spacing is collapsed to "/" but the result is not mapped back to a
    // space, so "Group / Life" has no dedicated segment.
    expect(getBenefitPortalSegment("Group / Life")).toBe("");
  });

  it("returns an empty segment for unknown or empty categories", () => {
    expect(getBenefitPortalSegment("Dental")).toBe("");
    expect(getBenefitPortalSegment(null)).toBe("");
  });
});

describe("flyer modes", () => {
  it("accepts every declared mode and rejects unknown values", () => {
    for (const mode of FLYER_MODES) {
      expect(isFlyerMode(mode)).toBe(true);
    }
    expect(isFlyerMode("nope")).toBe(false);
    expect(isFlyerMode("")).toBe(false);
  });

  it("labels every mode", () => {
    for (const mode of FLYER_MODES) {
      expect(FLYER_MODE_LABELS[mode]).toBeTruthy();
    }
  });
});

describe("buildFlyerBrandSnapshot", () => {
  it("copies sponsor and organization (legacy) branding", () => {
    expect(
      buildFlyerBrandSnapshot(
        {
          companyName: "Acme",
          brandColor: "#111111",
          secondaryColor: "#222222",
          companyLogo: "logo",
        } as any,
        {
          organizationType: "RIA",
          name: "Advisor",
          advisorLogo: "advisor",
          advisorLogoUrl: null,
        } as any,
      ),
    ).toEqual({
      sponsor: {
        companyName: "Acme",
        brandColor: "#111111",
        secondaryColor: "#222222",
        companyLogo: "logo",
      },
      organization: {
        organizationType: "RIA",
        name: "Advisor",
        advisorLogo: "advisor",
        advisorLogoUrl: null,
      },
    });
  });

  it("normalizes missing values to null", () => {
    const result = buildFlyerBrandSnapshot(
      {
        companyName: "Acme",
        brandColor: "#111111",
        secondaryColor: "#222222",
        companyLogo: undefined,
      } as any,
      {
        organizationType: null,
        name: "Advisor",
        advisorLogo: undefined,
        advisorLogoUrl: undefined,
      } as any,
    );

    expect(result.sponsor.companyLogo).toBeNull();
    expect(result.organization.organizationType).toBeNull();
    expect(result.organization.advisorLogo).toBeNull();
    expect(result.organization.advisorLogoUrl).toBeNull();
  });
});

describe("marketing plan guard", () => {
  it("delegates to the T2 plan guard", async () => {
    await expect(getAuthorizedPlanClient("plan-1", "user-1")).resolves.toEqual({
      id: "plan-1",
    });
    expect(mocks.getAuthorizedClient).toHaveBeenCalledWith({
      clientIdOrSlug: "plan-1",
      userId: "user-1",
    });
  });

  it("keeps the legacy getOwnedClient alias", () => {
    expect(getOwnedClient).toBe(getAuthorizedPlanClient);
  });
});
