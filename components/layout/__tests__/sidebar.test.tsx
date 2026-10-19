import React from "react";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_EDITOR_LAYOUT_EVENT } from "@/lib/preview-editor-layout";

import Sidebar from "../sidebar";

const mocks = vi.hoisted(() => {
  const baseNavItems = [
    { title: "Dashboard", href: "/dashboard" },
    {
      title: "Plans",
      href: "/clients",
      items: [
        { title: "View Plans", href: "/clients" },
        { title: "Create Plan", href: "/new-client" },
      ],
    },
    { title: "Benefits", href: "/benefits" },
    { title: "Settings", href: "/settings" },
  ] as any[];

  return {
    pathname: "/dashboard",
    wizardStep: 1 as number | null,
    wizardListeners: new Set<() => void>(),
    mediaListeners: new Set<() => void>(),
    accessListeners: new Set<() => void>(),
    isRoomy: true,
    theme: "light" as string | undefined,
    allowed: new Set<string>(),
    mayUsePath: vi.fn(),
    access: {
      isCollaborator: false,
      isLoading: false,
      can: vi.fn(() => true),
    },
    navProps: { isOpen: true, items: [] as any[] },
    baseNavItems,
    navItems: baseNavItems.map((item) => ({
      ...item,
      items: item.items ? item.items.map((child: any) => ({ ...child })) : undefined,
    })) as any[],
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: mocks.theme }),
}));

vi.mock("@/hooks/useMediaQuery", async () => {
  const React = await import("react");
  return {
    useMediaQuery: () =>
      React.useSyncExternalStore(
        (callback) => {
          mocks.mediaListeners.add(callback);
          return () => mocks.mediaListeners.delete(callback);
        },
        () => mocks.isRoomy,
        () => mocks.isRoomy,
      ),
  };
});

vi.mock("@/hooks/useViewerAccess", async () => {
  const React = await import("react");
  return {
    useViewerAccess: () =>
      React.useSyncExternalStore(
        (callback) => {
          mocks.accessListeners.add(callback);
          return () => mocks.accessListeners.delete(callback);
        },
        () => mocks.access,
        () => mocks.access,
      ),
  };
});

vi.mock("@/lib/teammates/nav-access", () => ({
  mayUsePath: mocks.mayUsePath,
}));

vi.mock("@/constants/data", () => ({
  navItems: mocks.navItems,
}));

vi.mock("@/lib/new-client-wizard-store", async () => {
  const React = await import("react");
  const useNewClientWizardStore = (selector: (state: any) => unknown) =>
    React.useSyncExternalStore(
      (callback) => {
        mocks.wizardListeners.add(callback);
        return () => mocks.wizardListeners.delete(callback);
      },
      () => selector({ currentStep: mocks.wizardStep }),
      () => selector({ currentStep: mocks.wizardStep }),
    );
  return { useNewClientWizardStore };
});

vi.mock("@/components/ui/dashboard-nav", () => ({
  DashboardNav: ({ items, isOpen }: any) => {
    mocks.navProps = { items, isOpen };
    return (
      <div data-testid="dashboard-nav" data-open={String(isOpen)}>
        {items.map((item: any) => (
          <div key={item.title}>
            <span>{item.title}</span>
            {item.items?.map((child: any) => (
              <span key={child.title}>{child.title}</span>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

function setWizardStep(step: number | null) {
  mocks.wizardStep = step;
  act(() => {
    mocks.wizardListeners.forEach((listener) => listener());
  });
}

function setRoomy(value: boolean) {
  mocks.isRoomy = value;
  act(() => {
    mocks.mediaListeners.forEach((listener) => listener());
  });
}

function setAccess(next: typeof mocks.access) {
  mocks.access = next;
  act(() => {
    mocks.accessListeners.forEach((listener) => listener());
  });
}

function sidebarNav() {
  return screen.getByRole("navigation");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.style.removeProperty("--sidebar-width");
  mocks.pathname = "/dashboard";
  mocks.wizardStep = 1;
  mocks.wizardListeners.clear();
  mocks.mediaListeners.clear();
  mocks.accessListeners.clear();
  mocks.isRoomy = true;
  mocks.theme = "light";
  mocks.allowed = new Set();
  mocks.access = {
    isCollaborator: false,
    isLoading: false,
    can: vi.fn(() => true),
  };
  mocks.navProps = { isOpen: true, items: [] };
  mocks.navItems.splice(
    0,
    mocks.navItems.length,
    ...mocks.baseNavItems.map((item) => ({
      ...item,
      items: item.items
        ? item.items.map((child: any) => ({ ...child }))
        : undefined,
    })),
  );
  mocks.mayUsePath.mockImplementation(
    (href: string | undefined) =>
      !href || mocks.allowed.has(href),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Sidebar", () => {
  it("defaults to an open rail", () => {
    render(<Sidebar />);

    expect(sidebarNav().style.width).toBe("16rem");
    expect(screen.getByTestId("dashboard-nav")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("restores a collapsed preference from localStorage", () => {
    localStorage.setItem("sidebar-is-open", "false");

    render(<Sidebar />);

    expect(sidebarNav().style.width).toBe("4rem");
    expect(screen.getByTestId("dashboard-nav")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("restores an open preference from localStorage", () => {
    localStorage.setItem("sidebar-is-open", "true");

    render(<Sidebar />);

    expect(sidebarNav().style.width).toBe("16rem");
  });

  it("falls back to open when the saved value is not true/false", () => {
    localStorage.setItem("sidebar-is-open", "yes");

    render(<Sidebar />);

    expect(sidebarNav().style.width).toBe("16rem");
  });

  it("collapses, persists the preference, and swaps the toggle label", async () => {
    render(<Sidebar />);

    await userEvent.click(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    );

    expect(sidebarNav().style.width).toBe("4rem");
    expect(screen.getByTestId("dashboard-nav")).toHaveAttribute(
      "data-open",
      "false",
    );
    expect(localStorage.getItem("sidebar-is-open")).toBe("false");
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
  });

  it("expands again and persists the preference", async () => {
    localStorage.setItem("sidebar-is-open", "false");
    render(<Sidebar />);

    await userEvent.click(
      screen.getByRole("button", { name: "Expand sidebar" }),
    );

    expect(sidebarNav().style.width).toBe("16rem");
    expect(localStorage.getItem("sidebar-is-open")).toBe("true");
  });

  it("uses the narrower rail between 1024 and 1280px", () => {
    mocks.isRoomy = false;

    render(<Sidebar />);

    expect(sidebarNav().style.width).toBe("13rem");
  });

  it("writes the rail width to --sidebar-width", async () => {
    render(<Sidebar />);

    expect(
      document.documentElement.style.getPropertyValue("--sidebar-width"),
    ).toBe("16rem");
  });

  it("shows the nav skeleton while the access summary loads", () => {
    mocks.access.isLoading = true;

    render(<Sidebar />);

    expect(screen.queryByTestId("dashboard-nav")).not.toBeInTheDocument();
    const skeleton = document.querySelector('nav[aria-hidden="true"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.querySelectorAll(".animate-pulse").length).toBe(
      mocks.navItems.length * 2,
    );
  });

  it("shows every item to a non-collaborator", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Plans")).toBeInTheDocument();
    expect(screen.getByText("View Plans")).toBeInTheDocument();
    expect(screen.getByText("Create Plan")).toBeInTheDocument();
    expect(screen.getByText("Benefits")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(mocks.mayUsePath).not.toHaveBeenCalled();
  });

  it("filters a collaborator's disallowed top-level items", () => {
    mocks.access.isCollaborator = true;
    mocks.allowed = new Set(["/clients", "/new-client", "/settings"]);

    render(<Sidebar />);

    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Benefits")).not.toBeInTheDocument();
    expect(screen.getByText("Plans")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("filters a collaborator's disallowed children", () => {
    mocks.access.isCollaborator = true;
    mocks.allowed = new Set(["/clients", "/settings"]);

    render(<Sidebar />);

    expect(screen.getByText("Plans")).toBeInTheDocument();
    expect(screen.getByText("View Plans")).toBeInTheDocument();
    expect(screen.queryByText("Create Plan")).not.toBeInTheDocument();
  });

  it("drops a group whose every child was filtered out", () => {
    mocks.access.isCollaborator = true;
    mocks.allowed = new Set(["/dashboard", "/benefits", "/settings"]);

    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Benefits")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Plans")).not.toBeInTheDocument();
    expect(screen.queryByText("View Plans")).not.toBeInTheDocument();
  });

  it("passes the collaborator gate and permission checker to mayUsePath", () => {
    mocks.access.isCollaborator = true;

    render(<Sidebar />);

    expect(mocks.mayUsePath).toHaveBeenCalledWith(
      "/dashboard",
      expect.objectContaining({
        isCollaborator: true,
        can: mocks.access.can,
      }),
    );
  });

  it("uses the dark logos for the dark theme", () => {
    mocks.theme = "dark";

    render(<Sidebar />);

    expect(screen.getByAltText("PlanTelligence")).toHaveAttribute(
      "src",
      "/plantelligence-logos/pt_web_dark.png",
    );
    expect(screen.getByAltText("PlanTelligence Icon")).toHaveAttribute(
      "src",
      "/plantelligence-logos/pt_icon_dark.png",
    );
  });

  it("shows the icon logo when the rail is collapsed", () => {
    localStorage.setItem("sidebar-is-open", "false");

    render(<Sidebar />);

    expect(screen.getByAltText("PlanTelligence").className).toContain("w-0");
    expect(
      screen.getByAltText("PlanTelligence Icon").className,
    ).toContain("w-6");
  });

  it("rail-collapses while the preview editor is open without changing the preference", () => {
    render(<Sidebar />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_EDITOR_LAYOUT_EVENT, {
          detail: { isOpen: true },
        }),
      );
    });

    expect(sidebarNav().style.width).toBe("4rem");
    expect(screen.getByTestId("dashboard-nav")).toHaveAttribute(
      "data-open",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: "Collapse sidebar" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("sidebar-is-open")).toBe("true");
  });

  it("restores the user's rail state when the preview editor closes", () => {
    render(<Sidebar />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_EDITOR_LAYOUT_EVENT, {
          detail: { isOpen: true },
        }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_EDITOR_LAYOUT_EVENT, {
          detail: { isOpen: false },
        }),
      );
    });

    expect(sidebarNav().style.width).toBe("16rem");
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();
  });

  it("keeps the wizard's 36rem width while step 2 is active", () => {
    mocks.pathname = "/new-client";
    render(<Sidebar />);

    document.documentElement.style.setProperty("--sidebar-width", "36rem");

    setWizardStep(2);

    expect(
      document.documentElement.style.getPropertyValue("--sidebar-width"),
    ).toBe("36rem");
  });

  it("restores the rail width after leaving step 2", () => {
    mocks.pathname = "/new-client";
    render(<Sidebar />);

    document.documentElement.style.setProperty("--sidebar-width", "36rem");
    setWizardStep(2);
    setWizardStep(3);

    expect(
      document.documentElement.style.getPropertyValue("--sidebar-width"),
    ).toBe("16rem");
  });

  it("opens normally when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });

    render(<Sidebar />);

    expect(sidebarNav().style.width).toBe("16rem");
    expect(screen.getByTestId("dashboard-nav")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("still toggles when localStorage.setItem throws", async () => {
    render(<Sidebar />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    );

    expect(sidebarNav().style.width).toBe("4rem");
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
  });

  it("restores the rail when the preview event has no detail", () => {
    render(<Sidebar />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_EDITOR_LAYOUT_EVENT, {
          detail: { isOpen: true },
        }),
      );
    });
    expect(sidebarNav().style.width).toBe("4rem");

    act(() => {
      window.dispatchEvent(new CustomEvent(PREVIEW_EDITOR_LAYOUT_EVENT));
    });

    expect(sidebarNav().style.width).toBe("16rem");
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();
  });

  it("follows a viewport change while mounted", () => {
    render(<Sidebar />);
    expect(sidebarNav().style.width).toBe("16rem");

    setRoomy(false);

    expect(sidebarNav().style.width).toBe("13rem");
    expect(
      document.documentElement.style.getPropertyValue("--sidebar-width"),
    ).toBe("13rem");
  });

  it("uses the light logos when the theme resolves to system", () => {
    mocks.theme = undefined;

    render(<Sidebar />);

    expect(screen.getByAltText("PlanTelligence")).toHaveAttribute(
      "src",
      "/plantelligence-logos/pt_web_light.png",
    );
    expect(screen.getByAltText("PlanTelligence Icon")).toHaveAttribute(
      "src",
      "/plantelligence-logos/pt_icon_light.png",
    );
  });

  it("re-filters when the access summary changes", () => {
    mocks.access.isCollaborator = true;
    mocks.allowed = new Set(["/clients", "/settings"]);
    render(<Sidebar />);

    expect(screen.queryByText("Benefits")).not.toBeInTheDocument();

    mocks.allowed.add("/benefits");
    setAccess({
      ...mocks.access,
      can: vi.fn(() => true),
    });

    expect(screen.getByText("Benefits")).toBeInTheDocument();
  });

  it("renders an empty nav when a collaborator may reach nothing", () => {
    mocks.access.isCollaborator = true;

    render(<Sidebar />);

    expect(screen.getByTestId("dashboard-nav")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Plans")).not.toBeInTheDocument();
    expect(screen.queryByText("Benefits")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("writes 4rem to --sidebar-width when collapsed", () => {
    localStorage.setItem("sidebar-is-open", "false");

    render(<Sidebar />);

    expect(
      document.documentElement.style.getPropertyValue("--sidebar-width"),
    ).toBe("4rem");
  });

  it("keeps a top-level item that has no href", () => {
    mocks.navItems.push({ title: "Help" });
    mocks.access.isCollaborator = true;
    mocks.allowed = new Set(["/clients", "/settings"]);

    render(<Sidebar />);

    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("opens the logo in a new tab", () => {
    render(<Sidebar />);

    const link = screen.getByAltText("PlanTelligence").closest("a");
    expect(link).toHaveAttribute("href", "#");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("removes its preview-layout listener on unmount", () => {
    const { unmount } = render(<Sidebar />);
    unmount();

    expect(() =>
      act(() => {
        window.dispatchEvent(
          new CustomEvent(PREVIEW_EDITOR_LAYOUT_EVENT, {
            detail: { isOpen: true },
          }),
        );
      }),
    ).not.toThrow();
  });
});
