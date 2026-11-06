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

  it("lands on the section when the request arrives before the panel opens", async () => {
    // The portal's panel renders nothing while closed, so the request and the
    // opening can land in different commits — and a one-shot lookup would then
    // find no body to scroll and silently open the panel at the top.
    const { rerender } = renderPanel({
      isOpen: false,
      focusRequest: { id: "mission-statement", nonce: 1 },
    });
    expect(scrollTo).not.toHaveBeenCalled();

    rerender(
      <EditorPanelWrapper
        isOpen
        isAnimating={false}
        onClose={() => {}}
        sections={sections}
        focusRequest={{ id: "mission-statement", nonce: 1 }}
      />,
    );

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
  });

  it("keeps looking for a section that mounts after the panel opened", async () => {
    // The editors seed themselves from the plan, so the sections can appear a
    // commit after the panel does (the footer Disclosure is one of them).
    const { rerender } = renderPanel({
      focusRequest: { id: "disclosure", nonce: 1 },
    });
    expect(scrollTo).not.toHaveBeenCalled();

    rerender(
      <EditorPanelWrapper
        isOpen
        isAnimating={false}
        onClose={() => {}}
        sections={[{ title: "Disclosure", content: <p>footer</p> }]}
        focusRequest={{ id: "disclosure", nonce: 1 }}
      />,
    );

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
  });
});
