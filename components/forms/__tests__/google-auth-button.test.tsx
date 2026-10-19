import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GoogleSignInButton from "../google-auth-button";

const signIn = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({
  params: new URLSearchParams(),
}));

vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => search.params,
}));

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    search.params = new URLSearchParams();
    signIn.mockReset();
  });

  it("renders the Google call to action", () => {
    render(<GoogleSignInButton />);

    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it("does not start OAuth until the button is pressed", () => {
    render(<GoogleSignInButton />);

    expect(signIn).not.toHaveBeenCalled();
  });

  it("falls back to the role-aware landing route", async () => {
    render(<GoogleSignInButton />);

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(signIn).toHaveBeenCalledWith("google", {
      callbackUrl: "/api/teammates/landing",
    });
  });

  it("preserves a callbackUrl supplied by middleware", async () => {
    search.params = new URLSearchParams({
      callbackUrl: "/onboarding",
    });
    render(<GoogleSignInButton />);

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(signIn).toHaveBeenCalledWith("google", {
      callbackUrl: "/onboarding",
    });
  });

  it("preserves a deep link with query parameters", async () => {
    search.params = new URLSearchParams({
      callbackUrl: "/benefits?tab=plans",
    });
    render(<GoogleSignInButton />);

    await userEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(signIn).toHaveBeenCalledWith("google", {
      callbackUrl: "/benefits?tab=plans",
    });
  });
});
