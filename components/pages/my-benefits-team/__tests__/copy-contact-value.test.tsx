import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CopyContactValue,
  copyTextToClipboard,
} from "@/components/pages/my-benefits-team/copy-contact-value";

/**
 * The email / phone value on a contact card.
 *
 * These used to be `mailto:` / `tel:` links. They are buttons now: clicking copies
 * the value and says so, because most readers take the address or number and paste
 * it somewhere else. Three things matter, and all three are here:
 *
 *  - the copy actually happens, with the value trimmed;
 *  - the "Copied" feedback is announced, not just drawn (a bare visual chip leaves
 *    screen-reader users with no confirmation at all);
 *  - a refused clipboard says "Couldn't copy" rather than lying.
 */

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

function renderValue(
  props: Partial<React.ComponentProps<typeof CopyContactValue>> = {},
) {
  return render(
    <CopyContactValue
      kind="email"
      value="ada@acme.test"
      icon={<span aria-hidden>@</span>}
      {...props}
    />,
  );
}

describe("CopyContactValue", () => {
  it("copies the value on click and names what was copied", async () => {
    renderValue();
    expect(screen.queryByText(/Copied/)).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Copy email: ada@acme.test" }),
    );

    expect(writeText).toHaveBeenCalledWith("ada@acme.test");
    expect(await screen.findByText("Copied Email")).toBeInTheDocument();
  });

  it("names the phone when a number is copied", async () => {
    renderValue({ kind: "phone", value: "(305) 555-0100" });

    await userEvent.click(screen.getByRole("button", { name: /Copy phone/ }));

    expect(await screen.findByText("Copied Phone")).toBeInTheDocument();
  });

  it("shows the phone as formatted and copies the same text", async () => {
    renderValue({
      kind: "phone",
      value: "(305) 555-0100",
    });

    const button = screen.getByRole("button", {
      name: "Copy phone: (305) 555-0100",
    });
    expect(button).toHaveTextContent("(305) 555-0100");

    await userEvent.click(button);
    expect(writeText).toHaveBeenCalledWith("(305) 555-0100");
  });

  it("says so when the clipboard refuses", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    // jsdom has no `document.execCommand`, so the legacy fallback fails too.
    renderValue();

    await userEvent.click(screen.getByRole("button", { name: /Copy email/ }));

    expect(await screen.findByText(/Couldn't copy/)).toBeInTheDocument();
  });

  it("falls back to execCommand when the Clipboard API is missing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: unknown }).execCommand = execCommand;

    await expect(copyTextToClipboard("  ada@acme.test  ")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("refuses to copy an empty value", async () => {
    await expect(copyTextToClipboard("   ")).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });
});
