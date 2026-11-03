import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The floating Edit button must look light on the portal whatever the advisor's
 * dashboard theme is.
 *
 * It sits OUTSIDE `.portal-root`, so the portal's light-theme overrides do not
 * reach it — a theme token like `bg-background` followed the dashboard and
 * rendered the button dark over a light portal. Its colours are therefore fixed.
 */

const mocks = vi.hoisted(() => ({
  theme: "light" as "light" | "dark",
  editing: {
    target: { page: "home", label: "Home" },
    canEdit: true,
    isOpen: false,
    togglePanel: vi.fn(),
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mocks.theme,
    resolvedTheme: mocks.theme,
  }),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  usePortalEditing: () => mocks.editing,
  useOptionalPortalEditing: () => null,
}));

import { PortalEditingLauncher } from "@/components/portal-editing/portal-editing-launcher";

describe("PortalEditingLauncher theme", () => {
  beforeEach(() => {
    mocks.editing.isOpen = false;
  });

  it("is light with the dashboard in light mode", () => {
    mocks.theme = "light";
    render(<PortalEditingLauncher />);

    const button = screen.getByRole("button", { name: "Edit this page" });
    expect(button.className).toContain("bg-white");
    expect(button.className).toContain("border-gray-200");
    expect(button.className).not.toContain("bg-gray-900");
    expect(button.className).not.toContain("bg-background");
  });

  it("stays light with the dashboard in dark mode", () => {
    mocks.theme = "dark";
    render(<PortalEditingLauncher />);

    const button = screen.getByRole("button", { name: "Edit this page" });
    expect(button.className).toContain("bg-white");
    expect(button.className).toContain("text-gray-500");
    expect(button.className).not.toContain("bg-gray-900");
    expect(button.className).not.toContain("text-gray-300");
  });

  it("keeps the active accent", () => {
    mocks.theme = "dark";
    mocks.editing.isOpen = true;
    render(<PortalEditingLauncher />);

    const button = screen.getByRole("button", {
      name: "Close editing panel",
    });
    expect(button.className).toContain("text-accent-blue");
    expect(button.className).toContain("bg-white");
  });
});
