import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalCommentsRail } from "../portal-comments-rail";

/**
 * `PortalCommentsRail` is the only thing standing between a shared portal link
 * and a participant seeing the advisor's comments panel.
 *
 * Three gates must all open — the `?comments=on` flag, an authenticated
 * session, and a desktop viewport — and the suite pins each one
 * independently, because any single gate regressing is a privacy or a
 * usability bug depending on which it is:
 *
 *  - no flag → a plain portal, no provider, no rail;
 *  - no session → a plain portal (the portal route is public by design);
 *  - below 1024px → a plain portal, and `--comments-inset` is never set.
 *
 * Armed, the component also owns the rail's top offset variable and the
 * floating button that lets an advisor close and reopen the panel without
 * editing the URL.
 */

const mocks = vi.hoisted(() => ({
  sessionStatus: "authenticated" as
    | "authenticated"
    | "unauthenticated"
    | "loading",
  isDesktop: true,
  initialModes: [] as string[],
  mode: {
    canComment: true,
    mode: "on" as "on" | "off",
    needsDraft: false,
    toggleMode: vi.fn(),
  },
  messagesMode: {
    open: false,
    toggle: vi.fn(),
    unreadTotal: 0,
  },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.sessionStatus, data: null }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
  usePathname: () => "/plan-1/retirement",
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({ clientData: { companyName: "Acme Corp" } }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => mocks.isDesktop,
}));

vi.mock("@/components/comments/comments-rail", () => ({
  CommentsRail: ({ surfaceLabel, showViewer, showPanelSwitch }: any) => (
    <div
      data-testid="comments-rail"
      data-surface-label={surfaceLabel ?? ""}
      data-show-viewer={String(Boolean(showViewer))}
      data-show-panel-switch={String(Boolean(showPanelSwitch))}
    />
  ),
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  CommentModeProvider: ({
    children,
    initialMode,
  }: {
    children: React.ReactNode;
    initialMode?: string;
  }) => {
    mocks.initialModes.push(String(initialMode));
    return <div data-testid="comment-mode-provider">{children}</div>;
  },
  useCommentMode: () => mocks.mode,
}));

vi.mock("@/components/messages/messages-mode-provider", () => ({
  MessagesModeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="messages-mode-provider">{children}</div>
  ),
  useMessagesMode: () => mocks.messagesMode,
}));

vi.mock("@/components/messages/messages-rail", () => ({
  MessagesRail: ({ showPanelSwitch }: any) => (
    <div
      data-testid="messages-rail"
      data-show-panel-switch={String(Boolean(showPanelSwitch))}
    />
  ),
}));

function renderRail() {
  return render(
    <PortalCommentsRail>
      <p>portal content</p>
    </PortalCommentsRail>,
  );
}

function setSearch(search: string) {
  window.history.replaceState({}, "", `/plan-1${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessionStatus = "authenticated";
  mocks.isDesktop = true;
  mocks.initialModes = [];
  mocks.mode = {
    canComment: true,
    mode: "on",
    needsDraft: false,
    toggleMode: vi.fn(),
  };
  mocks.messagesMode = {
    open: false,
    toggle: vi.fn(),
    unreadTotal: 0,
  };
  setSearch("");
  document.documentElement.style.removeProperty("--comments-rail-top");
});

describe("PortalCommentsRail gates", () => {
  it("renders a plain portal without the flag", () => {
    renderRail();

    expect(screen.getByText("portal content")).toBeInTheDocument();
    expect(screen.queryByTestId("comments-rail")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("comment-mode-provider"),
    ).not.toBeInTheDocument();
    expect(mocks.initialModes).toEqual([]);
  });

  it("requires the exact flag value", () => {
    setSearch("?comments=1");
    renderRail();

    expect(screen.queryByTestId("comments-rail")).not.toBeInTheDocument();
  });

  it("renders a plain portal for an unauthenticated visitor", () => {
    setSearch("?comments=on");
    mocks.sessionStatus = "unauthenticated";
    renderRail();

    expect(screen.queryByTestId("comments-rail")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("comment-mode-provider"),
    ).not.toBeInTheDocument();
  });

  it("renders a plain portal while the session is still loading", () => {
    setSearch("?comments=on");
    mocks.sessionStatus = "loading";
    renderRail();

    expect(screen.queryByTestId("comments-rail")).not.toBeInTheDocument();
  });

  it("ignores the flag on a non-desktop viewport", () => {
    setSearch("?comments=on");
    mocks.isDesktop = false;
    renderRail();

    expect(screen.queryByTestId("comments-rail")).not.toBeInTheDocument();
    expect(
      document.documentElement.style.getPropertyValue("--comments-rail-top"),
    ).toBe("");
  });

  it("arms with the flag, a session and a desktop viewport", () => {
    setSearch("?comments=on&tab=docs");
    renderRail();

    expect(screen.getByTestId("comments-rail")).toBeInTheDocument();
    expect(screen.getByText("portal content")).toBeInTheDocument();
    expect(mocks.initialModes).toEqual(["on"]);
  });

  it("names the plan/benefit conversation and shows the reader's identity", () => {
    setSearch("?comments=on");
    renderRail();

    expect(screen.getByTestId("comments-rail")).toHaveAttribute(
      "data-surface-label",
      "Acme Corp · Retirement",
    );
    expect(screen.getByTestId("comments-rail")).toHaveAttribute(
      "data-show-viewer",
      "true",
    );
  });

  it("mounts Direct Messages and puts the panel switch inside both rails", () => {
    setSearch("?comments=on");
    renderRail();

    expect(screen.getByTestId("messages-rail")).toBeInTheDocument();
    expect(screen.getByTestId("comments-rail")).toHaveAttribute(
      "data-show-panel-switch",
      "true",
    );
    expect(screen.getByTestId("messages-rail")).toHaveAttribute(
      "data-show-panel-switch",
      "true",
    );
  });
});

describe("PortalCommentsRail chrome", () => {
  it("pins the rail to the top of the window while armed", () => {
    setSearch("?comments=on");
    const { unmount } = renderRail();

    expect(
      document.documentElement.style.getPropertyValue("--comments-rail-top"),
    ).toBe("0px");

    unmount();
    expect(
      document.documentElement.style.getPropertyValue("--comments-rail-top"),
    ).toBe("");
  });

  it("offers the on/off control with the active label", async () => {
    const user = userEvent.setup();
    setSearch("?comments=on");
    renderRail();

    const button = screen.getByRole("button", { name: "Turn comments off" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toBeEnabled();

    await user.click(button);
    expect(mocks.mode.toggleMode).toHaveBeenCalledTimes(1);
  });

  it("labels the control for reopening the rail", () => {
    setSearch("?comments=on");
    mocks.mode = { ...mocks.mode, mode: "off" };
    renderRail();

    const button = screen.getByRole("button", { name: "Turn comments on" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("explains why the control is unavailable before a draft exists", () => {
    setSearch("?comments=on");
    mocks.mode = { ...mocks.mode, canComment: false, needsDraft: true };
    renderRail();

    const button = screen.getByRole("button", {
      name: "Save a draft to turn on comments",
    });
    expect(button).toBeDisabled();
  });

  it("sits at the rail's left edge while either rail is open", () => {
    setSearch("?comments=on");
    renderRail();

    expect(
      screen.getByRole("button", { name: "Turn comments off" }),
    ).toHaveStyle({
      right:
        "calc(max(var(--comments-inset, 0px), var(--messages-inset, 0px)) + 1.5rem)",
    });
  });
});
