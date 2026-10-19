import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: any) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
}));

import { MeetingDayDrawer } from "../meeting-day-drawer";
import {
  formatScheduleDayKey,
  scheduleDayKeyToDate,
  todayScheduleDayKey,
} from "@/lib/date";

function dayKeyOffset(days: number): string {
  const today = scheduleDayKeyToDate(todayScheduleDayKey());
  const shifted = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + days,
  );
  return format(shifted, "yyyy-MM-dd");
}

const futureKey = dayKeyOffset(2);
const pastKey = dayKeyOffset(-2);

const virtualMeeting = {
  id: "m-1",
  meeting: "Virtual Session",
  date: futureKey,
  time: "09:00",
  timezone: "America/New_York",
  duration: "1 hour",
  format: "Virtual",
  platform: "Zoom",
  meetingLink: "zoom.us/j/1",
  attendees: 5,
  maxAttendees: 10,
  status: "Scheduled",
  language: "Spanish",
  benefitsCategory: "Retirement",
  description: "Session description",
  client: "Acme Corp",
};

const inPersonMeeting = {
  id: "m-2",
  meeting: "In-Person Session",
  date: futureKey,
  time: "14:00",
  duration: "2 hours",
  format: "In-Person",
  attendees: 3,
  status: "Draft",
  address: "1 Main St",
  city: "Austin",
  state: "TX",
  zip: "78701",
  client: "Acme Corp",
};

function renderDrawer(overrides: Record<string, unknown> = {}) {
  const onAdd = vi.fn();
  const onEdit = vi.fn();
  const onDuplicate = vi.fn();
  const onDelete = vi.fn();
  render(
    <MeetingDayDrawer
      open
      onOpenChange={vi.fn()}
      dateKey={futureKey}
      meetings={[]}
      onAdd={onAdd}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      {...overrides}
    />,
  );
  return { onAdd, onEdit, onDuplicate, onDelete };
}

describe("MeetingDayDrawer", () => {
  it("renders nothing while closed", () => {
    renderDrawer({ open: false });

    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument();
  });

  it("shows the day heading and allows scheduling tomorrow onward", async () => {
    const { onAdd } = renderDrawer();

    expect(screen.getByText("Meetings for this day")).toBeInTheDocument();
    expect(
      screen.getByText(format(scheduleDayKeyToDate(futureKey), "EEEE, MMMM d, yyyy")),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole("button", { name: /Add Meeting/ })[0],
    );
    expect(onAdd).toHaveBeenCalled();
  });

  it("disables scheduling for a past day and explains why", () => {
    renderDrawer({ dateKey: pastKey });

    expect(screen.getByRole("button", { name: /Add Meeting/ })).toBeDisabled();
    expect(
      screen.getByText(/Scheduling is available starting tomorrow/),
    ).toBeInTheDocument();
  });

  it("shows the future empty state with an Add CTA", async () => {
    const { onAdd } = renderDrawer();

    expect(screen.getByText("No meetings on this day")).toBeInTheDocument();
    const ctas = screen.getAllByRole("button", { name: /Add Meeting/ });
    await userEvent.click(ctas[ctas.length - 1]);

    expect(onAdd).toHaveBeenCalled();
  });

  it("shows the read-only empty state for a past day", () => {
    renderDrawer({ dateKey: pastKey });

    expect(screen.getByText("No meetings on this day")).toBeInTheDocument();
    expect(
      screen.getByText("This day is not open for scheduling yet."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add Meeting/ })).toHaveLength(1);
  });

  it("sorts meetings by time and maps statuses", () => {
    renderDrawer({ meetings: [inPersonMeeting, virtualMeeting] });

    const titles = screen.getAllByText(/Session$/).map((el) => el.textContent);
    expect(titles).toEqual(["Virtual Session", "In-Person Session"]);
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("2:00 PM")).toBeInTheDocument();
  });

  it("expands a virtual meeting with details and a normalized link", async () => {
    const user = userEvent.setup();
    renderDrawer({ meetings: [virtualMeeting] });

    await user.click(screen.getByText("Virtual Session"));

    const sheet = within(screen.getByTestId("sheet"));
    expect(sheet.getByText(formatScheduleDayKey(futureKey))).toBeInTheDocument();
    expect(sheet.getByText("1 hour")).toBeInTheDocument();
    expect(sheet.getByText("5 / 10")).toBeInTheDocument();
    expect(sheet.getByText("Virtual · Zoom")).toBeInTheDocument();
    expect(sheet.getByText("Acme Corp")).toBeInTheDocument();
    expect(sheet.getByText("Spanish")).toBeInTheDocument();
    expect(sheet.getByText("Retirement")).toBeInTheDocument();
    expect(sheet.getByText("Session description")).toBeInTheDocument();
    expect(sheet.getByRole("link", { name: "Open meeting link" })).toHaveAttribute(
      "href",
      "https://zoom.us/j/1",
    );
  });

  it("expands an in-person meeting with its full address and no link", async () => {
    const user = userEvent.setup();
    renderDrawer({ meetings: [inPersonMeeting] });

    await user.click(screen.getByText("In-Person Session"));

    expect(
      screen.getByText(/1 Main St, Austin, TX, 78701/),
    ).toBeInTheDocument();
    expect(screen.queryByText("No meeting link set.")).not.toBeInTheDocument();
  });

  it("explains when a virtual meeting has no link", async () => {
    const user = userEvent.setup();
    renderDrawer({
      meetings: [{ ...virtualMeeting, meetingLink: "" }],
    });

    await user.click(screen.getByText("Virtual Session"));

    expect(screen.getByText("No meeting link set.")).toBeInTheDocument();
  });

  it("forwards edit, duplicate, and delete actions", async () => {
    const user = userEvent.setup();
    const { onEdit, onDuplicate, onDelete } = renderDrawer({
      meetings: [virtualMeeting],
    });

    await user.click(screen.getByText("Virtual Session"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(virtualMeeting);

    await user.click(screen.getByText("Virtual Session"));
    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledWith(virtualMeeting);

    await user.click(screen.getByText("Virtual Session"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(virtualMeeting);
  });

  it("collapses an expanded row when its header is clicked again", async () => {
    const user = userEvent.setup();
    renderDrawer({ meetings: [virtualMeeting] });

    const header = screen.getByText("Virtual Session").closest("button")!;
    expect(header).toHaveAttribute("aria-expanded", "false");

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
  });
});
