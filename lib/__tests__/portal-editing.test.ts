import { describe, expect, it } from "vitest";

import {
  canEditPortalFunction,
  canEditPortalTarget,
  resolvePortalEditTarget,
} from "@/lib/portal-editing";
import type { ViewerAccessLike } from "@/lib/teammates/nav-access";
import type { PermissionFunction } from "@/types/teammate";

function viewer(grants: Partial<Record<PermissionFunction, boolean>>): ViewerAccessLike {
  return {
    isCollaborator: true,
    can: (permission) => grants[permission] === true,
  };
}

describe("resolvePortalEditTarget", () => {
  it("maps the plan landing page to plan branding", () => {
    const target = resolvePortalEditTarget({
      pathname: "/acme",
      planSlug: "acme",
    });
    expect(target?.page).toBe("home");
    expect(target?.permission).toBe("plan_details_branding");
  });

  it("maps every known benefit segment to create_benefits", () => {
    for (const [segment, category] of [
      ["retirement", "Retirement"],
      ["health-insurance", "Group Health"],
      ["life-insurance", "Group Life"],
      ["wellness-programs", "Other"],
    ] as const) {
      const target = resolvePortalEditTarget({
        pathname: `/acme/${segment}`,
        planSlug: "acme",
      });
      expect(target?.page).toBe("benefit");
      expect(target?.category).toBe(category);
      expect(target?.permission).toBe("create_benefits");
    }
  });

  it("recognises the advisor's custom hub slug", () => {
    const target = resolvePortalEditTarget({
      pathname: "/acme/mindfulness-and-me",
      planSlug: "acme",
      customHubSlug: "mindfulness-and-me",
    });
    expect(target?.page).toBe("benefit");
    expect(target?.category).toBe("Other");
  });

  it("refuses an unknown second segment rather than guessing a benefit", () => {
    expect(
      resolvePortalEditTarget({
        pathname: "/acme/not-a-page",
        planSlug: "acme",
      }),
    ).toBeNull();
  });

  it("maps My Benefits Team, News & Events and Employee Resources", () => {
    expect(
      resolvePortalEditTarget({
        pathname: "/acme/my-benefits-team",
        planSlug: "acme",
      })?.permission,
    ).toBe("key_contacts");
    expect(
      resolvePortalEditTarget({
        pathname: "/acme/news-events",
        planSlug: "acme",
      })?.permission,
    ).toBe("marketing");
    expect(
      resolvePortalEditTarget({
        pathname: "/acme/employee-resources",
        planSlug: "acme",
      })?.page,
    ).toBe("documents");
  });

  it("refuses a path belonging to another plan", () => {
    expect(
      resolvePortalEditTarget({
        pathname: "/other/retirement",
        planSlug: "acme",
      }),
    ).toBeNull();
  });

  it("refuses deeper paths", () => {
    expect(
      resolvePortalEditTarget({
        pathname: "/acme/retirement/documents",
        planSlug: "acme",
      }),
    ).toBeNull();
  });
});

describe("portal editing permissions", () => {
  const home = resolvePortalEditTarget({
    pathname: "/acme",
    planSlug: "acme",
  });
  const benefit = resolvePortalEditTarget({
    pathname: "/acme/retirement",
    planSlug: "acme",
  });

  it("allows the page's own edit grant", () => {
    expect(
      canEditPortalTarget(home, viewer({ plan_details_branding: true })),
    ).toBe(true);
    expect(canEditPortalTarget(benefit, viewer({ create_benefits: true }))).toBe(
      true,
    );
  });

  it("refuses a view-only grant", () => {
    expect(
      canEditPortalTarget(home, viewer({ plan_details_branding: false })),
    ).toBe(false);
  });

  it("lets a benefit hub open for a documents-only or video-only grant", () => {
    expect(canEditPortalTarget(benefit, viewer({ documents: true }))).toBe(
      true,
    );
    expect(canEditPortalTarget(benefit, viewer({ video: true }))).toBe(true);
  });

  it("checks a specific section's function", () => {
    const onlyDocs = viewer({ documents: true });
    expect(canEditPortalFunction(benefit, onlyDocs, "documents")).toBe(true);
    expect(canEditPortalFunction(benefit, onlyDocs, "create_benefits")).toBe(
      false,
    );
  });

  it("refuses when there is no target", () => {
    expect(canEditPortalTarget(null, viewer({ plan_details_branding: true }))).toBe(
      false,
    );
  });
});
