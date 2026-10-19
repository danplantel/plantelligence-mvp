import React from "react";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgetPasswordForm from "../forget-password-form";

const axiosPost = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  message: vi.fn(),
}));

vi.mock("axios", () => ({ default: { post: axiosPost } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
vi.mock("sonner", () => ({ toast }));

function renderForm() {
  return render(<ForgetPasswordForm />);
}

async function submit(email: string) {
  await userEvent.type(screen.getByPlaceholderText("Enter your email"), email);
  await userEvent.click(
    screen.getByRole("button", { name: "Forget Password" }),
  );
}

describe("ForgetPasswordForm", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ status: 200, data: {} });
    replace.mockReset();
    toast.success.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders the email field and submit button", () => {
    renderForm();

    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Forget Password" }),
    ).toBeInTheDocument();
  });

  it("rejects an invalid email without calling the API", async () => {
    renderForm();

    const input = screen.getByPlaceholderText("Enter your email");
    fireEvent.change(input, { target: { value: "not-an-email" } });
    // Native `type="email"` validation would block a click before React Hook
    // Form runs, so submit the form directly to exercise the Zod resolver.
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("requests a reset code and routes to verification", async () => {
    renderForm();
    await submit("ada@example.com");

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("/api/forget", {
        email: "ada@example.com",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Please check your email for password reset instructions",
    );
    expect(replace).toHaveBeenCalledWith(
      "/verify-code?email=ada@example.com",
    );
  });

  it("shows the API error message", async () => {
    const error = Object.assign(new Error("failed"), {
      response: { data: { error: "Too many requests" } },
    });
    axiosPost.mockRejectedValue(error);

    renderForm();
    await submit("ada@example.com");

    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a generic error for network failures", async () => {
    axiosPost.mockRejectedValue(new Error("offline"));

    renderForm();
    await submit("ada@example.com");

    expect(
      await screen.findByText("An unexpected error occurred"),
    ).toBeInTheDocument();
  });

  it("shows the loading state and disables the field", async () => {
    let resolvePost: (value: unknown) => void = () => {};
    axiosPost.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    renderForm();
    await submit("ada@example.com");

    expect(
      await screen.findByRole("button", { name: "Sending..." }),
    ).toBeDisabled();
    expect(screen.getByPlaceholderText("Enter your email")).toBeDisabled();

    resolvePost({ status: 200, data: {} });
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });

  it("clears the error after eight seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const error = Object.assign(new Error("failed"), {
        response: { data: { error: "Temporary failure" } },
      });
      axiosPost.mockRejectedValue(error);

      renderForm();
      fireEvent.change(screen.getByPlaceholderText("Enter your email"), {
        target: { value: "ada@example.com" },
      });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(
        screen.getByRole("button", { name: "Forget Password" }),
      );

      expect(
        await screen.findByText("Temporary failure"),
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(8000);
      });

      expect(
        screen.queryByText("Temporary failure"),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
