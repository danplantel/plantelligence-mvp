import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { isPortalModalOpen } from "@/lib/portal-modal-flag";

import {
  BenefitDocumentSection,
  type RetirementDocumentItem,
} from "../benefit-document-section";

/**
 * The documents band's preview modal, on a benefit hub.
 *
 * The report was "nothing appears on the opened Modal, nor does the Download PDF
 * button work". Both had the same cause: the card opened
 * `/api/documents/{id}/view` with no plan identifier, and that route resolves the
 * owning advisor from it on the anonymous portal — so the iframe was handed a 401
 * body and the download link pointed at the same 401. Cards with no stored file
 * (`href: "#"`) were worse still: an iframe on `#` renders the page itself.
 *
 * What is pinned here: the modal loads the SCOPED url, the download fetches that
 * same url and saves the file under the document's name, `#` says so instead of
 * loading, and an Office file offers the download rather than an empty frame.
 */

const PLAN = "g-loomis";
/** A Postgres cuid — the shape `Document.id` has after the Mongo migration. */
const DOC_ID = "cm3kf0a1b0000abcd1234efgh";
const VIEW_URL = `/api/documents/${DOC_ID}/view`;
const SCOPED_URL = `${VIEW_URL}?clientSlug=${PLAN}`;

function doc(
  overrides: Partial<RetirementDocumentItem> = {},
): RetirementDocumentItem {
  return {
    id: DOC_ID,
    title: "Enrollment Booklet",
    description: "Complete guide to your retirement plan options",
    href: VIEW_URL,
    language: "EN",
    ...overrides,
  };
}

function renderSection(
  retirementDocs: RetirementDocumentItem[],
  portalClientId: string | undefined = PLAN,
) {
  return render(
    <BenefitDocumentSection
      hideHeader
      portalClientId={portalClientId}
      retirementDocs={retirementDocs}
    />,
  );
}

/** The card's CTA — the only control that opens the modal. */
function openPreview() {
  fireEvent.click(screen.getByRole("button", { name: /VIEW\/DOWNLOAD/i }));
}

/** The modal's inline preview — the card's own title is a `title` attribute too. */
function previewFrame() {
  return document.querySelector("iframe");
}

describe("BenefitDocumentSection preview", () => {
  it("loads the document through the plan-scoped view route", () => {
    renderSection([doc()]);

    expect(previewFrame()).not.toBeInTheDocument();

    openPreview();

    expect(previewFrame()).toHaveAttribute("src", SCOPED_URL);
  });

  it("fills the desktop viewport, with the frame taking the leftover height", () => {
    renderSection([doc()]);

    openPreview();

    const dialog = screen.getByRole("dialog");

    // From `sm` up the dialog is pinned to all four viewport edges…
    expect(dialog).toHaveClass("sm:inset-0");
    expect(dialog).toHaveClass("sm:max-w-none");
    expect(dialog).toHaveClass("sm:translate-x-0");
    expect(dialog).toHaveClass("sm:translate-y-0");
    expect(dialog).toHaveClass("sm:rounded-none");
    // …and the frame below takes everything the header does not use.
    expect(previewFrame()?.parentElement).toHaveClass("flex-1");
    // Phones keep the sheet, but it is exactly as tall as the viewport.
    expect(dialog).toHaveClass("h-[100dvh]");
    expect(dialog).toHaveClass("max-h-[100dvh]");
  });

  it("releases the spinner when a phone never reports the frame loaded", () => {
    vi.useFakeTimers();
    try {
      renderSection([doc()]);

      act(() => {
        openPreview();
      });

      expect(
        screen.getByTestId("document-preview-spinner"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("document-preview-fallback"),
      ).not.toBeInTheDocument();

      // iOS Safari and Android Chrome often never fire `load` for a PDF frame,
      // so waiting on `onLoad` alone left the modal spinning forever.
      act(() => {
        vi.advanceTimersByTime(8000);
      });

      expect(
        screen.queryByTestId("document-preview-spinner"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId("document-preview-fallback"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /open the document in a new tab/i }),
      ).toHaveAttribute("href", SCOPED_URL);
    } finally {
      vi.useRealTimers();
    }
  });

  /** Pretend the viewport is a phone for the duration of `run`. */
  function asPhone(run: () => void) {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn(() => ({
      matches: true,
      media: "(max-width: 767px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      run();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  }

  it("sends a phone straight to the document, with no modal at all", () => {
    // The VIEW/DOWNLOAD press hands the file to the phone's own viewer: iOS
    // Safari paints a PDF frame blank and Android Chrome downloads it, so the
    // modal had nothing to show.
    const open = vi.fn();
    const originalOpen = window.open;
    window.open = open as unknown as typeof window.open;

    try {
      asPhone(() => {
        renderSection([doc()]);

        openPreview();

        expect(open).toHaveBeenCalledWith(
          SCOPED_URL,
          "_blank",
          "noopener,noreferrer",
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(previewFrame()).not.toBeInTheDocument();
      });
    } finally {
      window.open = originalOpen;
    }
  });

  it("still explains a phone's document that has no file to open", () => {
    asPhone(() => {
      renderSection([doc({ href: "#" })]);

      openPreview();

      // Nothing to hand the browser, so the modal says so instead.
      expect(
        screen.getByText("Preview not available for this document."),
      ).toBeInTheDocument();
    });
  });

  it("holds a spinner over the frame until the document has loaded", () => {
    renderSection([doc()]);

    openPreview();

    // The viewer's own chrome arrives only once the file is fetched, so the
    // transient empty white pane is covered instead of looking broken.
    expect(
      screen.getByTestId("document-preview-spinner"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading document");

    fireEvent.load(previewFrame() as HTMLIFrameElement);

    expect(
      screen.queryByTestId("document-preview-spinner"),
    ).not.toBeInTheDocument();
  });

  it("never hands the r2 placeholder to the browser", () => {
    // The reported console error: "Failed to launch 'r2:stored' because the
    // scheme does not have a registered handler". A card whose href is the
    // placeholder has nothing to open, so the modal says so.
    renderSection([doc({ href: "r2:stored" })]);

    openPreview();

    expect(previewFrame()).not.toBeInTheDocument();
    expect(
      screen.getByText("Preview not available for this document."),
    ).toBeInTheDocument();
  });

  it("offers nothing to open when the card has no stored file", () => {
    renderSection([doc({ href: "#" })]);

    openPreview();

    expect(previewFrame()).not.toBeInTheDocument();
    expect(
      screen.getByText("Preview not available for this document."),
    ).toBeInTheDocument();
    // The card's own CTA says "VIEW/DOWNLOAD"; the modal must not add a second,
    // dead download control beside the notice.
    expect(
      screen.queryByRole("button", { name: /^download/i }),
    ).not.toBeInTheDocument();
  });

  it("downloads through a same-origin link, never a CORS-bound fetch", () => {
    // The view route redirects to R2, which serves no CORS headers, so a `fetch`
    // there fails with "blocked by CORS policy" and the file never arrives. The
    // button clicks a plain link carrying `?download=1` instead, which makes the
    // route sign the object with `Content-Disposition: attachment`.
    const clicks: Array<{ href: string; download: string }> = [];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        clicks.push({
          href: this.getAttribute("href") ?? "",
          download: this.getAttribute("download") ?? "",
        });
      },
    );

    renderSection([doc()]);
    openPreview();

    fireEvent.click(screen.getByRole("button", { name: /^download pdf$/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(clicks).toEqual([
      {
        href: `${SCOPED_URL}&download=1`,
        download: "Enrollment Booklet.pdf",
      },
    ]);
  });

  it("spins on the Download button until the browser takes the file", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderSection([doc()]);
    openPreview();

    fireEvent.click(screen.getByRole("button", { name: /^download pdf$/i }));

    // The press was handed to the browser: it is busy, and cannot be pressed
    // twice while the save is being prepared.
    const busy = screen.getByRole("button", { name: /preparing/i });
    expect(busy).toBeDisabled();
    expect(screen.getByTestId("document-download-spinner")).toBeInTheDocument();
    // Cancel stays available — the modal is not locked.
    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();

    // Coming back to the window means the save dialog is done.
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(
      screen.getByRole("button", { name: /^download pdf$/i }),
    ).not.toBeDisabled();
    expect(
      screen.queryByTestId("document-download-spinner"),
    ).not.toBeInTheDocument();
  });

  it("names the download after a file the browser cannot draw", () => {
    renderSection([doc({ fileName: "Beneficiary Form.docx" })]);

    openPreview();

    // No <iframe>: a Word document would render as a blank pane.
    expect(previewFrame()).not.toBeInTheDocument();
    expect(screen.getByText(/can.t be previewed in the browser/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^download docx$/i }),
    ).toBeInTheDocument();
  });

  it("closes from Cancel and lets the portal chrome back in", async () => {
    renderSection([doc()]);
    openPreview();

    // The floating "Ask a question" pill is in the layout tree, not this one, so
    // the open dialog publishes itself on a shared flag.
    await waitFor(() => expect(isPortalModalOpen()).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(previewFrame()).not.toBeInTheDocument());
    await waitFor(() => expect(isPortalModalOpen()).toBe(false));
  });

  it("keeps the bare view url when the caller is signed in (dashboard)", () => {
    // "" rather than omitting the prop: the helper's default argument is the
    // plan, so `undefined` would have meant "scope it".
    renderSection([doc()], "");

    openPreview();

    expect(previewFrame()).toHaveAttribute("src", VIEW_URL);
  });
});
