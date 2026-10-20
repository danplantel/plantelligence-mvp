import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PortalCommentsZoom } from "../portal-comments-zoom";

/**
 * `PortalCommentsZoom` draws the portal as a scaled replica while the Comments
 * rail is open, so the page keeps the proportions a participant sees instead of
 * reflowing into a narrower column.
 *
 * Two numbers are load-bearing and both are pure arithmetic:
 *
 *  - **the scale**, `(clientWidth − railWidth) / clientWidth`, clamped to
 *    `[0.5, 1]` so the replica never becomes unreadable and never grows;
 *  - **the wrapper height**, the *unscaled* content height times that scale,
 *    because a transform does not shrink layout height and the leftover would
 *    otherwise become a band of empty page below the portal.
 *
 * It also has to be invisible when there is no provider — that pass-through is
 * what keeps dashboard pages unaffected by this portal-only wrapper.
 */

const mocks = vi.hoisted(() => ({
  mode: undefined as { canComment: boolean; mode: "on" | "off" } | undefined,
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  useOptionalCommentMode: () => mocks.mode,
}));

const VIEWPORT = 1440;
const RAIL = 384; // 24rem at the portal's 16px root

function expectedScale(width: number) {
  return Math.max(0.5, Math.min(1, (width - RAIL) / width));
}

function setViewport(width: number) {
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: width,
  });
}

function content() {
  return screen.getByText("portal content").parentElement as HTMLElement;
}

function wrapper() {
  // The height sits on the outer wrapper; the transform sits on its child.
  return content().parentElement as HTMLElement;
}

function renderZoom() {
  return render(
    <PortalCommentsZoom>
      <p>portal content</p>
    </PortalCommentsZoom>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mode = { canComment: true, mode: "on" };
  setViewport(VIEWPORT);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PortalCommentsZoom pass-through", () => {
  it("contributes nothing without a provider", () => {
    mocks.mode = undefined;
    renderZoom();

    expect(screen.getByText("portal content")).toBeInTheDocument();
    expect(content().style.transform).toBe("");
  });

  it("does not scale while the rail is closed", () => {
    mocks.mode = { canComment: true, mode: "off" };
    renderZoom();

    expect(content().style.transform).toBe("");
    expect(content().style.getPropertyValue("--comments-inset")).toBe("");
  });
});

describe("PortalCommentsZoom scale", () => {
  it("scales the portal to the space beside the rail", () => {
    renderZoom();

    expect(content().style.transform).toBe(`scale(${expectedScale(VIEWPORT)})`);
    expect(content().style.transformOrigin).toBe("top left");
  });

  it("never scales below half size", () => {
    setViewport(700);
    renderZoom();

    expect(content().style.transform).toBe("scale(0.5)");
  });

  it("never scales above 1 and leaves a zero-width viewport alone", () => {
    setViewport(0);
    const { unmount } = renderZoom();
    expect(content().style.transform).toBe("");
    unmount();

    setViewport(300);
    renderZoom();
    expect(content().style.transform).toBe("scale(0.5)");
  });

  it("recomputes on resize", () => {
    renderZoom();

    setViewport(1200);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(content().style.transform).toBe(`scale(${expectedScale(1200)})`);
  });

  it("returns to 1 when the rail closes", () => {
    const { rerender } = renderZoom();
    expect(content().style.transform).not.toBe("");

    mocks.mode = { canComment: true, mode: "off" };
    rerender(
      <PortalCommentsZoom>
        <p>portal content</p>
      </PortalCommentsZoom>,
    );

    expect(content().style.transform).toBe("");
  });
});

describe("PortalCommentsZoom layout", () => {
  it("clears the rail's inset inside the scaled subtree", () => {
    renderZoom();

    expect(content().style.getPropertyValue("--comments-inset")).toBe("0px");
  });

  it("divides the wrapper height down by the scale", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
      2000,
    );
    renderZoom();

    expect(wrapper().style.height).toBe(`${2000 * expectedScale(VIEWPORT)}px`);
    expect(wrapper().style.minHeight).toBe("100dvh");
    expect(wrapper().className).toContain("overflow-hidden");
  });

  it("observes the content so images and accordions re-measure", () => {
    const instances: Array<{
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        constructor() {
          instances.push(this);
        }
      },
    );

    const { unmount } = renderZoom();

    expect(instances).toHaveLength(1);
    expect(instances[0].observe).toHaveBeenCalledTimes(1);

    unmount();
    expect(instances[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
