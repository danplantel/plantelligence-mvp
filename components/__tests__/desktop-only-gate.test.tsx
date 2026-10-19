import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DESKTOP_ONLY_COPY } from "@/lib/desktop-only";

import { DesktopOnlyGate } from "../desktop-only-gate";

const media = vi.hoisted(() => ({ isDesktop: true }));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => media.isDesktop,
}));

describe("DesktopOnlyGate", () => {
  beforeEach(() => {
    media.isDesktop = true;
  });

  it("renders children on desktop and does not report a block", () => {
    const onBlocked = vi.fn();

    render(
      <DesktopOnlyGate variant="onboarding" onBlocked={onBlocked}>
        <div>Wizard</div>
      </DesktopOnlyGate>,
    );

    expect(screen.getByText("Wizard")).toBeInTheDocument();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("renders the onboarding notice and reports the block on mobile", () => {
    media.isDesktop = false;
    const onBlocked = vi.fn();

    render(
      <DesktopOnlyGate variant="onboarding" onBlocked={onBlocked}>
        <div>Wizard</div>
      </DesktopOnlyGate>,
    );

    expect(screen.queryByText("Wizard")).not.toBeInTheDocument();
    expect(
      screen.getByText(DESKTOP_ONLY_COPY.onboarding.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(DESKTOP_ONLY_COPY.onboarding.body),
    ).toBeInTheDocument();
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it("uses the dashboard copy for the dashboard variant", () => {
    media.isDesktop = false;

    render(
      <DesktopOnlyGate variant="dashboard">
        <div>Dashboard</div>
      </DesktopOnlyGate>,
    );

    expect(
      screen.getByText(DESKTOP_ONLY_COPY.dashboard.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(DESKTOP_ONLY_COPY.dashboard.body),
    ).toBeInTheDocument();
  });

  it("works without an onBlocked callback", () => {
    media.isDesktop = false;

    render(
      <DesktopOnlyGate variant="onboarding">
        <div>Wizard</div>
      </DesktopOnlyGate>,
    );

    expect(
      screen.getByText(DESKTOP_ONLY_COPY.onboarding.title),
    ).toBeInTheDocument();
  });

  it("reports a block when the viewport shrinks after mount", () => {
    const onBlocked = vi.fn();
    const { rerender } = render(
      <DesktopOnlyGate variant="onboarding" onBlocked={onBlocked}>
        <div>Wizard</div>
      </DesktopOnlyGate>,
    );
    expect(onBlocked).not.toHaveBeenCalled();

    media.isDesktop = false;
    rerender(
      <DesktopOnlyGate variant="onboarding" onBlocked={onBlocked}>
        <div>Wizard</div>
      </DesktopOnlyGate>,
    );

    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Wizard")).not.toBeInTheDocument();
  });

  it("reports again when a new onBlocked callback arrives while blocked", () => {
    media.isDesktop = false;
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = render(
      <DesktopOnlyGate variant="onboarding" onBlocked={first}>
        <div>Wizard</div>
      </DesktopOnlyGate>,
    );
    rerender(
      <DesktopOnlyGate variant="onboarding" onBlocked={second}>
        <div>Wizard</div>
      </DesktopOnlyGate>,
    );

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
