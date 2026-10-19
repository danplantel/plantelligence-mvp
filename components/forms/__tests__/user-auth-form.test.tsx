import React from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoadingProvider } from "@/contexts/loading-context";

import UserAuthForm from "../user-auth-form";

const signIn = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({
  params: new URLSearchParams(),
}));

vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => search.params,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/forms/google-auth-button", () => ({
  default: () => <div data-testid="google-button" />,
}));

function renderForm() {
  return render(
    <LoadingProvider>
      <UserAuthForm />
    </LoadingProvider>,
  );
}

async function fillCredentials(
  email = "ada@example.com",
  password = "secret",
) {
  await userEvent.type(
    screen.getByPlaceholderText("Enter your email"),
    email,
  );
  await userEvent.type(
    await screen.findByPlaceholderText("Enter your password"),
    password,
  );
}

describe("UserAuthForm (sign in)", () => {
  beforeEach(() => {
    search.params = new URLSearchParams();
    signIn.mockReset();
    signIn.mockResolvedValue({ url: "/api/teammates/landing" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows only the email field until an email is typed", async () => {
    renderForm();

    expect(
      screen.getByPlaceholderText("Enter your email"),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Enter your password"),
    ).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText("Enter your email"),
      "a",
    );

    expect(
      await screen.findByPlaceholderText("Enter your password"),
    ).toBeInTheDocument();
  });

  it("validates the email and password", async () => {
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText("Enter your email"),
      "ada@example.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    expect(await screen.findByText("Password is required")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    renderForm();
    await userEvent.type(
      screen.getByPlaceholderText("Enter your email"),
      "ada@example.com",
    );

    const password = await screen.findByPlaceholderText(
      "Enter your password",
    );
    expect(password).toHaveAttribute("type", "password");

    const toggle = password.parentElement?.querySelector("button");
    expect(toggle).not.toBeNull();
    await userEvent.click(toggle as HTMLElement);

    expect(password).toHaveAttribute("type", "text");
  });

  it("signs in with the callbackUrl from the query", async () => {
    search.params = new URLSearchParams("callbackUrl=%2Fplans");
    renderForm();

    await fillCredentials();
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("credentials", {
        redirect: false,
        email: "ada@example.com",
        password: "secret",
        callbackUrl: "/plans",
      }),
    );
  });

  it("falls back to the role-aware landing path", async () => {
    renderForm();

    await fillCredentials();
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("credentials", {
        redirect: false,
        email: "ada@example.com",
        password: "secret",
        callbackUrl: "/api/teammates/landing",
      }),
    );
  });

  it("maps a credentials error to a friendly message", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin" });
    renderForm();

    await fillCredentials();
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    expect(
      await screen.findByText(
        "Invalid email or password. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("maps an unknown error to the generic message", async () => {
    signIn.mockResolvedValue({ error: "SomethingNew" });
    renderForm();

    await fillCredentials();
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    expect(
      await screen.findByText(
        "An unexpected error occurred. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the loading state while the request is in flight", async () => {
    let resolveSignIn: (value: unknown) => void = () => {};
    signIn.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    renderForm();

    await fillCredentials();
    await userEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );

    expect(
      await screen.findByRole("button", { name: "Signing in..." }),
    ).toBeDisabled();
    expect(
      screen.getByPlaceholderText("Enter your email"),
    ).toBeDisabled();

    await act(async () => {
      resolveSignIn({ error: "CredentialsSignin" });
    });

    expect(
      await screen.findByText(
        "Invalid email or password. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the alternate auth links and Google button", () => {
    renderForm();

    expect(
      screen.getByRole("link", { name: "Create New Account" }),
    ).toHaveAttribute("href", "/signup");
    expect(
      screen.getByRole("link", { name: "Forgot Password?" }),
    ).toHaveAttribute("href", "/forget");
    expect(screen.getByTestId("google-button")).toBeInTheDocument();
  });
});
