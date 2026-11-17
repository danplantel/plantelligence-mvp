import { describe, expect, it } from "vitest";

import {
  holdPortalModalOpen,
  isPortalModalOpen,
} from "@/lib/portal-modal-flag";

/**
 * The flag a portal modal raises so the floating chrome (the "Ask a question"
 * pill, mounted by the portal layout rather than by the dialog) can stand down.
 *
 * It is reference-counted because a preview can be opened from inside another
 * overlay, and because React may run an effect cleanup more than once in
 * development — a second release must not close a modal that is still open.
 */

describe("portal modal flag", () => {
  it("is down until a modal holds it, and down again once released", () => {
    expect(isPortalModalOpen()).toBe(false);

    const release = holdPortalModalOpen();
    expect(isPortalModalOpen()).toBe(true);

    release();
    expect(isPortalModalOpen()).toBe(false);
  });

  it("stays up while another modal still holds it", () => {
    const first = holdPortalModalOpen();
    const second = holdPortalModalOpen();

    first();
    expect(isPortalModalOpen()).toBe(true);

    second();
    expect(isPortalModalOpen()).toBe(false);
  });

  it("ignores a repeat release from the same hold", () => {
    const first = holdPortalModalOpen();
    const second = holdPortalModalOpen();

    first();
    first();
    expect(isPortalModalOpen()).toBe(true);

    second();
    expect(isPortalModalOpen()).toBe(false);
  });
});
