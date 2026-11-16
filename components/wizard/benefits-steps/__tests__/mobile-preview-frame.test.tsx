import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobilePreviewFrame } from "../step-2";

/**
 * The phone preview writes the page into an iframe so Tailwind's breakpoints
 * evaluate against the 390 px screen instead of the desktop parent window. Its
 * chrome therefore lives in the iframe's own document — `screen` only sees the
 * parent tree, so these assertions read `contentDocument` directly.
 */
async function frameShell(container: HTMLElement): Promise<HTMLElement> {
  const iframe = container.querySelector("iframe");
  expect(iframe).not.toBeNull();

  let shell: HTMLElement | null = null;
  await waitFor(() => {
    shell = (iframe!.contentDocument?.body?.firstElementChild ??
      null) as HTMLElement | null;
    expect(shell).not.toBeNull();
  });
  return shell as unknown as HTMLElement;
}

describe("MobilePreviewFrame", () => {
  it("scrolls the page directly and guards only the bottom curve", async () => {
    const { container } = render(
      <MobilePreviewFrame width={200}>
        <p>page content</p>
      </MobilePreviewFrame>,
    );

    const shell = await frameShell(container);

    // The scroll container is FIRST, with no band above it: the screen's top safe
    // area rides with the host's sticky portal header instead. As a separate band
    // it left a seam the page scrolled through, so section content appeared above
    // the header. The bottom strip stays here — the page's last row must clear the
    // bottom curve.
    expect(shell.children).toHaveLength(2);

    const [page, home] = Array.from(shell.children) as HTMLElement[];
    expect(page).not.toHaveAttribute("aria-hidden");
    expect(page.style.overflowY).toBe("auto");
    expect(page.textContent).toContain("page content");

    expect(home).toHaveAttribute("aria-hidden");
    expect(home.style.height).toBe("18px");
  });

  it("keeps the device's full height so the screen is never squashed", async () => {
    const { container } = render(
      <MobilePreviewFrame width={200}>
        <p>page content</p>
      </MobilePreviewFrame>,
    );

    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.style.height).toBe("400px");
    // No `max-height: 100%`: in a short window that shrank the iframe and clipped
    // the scaled page inside a body that cannot scroll. The host container
    // scrolls the whole device instead.
    expect(iframe.style.maxHeight).toBe("");
  });
});
