import { describe, expect, it } from "vitest";

import { shouldShowPopUpOnPage } from "@/hooks/useMarketingAssets";

/**
 * Pop-up page targeting.
 *
 * An advisor picks the pages a pop-up appears on in Marketing (`all`, `home`,
 * `benefits`, `news-events`, `my-benefits-team`). This helper is the only place
 * that decision is made, and it is what keeps a "News & Events" pop-up off the
 * landing page.
 */

describe("shouldShowPopUpOnPage", () => {
  it("shows nothing without popup data or a page list", () => {
    expect(shouldShowPopUpOnPage(null, "/")).toBe(false);
    expect(shouldShowPopUpOnPage(undefined, "/")).toBe(false);
    expect(shouldShowPopUpOnPage({}, "/")).toBe(false);
    expect(shouldShowPopUpOnPage({ popupPages: [] }, "/")).toBe(false);
  });

  it("shows on every page when 'all' is selected", () => {
    expect(shouldShowPopUpOnPage({ popupPages: ["all"] }, "/")).toBe(true);
    expect(
      shouldShowPopUpOnPage({ popupPages: ["all"] }, "/plan/news-events"),
    ).toBe(true);
  });

  it("targets the home page", () => {
    expect(shouldShowPopUpOnPage({ popupPages: ["home"] }, "/")).toBe(true);
    expect(shouldShowPopUpOnPage({ popupPages: ["home"] }, "")).toBe(true);
    expect(
      shouldShowPopUpOnPage({ popupPages: ["home"] }, "/plan/retirement"),
    ).toBe(false);
  });

  it("targets every benefit hub", () => {
    for (const path of [
      "/plan/retirement",
      "/plan/health-insurance",
      "/plan/life-insurance",
      "/plan/wellness-programs",
    ]) {
      expect(shouldShowPopUpOnPage({ popupPages: ["benefits"] }, path)).toBe(
        true,
      );
    }
    expect(
      shouldShowPopUpOnPage({ popupPages: ["benefits"] }, "/plan/news-events"),
    ).toBe(false);
  });

  it("treats extra benefit paths as benefit pages", () => {
    expect(
      shouldShowPopUpOnPage(
        { popupPages: ["benefits"] },
        "/plan/financial-wellness",
        ["/financial-wellness"],
      ),
    ).toBe(true);
    expect(
      shouldShowPopUpOnPage(
        { popupPages: ["benefits"] },
        "/plan/financial-wellness",
        ["/retirement"],
      ),
    ).toBe(false);
  });

  it("targets News & Events", () => {
    expect(
      shouldShowPopUpOnPage(
        { popupPages: ["news-events"] },
        "/plan/news-events",
      ),
    ).toBe(true);
    expect(
      shouldShowPopUpOnPage({ popupPages: ["news-events"] }, "/plan"),
    ).toBe(false);
  });

  it("targets My Benefits Team", () => {
    expect(
      shouldShowPopUpOnPage(
        { popupPages: ["my-benefits-team"] },
        "/plan/my-benefits-team",
      ),
    ).toBe(true);
    expect(
      shouldShowPopUpOnPage(
        { popupPages: ["news-events"] },
        "/plan/my-benefits-team",
      ),
    ).toBe(false);
  });

  it("matches on a substring, so a slug containing the keyword also matches", () => {
    // Documented behaviour: any path containing "/retirement" counts as the
    // Retirement hub, including a plan slug like "/retirement-plan".
    expect(
      shouldShowPopUpOnPage({ popupPages: ["benefits"] }, "/retirement-plan"),
    ).toBe(true);
  });

  it("ignores unknown page keys", () => {
    expect(
      shouldShowPopUpOnPage({ popupPages: ["documents"] }, "/plan/news-events"),
    ).toBe(false);
  });
});
