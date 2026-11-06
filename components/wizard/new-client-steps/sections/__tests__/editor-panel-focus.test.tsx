import React from "react";

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditorPanelWrapper } from "../components/editor-panel-wrapper";

/**
 * The panel's side of "open on that section".
 *
 * The portal page asks the provider to focus a section; the provider hands the
 * request down here, and this wrapper scrolls its own body — it is the one element
 * that knows where each section sits.
 */

const sections = [
  { title: "Typography", content: <p>typography</p> },
  { title: "Hero Content", content: <p>hero</p> },
  {
    title: "Mission Statement",
    // The Featured Image is the FIRST card of this section, addressed by an
    // anchor — pointing at a whole section would land on the wrong card.
    content: (
      <div>
        <div data-edit-anchor="featured-image">
          <p>featured image</p>
        </div>
        <p>mission</p>
      </div>
    ),
  },
];

function renderPanel(overrides: Record<string, unknown> = {}) {
  return render(
    <EditorPanelWrapper
      isOpen
      isAnimating={false}
      onClose={() => {}}
      sections={sections}
      {...overrides}
    />,
  );
}

describe("EditorPanelWrapper — focus a section", () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    scrollTo.mockClear();
    // jsdom implements no scrolling at all.
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
  });

  it("addresses every section by its slugged title", () => {
    renderPanel();

    expect(
      document.querySelector('[data-section-id="typography"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-section-id="hero-content"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-section-id="mission-statement"]'),
    ).toBeInTheDocument();
  });

  it("scrolls to the requested section", async () => {
    renderPanel({ focusRequest: { id: "mission-statement", nonce: 1 } });

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
  });

  it("scrolls again when the same section is asked for twice", async () => {
    const { rerender } = renderPanel({
      focusRequest: { id: "hero-content", nonce: 1 },
    });
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));

    rerender(
      <EditorPanelWrapper
        isOpen
        isAnimating={false}
        onClose={() => {}}
        sections={sections}
        // Same section, new request — without the nonce this would not re-run.
        focusRequest={{ id: "hero-content", nonce: 2 }}
      />,
    );
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(2));
  });

  it("scrolls to an anchor inside a section when no section matches", async () => {
    renderPanel({ focusRequest: { id: "featured-image", nonce: 1 } });

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
  });

  it("does not scroll while the panel is closed", () => {
    renderPanel({
      isOpen: false,
      focusRequest: { id: "mission-statement", nonce: 1 },
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
