"use client";

import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { formatUsDate, toScheduleDayKey, todayScheduleDayKey } from "@/lib/date";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const SWR_OPTS = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
} as const;

/** Abbreviations for the scheduling timezones the app offers. */
const TIME_ZONE_LABELS: Record<string, string> = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
  "America/Anchorage": "AT",
  "Pacific/Honolulu": "HT",
};

/** `12:00` + `America/New_York` → `12:00 PM ET`. Returns the raw value if unparseable. */
function formatMeetingTime(time: string, timezone?: string | null): string {
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);
  if (Number.isNaN(hour)) return time;

  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const suffix = hour >= 12 ? "PM" : "AM";
  const zone = timezone ? TIME_ZONE_LABELS[timezone] : undefined;

  return `${hour12}:${minutes ?? "00"} ${suffix}${zone ? ` ${zone}` : ""}`;
}

interface MeetingSummary {
  id: string;
  meeting: string;
  date: string;
  time: string;
  timezone: string | null;
  status: string;
}

interface MeetingsResponse {
  success: boolean;
  data: MeetingSummary[];
}

/**
 * Detail panel for the "Meetings this Week" tile: this week's meetings with their day,
 * time and status. Fetches lazily — it only mounts once the tile is selected.
 */
export function MeetingsThisWeekPanel() {
  const { data, isLoading, error } = useSWR<MeetingsResponse>(
    "/api/dashboard/meetings-this-week",
    jsonFetcher,
    SWR_OPTS,
  );

  if (isLoading) {
    return (
      <ul className="space-y-2.5">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="space-y-1.5">
            <div className="h-4 w-48 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn’t load this week’s meetings. Try again in a moment.
      </p>
    );
  }

  const meetings = data?.data ?? [];

  if (meetings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing on the calendar this week.
      </p>
    );
  }

  // Resolved once so every row is measured against the same "today".
  const todayKey = todayScheduleDayKey();

  return (
    <ul>
      {meetings.map((meeting) => {
        const isToday = toScheduleDayKey(meeting.date) === todayKey;

        return (
          <li
            key={meeting.id}
            className="flex items-center gap-3 border-b border-[#efefef] py-3 transition-colors hover:bg-muted/50 dark:border-gray-700"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium dark:text-gray-100">
                {meeting.meeting}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={isToday ? "font-semibold text-accent-blue" : ""}>
                  {isToday ? "Today" : formatUsDate(meeting.date)}
                </span>
                <span aria-hidden>·</span>
                <span>{formatMeetingTime(meeting.time, meeting.timezone)}</span>
                {meeting.status === "In Progress" && (
                  <span className="rounded-full bg-accent-blue/10 px-1.5 py-0.5 font-medium text-accent-blue">
                    In Progress
                  </span>
                )}
              </p>
            </div>

            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link
                href="/communications/meetings"
                aria-label={`View ${meeting.meeting}`}
              >
                View
              </Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
