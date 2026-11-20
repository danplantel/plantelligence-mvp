import { describe, expect, it } from "vitest";

import {
  holdPortalLightSurface,
  isPortalLightSurface,
} from "@/lib/portal-light-surface";

/**
 * The portal is always light, but a few overlays carry their OWN theme prop
 * instead of reading the `.dark` class the portal layout strips. This flag is
 * what those overlays (the toaster) consult.
 */
describe("portal light surface", () => {
  it("is down until a portal page is mounted, and down again once it leaves", () => {
    expect(isPortalLightSurface()).toBe(false);

    const release = holdPortalLightSurface();
    expect(isPortalLightSurface()).toBe(true);

    release();
    expect(isPortalLightSurface()).toBe(false);
  });

  it("stays up until the last nested portal releases", () => {
    const page = holdPortalLightSurface();
    const inlinePanel = holdPortalLightSurface();

    page();
    // The portal page's own shell left, but the editing panel it opened over it
    // is still mounted — the surface is still a light one.
    expect(isPortalLightSurface()).toBe(true);

    inlinePanel();
    expect(isPortalLightSurface()).toBe(false);
  });

  it("ignores a second release, so the count cannot go negative", () => {
    const release = holdPortalLightSurface();

    release();
    release();

    const next = holdPortalLightSurface();
    expect(isPortalLightSurface()).toBe(true);
    next();
    expect(isPortalLightSurface()).toBe(false);
  });
});
