import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSignInRedirect } from "@/lib/sign-in-redirect";

import SignIn from "../index";

const theme = vi.hoisted(() => ({
  value: "light",
  setTheme: vi.fn(),
}));
const session = vi.hoisted(() => ({
  status: "unauthenticated" as "loading" | "authenticated" | "unauthenticated",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: theme.value, setTheme: theme.setTheme }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: session.status, data: null }),
}));
vi.mock("@/components/forms/user-auth-form", () => ({
  default: () => <div data-testid="sign-in-form" />,
}));
vi.mock("@/components/forms/resume-onboarding-link", () => ({
  ResumeOnboardingLink: () => <div data-testid="resume-link" />,
}));
// Delegate to the real resolver so the mapping stays covered by its own suite,
// while this suite can assert the screen wires it up.
vi.mock("@/lib/sign-in-redirect", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/sign-in-redirect")>();
  return {
    ...actual,
    resolveSignInRedirect: vi.fn(actual.resolveSignInRedirect),
  };
});

describe("SignIn screen", () => {
  beforeEach(() => {
    theme.value = "light";
    theme.setTheme.mockClear();
    session.status = "unauthenticated";
    vi.mocked(resolveSignInRedirect).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders the form, resume link, and light logo", async () => {
    render(<SignIn />);

    expect(screen.getByTestId("sign-in-form")).toBeInTheDocument();
    expect(screen.getByTestId("resume-link")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByAltText("PlanTelligence")).toHaveAttribute(
        "src",
        "/plantelligence-logos/pt_web_light.png",
      ),
    );
  });

  it("switches from light to dark", async () => {
    render(<SignIn />);

    await userEvent.click(
      screen.getByRole("button", { name: "Toggle theme" }),
    );

    expect(theme.setTheme).toHaveBeenCalledWith("dark");
  });

  it("renders the dark logo and switches back to light", async () => {
    theme.value = "dark";
    render(<SignIn />);

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

  it("renders unauthenticated visitors without redirecting", async () => {
    render(<SignIn />);

    expect(screen.getByTestId("sign-in-form")).toBeInTheDocument();
    expect(screen.getByTestId("resume-link")).toBeInTheDocument();
    expect(resolveSignInRedirect).toHaveBeenCalledWith(
      "unauthenticated",
      null,
    );
  });

  it("resolves a redirect for an authenticated visitor with a callbackUrl", async () => {
    session.status = "authenticated";
    window.history.pushState(
      {},
      "",
      "/signin?callbackUrl=%2Fonboarding%2Fstep-3",
    );

    render(<SignIn />);

    await waitFor(() =>
      expect(resolveSignInRedirect).toHaveBeenCalledWith(
        "authenticated",
        "/onboarding/step-3",
      ),
    );

    window.history.pushState({}, "", "/signin");
  });
});
