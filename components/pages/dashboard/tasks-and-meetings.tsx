"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpcomingMeetingsList } from "./upcoming-meetings-list";

/**
 * Dashboard row pairing the advisor's open tasks with their upcoming meetings.
 *
 * The layout is a five-column grid so the task list spans three fifths of the width and
 * the meetings rail two fifths, collapsing to a single stacked column below `lg`. Both
 * cards stretch to the height of the taller one.
 *
 * Both sections are placeholders for now: each renders its own titled card with an empty
 * body, to be filled in separately.
 */
export function TasksAndMeetings() {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* Task List — three fifths of the row. */}
      <div className="lg:col-span-3">
        <Card className="h-full dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-base dark:text-gray-100">
              Task List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Placeholder label="Task list" />
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Meetings — the remaining two fifths. */}
      <div className="lg:col-span-2">
        <Card className="flex h-full flex-col dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-base dark:text-gray-100">
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          {/* `flex-1` gives the list a definite height so its footer link can sit at the
              foot of the card even when the task list column is taller. */}
          <CardContent className="flex-1">
            <UpcomingMeetingsList />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/** Temporary empty-state body, sized so the section has a visible footprint. */
function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground dark:border-gray-700">
      {label} — coming soon
    </div>
  );
}
