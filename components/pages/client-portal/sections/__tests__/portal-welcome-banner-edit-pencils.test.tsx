import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The welcome banner's per-element pencils.
 *
 * The banner is one card with four things the advisor can change — the headline,
 * the description, the closing/signature block, the key-contact portrait and the
 * provider logo — and each belongs to a different panel section. The host passes
 * the anchors (`editTargets`); the banner draws a pencil on each one it is given,
 * and nothing at all when it is given none (previews) or when no editing provider
 * is mounted (a participant).
 */

const mocks = vi.hoisted(() => ({
  focusSection: vi.fn(),
  editing: {
    value: null as null | { canEdit: boolean; focusSection: (id: string) => void },
  },
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing.value,
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: (raw: string | null) => ({ url: raw, loading: false }),
}));

vi.mock("@/lib/branding-image-url", () => ({
  toNextImageSrc: (value: string) => value,
  isR2BrandingKey: () => false,
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { PortalWelcomeBanner } from "../portal-welcome-banner";

const TARGETS = {
  title: "benefit-messaging",
  description: "benefit-messaging",
  closing: "benefit-messaging",
  portrait: "benefit-key-contact-image",
  logo: "benefit-provider-logo",
};

function renderBanner(props: Record<string, unknown> = {}) {
  return render(
    <PortalWelcomeBanner
      clientData={{
        companyName: "Acme",
        companyLogo: "/logo.png",
        keyContacts: [{ name: "Dana Reid", title: "Advisor" }],
      }}
      customHeadline="Your retirement plan"
      customDescription="Everything you need in one place"
      customClosing="Sincerely,"
      editTargets={TARGETS}
      {...props}
    />,
  );
}

describe("PortalWelcomeBanner — per-element pencils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.value = { canEdit: true, focusSection: mocks.focusSection };
  });

  it("puts a pencil on the headline that opens Benefit Messaging", async () => {
    const user = userEvent.setup();
    renderBanner();

    const pencil = screen.getByRole("button", { name: "Edit headline" });
    // Revealed by CSS on hover, present in the DOM — a state-rendered pencil
    // unmounted as soon as the pointer left the region to reach it.
    expect(pencil.className).toContain("opacity-0");
    expect(pencil.className).toContain("group-hover:opacity-100");

    await user.click(pencil);

    expect(mocks.focusSection).toHaveBeenCalledWith("benefit-messaging");
  });

  it("puts a pencil on the description", async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole("button", { name: "Edit description" }));

    expect(mocks.focusSection).toHaveBeenCalledWith("benefit-messaging");
  });

  it("puts pencils on the closing, the portrait and the provider logo", async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(
      screen.getByRole("button", { name: "Edit closing and signature" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Edit key contact portrait" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Edit provider logo" }),
    );

    expect(mocks.focusSection.mock.calls).toEqual([
      ["benefit-messaging"],
      ["benefit-key-contact-image"],
      ["benefit-provider-logo"],
    ]);
  });

  it("draws no pencil for a region the host did not name", () => {
    renderBanner({ editTargets: { title: TARGETS.title } });

    expect(
      screen.queryByRole("button", { name: "Edit provider logo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit key contact portrait" }),
    ).not.toBeInTheDocument();
  });

  it("draws no pencil at all for a participant", () => {
    mocks.editing.value = null;
    renderBanner();

    // The banner's own CTA is still there; none of the PENCILS are.
    for (const name of [
      "Edit headline",
      "Edit description",
      "Edit closing and signature",
      "Edit key contact portrait",
      "Edit provider logo",
    ]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  /**
   * The Create/Edit Benefits previews (desktop AND the phone frame) render this
   * banner without a portal editing provider — they own their Edit Panel and pass
   * click handlers instead. Before the pencils accepted `onActivate`, every
   * editable region of the banner was silently affordance-free there.
   */
  describe("in a preview, where the host owns the panel", () => {
    beforeEach(() => {
      mocks.editing.value = null;
    });

    function renderPreview(handlers: Record<string, unknown> = {}) {
      const onTitleClick = vi.fn();
      const onDescriptionClick = vi.fn();
      const onClosingClick = vi.fn();
      const onPortraitClick = vi.fn();
      const onLogoClick = vi.fn();
      renderBanner({
        editTargets: undefined,
        onTitleClick,
        onDescriptionClick,
        onClosingClick,
        onPortraitClick,
        onLogoClick,
        ...handlers,
      });
      return {
        onTitleClick,
        onDescriptionClick,
        onClosingClick,
        onPortraitClick,
        onLogoClick,
      };
    }

    it("draws a pencil on every region the host can open", () => {
      renderPreview();

      for (const name of [
        "Edit headline",
        "Edit description",
        "Edit closing and signature",
        "Edit key contact portrait",
        "Edit provider logo",
      ]) {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      }
    });

    it("hands each pencil the host's own handler", async () => {
      const user = userEvent.setup();
      const handlers = renderPreview();

      await user.click(screen.getByRole("button", { name: "Edit headline" }));
      await user.click(
        screen.getByRole("button", { name: "Edit description" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Edit closing and signature" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Edit key contact portrait" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Edit provider logo" }),
      );

      expect(handlers.onTitleClick).toHaveBeenCalledTimes(1);
      expect(handlers.onDescriptionClick).toHaveBeenCalledTimes(1);
      expect(handlers.onClosingClick).toHaveBeenCalledTimes(1);
      expect(handlers.onPortraitClick).toHaveBeenCalledTimes(1);
      expect(handlers.onLogoClick).toHaveBeenCalledTimes(1);
    });

    it("draws nothing for a region the host did not offer", () => {
      renderPreview({ onPortraitClick: undefined, onLogoClick: undefined });

      expect(
        screen.queryByRole("button", { name: "Edit key contact portrait" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Edit provider logo" }),
      ).not.toBeInTheDocument();
      // The regions it did offer keep their pencils.
      expect(
        screen.getByRole("button", { name: "Edit headline" }),
      ).toBeInTheDocument();
    });
  });
});
