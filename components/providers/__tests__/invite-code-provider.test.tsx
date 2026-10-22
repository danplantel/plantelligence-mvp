import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InviteCodeProvider } from "@/components/providers/invite-code-provider";

/**
 * The Early Access gate.
 *
 * It wraps the whole app, so it also wraps the portal. A downloaded (installed)
 * PWA opens at the plan's `start_url` (`/<slug>`) and the gate's pass is a
 * `localStorage` key that an installed app may not share with the browser — which
 * is why the very first launch of the downloaded app landed on the invite-code
 * screen instead of the participant's benefits.
 */

const mocks = vi.hoisted(() => ({
  isStandaloneDisplay: vi.fn((): boolean => false),
}));

vi.mock("@/lib/pwa/install-prompt", () => ({
  isStandaloneDisplay: mocks.isStandaloneDisplay,
}));

vi.mock("@/components/modals/invite-code-modal", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="invite-code-modal" /> : null,
}));

function renderProvider() {
  return render(
    <InviteCodeProvider>
      <div data-testid="app">Application</div>
    </InviteCodeProvider>,
  );
}

describe("InviteCodeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.isStandaloneDisplay.mockReturnValue(false);
  });

  it("skips the gate entirely inside an installed PWA", async () => {
    mocks.isStandaloneDisplay.mockReturnValue(true);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("app")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("invite-code-modal")).not.toBeInTheDocument();
  });

  it("does not write the gate's local flag when running standalone", async () => {
    mocks.isStandaloneDisplay.mockReturnValue(true);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("app")).toBeInTheDocument(),
    );
    expect(
      window.localStorage.getItem("plantelligence_authenticated"),
    ).toBeNull();
  });

  it("asks for the code in a browser that has not passed the gate", async () => {
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("invite-code-modal")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("app")).not.toBeInTheDocument();
  });

  it("renders the app once the gate has been passed before", async () => {
    window.localStorage.setItem("plantelligence_authenticated", "true");

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("app")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("invite-code-modal")).not.toBeInTheDocument();
  });
});
