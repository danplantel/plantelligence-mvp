"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskList } from "./task-list";
import { UpcomingMeetingsList } from "./upcoming-meetings-list";

/**
 * Dashboard row pairing the advisor's open tasks with their upcoming meetings.
 *
 * The layout is a five-column grid so the task list spans three fifths of the width and
 * the meetings rail two fifths, collapsing to a single stacked column below `lg`. Both
 * cards stretch to the height of the taller one.
 *
 * The task list carries its own "+ Add Task" affordance at the foot, so its card is a flex
 * column too — that keeps the entry row anchored regardless of how long the list gets.
 */
interface TasksAndMeetingsProps {
  /** Forwarded to the meetings rail so a read-only Viewer is not offered scheduling. */
  viewerReadOnly?: boolean;
  /** Forwarded to the task list so a reader without `publish` is not offered the publish task. */
  canPublish?: boolean;
}

export function TasksAndMeetings({
  viewerReadOnly = false,
  canPublish = true,
}: TasksAndMeetingsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* Task List — three fifths of the row. */}
      <div className="lg:col-span-3">
        <Card className="flex h-full flex-col dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-base dark:text-gray-100">
              Task List
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <TaskList canPublish={canPublish} />
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
            <UpcomingMeetingsList viewerReadOnly={viewerReadOnly} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

