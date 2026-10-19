import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VerifyCodeForm from "../verify-code-form";

const axiosPost = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({
  params: new URLSearchParams("email=ada%40example.com"),
}));

vi.mock("axios", () => ({
  default: { post: axiosPost },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => search.params,
}));

function renderForm() {
  return render(<VerifyCodeForm />);
}

async function submit(code: string) {
  await userEvent.type(
    screen.getByPlaceholderText("Enter your 6-digit code"),
    code,
  );
  await userEvent.click(screen.getByRole("button", { name: "Verify Code" }));
}

describe("VerifyCodeForm", () => {
  beforeEach(() => {
    search.params = new URLSearchParams("email=ada%40example.com");
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      status: 200,
      data: { resetToken: "reset-token" },
    });
    replace.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders the code field and submit button", () => {
    renderForm();

    expect(
      screen.getByPlaceholderText("Enter your 6-digit code"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verify Code" }),
    ).toBeInTheDocument();
  });

  it("rejects a code shorter than six digits", async () => {
    renderForm();
    await submit("123");

    expect(
      await screen.findByText("Code must be 6 digits"),
    ).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("rejects a code longer than six digits", async () => {
    renderForm();
    await submit("1234567");

    expect(
      await screen.findByText("Code must be 6 digits"),
    ).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("verifies the code and routes to reset-password", async () => {
    renderForm();
    await submit("123456");

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("/api/verify-code", {
        email: "ada@example.com",
        code: "123456",
      }),
    );
    expect(replace).toHaveBeenCalledWith(
      "/reset-password?email=ada%40example.com&token=reset-token",
    );
  });

  it("shows the API error message", async () => {
    const error = Object.assign(new Error("failed"), {
      response: { data: { error: "Invalid or expired code" } },
    });
    axiosPost.mockRejectedValue(error);

    renderForm();
    await submit("123456");

    expect(
      await screen.findByText("Invalid or expired code"),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a generic error for network failures", async () => {
    axiosPost.mockRejectedValue(new Error("offline"));

    renderForm();
    await submit("123456");

    expect(
      await screen.findByText("Verification failed"),
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
    await submit("123456");

    expect(
      await screen.findByRole("button", { name: "Verifying..." }),
    ).toBeDisabled();
    expect(
      screen.getByPlaceholderText("Enter your 6-digit code"),
    ).toBeDisabled();

    resolvePost({ status: 200, data: { resetToken: "reset-token" } });
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });

  it("posts an empty email when the query has none", async () => {
    search.params = new URLSearchParams();

    renderForm();
    await submit("123456");

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("/api/verify-code", {
        email: "",
        code: "123456",
      }),
    );
  });
});
