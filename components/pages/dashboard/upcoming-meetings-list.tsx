"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { formatMeetingDay, formatMeetingTime } from "@/lib/meeting-display";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Unlike the profile/stats payloads, this list changes as the advisor works — a meeting
 * added on the meetings page has to be here when they come back. SWR keeps its cache across
 * client-side navigation, so the defaults used elsewhere (no focus revalidation, 60s dedupe)
 * would serve the pre-meeting list. Revalidating on mount and on focus, with a near-zero
 * dedupe window, means the dashboard refetches every time it is opened or refocused.
 */
const SWR_OPTS = {
  revalidateOnMount: true,
  revalidateOnFocus: true,
  dedupingInterval: 2_000,
} as const;

/**
 * The meetings page owns scheduling. It accepts `client` / `planId` params to preselect a
 * plan but has no param that opens its create form, so both the CTA and the footer link
 * land on the page itself.
 */
const MEETINGS_HREF = "/communications/meetings";

interface UpcomingMeeting {
  id: string;
  meeting: string;
  date: string;
  time: string;
  timezone: string | null;
  status: string;
  client: string;
  clientId: string | null;
}

interface UpcomingMeetingsResponse {
  success: boolean;
  data: UpcomingMeeting[];
}

/**
 * The next few meetings for the dashboard rail — day, time, title and plan, soonest
 * first — with a link through to the full list. Fetches its own data so the surrounding
 * card stays presentational.
 */
export function UpcomingMeetingsList() {
  const { data, isLoading, error } = useSWR<UpcomingMeetingsResponse>(
    "/api/dashboard/upcoming-meetings",
    jsonFetcher,
    SWR_OPTS,
  );

  if (isLoading) {
    return (
      <ul className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-40 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn’t load upcoming meetings. Try again in a moment.
      </p>
    );
  }

  const meetings = data?.data ?? [];

  // An empty state that offers the next action rather than just reporting the absence.
  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center dark:border-gray-700">
        <p className="text-sm text-muted-foreground">No upcoming meetings</p>
        <Button asChild variant="outline" size="sm">
          <Link href={MEETINGS_HREF}>
            <Plus className="size-4" />
            Schedule Meeting
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="divide-y divide-[#efefef] dark:divide-gray-700">
        {meetings.map((meeting) => (
          <li key={meeting.id} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-accent-blue">
                {formatMeetingDay(meeting.date)}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatMeetingTime(meeting.time, meeting.timezone)}
              </span>
            </div>

            <p
              className="mt-1 truncate text-sm font-medium dark:text-gray-100"
              title={meeting.meeting}
            >
              {meeting.meeting}
            </p>

            {meeting.client && (
              <p className="truncate text-xs text-muted-foreground" title={meeting.client}>
                {meeting.client}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* `mt-auto` anchors the link to the foot of the card whatever the other column's
          height, so the two sections stay aligned. */}
      <Link
        href={MEETINGS_HREF}
        className="mt-auto flex items-center justify-center gap-1 pt-3 text-sm font-medium text-accent-blue hover:underline"
      >
        View All Meetings
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
