import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BrandingSetupCard } from "../sections/branding-setup-card/branding-setup-card";

const extractColorsFromImage = vi.hoisted(() =>
  vi.fn(async () => ({ primary: "#111111", secondary: "#222222" })),
);
const deleteFromR2 = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/extract-colors-from-image", () => ({
  extractColorsFromImage,
}));
vi.mock("@/lib/upload-to-r2", () => ({ deleteFromR2 }));

vi.mock("@/components/ui/universal-image-editor-modal", () => ({
  UniversalImageEditorModal: ({
    type,
    onChange,
    onRemove,
  }: {
    type: string;
    onChange: (value: string, fileName: string, data?: unknown) => void;
    onRemove: () => void;
  }) => (
    <div data-testid={`image-editor-${type}`}>
      <button
        type="button"
        onClick={() =>
          onChange("r2/logo.png", "logo.png", {
            previewDataUrl: "data:image/png;base64,logo",
          })
        }
      >
        upload-logo
      </button>
      <button type="button" onClick={onRemove}>
        remove-logo
      </button>
    </div>
  ),
}));

vi.mock(
  "@/components/wizard/steps/sections/background-image-field/background-image-field",
  () => ({
    BackgroundImageField: ({
      onChange,
      onRemove,
    }: {
      onChange: (value: string, fileName: string, preview: string) => void;
      onRemove: () => void;
    }) => (
      <div data-testid="background-field">
        <button
          type="button"
          onClick={() =>
            onChange(
              "r2/background.jpg",
              "background.jpg",
              "data:image/png;base64,bg",
            )
          }
        >
          upload-background
        </button>
        <button type="button" onClick={onRemove}>
          remove-background
        </button>
      </div>
    ),
  }),
);

vi.mock("@/components/ui/color-picker", () => ({
  ColorPicker: () => <div data-testid="color-picker" />,
}));

vi.mock("@/components/ui/info-dialog", () => ({
  InfoDialog: () => null,
}));

const data = {
  organizationName: "Acme",
  logo: "r2/logo-old.png",
  logoFileName: "logo-old.png",
  website: "acme.example",
  missionStatement: "Welcome to Acme!",
  brandColor: "#1F3A60",
  primaryColor: "#111111",
  secondaryColor: "#222222",
  isPrimaryColorPickerOpen: false,
  isSecondaryColorPickerOpen: false,
  isGenerating: false,
  backgroundImage: "r2/background-old.jpg",
  backgroundFileName: "background-old.jpg",
  useDefaultWelcomeStatement: true,
  logoPreviewDataUrl: "",
  backgroundPreviewDataUrl: "",
};

function renderCard(overrides: Record<string, unknown> = {}) {
  const props = {
    data,
    onDataChange: vi.fn(),
    onFileUpload: vi.fn(),
    onFileRemove: vi.fn(),
    onLogoPreview: vi.fn(async () => undefined),
    ...overrides,
  };

  return { props, ...render(<BrandingSetupCard {...props} />) };
}

describe("BrandingSetupCard", () => {
  beforeEach(() => {
    extractColorsFromImage.mockClear();
    extractColorsFromImage.mockResolvedValue({
      primary: "#111111",
      secondary: "#222222",
    });
    deleteFromR2.mockClear();
  });

  it("renders the organization fields, logo, colors, and background", () => {
    renderCard();

    expect(
      screen.getByPlaceholderText("Enter organization name"),
    ).toHaveValue("Acme");
    expect(
      screen.getByPlaceholderText(
        "Enter organization website (e.g., example.com)",
      ),
    ).toHaveValue("acme.example");
    expect(screen.getByTestId("image-editor-logo")).toBeInTheDocument();
    expect(screen.getByText("Primary Brand Color")).toBeInTheDocument();
    expect(screen.getByText("Secondary Brand Color")).toBeInTheDocument();
    expect(screen.getByTestId("background-field")).toBeInTheDocument();
  });

  it("emits organization name and website changes", () => {
    const { props } = renderCard();

    fireEvent.change(screen.getByPlaceholderText("Enter organization name"), {
      target: { value: "Beta" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "Enter organization website (e.g., example.com)",
      ),
      { target: { value: "beta.example" } },
    );

    expect(props.onDataChange).toHaveBeenCalledWith(
      "organizationName",
      "Beta",
    );
    expect(props.onDataChange).toHaveBeenCalledWith("website", "beta.example");
  });

  it("shows an inline error for a malformed website", () => {
    renderCard();

    fireEvent.change(
      screen.getByPlaceholderText(
        "Enter organization website (e.g., example.com)",
      ),
      { target: { value: "not a url" } },
    );

    expect(
      screen.getByText(
        "Please enter a valid website URL (e.g., example.com or https://example.com)",
      ),
    ).toBeInTheDocument();
  });

  it("regenerates the default welcome statement on mount when it is stale", async () => {
    const { props } = renderCard({
      data: { ...data, missionStatement: "" },
    });

    await waitFor(() =>
      expect(props.onDataChange).toHaveBeenCalledWith(
        "missionStatement",
        expect.stringContaining("Welcome to Acme!"),
      ),
    );
  });

  it("saves logo changes, extracts colors, and reports the preview", async () => {
    const { props } = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "upload-logo" }),
    );

    await waitFor(() =>
      expect(extractColorsFromImage).toHaveBeenCalledWith(
        "data:image/png;base64,logo",
      ),
    );
    expect(props.onDataChange).toHaveBeenCalledWith("logo", "r2/logo.png");
    expect(props.onDataChange).toHaveBeenCalledWith(
      "logoFileName",
      "logo.png",
    );
    expect(props.onDataChange).toHaveBeenCalledWith(
      "logoPreviewDataUrl",
      "data:image/png;base64,logo",
    );
    expect(props.onDataChange).toHaveBeenCalledWith("primaryColor", "#111111");
    expect(props.onDataChange).toHaveBeenCalledWith(
      "secondaryColor",
      "#222222",
    );
    expect(props.onLogoPreview).toHaveBeenCalledWith(
      "data:image/png;base64,logo",
    );
  });

  it("skips automatic color extraction when disabled", async () => {
    const { props } = renderCard({ disableAutoColorExtraction: true });

    await userEvent.click(
      screen.getByRole("button", { name: "upload-logo" }),
    );

    expect(extractColorsFromImage).not.toHaveBeenCalled();
    expect(props.onDataChange).not.toHaveBeenCalledWith(
      "primaryColor",
      expect.anything(),
    );
    expect(props.onLogoPreview).toHaveBeenCalled();
  });

  it("removes the logo through R2 and notifies the parent", async () => {
    const { props } = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "remove-logo" }),
    );

    expect(deleteFromR2).toHaveBeenCalledWith("r2/logo-old.png");
    expect(props.onDataChange).toHaveBeenCalledWith("logo", "");
    expect(props.onDataChange).toHaveBeenCalledWith("logoFileName", "");
    expect(props.onFileRemove).toHaveBeenCalledWith("logo");
  });

  it("saves background changes", async () => {
    const { props } = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "upload-background" }),
    );

    expect(props.onDataChange).toHaveBeenCalledWith(
      "backgroundPreviewDataUrl",
      "data:image/png;base64,bg",
    );
    expect(props.onDataChange).toHaveBeenCalledWith(
      "backgroundImage",
      "r2/background.jpg",
    );
    expect(props.onDataChange).toHaveBeenCalledWith(
      "backgroundFileName",
      "background.jpg",
    );
  });

  it("removes the background through R2", async () => {
    const { props } = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "remove-background" }),
    );

    expect(deleteFromR2).toHaveBeenCalledWith("r2/background-old.jpg");
    expect(props.onDataChange).toHaveBeenCalledWith("backgroundImage", "");
    expect(props.onFileRemove).toHaveBeenCalledWith("backgroundImage");
  });

  it("hides colors and background when requested", () => {
    renderCard({ hideColors: true, hideBackgroundImage: true });

    expect(
      screen.queryByText("Primary Brand Color"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("background-field"),
    ).not.toBeInTheDocument();
  });
});
