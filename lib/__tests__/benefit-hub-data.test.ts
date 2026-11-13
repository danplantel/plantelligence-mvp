import { describe, expect, it } from "vitest";

import {
  BENEFIT_HUB_CATEGORY_BY_SEGMENT,
  CUSTOM_BENEFIT_HUB_CATEGORY,
  benefitHubApiPath,
  benefitHubCategoryForPath,
} from "../benefit-hub-data";

/**
 * The hub endpoint map (see `lib/benefit-hub-data.ts`).
 *
 * Two consumers share it and must never disagree: the portal provider, which WARMS
 * the read inside its bootstrap skeleton, and the hub page, whose `useSWR` subscribes
 * to the key. A preload only helps if the warm-up key is byte-for-byte the key the
 * page mounts with — that equality is what these tests pin.
 */

describe("benefitHubCategoryForPath", () => {
  it("maps the three fixed hub segments to their benefit category", () => {
    expect(benefitHubCategoryForPath("/acme/retirement")).toBe("Retirement");
    expect(benefitHubCategoryForPath("/acme/health-insurance")).toBe(
      "Group Health",
    );
    expect(benefitHubCategoryForPath("/acme/life-insurance")).toBe("Group Life");
  });

  it("treats any other second segment as the Custom hub", () => {
    // The Custom hub's path is the plan's own benefit name, so it cannot be
    // enumerated — the route tree has nothing else at that depth.
    expect(benefitHubCategoryForPath("/acme/wellness-programs")).toBe(
      CUSTOM_BENEFIT_HUB_CATEGORY,
    );
    expect(
      benefitHubCategoryForPath(`/acme/${encodeURIComponent("Acme Wellness")}`),
    ).toBe(CUSTOM_BENEFIT_HUB_CATEGORY);
  });

  it("answers null for the landing page and every non-hub portal tab", () => {
    expect(benefitHubCategoryForPath("/acme")).toBeNull();
    for (const tab of [
      "my-benefits-team",
      "news-events",
      "employee-resources",
      "privacy",
      "terms",
      "not-found",
    ]) {
      expect(benefitHubCategoryForPath(`/acme/${tab}`)).toBeNull();
    }
    expect(benefitHubCategoryForPath(null)).toBeNull();
    expect(benefitHubCategoryForPath("")).toBeNull();
  });
});

describe("benefitHubApiPath", () => {
  it("builds the exact URL each hub page requests", () => {
    expect(benefitHubApiPath("plan-1", "Retirement")).toBe(
      "/api/clients/plan-1/benefits/Retirement?forPortal=1&withTopics=1",
    );
    expect(benefitHubApiPath("plan-1", "Group Health")).toBe(
      "/api/clients/plan-1/benefits/Group%20Health?forPortal=1&withTopics=1",
    );
    expect(benefitHubApiPath("plan-1", CUSTOM_BENEFIT_HUB_CATEGORY)).toBe(
      "/api/clients/plan-1/benefits/Company%20%2F%20Plan%20Sponsor?forPortal=1&withTopics=1",
    );
  });

  it("agrees with the segment map, so a preload warms the page's own key", () => {
    for (const [segment, category] of Object.entries(
      BENEFIT_HUB_CATEGORY_BY_SEGMENT,
    )) {
      const fromPath = benefitHubCategoryForPath(`/p/${segment}`);
      expect(fromPath).toBe(category);
      expect(benefitHubApiPath("p", fromPath as string)).toBe(
        `/api/clients/p/benefits/${encodeURIComponent(
          category,
        )}?forPortal=1&withTopics=1`,
      );
    }
  });
});
