import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { MeetingsCalendarView } from "../meetings-calendar-view";
import {
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

function dayButton(key: string): HTMLElement {
  return screen.getByRole("button", {
    name: `Open ${format(scheduleDayKeyToDate(key), "EEEE, MMMM d, yyyy")}`,
  });
}

function meeting(overrides: Record<string, unknown> = {}) {
  return {
    id: "m-1",
    title: "Open Enrollment Session",
    date: dayKeyOffset(2),
    time: "13:00",
    status: "Upcoming",
    ...overrides,
  };
}

describe("MeetingsCalendarView", () => {
  it("renders a 12-month window with three month cards and the empty tag", () => {
    render(<MeetingsCalendarView meetings={[]} />);

    expect(screen.getByText("No Meetings Scheduled")).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Show previous 3 months" }),
    ).toBeDisabled();
  });

  it("counts the meetings inside the window", () => {
    render(
      <MeetingsCalendarView
        meetings={[
          meeting({ id: "m-1", date: dayKeyOffset(1) }),
          meeting({ id: "m-2", date: dayKeyOffset(2) }),
        ]}
      />,
    );

    expect(
      screen.getByText("2 meetings scheduled over the next 12 months"),
    ).toBeInTheDocument();
  });

  it("ignores meetings outside the 12-month window", () => {
    render(
      <MeetingsCalendarView
        meetings={[meeting({ date: dayKeyOffset(800) })]}
      />,
    );

    expect(screen.getByText("No Meetings Scheduled")).toBeInTheDocument();
  });

  it("marks today with the today ring", () => {
    render(<MeetingsCalendarView meetings={[]} />);

    const today = within(dayButton(todayScheduleDayKey()));
    expect(today.getByText(String(new Date().getDate())).className).toContain(
      "bg-blue-500",
    );
  });

  it("calls onSelectDay with the clicked day key", async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    const key = dayKeyOffset(2);
    render(<MeetingsCalendarView meetings={[]} onSelectDay={onSelectDay} />);

    await user.click(dayButton(key));

    expect(onSelectDay).toHaveBeenCalledWith(key);
  });

  it("pages forward and backward through the slides", async () => {
    const user = userEvent.setup();
    render(<MeetingsCalendarView meetings={[]} />);

    await user.click(screen.getByRole("button", { name: "Show next 3 months" }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show previous 3 months" }),
    ).toBeEnabled();

    await user.click(
      screen.getByRole("button", { name: "Show previous 3 months" }),
    );
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("jumps to a slide from its dot", async () => {
    const user = userEvent.setup();
    render(<MeetingsCalendarView meetings={[]} />);

    await user.click(
      screen.getByRole("button", { name: "Show slide 4 of 4" }),
    );

    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show next 3 months" }),
    ).toBeDisabled();
  });

  it("shows meeting counts and draft styling on the day cell", () => {
    const key = dayKeyOffset(2);
    render(
      <MeetingsCalendarView
        meetings={[meeting({ date: key, status: "Draft" })]}
      />,
    );

    const cell = within(dayButton(key));
    const chip = cell.getByText("1");
    expect(chip.className).toContain("bg-amber-100");
    expect(chip.getAttribute("title")).toContain(
      "1:00pm · Open Enrollment Session",
    );
  });

  it("opens the hover menu and quick-adds a meeting", async () => {
    const onQuickAdd = vi.fn();
    const key = dayKeyOffset(2);
    render(<MeetingsCalendarView meetings={[]} onQuickAdd={onQuickAdd} />);

    fireEvent.mouseEnter(dayButton(key).parentElement!);

    const action = await screen.findByRole("button", { name: "Add a Meeting" });
    fireEvent.click(action);

    expect(onQuickAdd).toHaveBeenCalledWith(key);
    expect(screen.queryByRole("button", { name: "Add a Meeting" })).not.toBeInTheDocument();
  });

  it("offers View Meetings for a day that already has meetings", async () => {
    const onSelectDay = vi.fn();
    const key = dayKeyOffset(2);
    render(
      <MeetingsCalendarView
        meetings={[meeting({ date: key })]}
        onSelectDay={onSelectDay}
      />,
    );

    fireEvent.mouseEnter(dayButton(key).parentElement!);
    fireEvent.click(
      await screen.findByRole("button", { name: "View Meetings" }),
    );

    expect(onSelectDay).toHaveBeenCalledWith(key);
  });
});
