import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewLayoutClient } from "@/components/layout/layout-client";

/**
 * Dashboard chrome routing.
 *
 * The regression this file exists for: `NewLayoutClient` used to call the two
 * wizard-store hooks only AFTER its `/onboarding` and auth-page early returns.
 * Moving from a standalone route to a dashboard route then rendered more hooks
 * than the previous render and React threw
 * "Rendered more hooks than during the previous render".
 *
 * The chrome itself is stubbed; the assertions are about which shell renders
 * and, critically, that the same component instance can switch between
 * standalone and dashboard routes without crashing.
 */

const mocks = vi.hoisted(() => ({
  pathname: "/onboarding",
  mayUsePath: vi.fn(() => true),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/components/layout/header", () => ({
  default: ({ stepper, stepTitle }: any) => (
    <header data-testid="header" data-step-title={stepTitle ?? ""}>
      {stepper}
    </header>
  ),
}));

vi.mock("@/components/layout/sidebar", () => ({
  default: () => <aside data-testid="sidebar" />,
}));

vi.mock("@/components/wizard/wizard-stepper", () => ({
  WizardStepper: ({ steps, currentStep, totalSteps }: any) => (
    <div
      data-testid="stepper"
      data-steps={steps?.length ?? 0}
      data-current={currentStep ?? ""}
      data-total={totalSteps ?? ""}
    />
  ),
}));

vi.mock("@/lib/new-client-wizard-store", () => ({
  useNewClientWizardStore: (selector: (state: any) => unknown) =>
    selector({
      steps: [
        { id: 1, title: "New User Setup" },
        { id: 2, title: "Services" },
      ],
      currentStep: 1,
    }),
}));

vi.mock("@/lib/benefits-wizard-store", () => ({
  useBenefitsWizardStore: (selector: (state: any) => unknown) =>
    selector({
      steps: [{ id: 1 }, { id: 2 }],
      currentStep: 1,
      totalSteps: 2,
    }),
}));

vi.mock("@/hooks/useViewerAccess", () => ({
  useViewerAccess: () => ({
    isCollaborator: false,
    can: () => true,
    primaryAssignment: null,
  }),
  VIEWER_ACCESS_KEY: "viewer-access",
}));

vi.mock("@/lib/teammates/nav-access", () => ({
  mayUsePath: mocks.mayUsePath,
}));

vi.mock("@/components/desktop-only-gate", () => ({
  DesktopOnlyGate: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  CommentModeProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/messages/messages-mode-provider", () => ({
  MessagesModeProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/comments/comments-rail", () => ({
  CommentsRail: () => null,
}));

vi.mock("@/components/messages/messages-rail", () => ({
  MessagesRail: () => null,
}));

vi.mock("@/components/pages/no-access-notice", () => ({
  NoAccessNotice: () => <div data-testid="no-access" />,
}));

vi.mock("swr", () => ({
  SWRConfig: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

function renderLayout(pathname: string) {
  mocks.pathname = pathname;
  const ui = (path: string) => {
    mocks.pathname = path;
    return (
      <NewLayoutClient viewerAccess={{} as any}>
        <p data-testid="page">page content</p>
      </NewLayoutClient>
    );
  };
  const view = render(ui(pathname));
  return {
    ...view,
    show: (path: string) => view.rerender(ui(path)),
  };
}

describe("NewLayoutClient", () => {
  beforeEach(() => {
    mocks.mayUsePath.mockReturnValue(true);
  });

  it("renders onboarding standalone, without the dashboard chrome", () => {
    renderLayout("/onboarding");

    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("renders auth pages standalone", () => {
    renderLayout("/signin");

    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
  });

  it("moves from onboarding to the benefits wizard without changing hook order", () => {
    const view = renderLayout("/onboarding");

    // This rerender is the regression: the same layout instance must add the
    // header, sidebar and stepper without React throwing a hook-order error.
    view.show("/new-benefits");

    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("stepper")).toHaveAttribute("data-steps", "2");
    expect(screen.getByTestId("stepper")).toHaveAttribute("data-total", "2");
  });

  it("moves from sign-in to the new-client wizard without changing hook order", () => {
    const view = renderLayout("/signin");

    view.show("/new-client");

    expect(screen.getByTestId("header")).toHaveAttribute(
      "data-step-title",
      "New User Setup",
    );
    // The new-client stepper reads its own store, so it is rendered without
    // props; only the benefits stepper is fed the state above.
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
  });

  it("shows no stepper outside the wizard routes", () => {
    renderLayout("/benefits");

    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.queryByTestId("stepper")).not.toBeInTheDocument();
  });

  it("renders the refusal instead of the page when the path is not allowed", () => {
    mocks.mayUsePath.mockReturnValue(false);
    renderLayout("/settings");

    expect(screen.getByTestId("no-access")).toBeInTheDocument();
    expect(screen.queryByTestId("page")).not.toBeInTheDocument();
  });
});
