import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignupPage from "../page";

const theme = vi.hoisted(() => ({
  value: "light",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: theme.value, setTheme: theme.setTheme }),
}));

vi.mock("@/components/forms/user-signup-form", () => ({
  default: () => <div data-testid="signup-form" />,
}));

describe("Signup page", () => {
  beforeEach(() => {
    theme.value = "light";
    theme.setTheme.mockClear();
  });

  it("renders the form and the light logo", async () => {
    render(<SignupPage />);

    expect(screen.getByTestId("signup-form")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByAltText("PlanTelligence")).toHaveAttribute(
        "src",
        "/plantelligence-logos/pt_web_light.png",
      ),
    );
  });

  it("switches to the dark theme", async () => {
    render(<SignupPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Toggle theme" }),
    );

    expect(theme.setTheme).toHaveBeenCalledWith("dark");
  });

  it("renders the dark logo and switches back to light", async () => {
    theme.value = "dark";
    render(<SignupPage />);

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

  it("uses the dark logo for the system theme", async () => {
    theme.value = "system";
    render(<SignupPage />);

    await waitFor(() =>
      expect(screen.getByAltText("PlanTelligence")).toHaveAttribute(
        "src",
        "/plantelligence-logos/pt_web_dark.png",
      ),
    );
  });
});
