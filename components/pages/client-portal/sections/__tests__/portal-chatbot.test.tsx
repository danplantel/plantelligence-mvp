import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PortalChatbot } from "../portal-chatbot";

/**
 * The portal's floating "Ask a question" action — the chatbot the old header
 * button was replaced with.
 *
 * It is UI only: the composer appends what the visitor types to the local
 * transcript and stops there, so these tests pin the shell (open/close, the
 * greeting, sending, Escape) rather than any reply.
 */

const mocks = vi.hoisted(() => ({
  clientData: {
    brandColor: "#123456",
    secondaryColor: "#abcdef",
  } as Record<string, unknown> | undefined,
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useOptionalClientPortal: () => ({ clientData: mocks.clientData }),
}));

describe("PortalChatbot", () => {
  it("starts as a closed floating action button", () => {
    render(<PortalChatbot />);

    const fab = screen.getByRole("button", { name: "Ask a question" });
    expect(fab).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a chat sheet with a greeting", async () => {
    const user = userEvent.setup();
    render(<PortalChatbot />);

    await user.click(screen.getByRole("button", { name: "Ask a question" }));

    expect(
      screen.getByRole("dialog", { name: "Benefits assistant" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/I'm your benefits assistant/i),
    ).toBeInTheDocument();
    // The FAB becomes the "close" affordance and reports the open state.
    expect(screen.getByRole("button", { name: "Close chat" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("appends what the visitor types", async () => {
    const user = userEvent.setup();
    render(<PortalChatbot />);

    await user.click(screen.getByRole("button", { name: "Ask a question" }));
    const input = screen.getByRole("textbox", { name: "Type your question" });
    await user.type(input, "How do I enroll?");
    await user.click(screen.getByRole("button", { name: "Send your question" }));

    expect(screen.getByText("How do I enroll?")).toBeInTheDocument();
    // The composer clears so the next question can be typed.
    expect(input).toHaveValue("");
  });

  it("ignores an empty draft", async () => {
    const user = userEvent.setup();
    render(<PortalChatbot />);

    await user.click(screen.getByRole("button", { name: "Ask a question" }));

    expect(
      screen.getByRole("button", { name: "Send your question" }),
    ).toBeDisabled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<PortalChatbot />);

    await user.click(screen.getByRole("button", { name: "Ask a question" }));
    await user.keyboard("{Escape}");

    // AnimatePresence keeps the sheet mounted for its exit animation.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("closes from its header button", async () => {
    const user = userEvent.setup();
    render(<PortalChatbot />);

    await user.click(screen.getByRole("button", { name: "Ask a question" }));
    await user.click(
      screen.getByRole("button", { name: "Close the benefits assistant" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Ask a question" }),
    ).toBeInTheDocument();
  });

  it("wears the plan's brand colour", () => {
    render(<PortalChatbot />);

    expect(
      screen.getByRole("button", { name: "Ask a question" }),
    ).toHaveStyle({ backgroundColor: "#123456" });
  });

  it("falls back to the portal defaults outside a plan context", () => {
    mocks.clientData = undefined;
    render(<PortalChatbot />);

    expect(
      screen.getByRole("button", { name: "Ask a question" }),
    ).toHaveStyle({ backgroundColor: "#1F3A60" });

    mocks.clientData = { brandColor: "#123456", secondaryColor: "#abcdef" };
  });
});
