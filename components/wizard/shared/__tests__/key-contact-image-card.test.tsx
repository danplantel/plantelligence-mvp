import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KeyContactImageCard } from "../key-contact-image-card";

/**
 * The Key Contact Image control shared by Edit Plan and Edit Benefit → Section 2.
 *
 * The stored value is an OVERRIDE: empty means "the banner is using the key
 * contact headshot". The headshot is only drawn in the slot, so the card opens on
 * the portrait the portal shows without pretending the field is filled in.
 */

vi.mock("@/components/ui/modalGallery", () => ({
  ModalGallery: ({ open, onSelect }: any) =>
    open ? (
      <button
        type="button"
        onClick={() => onSelect("https://cdn.test/picked.png")}
      >
        pick image
      </button>
    ) : null,
}));

vi.mock("@/lib/upload-to-r2", () => ({
  uploadFileToR2: vi.fn(async () => "org/plan/key-contact-image/a.png"),
}));

describe("KeyContactImageCard", () => {
  it("draws the key contact headshot while the field is empty", () => {
    render(
      <KeyContactImageCard
        value=""
        defaultImage="https://cdn.test/dana.png"
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByAltText("Key contact portrait"),
    ).toHaveAttribute("src", "https://cdn.test/dana.png");
    expect(
      screen.getByText("Key contact headshot (default)"),
    ).toBeInTheDocument();
    // Nothing to remove — the field is already empty.
    expect(
      screen.queryByRole("button", { name: /Remove/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the chosen image and clears it back to the headshot", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <KeyContactImageCard
        value="https://cdn.test/chosen.png"
        defaultImage="https://cdn.test/dana.png"
        onChange={onChange}
      />,
    );

    expect(
      screen.getByAltText("Key contact portrait"),
    ).toHaveAttribute("src", "https://cdn.test/chosen.png");
    expect(screen.getByText("Your image")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remove/ }));

    // Clearing is an empty string: "use the headshot".
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("reports a gallery pick as the new portrait", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <KeyContactImageCard
        value=""
        defaultImage="https://cdn.test/dana.png"
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Choose Default Image/ }),
    );
    await user.click(screen.getByRole("button", { name: "pick image" }));

    expect(onChange).toHaveBeenCalledWith("https://cdn.test/picked.png");
  });

  it("falls back to a plain hint when the contact has no headshot", () => {
    render(<KeyContactImageCard value="" onChange={() => {}} />);

    expect(
      screen.queryByAltText("Key contact portrait"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No headshot yet")).toBeInTheDocument();
  });
});
