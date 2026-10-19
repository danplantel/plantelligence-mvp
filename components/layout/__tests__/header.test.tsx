import React from "react";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "../header";

const mocks = vi.hoisted(() => ({
  title: "",
  subtitle: "",
  theme: "light" as string | undefined,
  resolvedTheme: "light" as string | undefined,
  setTheme: vi.fn(),
  userNav: { compact: false, detailsFrom: "xl" } as {
    compact?: boolean;
    detailsFrom?: string;
  },
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    title: mocks.title,
    subtitle: mocks.subtitle,
    setTitle: vi.fn(),
    setSubtitle: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mocks.theme,
    resolvedTheme: mocks.resolvedTheme,
    setTheme: mocks.setTheme,
  }),
}));

vi.mock("@/components/layout/notifications-menu", () => ({
  NotificationsMenu: () => <div data-testid="notifications-menu" />,
}));

vi.mock("@/components/comments/comments-toggle", () => ({
  CommentsToggle: () => <div data-testid="comments-toggle" />,
}));

vi.mock("@/components/messages/messages-toggle", () => ({
  MessagesToggle: () => <div data-testid="messages-toggle" />,
}));

vi.mock("@/components/layout/user-nav", () => ({
  UserNav: (props: { compact?: boolean; detailsFrom?: string }) => {
    mocks.userNav = props;
    return (
      <div
        data-testid="user-nav"
        data-compact={String(props.compact)}
        data-details-from={props.detailsFrom}
      />
    );
  },
}));

function fireEditorEvent(name: string, isOpen: boolean) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(name, { detail: { isOpen } }),
    );
  });
}

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.title = "";
  mocks.subtitle = "";
  mocks.theme = "light";
  mocks.resolvedTheme = "light";
  mocks.userNav = { compact: false, detailsFrom: "xl" };
  setScrollY(0);
});

describe("Header", () => {
  it("renders the page title, subtitle, step title, and action cluster", async () => {
    mocks.title = "Dashboard";
    mocks.subtitle = "Acme Advisors";

    render(<Header stepTitle="Step 2" />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Dashboard/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Acme Advisors")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByTestId("messages-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("comments-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("notifications-menu")).toBeInTheDocument();
    expect(await screen.findByTestId("user-nav")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
  });

  it("renders nothing for the title group when title, subtitle, and step are empty", () => {
    render(<Header />);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("/")).not.toBeInTheDocument();
  });

  it("splits a company name out of the page title", () => {
    mocks.title = "Edit Plan - Acme Advisors";

    render(<Header />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Edit Plan - Acme Advisors");
    expect(heading).toHaveTextContent("Edit Plan");
    const company = screen.getByText("Acme Advisors");
    expect(company).toHaveClass("text-accent-blue");
  });

  it("keeps a title with no company separator intact", () => {
    mocks.title = "Dashboard";

    render(<Header />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Dashboard",
    );
    expect(screen.queryByText(" - ")).not.toBeInTheDocument();
  });

  it("renders a subtitle separator", () => {
    mocks.title = "Settings";
    mocks.subtitle = "Acme Advisors";

    render(<Header />);

    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("shows the in-flow stepper when the editor is closed", () => {
    render(<Header stepper={<div data-testid="stepper">Step 1</div>} />);

    const stepper = screen.getByTestId("stepper");
    expect(stepper.parentElement?.className).toContain("justify-center");
    expect(stepper.parentElement?.className).not.toContain("absolute");
  });

  it("moves the stepper into the overlay and hides the title while editing", () => {
    mocks.title = "Edit Plan - Acme";
    mocks.subtitle = "Acme Advisors";

    render(<Header stepper={<div data-testid="stepper">Step 1</div>} />);

    fireEditorEvent("step5EditorStateChange", true);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("Acme Advisors")).not.toBeInTheDocument();
    const stepper = screen.getByTestId("stepper");
    expect(stepper.parentElement?.className).toContain("absolute");
    expect(screen.getByTestId("user-nav")).toHaveAttribute(
      "data-compact",
      "true",
    );
  });

  it("reacts to the step-2 editor event and restores the bar when it closes", () => {
    mocks.title = "Create Client";
    render(<Header stepper={<div data-testid="stepper">Step 1</div>} />);

    fireEditorEvent("step2EditorStateChange", true);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();

    fireEditorEvent("step2EditorStateChange", false);
    expect(
      screen.getByRole("heading", { level: 1, name: "Create Client" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("user-nav")).toHaveAttribute(
      "data-compact",
      "false",
    );
  });

  it("detects a page tab strip portalled into the header", async () => {
    render(<Header />);

    expect(screen.getByTestId("user-nav")).toHaveAttribute(
      "data-details-from",
      "xl",
    );

    const portal = document.getElementById("header-tabs-portal");
    expect(portal).not.toBeNull();

    act(() => {
      const tabs = document.createElement("div");
      tabs.setAttribute("role", "tablist");
      portal!.appendChild(tabs);
    });

    await waitFor(() =>
      expect(screen.getByTestId("user-nav")).toHaveAttribute(
        "data-details-from",
        "2xl",
      ),
    );
  });

  it("collapses the tab-strip allowance when the portalled content is removed", async () => {
    render(<Header />);
    const portal = document.getElementById("header-tabs-portal")!;

    act(() => {
      portal.appendChild(document.createElement("div"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("user-nav")).toHaveAttribute(
        "data-details-from",
        "2xl",
      ),
    );

    act(() => {
      portal.replaceChildren();
    });
    await waitFor(() =>
      expect(screen.getByTestId("user-nav")).toHaveAttribute(
        "data-details-from",
        "xl",
      ),
    );
  });

  it("toggles from light to dark", async () => {
    mocks.resolvedTheme = "light";
    render(<Header />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Toggle light/dark mode" }),
    );

    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles from dark to light", async () => {
    mocks.resolvedTheme = "dark";
    render(<Header />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Toggle light/dark mode" }),
    );

    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });

  it("adds the scrolled chrome only after the window scrolls", () => {
    render(<Header />);
    const nav = screen.getByRole("navigation");

    expect(nav.className).not.toContain("backdrop-blur-md");

    setScrollY(20);
    fireEvent.scroll(window);

    expect(nav.className).toContain("backdrop-blur-md");
    expect(nav.className).toContain("shadow-sm");
  });

  it("removes the scrolled chrome when the page returns to the top", () => {
    setScrollY(20);
    render(<Header />);
    const nav = screen.getByRole("navigation");

    fireEvent.scroll(window);
    expect(nav.className).toContain("backdrop-blur-md");

    setScrollY(0);
    fireEvent.scroll(window);

    expect(nav.className).not.toContain("backdrop-blur-md");
  });

  it("splits on the first separator only", () => {
    mocks.title = "Edit Plan - Acme - West";

    render(<Header />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Edit Plan - Acme - West");
    expect(screen.getByText("Acme - West")).toHaveClass("text-accent-blue");
  });

  it("treats an unresolved theme as light and toggles to dark", async () => {
    mocks.resolvedTheme = undefined;

    render(<Header />);

    const toggle = await screen.findByRole("button", {
      name: "Toggle light/dark mode",
    });
    expect(toggle.querySelector(".lucide-moon")).not.toBeNull();

    await userEvent.click(toggle);

    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });

  it("hides the step title while editing too", () => {
    mocks.title = "Create Plan";
    render(<Header stepTitle="Step 2" stepper={<div>Step</div>} />);

    expect(screen.getByText("Step 2")).toBeInTheDocument();

    fireEditorEvent("step5EditorStateChange", true);

    expect(screen.queryByText("Step 2")).not.toBeInTheDocument();
  });

  it("compacts the user menu and left-aligns portalled tabs while editing", async () => {
    mocks.title = "Edit Benefit";
    render(<Header />);

    const portal = document.getElementById("header-tabs-portal")!;
    act(() => {
      portal.appendChild(document.createElement("div"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("user-nav")).toHaveAttribute(
        "data-details-from",
        "2xl",
      ),
    );

    fireEditorEvent("step5EditorStateChange", true);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByTestId("user-nav")).toHaveAttribute(
      "data-compact",
      "true",
    );
    expect(portal.parentElement?.className).toContain("justify-start");
  });

  it("clears the tab-strip allowance when switching to a stepper", async () => {
    const { rerender } = render(<Header />);
    const portal = document.getElementById("header-tabs-portal")!;

    act(() => {
      portal.appendChild(document.createElement("div"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("user-nav")).toHaveAttribute(
        "data-details-from",
        "2xl",
      ),
    );

    rerender(<Header stepper={<div data-testid="stepper">Step</div>} />);

    await waitFor(() =>
      expect(screen.getByTestId("user-nav")).toHaveAttribute(
        "data-details-from",
        "xl",
      ),
    );
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
  });

  it("closes the editor mode when the event has no detail", () => {
    mocks.title = "Dashboard";
    render(<Header stepper={<div data-testid="stepper">Step</div>} />);

    fireEditorEvent("step5EditorStateChange", true);
    act(() => {
      window.dispatchEvent(new CustomEvent("step5EditorStateChange"));
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("user-nav")).toHaveAttribute(
      "data-compact",
      "false",
    );
  });

  it("removes its window listeners on unmount", () => {
    const { unmount } = render(<Header />);
    unmount();

    expect(() => fireEditorEvent("step5EditorStateChange", true)).not.toThrow();
    expect(() => fireEditorEvent("step2EditorStateChange", true)).not.toThrow();
  });
});
