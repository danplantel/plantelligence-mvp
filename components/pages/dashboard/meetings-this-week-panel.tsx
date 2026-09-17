"use client";

import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { formatMeetingDay, formatMeetingTime } from "@/lib/meeting-display";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const SWR_OPTS = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
} as const;

interface MeetingSummary {
  id: string;
  meeting: string;
  date: string;
  time: string;
  timezone: string | null;
  status: string;
  /** Denormalised plan name stored on the meeting. */
  client: string;
  /** Authoritative plan record, used in preference to `client`. */
  clientRecord: { companyName: string } | null;
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

  return (
    <ul>
      {meetings.map((meeting) => {
        const dayLabel = formatMeetingDay(meeting.date);
        const isToday = dayLabel === "Today";
        const planName = meeting.clientRecord?.companyName || meeting.client;

        return (
          <li
            key={meeting.id}
            className="flex items-center gap-3 border-b border-[#efefef] py-3 transition-colors hover:bg-muted/50 dark:border-gray-700"
          >
            <div className="min-w-0 flex-1">
              {/* Meeting name and its plan share one line so the row reads as a single
                  statement of what and for whom. Kept as one element so a long pair
                  truncates at a single point instead of two flex children fighting for
                  space. The plan is omitted for meetings with no plan attached. */}
              <p
                className="truncate text-sm font-medium dark:text-gray-100"
                title={
                  planName ? `${meeting.meeting} · ${planName}` : meeting.meeting
                }
              >
                {meeting.meeting}
                {planName && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    · {planName}
                  </span>
                )}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={isToday ? "font-semibold text-accent-blue" : ""}>
                  {dayLabel}
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
