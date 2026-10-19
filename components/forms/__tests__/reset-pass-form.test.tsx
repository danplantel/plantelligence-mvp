import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResetPasswordForm from "../reset-pass-form";

const axiosPost = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  message: vi.fn(),
}));
const search = vi.hoisted(() => ({
  params: new URLSearchParams(
    "email=ada%40example.com&token=reset-token",
  ),
}));

vi.mock("axios", () => ({ default: { post: axiosPost } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => search.params,
}));
vi.mock("sonner", () => ({ toast }));

function renderForm() {
  return render(<ResetPasswordForm />);
}

async function submit(password: string, confirmPassword = password) {
  await userEvent.type(
    screen.getByPlaceholderText("Enter new password"),
    password,
  );
  await userEvent.type(
    screen.getByPlaceholderText("Confirm new password"),
    confirmPassword,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Reset Password" }),
  );
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    search.params = new URLSearchParams(
      "email=ada%40example.com&token=reset-token",
    );
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ status: 200, data: {} });
    push.mockReset();
    toast.success.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders both password fields and the policy hint", () => {
    renderForm();

    expect(
      screen.getByPlaceholderText("Enter new password"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Confirm new password"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Must be at least 8 characters with uppercase/),
    ).toBeInTheDocument();
  });

  it("requires at least eight characters", async () => {
    renderForm();
    await submit("Short1!");

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("requires every character class", async () => {
    renderForm();
    await submit("password1!");

    expect(
      await screen.findByText(
        "Password must contain at least one uppercase letter",
      ),
    ).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("requires the passwords to match", async () => {
    renderForm();
    await submit("Password1!", "Password2!");

    expect(await screen.findByText("Passwords must match")).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("resets the password with the verified token", async () => {
    renderForm();
    await submit("Password1!");

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("/api/reset-password", {
        email: "ada@example.com",
        newPassword: "Password1!",
        resetToken: "reset-token",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Password reset successfully. Please sign in.",
    );
    expect(push).toHaveBeenCalledWith("/signin");
  });

  it("shows the API error message", async () => {
    const error = Object.assign(new Error("failed"), {
      response: { data: { error: "Invalid or expired reset token" } },
    });
    axiosPost.mockRejectedValue(error);

    renderForm();
    await submit("Password1!");

    expect(
      await screen.findByText("Invalid or expired reset token"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic error for network failures", async () => {
    axiosPost.mockRejectedValue(new Error("offline"));

    renderForm();
    await submit("Password1!");

    expect(
      await screen.findByText("An unexpected error occurred"),
    ).toBeInTheDocument();
  });

  it("shows the loading state and disables both fields", async () => {
    let resolvePost: (value: unknown) => void = () => {};
    axiosPost.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    renderForm();
    await submit("Password1!");

    expect(
      await screen.findByRole("button", { name: "Resetting..." }),
    ).toBeDisabled();
    expect(
      screen.getByPlaceholderText("Enter new password"),
    ).toBeDisabled();
    expect(
      screen.getByPlaceholderText("Confirm new password"),
    ).toBeDisabled();

    resolvePost({ status: 200, data: {} });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("toggles both password fields", async () => {
    renderForm();

    const password = screen.getByPlaceholderText("Enter new password");
    const confirm = screen.getByPlaceholderText("Confirm new password");

    await userEvent.click(
      password.parentElement?.querySelector("button") as HTMLElement,
    );
    await userEvent.click(
      confirm.parentElement?.querySelector("button") as HTMLElement,
    );

    expect(password).toHaveAttribute("type", "text");
    expect(confirm).toHaveAttribute("type", "text");
  });

  it("posts an empty token when the query has none", async () => {
    search.params = new URLSearchParams("email=ada%40example.com");

    renderForm();
    await submit("Password1!");

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("/api/reset-password", {
        email: "ada@example.com",
        newPassword: "Password1!",
        resetToken: "",
      }),
    );
  });
});
