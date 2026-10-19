import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResumeOnboardingLink } from "../resume-onboarding-link";

const fetchMock = vi.fn();

async function openDialog() {
  await userEvent.click(
    screen.getByRole("button", {
      name: "Already started setup? Email me a link to continue",
    }),
  );
}

describe("ResumeOnboardingLink", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("opens a dialog with an email field", async () => {
    render(<ResumeOnboardingLink />);

    await openDialog();

    expect(
      await screen.findByText("Continue your setup"),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Email me a link" }),
    ).toBeInTheDocument();
  });

  it("posts the email and shows the neutral confirmation", async () => {
    render(<ResumeOnboardingLink />);
    await openDialog();

    await userEvent.type(
      screen.getByPlaceholderText("you@example.com"),
      "ada@example.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Email me a link" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/request-resume-link",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "ada@example.com" }),
        }),
      ),
    );
    expect(
      await screen.findByText(/a resume link is on its way/),
    ).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("shows the same neutral confirmation when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    render(<ResumeOnboardingLink />);
    await openDialog();

    await userEvent.type(
      screen.getByPlaceholderText("you@example.com"),
      "ada@example.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Email me a link" }),
    );

    expect(
      await screen.findByText(/a resume link is on its way/),
    ).toBeInTheDocument();
  });

  it("Cancel closes the dialog and resets the form", async () => {
    render(<ResumeOnboardingLink />);
    await openDialog();

    await userEvent.type(
      screen.getByPlaceholderText("you@example.com"),
      "ada@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("Continue your setup")).not.toBeInTheDocument(),
    );

    await openDialog();
    expect(screen.getByPlaceholderText("you@example.com")).toHaveValue("");
  });
});
