import React from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dashboard } from "../dashboard";

const mocks = vi.hoisted(() => ({
  setTitle: vi.fn(),
  profile: undefined as any,
  profileLoading: false,
  stats: undefined as any,
  statsLoading: false,
  resolveImage: vi.fn(),
  quickActions: null as any,
  quickInsights: null as any,
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    title: "",
    subtitle: "",
    setTitle: mocks.setTitle,
    setSubtitle: vi.fn(),
  }),
}));

vi.mock("swr", () => ({
  default: (key: string) =>
    key === "/api/profile"
      ? { data: mocks.profile, isLoading: mocks.profileLoading }
      : { data: mocks.stats, isLoading: mocks.statsLoading },
}));

vi.mock("@/lib/branding-image-url", () => ({
  resolveBrandingImageUrl: mocks.resolveImage,
}));

vi.mock("@/components/ui/quick-actions", () => ({
  QuickActions: ({ actions }: any) => {
    mocks.quickActions = actions;
    return (
      <div data-testid="quick-actions">
        {actions.map((action: any) => (
          <span key={action.label}>{action.label}</span>
        ))}
      </div>
    );
  },
}));

vi.mock("@/components/ui/quick-insights", () => ({
  QuickInsights: ({ insights, isLoading, renderDetail }: any) => {
    mocks.quickInsights = { insights, isLoading };
    const [detail, setDetail] = React.useState<React.ReactNode>(null);

    return (
      <div
        data-testid="quick-insights"
        data-loading={String(isLoading)}
      >
        {insights.map((insight: any) => (
          <span
            key={insight.id}
            data-testid={`insight-${insight.id}`}
            data-value={String(insight.value)}
          >
            {insight.title}
          </span>
        ))}
        {["active-plans", "meetings-this-week", "needs-attention", "unknown"].map(
          (id) => (
            <button
              key={id}
              type="button"
              onClick={() => setDetail(renderDetail({ id }))}
            >
              open-{id}
            </button>
          ),
        )}
        <div data-testid="detail-out">{detail}</div>
      </div>
    );
  },
}));

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ src, monogramName, alt }: any) => (
    <div
      data-testid="headshot"
      data-src={src ?? ""}
      data-monogram={monogramName ?? ""}
      data-alt={alt ?? ""}
    />
  ),
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src, alt, fillContainer, objectFit }: any) => (
    <img
      data-testid="branding-image"
      src={src}
      alt={alt}
      data-fill-container={String(fillContainer)}
      data-object-fit={objectFit}
    />
  ),
}));

vi.mock("../active-plans-panel", () => ({
  ActivePlansPanel: ({ viewerReadOnly }: any) => (
    <div
      data-testid="active-plans-panel"
      data-readonly={String(Boolean(viewerReadOnly))}
    />
  ),
}));

vi.mock("../meetings-this-week-panel", () => ({
  MeetingsThisWeekPanel: () => <div data-testid="meetings-panel" />,
}));

vi.mock("../needs-attention-panel", () => ({
  NeedsAttentionPanel: ({ viewerReadOnly }: any) => (
    <div
      data-testid="needs-attention-panel"
      data-readonly={String(Boolean(viewerReadOnly))}
    />
  ),
}));

vi.mock("../recent-activity", () => ({
  RecentActivity: () => <div data-testid="recent-activity" />,
}));

vi.mock("../tasks-and-meetings", () => ({
  TasksAndMeetings: ({ viewerReadOnly, canPublish }: any) => (
    <div
      data-testid="tasks-and-meetings"
      data-readonly={String(Boolean(viewerReadOnly))}
      data-publish={String(Boolean(canPublish))}
    />
  ),
}));

vi.mock("../dashboard-team", () => ({
  DashboardTeam: () => <div data-testid="dashboard-team" />,
}));

const ownerProfile = {
  name: "Owner Name",
  title: "Owner Title",
  organization: { viewerIsOwner: true },
  wizardSessions: [
    {
      userSetup: { name: "Wizard Name", title: "Planner" },
      branding: { aiAvatar: "avatar-key", logo: "logo-key" },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile = undefined;
  mocks.profileLoading = false;
  mocks.stats = undefined;
  mocks.statsLoading = false;
  mocks.quickActions = null;
  mocks.quickInsights = null;
  mocks.resolveImage.mockImplementation(async (key: string | null) =>
    key ? `resolved:${key}` : null,
  );
});

describe("Dashboard", () => {
  it("sets the page title", () => {
    render(<Dashboard />);

    expect(mocks.setTitle).toHaveBeenCalledWith("Dashboard");
  });

  it("renders the default identity before the profile arrives", async () => {
    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: "Welcome back, Alicia!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Senior Financial Advisor")).toBeInTheDocument();
    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "src",
      "/logo-2.png",
    );
    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute("data-src", ""),
    );
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
  });

  it("prefers the wizard setup and branding for identity", async () => {
    mocks.profile = ownerProfile;

    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: "Welcome back, Wizard Name!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Planner")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "src",
      "logo-key",
    );
    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "data-fill-container",
      "true",
    );
    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "data-object-fit",
      "contain",
    );
    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute(
        "data-src",
        "resolved:avatar-key",
      ),
    );
  });

  it("falls back to the profile name and the organization logo", async () => {
    mocks.profile = {
      name: "Row Name",
      organization: {
        viewerIsOwner: false,
        source: { logo: "org-logo" },
      },
    };

    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: "Welcome back, Row Name!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Advisor")).toBeInTheDocument();
    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "src",
      "org-logo",
    );
    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute("data-src", ""),
    );
  });

  it("falls back to the invited seat for title, role, and photo", async () => {
    mocks.profile = {
      name: "Seat Name",
      organization: { viewerIsOwner: false },
      seat: {
        jobTitle: "Planner",
        role: "admin",
        headshot: "seat-photo",
      },
    };

    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: "Welcome back, Seat Name!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Planner")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute(
        "data-src",
        "resolved:seat-photo",
      ),
    );
  });

  it("prefers the reader's own headshot over the seat photo", async () => {
    mocks.profile = {
      name: "Teammate",
      headshot: "own-photo",
      organization: { viewerIsOwner: false },
      seat: { headshot: "seat-photo", role: "editor" },
    };

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute(
        "data-src",
        "resolved:own-photo",
      ),
    );
  });

  it("falls back to the userSetup preview image", async () => {
    mocks.profile = {
      name: "Teammate",
      organization: { viewerIsOwner: false },
      seat: { headshot: "seat-photo", role: "editor" },
      wizardSessions: [
        { userSetup: { headshotData: { previewDataUrl: "preview-photo" } } },
      ],
    };

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute(
        "data-src",
        "resolved:preview-photo",
      ),
    );
  });

  it("uses the raw avatar when resolution returns null", async () => {
    mocks.resolveImage.mockResolvedValue(null);
    mocks.profile = {
      ...ownerProfile,
      wizardSessions: [
        {
          userSetup: { name: "Wizard Name", title: "Planner" },
          branding: { aiAvatar: "raw-avatar", logo: "logo-key" },
        },
      ],
    };

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute(
        "data-src",
        "raw-avatar",
      ),
    );
  });

  it("shows the identity skeleton while the profile loads", () => {
    mocks.profileLoading = true;

    const { container } = render(<Dashboard />);

    expect(
      screen.queryByRole("heading", { name: /Welcome back/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBe(3);
    expect(screen.queryByTestId("dashboard-team")).not.toBeInTheDocument();
  });

  it("overlays live stats onto the insight tiles", () => {
    mocks.profile = ownerProfile;
    mocks.stats = {
      data: { activePlans: 7, needsAttention: 2, meetingsThisWeek: 4 },
    };

    render(<Dashboard />);

    expect(screen.getByTestId("insight-active-plans")).toHaveAttribute(
      "data-value",
      "7",
    );
    expect(screen.getByTestId("insight-needs-attention")).toHaveAttribute(
      "data-value",
      "2",
    );
    expect(screen.getByTestId("insight-meetings-this-week")).toHaveAttribute(
      "data-value",
      "4",
    );
    expect(screen.getByTestId("insight-kpi-4")).toHaveAttribute(
      "data-value",
      "0",
    );
  });

  it("uses an em dash when a live stat is missing", () => {
    mocks.profile = ownerProfile;
    mocks.stats = { data: {} };

    render(<Dashboard />);

    expect(screen.getByTestId("insight-active-plans")).toHaveAttribute(
      "data-value",
      "—",
    );
    expect(screen.getByTestId("insight-kpi-4")).toHaveAttribute(
      "data-value",
      "0",
    );
  });

  it("uses an em dash when the stats payload is null", () => {
    mocks.profile = ownerProfile;
    mocks.stats = { data: null };

    render(<Dashboard />);

    expect(screen.getByTestId("insight-needs-attention")).toHaveAttribute(
      "data-value",
      "—",
    );
  });

  it("forwards the stats loading state to Quick Insights", () => {
    mocks.profile = ownerProfile;
    mocks.statsLoading = true;

    render(<Dashboard />);

    expect(screen.getByTestId("quick-insights")).toHaveAttribute(
      "data-loading",
      "true",
    );
  });

  it("gives an owner every action, the team panel, and publish rights", () => {
    mocks.profile = ownerProfile;

    render(<Dashboard />);

    expect(screen.getByText("Create Plan")).toBeInTheDocument();
    expect(screen.getByText("View Plans")).toBeInTheDocument();
    expect(screen.getByText("Create Meeting/Event")).toBeInTheDocument();
    expect(screen.getByText("Upload Documents")).toBeInTheDocument();
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-team")).toBeInTheDocument();
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-readonly",
      "false",
    );
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-publish",
      "true",
    );
  });

  it("gives an admin the team panel and publish rights", () => {
    mocks.profile = {
      name: "Admin",
      organization: { viewerIsOwner: false },
      seat: { role: "admin" },
    };

    render(<Dashboard />);

    expect(screen.getByTestId("dashboard-team")).toBeInTheDocument();
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-publish",
      "true",
    );
  });

  it("withholds write entry points from a read-only viewer", () => {
    mocks.profile = {
      name: "Viewer",
      organization: { viewerIsOwner: false },
      seat: { role: "viewer" },
    };

    render(<Dashboard />);

    expect(screen.getByText("View Plans")).toBeInTheDocument();
    expect(screen.queryByText("Create Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Meeting/Event")).not.toBeInTheDocument();
    expect(screen.queryByText("Upload Documents")).not.toBeInTheDocument();
    expect(screen.queryByText("Marketing")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-team")).not.toBeInTheDocument();
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-readonly",
      "true",
    );
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-publish",
      "false",
    );
  });

  it("lets an editor keep the write actions but not publish or manage the team", () => {
    mocks.profile = {
      name: "Editor",
      organization: { viewerIsOwner: false },
      seat: { role: "editor" },
    };

    render(<Dashboard />);

    expect(screen.getByText("Create Plan")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-team")).not.toBeInTheDocument();
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-readonly",
      "false",
    );
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-publish",
      "false",
    );
  });

  it("renders the recent activity panel", () => {
    mocks.profile = ownerProfile;

    render(<Dashboard />);

    expect(screen.getByTestId("recent-activity")).toBeInTheDocument();
  });

  it("maps each insight detail to its panel", async () => {
    mocks.profile = ownerProfile;

    render(<Dashboard />);

    await userEvent.click(
      screen.getByRole("button", { name: "open-active-plans" }),
    );
    expect(screen.getByTestId("active-plans-panel")).toHaveAttribute(
      "data-readonly",
      "false",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "open-meetings-this-week" }),
    );
    expect(screen.getByTestId("meetings-panel")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "open-needs-attention" }),
    );
    expect(screen.getByTestId("needs-attention-panel")).toHaveAttribute(
      "data-readonly",
      "false",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "open-unknown" }),
    );
    expect(screen.getByTestId("detail-out")).toBeEmptyDOMElement();
  });

  it("passes read-only mode into the insight panels for a viewer", async () => {
    mocks.profile = {
      name: "Viewer",
      organization: { viewerIsOwner: false },
      seat: { role: "viewer" },
    };

    render(<Dashboard />);

    await userEvent.click(
      screen.getByRole("button", { name: "open-active-plans" }),
    );
    expect(screen.getByTestId("active-plans-panel")).toHaveAttribute(
      "data-readonly",
      "true",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "open-needs-attention" }),
    );
    expect(screen.getByTestId("needs-attention-panel")).toHaveAttribute(
      "data-readonly",
      "true",
    );
  });

  it("does not render a role badge when nothing is known", () => {
    mocks.profile = { name: "No Role" };

    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: "Welcome back, No Role!" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Viewer")).not.toBeInTheDocument();
  });

  it("falls back to the raw avatar when resolution rejects", async () => {
    mocks.resolveImage.mockRejectedValue(new Error("resolver down"));
    mocks.profile = {
      ...ownerProfile,
      wizardSessions: [
        {
          userSetup: { name: "Wizard Name", title: "Planner" },
          branding: { aiAvatar: "raw-avatar", logo: "logo-key" },
        },
      ],
    };

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute(
        "data-src",
        "raw-avatar",
      ),
    );
  });

  it("ignores a resolved avatar after the raw avatar changes", async () => {
    const first = deferred<string | null>();
    const second = deferred<string | null>();
    mocks.resolveImage
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    mocks.profile = {
      ...ownerProfile,
      wizardSessions: [
        {
          userSetup: { name: "Wizard Name", title: "Planner" },
          branding: { aiAvatar: "avatar-a", logo: "logo-key" },
        },
      ],
    };
    const { rerender } = render(<Dashboard />);

    await waitFor(() => expect(mocks.resolveImage).toHaveBeenCalledTimes(1));

    mocks.profile = {
      ...ownerProfile,
      wizardSessions: [
        {
          userSetup: { name: "Wizard Name", title: "Planner" },
          branding: { aiAvatar: "avatar-b", logo: "logo-key" },
        },
      ],
    };
    rerender(<Dashboard />);

    await waitFor(() => expect(mocks.resolveImage).toHaveBeenCalledTimes(2));

    await act(async () => {
      first.resolve("resolved:avatar-a");
    });
    await act(async () => {
      second.resolve("resolved:avatar-b");
    });

    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute(
        "data-src",
        "resolved:avatar-b",
      ),
    );
  });

  it("keeps owner privileges even when a viewer seat is present", () => {
    mocks.profile = {
      name: "Owner",
      organization: { viewerIsOwner: true },
      seat: { role: "viewer" },
    };

    render(<Dashboard />);

    expect(screen.getByText("Create Plan")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-team")).toBeInTheDocument();
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-readonly",
      "false",
    );
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-publish",
      "true",
    );
  });

  it("renders zero as a real statistic", () => {
    mocks.profile = ownerProfile;
    mocks.stats = { data: { activePlans: 0 } };

    render(<Dashboard />);

    expect(screen.getByTestId("insight-active-plans")).toHaveAttribute(
      "data-value",
      "0",
    );
  });

  it("falls back to advisorLogoUrl for the organization mark", () => {
    mocks.profile = {
      name: "Row Name",
      advisorLogoUrl: "row-logo",
      organization: { viewerIsOwner: true },
    };

    render(<Dashboard />);

    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "src",
      "row-logo",
    );
  });

  it("falls back to the generic identity for an empty profile", () => {
    mocks.profile = {};

    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: "Welcome back, User!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Advisor")).toBeInTheDocument();
    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "src",
      "/logo-2.png",
    );
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
  });

  it("keeps the default permissions before a profile exists", () => {
    render(<Dashboard />);

    expect(screen.getByText("Create Plan")).toBeInTheDocument();
    expect(screen.getByText("View Plans")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-team")).not.toBeInTheDocument();
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-readonly",
      "false",
    );
    expect(screen.getByTestId("tasks-and-meetings")).toHaveAttribute(
      "data-publish",
      "false",
    );
  });

  it.each([
    ["contributor", "Contributor"],
    ["reviewer", "Reviewer"],
    ["custom", "Custom"],
  ])("renders the %s role label", (role, label) => {
    mocks.profile = {
      name: "Role Name",
      organization: { viewerIsOwner: false },
      seat: { role },
    };

    render(<Dashboard />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("uses the seat title when the wizard setup has only a name", () => {
    mocks.profile = {
      name: "Seat Name",
      organization: { viewerIsOwner: false },
      wizardSessions: [{ userSetup: { name: "Wizard Name" } }],
      seat: { jobTitle: "Planner", role: "editor" },
    };

    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: "Welcome back, Wizard Name!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Planner")).toBeInTheDocument();
  });

  it("keeps previous stats visible while revalidating", () => {
    mocks.profile = ownerProfile;
    mocks.stats = { data: { activePlans: 5 } };
    mocks.statsLoading = true;

    render(<Dashboard />);

    expect(screen.getByTestId("insight-active-plans")).toHaveAttribute(
      "data-value",
      "5",
    );
    expect(screen.getByTestId("quick-insights")).toHaveAttribute(
      "data-loading",
      "true",
    );
  });

  it("passes the identity name as the headshot monogram and resolves null without an avatar", async () => {
    mocks.profile = { name: "No Photo" };

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByTestId("headshot")).toHaveAttribute(
        "data-monogram",
        "No Photo",
      ),
    );
    expect(mocks.resolveImage).toHaveBeenCalledWith(null);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
