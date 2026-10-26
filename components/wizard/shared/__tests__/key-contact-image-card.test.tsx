import React from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KeyContactImageCard } from "../key-contact-image-card";
import { uploadFileToR2 } from "@/lib/upload-to-r2";

/**
 * The Key Contact Image control shared by Edit Plan and Edit Benefit → Section 2.
 *
 * The stored value is an OVERRIDE: empty means "the banner is using the key
 * contact headshot". The headshot is only drawn in the slot, so the card opens on
 * the portrait the portal shows without pretending the field is filled in.
 *
 * A gallery pick is only the SOURCE for the square cropper — the card must not
 * store the picked photo as-is, because the banner draws it inside a circle.
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

// Reading the picked photo back at full resolution needs a real canvas.
vi.mock(
  "@/components/wizard/new-client-steps/sections/utils/image-utils",
  () => ({
    exportFullResolutionImage: vi.fn(async () => ({
      dataUrl: "data:image/png;base64,cGlja2Vk",
      width: 1200,
      height: 1200,
    })),
  }),
);

// The real editor is a Fabric canvas; what is under test here is the contract
// around it (it opens on the pick, and its crop is uploaded before it is stored).
vi.mock("@/components/ui/simple-image-editor-modal", () => ({
  SimpleImageEditorModal: ({
    isOpen,
    modalTitle,
    guidelineWidth,
    guidelineHeight,
    previewShape,
    onChange,
  }: any) =>
    isOpen ? (
      <div
        data-testid="portrait-cropper"
        data-guideline={`${guidelineWidth}x${guidelineHeight}`}
        data-preview-shape={previewShape}
      >
        <span>{modalTitle}</span>
        <button
          type="button"
          onClick={() =>
            onChange(
              "data:image/png;base64,Y3JvcHBlZA==",
              "key-contact-image.png",
            )
          }
        >
          save crop
        </button>
      </div>
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

  it("opens a square cropper for a gallery pick instead of applying it", async () => {
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

    const cropper = await screen.findByTestId("portrait-cropper");
    // The banner's frame is a circle, so the guide is square.
    expect(cropper).toHaveAttribute("data-guideline", "320x320");
    // ...and the modal previews it in a circle, like the live banner does.
    expect(cropper).toHaveAttribute("data-preview-shape", "circle");
    expect(within(cropper).getByText("Key Contact Image")).toBeInTheDocument();
    // Nothing is stored until the advisor saves a framing.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hands the saved crop to the preview as a data URL, without uploading", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyContactImageCard value="" onChange={onChange} />);

    await user.click(
      screen.getByRole("button", { name: /Choose Default Image/ }),
    );
    await user.click(screen.getByRole("button", { name: "pick image" }));
    await user.click(await screen.findByRole("button", { name: "save crop" }));

    // The Portal Preview paints the data URL straight away; the R2 upload is
    // deferred to Save Changes (`saveBenefit`), so nothing is uploaded here.
    expect(onChange).toHaveBeenCalledWith(
      "data:image/png;base64,Y3JvcHBlZA==",
    );
    expect(uploadFileToR2).not.toHaveBeenCalled();
  });

  it("falls back to a plain hint when the contact has no headshot", () => {
    render(<KeyContactImageCard value="" onChange={() => {}} />);

    expect(
      screen.queryByAltText("Key contact portrait"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No headshot yet")).toBeInTheDocument();
  });
});
