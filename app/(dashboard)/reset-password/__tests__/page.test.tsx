import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResetPasswordPage from "../page";

const theme = vi.hoisted(() => ({
  value: "light",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: theme.value, setTheme: theme.setTheme }),
}));

vi.mock("@/components/forms/reset-pass-form", () => ({
  default: () => <div data-testid="reset-form" />,
}));

describe("Reset-password page", () => {
  beforeEach(() => {
    theme.value = "light";
    theme.setTheme.mockClear();
  });

  it("renders the heading, description, form, and copyright", () => {
    render(<ResetPasswordPage />);

    expect(
      screen.getByRole("heading", { name: "Reset Password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter your new password"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reset-form")).toBeInTheDocument();
    expect(
      screen.getByText(`© ${new Date().getFullYear()} PlanTelligence`),
    ).toBeInTheDocument();
  });

  it("renders the light logo for the light theme", async () => {
    render(<ResetPasswordPage />);

    await waitFor(() =>
      expect(screen.getByAltText("PlanTelligence")).toHaveAttribute(
        "src",
        "/plantelligence-logos/pt_web_light.png",
      ),
    );
  });

  it("renders the dark logo and toggles back to light", async () => {
    theme.value = "dark";
    render(<ResetPasswordPage />);

    await waitFor(() =>
      expect(screen.getByAltText("PlanTelligence")).toHaveAttribute(
        "src",
        "/plantelligence-logos/pt_web_dark.png",
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Toggle theme" }),
    );

    expect(theme.setTheme).toHaveBeenCalledWith("light");
  });

  it("toggles from light to dark", async () => {
    render(<ResetPasswordPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Toggle theme" }),
    );

    expect(theme.setTheme).toHaveBeenCalledWith("dark");
  });
});
