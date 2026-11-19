import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsMenu } from "../notifications-menu";

/**
 * The header notifications bell now folds its feed by MESSAGE TYPE (Team / Meetings
 * / Documents). These tests pin the three things that matter about that:
 *
 *  1. each type is its own accordion, and all three start expanded — the menu must
 *     still show everything it used to until the reader chooses otherwise;
 *  2. folding one type leaves the others alone;
 *  3. the Team section's "Mark all read" action does not fold Team on its way out
 *     (it is a sibling of the trigger, not a nested button).
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  remove: vi.fn(),
  dismiss: vi.fn(),
  meetings: [] as Array<Record<string, unknown>>,
  documents: [] as Array<Record<string, unknown>>,
  items: [] as Array<Record<string, unknown>>,
  unreadCount: 0,
  isLoading: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/hooks/useHeaderNotifications", () => ({
  useHeaderNotifications: () => ({
    meetings: mocks.meetings,
    documents: mocks.documents,
    isLoading: mocks.isLoading,
    isRefreshing: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    items: mocks.items,
    unreadCount: mocks.unreadCount,
    isLoading: mocks.isLoading,
    refresh: vi.fn(),
    markRead: mocks.markRead,
    markAllRead: mocks.markAllRead,
    remove: mocks.remove,
  }),
}));

vi.mock("@/hooks/useDismissedNotifications", () => ({
  meetingNotificationKey: (reminder: { id: string }) => `meeting:${reminder.id}`,
  documentNotificationKey: (document: { id: string }) =>
    `document:${document.id}`,
  useDismissedNotifications: () => ({
    isDismissed: () => false,
    dismiss: mocks.dismiss,
  }),
}));

function meeting(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    title: "Quarterly review",
    meetingType: "review",
    client: "Acme",
    clientId: "plan-1",
    dateKey: "2026-11-21",
    time: "10:00",
    timezone: null,
    format: "virtual",
    status: "Scheduled",
    daysUntil: 2,
    reminderStatus: "in_2days",
    ...overrides,
  };
}

function document(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    title: "ACME 5500",
    client: { id: "plan-1", companyName: "Acme" },
    dateKey: "2026-11-26",
    category: "Retirement",
    type: "SPD",
    daysUntilExpiration: 7,
    status: "expiring_week",
    ...overrides,
  };
}

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    type: "comment",
    title: "New comment on Acme",
    body: "Looks good to me",
    href: "/comments",
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.meetings = [meeting()];
  mocks.documents = [document()];
  mocks.items = [notification()];
  mocks.unreadCount = 1;
  mocks.isLoading = false;
});

async function openMenu() {
  const user = userEvent.setup();
  render(<NotificationsMenu />);
  await user.click(screen.getByRole("button", { name: "Notifications" }));
  // Wait for the menu surface itself, not a fixture row: one test opens it with
  // every type empty and still expects the folds to be there.
  await screen.findByRole("menu");
  return user;
}

describe("NotificationsMenu accordions", () => {
  it("gives each message type its own fold, all open on first paint", async () => {
    await openMenu();

    // Every type's rows are visible without a click.
    expect(screen.getByText("New comment on Acme")).toBeInTheDocument();
    expect(screen.getByText("Quarterly review")).toBeInTheDocument();
    expect(screen.getByText("ACME 5500")).toBeInTheDocument();

    // ... and each has its own fold control, stated as expanded.
    for (const label of ["Team", "Meetings", "Documents"]) {
      expect(
        screen.getByRole("button", { name: `Collapse ${label} notifications` }),
      ).toHaveAttribute("aria-expanded", "true");
    }
  });

  it("folds only the type that was collapsed", async () => {
    const user = await openMenu();

    await user.click(
      screen.getByRole("button", { name: "Collapse Meetings notifications" }),
    );

    expect(
      screen.getByRole("button", { name: "Expand Meetings notifications" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Collapse Team notifications" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Collapse Documents notifications" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("reopens a folded type from the same control", async () => {
    const user = await openMenu();

    await user.click(
      screen.getByRole("button", { name: "Collapse Meetings notifications" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Expand Meetings notifications" }),
    );

    expect(
      screen.getByRole("button", { name: "Collapse Meetings notifications" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("marks the team feed read without folding the Team section", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    expect(mocks.markAllRead).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Collapse Team notifications" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps each type's empty state inside that type's fold", async () => {
    mocks.meetings = [];
    mocks.documents = [];

    await openMenu();

    expect(screen.getByText("No upcoming meetings.")).toBeInTheDocument();
    expect(screen.getByText("No expiring documents.")).toBeInTheDocument();
  });
});
