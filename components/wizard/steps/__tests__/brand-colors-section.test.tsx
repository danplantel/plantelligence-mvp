import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BrandColorsSection } from "@/components/wizard/new-client-steps/sections/brand-colors-section";

vi.mock("@/components/ui/color-picker", () => ({
  ColorPicker: () => <div data-testid="color-picker" />,
}));

function renderSection(overrides: Record<string, unknown> = {}) {
  const props = {
    primaryColor: "#111111",
    secondaryColor: "#222222",
    onPrimaryChange: vi.fn(),
    onSecondaryChange: vi.fn(),
    isPrimaryPickerOpen: false,
    isSecondaryPickerOpen: false,
    onPrimaryPickerOpenChange: vi.fn(),
    onSecondaryPickerOpenChange: vi.fn(),
    websiteUrl: "acme.example",
    organizationName: "Acme",
    ...overrides,
  };

  return { props, ...render(<BrandColorsSection {...props} />) };
}

describe("BrandColorsSection", () => {
  it("renders both colors and the swap action", () => {
    renderSection();

    expect(screen.getByText("Primary Color")).toBeInTheDocument();
    expect(screen.getByText("Secondary Color")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Swap Colors/ }),
    ).toBeInTheDocument();
  });

  it("emits color edits", () => {
    const { props, container } = renderSection();

    const [primary, secondary] = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[data-field="primaryColor"], input[data-field="secondaryColor"]',
      ),
    );
    fireEvent.change(primary, { target: { value: "#abcdef" } });
    fireEvent.change(secondary, { target: { value: "#fedcba" } });

    expect(props.onPrimaryChange).toHaveBeenCalledWith("#abcdef");
    expect(props.onSecondaryChange).toHaveBeenCalledWith("#fedcba");
  });

  it("swaps the two colors", async () => {
    const { props } = renderSection();

    await userEvent.click(screen.getByRole("button", { name: /Swap Colors/ }));

    expect(props.onPrimaryChange).toHaveBeenCalledWith("#222222");
    expect(props.onSecondaryChange).toHaveBeenCalledWith("#111111");
  });

  it("disables Extract Colors without a logo or website", () => {
    renderSection({ logoDataUrl: null, websiteUrl: "" });

    expect(
      screen.getByRole("button", { name: /Extract Colors/ }),
    ).toBeDisabled();
  });

  it("enables Extract Colors with a website", () => {
    renderSection();

    expect(
      screen.getByRole("button", { name: /Extract Colors/ }),
    ).toBeEnabled();
  });

  it("enables Extract Colors with only a logo", () => {
    renderSection({
      websiteUrl: "",
      logoDataUrl: "data:image/png;base64,logo",
    });

    expect(
      screen.getByRole("button", { name: /Extract Colors/ }),
    ).toBeEnabled();
  });

  it("shows required errors when the colors are empty", () => {
    renderSection({
      primaryColor: "",
      secondaryColor: "",
      errorFields: ["primaryColor", "secondaryColor"],
    });

    expect(screen.getByText("Primary color is required")).toBeInTheDocument();
    expect(
      screen.getByText("Secondary color is required"),
    ).toBeInTheDocument();
  });

  it("shows a hex-format error for invalid values", () => {
    renderSection({
      primaryColor: "blue",
      secondaryColor: "red",
      touchedFields: { primaryColor: true, secondaryColor: true },
      fieldErrors: {
        primaryColor: "invalid",
        secondaryColor: "invalid",
      },
    });

    expect(
      screen.getByText(
        "Primary color must be a valid hex color (e.g., #1F3A60)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Secondary color must be a valid hex color (e.g., #1F3A60)",
      ),
    ).toBeInTheDocument();
  });

  it("does not show errors for untouched fields", () => {
    renderSection({
      primaryColor: "blue",
      fieldErrors: { primaryColor: "invalid" },
    });

    expect(
      screen.queryByText(/must be a valid hex color/),
    ).not.toBeInTheDocument();
  });
});
