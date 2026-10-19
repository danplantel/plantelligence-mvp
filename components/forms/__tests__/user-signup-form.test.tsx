import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UserAuthForm from "../user-signup-form";

const axiosPost = vi.hoisted(() => vi.fn());
const signIn = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  message: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { post: axiosPost },
}));
vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("sonner", () => ({ toast }));
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
vi.mock("@/components/forms/resume-onboarding-link", () => ({
  ResumeOnboardingLink: () => <div data-testid="resume-link" />,
}));

const fetchMock = vi.fn();

async function fillForm({
  email = "ada@example.com",
  password = "Password1!",
  confirmPassword = password,
}: {
  email?: string;
  password?: string;
  confirmPassword?: string;
} = {}) {
  await userEvent.type(
    screen.getByPlaceholderText("Enter your name"),
    "Ada Lovelace",
  );
  await userEvent.type(screen.getByPlaceholderText("Enter your email"), email);
  await userEvent.type(
    screen.getByPlaceholderText("Enter your password"),
    password,
  );
  await userEvent.type(
    screen.getByPlaceholderText("Re-enter your password"),
    confirmPassword,
  );
}

async function submitWhenEnabled() {
  const button = screen.getByRole("button", { name: "Sign Up" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

describe("UserAuthForm (sign up)", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ status: 200, data: {} });
    signIn.mockReset();
    signIn.mockResolvedValue({ ok: true });
    push.mockReset();
    toast.success.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ available: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders every field and keeps Sign Up disabled until valid", () => {
    render(<UserAuthForm />);

    expect(screen.getByPlaceholderText("Enter your name")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter your email"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Must be at least 8 characters with uppercase/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign Up" }),
    ).toBeDisabled();
    expect(screen.getByTestId("google-button")).toBeInTheDocument();
    expect(screen.getByTestId("resume-link")).toBeInTheDocument();
  });

  it("enables Sign Up for a complete, valid form", async () => {
    render(<UserAuthForm />);

    await fillForm();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign Up" })).toBeEnabled(),
    );
  });

  it("shows a mismatch error for different passwords", async () => {
    render(<UserAuthForm />);

    await fillForm({ password: "Password1!", confirmPassword: "Password2!" });

    expect(
      await screen.findByText("Passwords must match"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeDisabled();
  });

  it("checks email availability after the debounce", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ available: false }),
    });

    render(<UserAuthForm />);
    await userEvent.type(
      screen.getByPlaceholderText("Enter your email"),
      "ada@example.com",
    );

    expect(
      await screen.findByText("This email is already registered.", undefined, {
        timeout: 2000,
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/check-email?email=ada%40example.com",
      expect.anything(),
    );
  });

  it("returns to idle when the availability check fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    render(<UserAuthForm />);
    await userEvent.type(
      screen.getByPlaceholderText("Enter your email"),
      "ada@example.com",
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByText("This email is already registered."),
      ).not.toBeInTheDocument(),
    );
  });

  it("does not check availability for an invalid email", async () => {
    render(<UserAuthForm />);
    await userEvent.type(
      screen.getByPlaceholderText("Enter your email"),
      "not-an-email",
    );

    await waitFor(
      () => expect(fetchMock).not.toHaveBeenCalled(),
      { timeout: 800 },
    );
  });

  it("creates the account, signs in, and routes to onboarding", async () => {
    render(<UserAuthForm />);

    await fillForm();
    await submitWhenEnabled();

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("/api/signup", {
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "Password1!",
      }),
    );
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ada@example.com",
      password: "Password1!",
      redirect: false,
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"));
    expect(toast.success).toHaveBeenCalledWith(
      "Account created successfully",
    );
  });

  it("routes to sign-in when auto sign-in fails", async () => {
    signIn.mockResolvedValue({ ok: false });
    render(<UserAuthForm />);

    await fillForm();
    await submitWhenEnabled();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/signin"));
    expect(toast.success).toHaveBeenCalledWith(
      "Account created successfully. Please sign in.",
    );
  });

  it("shows the API error message", async () => {
    const error = Object.assign(new Error("failed"), {
      response: { data: { error: "Email already exists" } },
    });
    axiosPost.mockRejectedValue(error);

    render(<UserAuthForm />);
    await fillForm();
    await submitWhenEnabled();

    expect(
      await screen.findByText("Email already exists"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic error for network failures", async () => {
    axiosPost.mockRejectedValue(new Error("offline"));

    render(<UserAuthForm />);
    await fillForm();
    await submitWhenEnabled();

    expect(
      await screen.findByText("Registration failed"),
    ).toBeInTheDocument();
  });

  it("shows the loading state and disables fields", async () => {
    let resolvePost: (value: unknown) => void = () => {};
    axiosPost.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    render(<UserAuthForm />);
    await fillForm();
    await submitWhenEnabled();

    expect(
      await screen.findByRole("button", { name: "Loading..." }),
    ).toBeDisabled();
    expect(
      screen.getByPlaceholderText("Enter your name"),
    ).toBeDisabled();

    resolvePost({ status: 200, data: {} });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"));
  });

  it("toggles both password fields", async () => {
    render(<UserAuthForm />);

    const password = screen.getByPlaceholderText("Enter your password");
    const confirm = screen.getByPlaceholderText("Re-enter your password");

    await userEvent.click(
      password.parentElement?.querySelector("button") as HTMLElement,
    );
    await userEvent.click(
      confirm.parentElement?.querySelector("button") as HTMLElement,
    );

    expect(password).toHaveAttribute("type", "text");
    expect(confirm).toHaveAttribute("type", "text");
  });

  it("links back to sign-in", () => {
    render(<UserAuthForm />);

    expect(
      screen.getByRole("link", { name: "Already have an account?" }),
    ).toHaveAttribute("href", "/signin");
  });
});
