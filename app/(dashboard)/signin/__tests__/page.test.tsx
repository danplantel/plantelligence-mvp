import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuthenticationPage from "../page";

vi.mock("@/components/pages/sign-in", () => ({
  default: () => <div data-testid="sign-in-screen" />,
}));

vi.mock("@/components/forms/user-auth-form", () => ({
  default: () => <div data-testid="sign-in-form" />,
}));

describe("Sign-in page", () => {
  it("renders the sign-in screen", () => {
    render(<AuthenticationPage />);

    expect(screen.getByTestId("sign-in-screen")).toBeInTheDocument();
  });
});
