import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgetPasswordPage from "../page";

const theme = vi.hoisted(() => ({
  value: "light",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: theme.value, setTheme: theme.setTheme }),
}));

vi.mock("@/components/forms/forget-password-form", () => ({
  default: () => <div data-testid="forget-form" />,
}));

describe("Forgot-password page", () => {
  beforeEach(() => {
    theme.value = "light";
    theme.setTheme.mockClear();
  });

  it("renders the heading, description, form, and copyright", () => {
    render(<ForgetPasswordPage />);

    expect(
      screen.getByRole("heading", { name: "Forgot Password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter your email to continue"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("forget-form")).toBeInTheDocument();
    expect(
      screen.getByText(`© ${new Date().getFullYear()} PlanTelligence`),
    ).toBeInTheDocument();
  });

  it("renders the light logo for the light theme", async () => {
    render(<ForgetPasswordPage />);

    await waitFor(() =>
      expect(screen.getByAltText("PlanTelligence")).toHaveAttribute(
        "src",
        "/plantelligence-logos/pt_web_light.png",
      ),
    );
  });

  it("renders the dark logo and toggles back to light", async () => {
    theme.value = "dark";
    render(<ForgetPasswordPage />);

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
    render(<ForgetPasswordPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Toggle theme" }),
    );

    expect(theme.setTheme).toHaveBeenCalledWith("dark");
  });
});
