import { describe, expect, it } from "vitest";

import {
  buildPortalEditHref,
  hasPortalEditIntent,
  portalPageLabel,
} from "@/lib/portal-editor-intent";

/**
 * The URL that sends an advisor to the page that owns the thing they clicked.
 *
 * The footer disclosure lives on the Landing Page, so its blue Edit button on My
 * Benefits Team / News & Events / Employee Resources navigates there with the
 * section to open. The URL — not component state — carries the request, because
 * state does not survive the navigation.
 */

describe("buildPortalEditHref", () => {
  it("names the section and the page it was clicked from", () => {
    expect(
      buildPortalEditHref({
        search: "",
        editPath: "/plan-1",
        editHref: "/plan-1#portal-footer",
        sectionId: "disclosure",
        sourceLabel: "News & Events",
      }),
    ).toBe(
      "/plan-1?comments=on&editSection=disclosure&editFrom=News+%26+Events#portal-footer",
    );
  });

  it("keeps ?comments=on — it is what mounts the portal's editing chrome", () => {
    // The rail and the Edit Panel only exist when this flag is present; the rail
    // opens with comments OFF instead (see `hasPortalEditIntent`).
    expect(
      buildPortalEditHref({
        search: "?comments=on",
        editPath: "/plan-1",
        sectionId: "disclosure",
      }),
    ).toBe("/plan-1?comments=on&editSection=disclosure");
  });

  it("keeps unrelated query parameters", () => {
    expect(
      buildPortalEditHref({
        search: "?tab=docs&comments=on",
        editPath: "/plan-1",
        sectionId: "disclosure",
      }),
    ).toBe("/plan-1?tab=docs&comments=on&editSection=disclosure");
  });

  it("keeps a hash last, so the browser still scrolls to the footer", () => {
    const href = buildPortalEditHref({
      search: "?comments=on",
      editPath: "/plan-1",
      editHref: "/plan-1#portal-footer",
      sectionId: "disclosure",
      sourceLabel: "My Benefits Team",
    });

    expect(href.indexOf("#")).toBeGreaterThan(href.indexOf("editSection"));
    expect(href.endsWith("#portal-footer")).toBe(true);
  });

  it("copes with no search string at all", () => {
    expect(
      buildPortalEditHref({
        search: null,
        editPath: "/plan-1",
        sectionId: "disclosure",
      }),
    ).toBe("/plan-1?comments=on&editSection=disclosure");
  });
});

describe("hasPortalEditIntent", () => {
  it("tells the rail to open with comments closed", () => {
    expect(hasPortalEditIntent("?comments=on&editSection=disclosure")).toBe(true);
    expect(hasPortalEditIntent("comments=on")).toBe(false);
    expect(hasPortalEditIntent("")).toBe(false);
    expect(hasPortalEditIntent(null)).toBe(false);
  });
});

describe("portalPageLabel", () => {
  it("names the portal pages for the redirect message", () => {
    expect(portalPageLabel("/plan-1/news-events")).toBe("News & Events");
    expect(portalPageLabel("/plan-1/my-benefits-team")).toBe(
      "My Benefits Team",
    );
    expect(portalPageLabel("/plan-1/employee-resources")).toBe(
      "Employee Resources",
    );
    expect(portalPageLabel("/plan-1/retirement")).toBe("Retirement");
    expect(portalPageLabel("/plan-1/health-insurance")).toBe("Group Health");
    expect(portalPageLabel("/plan-1/life-insurance")).toBe("Group Life");
    expect(portalPageLabel("/plan-1")).toBe("this page");
    expect(portalPageLabel(null)).toBe("this page");
  });
});
