import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivePlansPanel } from "../active-plans-panel";
import { DashboardTeam } from "../dashboard-team";
import { MeetingsThisWeekPanel } from "../meetings-this-week-panel";
import { NeedsAttentionPanel } from "../needs-attention-panel";
import { RecentActivity } from "../recent-activity";
import { TaskList } from "../task-list";
import { TasksAndMeetings } from "../tasks-and-meetings";
import { UpcomingMeetingsList } from "../upcoming-meetings-list";

const mocks = vi.hoisted(() => ({
  data: {} as Record<string, any>,
  loading: new Set<string>(),
  errors: new Set<string>(),
  mutate: vi.fn(async () => undefined),
  fetch: vi.fn(),
}));

vi.mock("swr", () => ({
  default: (key: string) => ({
    data: mocks.data[key],
    isLoading: mocks.loading.has(key),
    error: mocks.errors.has(key),
    mutate: mocks.mutate,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ src, alt, monogramName }: any) => (
    <span
      data-testid="headshot"
      data-src={src ?? ""}
      data-alt={alt ?? ""}
      data-monogram={monogramName ?? ""}
    />
  ),
}));

vi.mock("@/lib/meeting-display", () => ({
  formatMeetingDay: () => "Today",
  formatMeetingTime: (time: string) => time,
}));

vi.mock("@/lib/date", () => ({
  formatUsTime: () => "9:00 AM",
}));

vi.mock("@/lib/plan-attention-actions", () => ({
  issueDestinations: (id: string, _issues: any[], options: any = {}) =>
    options.readOnly
      ? [{ label: "View Benefits", href: "/benefits" }]
      : [
          { label: "View Benefits", href: "/benefits" },
          {
            label: "Categorize Documents",
            href: `/documents?planId=${encodeURIComponent(id)}`,
          },
        ],
}));

vi.mock("@/lib/recent-activity", () => ({
  groupActivityByDay: (items: any[]) =>
    items.length > 0
      ? [{ key: "today", label: "Today", items }]
      : [],
}));

const ACTIVE_PLANS_KEY = "/api/dashboard/active-plans";
const MEETINGS_KEY = "/api/dashboard/meetings-this-week";
const NEEDS_KEY = "/api/dashboard/needs-attention";
const DISCLOSURES_KEY = "/api/organization/disclosures-reviewed";
const RECENT_KEY = "/api/dashboard/recent-activity";
const UPCOMING_KEY = "/api/dashboard/upcoming-meetings";
const TEAM_KEY = "/api/teammates/team";
const TASKS_KEY = "/api/dashboard/tasks";
const PLAN_ID = "65f1c2a9b3d4e5f6a7b8c9d0";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.data = {};
  mocks.loading = new Set();
  mocks.errors = new Set();
  mocks.mutate = vi.fn(async () => undefined);
  mocks.fetch.mockReset();
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ActivePlansPanel", () => {
  it("shows a loading skeleton", () => {
    mocks.loading.add(ACTIVE_PLANS_KEY);

    const { container } = render(<ActivePlansPanel />);

    expect(container.querySelectorAll(".animate-pulse").length).toBe(6);
  });

  it("shows an error message", () => {
    mocks.errors.add(ACTIVE_PLANS_KEY);

    render(<ActivePlansPanel />);

    expect(
      screen.getByText(/Couldn.t load your active plans/),
    ).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    mocks.data[ACTIVE_PLANS_KEY] = { success: true, data: [] };

    render(<ActivePlansPanel />);

    expect(screen.getByText(/No active plans yet/)).toBeInTheDocument();
  });

  it("renders plan rows with View/Edit by default", () => {
    mocks.data[ACTIVE_PLANS_KEY] = {
      success: true,
      data: [{ id: PLAN_ID, companyName: "Acme", companyLogo: "logo" }],
    };

    render(<ActivePlansPanel />);

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByTestId("headshot")).toHaveAttribute(
      "data-src",
      "logo",
    );
    const link = screen.getByRole("link", { name: "View or edit Acme" });
    expect(link).toHaveAttribute("href", `/edit-client/${PLAN_ID}`);
    expect(link).toHaveTextContent("View/Edit");
  });

  it("uses the read-only label for a Viewer", () => {
    mocks.data[ACTIVE_PLANS_KEY] = {
      success: true,
      data: [{ id: PLAN_ID, companyName: "Acme", companyLogo: null }],
    };

    render(<ActivePlansPanel viewerReadOnly />);

    const link = screen.getByRole("link", { name: "View Acme" });
    expect(link).toHaveTextContent("View");
  });
});

describe("MeetingsThisWeekPanel", () => {
  it("shows a loading skeleton", () => {
    mocks.loading.add(MEETINGS_KEY);

    const { container } = render(<MeetingsThisWeekPanel />);

    expect(container.querySelectorAll(".animate-pulse").length).toBe(6);
  });

  it("shows an error message", () => {
    mocks.errors.add(MEETINGS_KEY);

    render(<MeetingsThisWeekPanel />);

    expect(
      screen.getByText(/Couldn.t load this week.s meetings/),
    ).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    mocks.data[MEETINGS_KEY] = { success: true, data: [] };

    render(<MeetingsThisWeekPanel />);

    expect(
      screen.getByText("Nothing on the calendar this week."),
    ).toBeInTheDocument();
  });

  it("prefers the plan record and shows the In Progress chip", () => {
    mocks.data[MEETINGS_KEY] = {
      success: true,
      data: [
        {
          id: "m1",
          meeting: "Quarterly Review",
          date: "2026-01-01",
          time: "09:00",
          timezone: "UTC",
          status: "In Progress",
          client: "Denormalised",
          clientRecord: { companyName: "Acme HQ" },
        },
      ],
    };

    render(<MeetingsThisWeekPanel />);

    expect(screen.getByText("Quarterly Review")).toBeInTheDocument();
    expect(screen.getByText(/Acme HQ/)).toBeInTheDocument();
    expect(screen.queryByText(/Denormalised/)).not.toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View Quarterly Review" }),
    ).toHaveAttribute("href", "/communications/meetings");
  });

  it("omits the plan when no client is attached", () => {
    mocks.data[MEETINGS_KEY] = {
      success: true,
      data: [
        {
          id: "m1",
          meeting: "Internal Sync",
          date: "2026-01-01",
          time: "09:00",
          timezone: null,
          status: "Scheduled",
          client: "",
          clientRecord: null,
        },
      ],
    };

    render(<MeetingsThisWeekPanel />);

    expect(screen.getByText("Internal Sync")).toBeInTheDocument();
    // The standalone dot separates day/time; the plan separator is "· Name".
    expect(screen.queryByText(/·\s/)).not.toBeInTheDocument();
    expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
  });
});

describe("NeedsAttentionPanel", () => {
  const flagged = {
    success: true,
    data: {
      total: 1,
      plans: [
        {
          id: PLAN_ID,
          companyName: "Acme",
          companyLogo: null,
          issues: [
            {
              kind: "incomplete-benefit",
              label: "Incomplete benefit",
              missing: ["One", "Two", "Three", "Four", "Five"],
            },
          ],
        },
      ],
    },
  };

  it("shows a loading skeleton", () => {
    mocks.loading.add(NEEDS_KEY);

    const { container } = render(<NeedsAttentionPanel />);

    expect(container.querySelectorAll(".animate-pulse").length).toBe(9);
  });

  it("shows an error message", () => {
    mocks.errors.add(NEEDS_KEY);

    render(<NeedsAttentionPanel />);

    expect(
      screen.getByText(/Couldn.t load the plans needing attention/),
    ).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    mocks.data[NEEDS_KEY] = { success: true, data: { total: 0, plans: [] } };

    render(<NeedsAttentionPanel />);

    expect(
      screen.getByText(/Nothing needs your attention/),
    ).toBeInTheDocument();
  });

  it("renders capped issue chips and the default actions", () => {
    mocks.data[NEEDS_KEY] = flagged;

    render(<NeedsAttentionPanel />);

    expect(screen.getByText("Incomplete benefit")).toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Four")).toBeInTheDocument();
    expect(screen.queryByText("Five")).not.toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View Benefits for Acme" }),
    ).toHaveAttribute("href", "/benefits");
    expect(
      screen.getByRole("link", { name: "Categorize Documents for Acme" }),
    ).toHaveAttribute("href", `/documents?planId=${PLAN_ID}`);
  });

  it("offers only the read destination to a Viewer", () => {
    mocks.data[NEEDS_KEY] = flagged;

    render(<NeedsAttentionPanel viewerReadOnly />);

    expect(
      screen.getByRole("link", { name: "View Benefits for Acme" }),
    ).toHaveAttribute("href", "/benefits");
    expect(
      screen.queryByRole("link", { name: "Categorize Documents for Acme" }),
    ).not.toBeInTheDocument();
  });

  it("shows the disclosures alert only for an unreviewed org the reader can review", () => {
    mocks.data[NEEDS_KEY] = flagged;
    mocks.data[DISCLOSURES_KEY] = { reviewed: false, canReview: true };

    const { rerender } = render(<NeedsAttentionPanel />);

    expect(
      screen.getByText(/Disclosures not reviewed/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Review them in Settings/ }),
    ).toHaveAttribute("href", "/settings?tab=organization");

    mocks.data[DISCLOSURES_KEY] = { reviewed: true, canReview: true };
    rerender(<NeedsAttentionPanel />);
    expect(
      screen.queryByText(/Disclosures not reviewed/),
    ).not.toBeInTheDocument();

    mocks.data[DISCLOSURES_KEY] = { reviewed: false, canReview: false };
    rerender(<NeedsAttentionPanel />);
    expect(
      screen.queryByText(/Disclosures not reviewed/),
    ).not.toBeInTheDocument();
  });
});

describe("RecentActivity", () => {
  it("shows a loading skeleton", () => {
    mocks.loading.add(RECENT_KEY);

    const { container } = render(<RecentActivity />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an error message", () => {
    mocks.errors.add(RECENT_KEY);

    render(<RecentActivity />);

    expect(
      screen.getByText(/Couldn.t load recent activity/),
    ).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    mocks.data[RECENT_KEY] = { success: true, data: [] };

    render(<RecentActivity />);

    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  });

  it("groups and renders activity rows", () => {
    mocks.data[RECENT_KEY] = {
      success: true,
      data: [
        {
          id: "a1",
          kind: "plan-created",
          title: "Created a plan",
          planName: "Acme",
          subject: "New benefits hub",
          at: "2026-01-01T09:00:00Z",
        },
      ],
    };

    render(<RecentActivity />);

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText(/Created a plan/)).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText("New benefits hub")).toBeInTheDocument();
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
  });
});

describe("UpcomingMeetingsList", () => {
  it("shows a loading skeleton", () => {
    mocks.loading.add(UPCOMING_KEY);

    const { container } = render(<UpcomingMeetingsList />);

    expect(container.querySelectorAll(".animate-pulse").length).toBe(9);
  });

  it("shows an error message", () => {
    mocks.errors.add(UPCOMING_KEY);

    render(<UpcomingMeetingsList />);

    expect(
      screen.getByText(/Couldn.t load upcoming meetings/),
    ).toBeInTheDocument();
  });

  it("offers the scheduling CTA in the empty state", () => {
    mocks.data[UPCOMING_KEY] = { success: true, data: [] };

    render(<UpcomingMeetingsList />);

    expect(screen.getByText("No upcoming meetings")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Schedule Meeting/ }),
    ).toHaveAttribute("href", "/communications/meetings");
  });

  it("hides the scheduling CTA for a read-only Viewer", () => {
    mocks.data[UPCOMING_KEY] = { success: true, data: [] };

    render(<UpcomingMeetingsList viewerReadOnly />);

    expect(screen.getByText("No upcoming meetings")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Schedule Meeting/ }),
    ).not.toBeInTheDocument();
  });

  it("renders meeting rows and the view-all link", () => {
    mocks.data[UPCOMING_KEY] = {
      success: true,
      data: [
        {
          id: "m1",
          meeting: "Quarterly Review",
          date: "2026-01-01",
          time: "09:00",
          timezone: "UTC",
          status: "Scheduled",
          client: "Acme",
          clientId: PLAN_ID,
        },
      ],
    };

    render(<UpcomingMeetingsList />);

    expect(screen.getByText("Quarterly Review")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View All Meetings/ }),
    ).toHaveAttribute("href", "/communications/meetings");
  });
});

describe("DashboardTeam", () => {
  it("shows the loading avatars", () => {
    mocks.loading.add(TEAM_KEY);

    const { container } = render(<DashboardTeam />);

    expect(container.querySelectorAll(".animate-pulse").length).toBe(4);
    expect(screen.getByText("Team Members")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    mocks.data[TEAM_KEY] = { team: [] };

    render(<DashboardTeam />);

    expect(screen.getByText("No team members yet.")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("caps the avatar stack and summarises the remainder", () => {
    mocks.data[TEAM_KEY] = {
      team: Array.from({ length: 6 }, (_, index) => ({
        id: `u${index}`,
        name: `Person ${index}`,
        headshot: null,
        role: "admin",
      })),
    };

    const { container } = render(<DashboardTeam />);

    expect(container.querySelectorAll('[data-testid="headshot"]').length).toBe(5);
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getAllByTestId("headshot")[0].parentElement).toHaveAttribute(
      "title",
      "Person 0 · Admin",
    );
  });

  it("links to People & Access", () => {
    mocks.data[TEAM_KEY] = { team: [] };

    render(<DashboardTeam />);

    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/settings?tab=members",
    );
  });
});

describe("TasksAndMeetings", () => {
  it("renders both cards and forwards their props", () => {
    mocks.data[TASKS_KEY] = { success: true, data: { system: [], manual: [] } };
    mocks.data[UPCOMING_KEY] = { success: true, data: [] };

    render(<TasksAndMeetings viewerReadOnly canPublish={false} />);

    expect(screen.getByText("Task List")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Meetings")).toBeInTheDocument();
    expect(screen.getByText(/Nothing to do/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Schedule Meeting/ }),
    ).not.toBeInTheDocument();
  });
});

describe("TaskList", () => {
  const tasks = {
    success: true,
    data: {
      system: [
        {
          id: "s1",
          title: "Fix benefit",
          planName: "Acme",
          href: `/edit-benefit/${PLAN_ID}/retirement`,
          kind: "incomplete-benefit",
          clientId: PLAN_ID,
          category: null,
        },
        {
          id: "s2",
          title: "Ready to publish",
          planName: "Acme",
          href: `/edit-client/${PLAN_ID}`,
          kind: "ready-to-publish",
          clientId: PLAN_ID,
          category: null,
        },
      ],
      manual: [
        {
          id: "t1",
          title: "Call the client",
          done: false,
          createdAt: "2026-01-01",
          clientId: PLAN_ID,
          planName: "Acme",
          assignedByUserId: null,
          assignedByName: null,
          derivedKind: null,
          href: null,
        },
      ],
    },
  };

  it("shows a loading skeleton", () => {
    mocks.loading.add(TASKS_KEY);

    const { container } = render(<TaskList />);

    expect(container.querySelectorAll(".animate-pulse").length).toBe(12);
  });

  it("shows an error message", () => {
    mocks.errors.add(TASKS_KEY);

    render(<TaskList />);

    expect(screen.getByText(/Couldn.t load your tasks/)).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    mocks.data[TASKS_KEY] = { success: true, data: { system: [], manual: [] } };

    render(<TaskList />);

    expect(screen.getByText(/Nothing to do/)).toBeInTheDocument();
  });

  it("filters the publish task when the reader cannot publish", () => {
    mocks.data[TASKS_KEY] = tasks;

    const { rerender } = render(<TaskList canPublish={false} />);

    expect(screen.getByText("Fix benefit")).toBeInTheDocument();
    expect(screen.queryByText("Ready to publish")).not.toBeInTheDocument();

    rerender(<TaskList canPublish />);
    expect(screen.getByText("Ready to publish")).toBeInTheDocument();
  });

  it("toggles a manual task", async () => {
    mocks.data[TASKS_KEY] = tasks;

    render(<TaskList />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: 'Mark "Call the client" as done' }),
    );

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        `${TASKS_KEY}/t1`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ done: true }),
        }),
      ),
    );
  });

  it("renames a manual task", async () => {
    mocks.data[TASKS_KEY] = tasks;

    render(<TaskList />);

    await userEvent.click(
      screen.getByRole("button", { name: 'Edit "Call the client"' }),
    );
    const input = screen.getByRole("textbox", {
      name: 'Edit "Call the client"',
    });
    await userEvent.clear(input);
    await userEvent.type(input, "Call tomorrow");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        `${TASKS_KEY}/t1`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "Call tomorrow" }),
        }),
      ),
    );
  });

  it("deletes a manual task", async () => {
    mocks.data[TASKS_KEY] = tasks;

    render(<TaskList />);

    await userEvent.click(
      screen.getByRole("button", { name: 'Delete "Call the client"' }),
    );

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(`${TASKS_KEY}/t1`, {
        method: "DELETE",
      }),
    );
  });

  it("adds a task and clears the draft", async () => {
    mocks.data[TASKS_KEY] = tasks;

    render(<TaskList />);

    const input = screen.getByPlaceholderText("New task…");
    await userEvent.type(input, "Follow up");
    await userEvent.click(screen.getByRole("button", { name: /Add Task/ }));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        TASKS_KEY,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Follow up" }),
        }),
      ),
    );
    expect(input).toHaveValue("");
  });

  it("surfaces an add-task API error", async () => {
    mocks.data[TASKS_KEY] = tasks;
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Title exists" }),
    });

    render(<TaskList />);

    await userEvent.type(screen.getByPlaceholderText("New task…"), "Follow up");
    await userEvent.click(screen.getByRole("button", { name: /Add Task/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Title exists");
  });
});
