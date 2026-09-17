"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import {
  CalendarPlus,
  FileText,
  Link2,
  Megaphone,
  Pencil,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsTime } from "@/lib/date";
import {
  groupActivityByDay,
  type ActivityItem,
  type ActivityKind,
} from "@/lib/recent-activity";
import { cn } from "@/lib/utils";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Activity changes as the advisor works, so this revalidates on mount and focus rather than
 * being held for a minute like the profile/stats payloads.
 */
const SWR_OPTS = {
  revalidateOnMount: true,
  revalidateOnFocus: true,
  dedupingInterval: 2_000,
} as const;

/** Icon and accent per event kind. Presentation only, so it stays out of the shared lib. */
const KIND_META: Record<
  ActivityKind,
  { icon: LucideIcon; className: string }
> = {
  "plan-created": { icon: Sparkles, className: "text-accent-blue" },
  "plan-published": { icon: Rocket, className: "text-[#155DFC]" },
  "plan-renamed": { icon: Pencil, className: "text-accent-blue" },
  "portal-url-changed": { icon: Link2, className: "text-[#155DFC]" },
  "document-uploaded": { icon: FileText, className: "text-[#4A5565]" },
  "meeting-added": { icon: CalendarPlus, className: "text-[#FF6900]" },
  "marketing-asset-created": { icon: Megaphone, className: "text-accent-blue" },
};

interface RecentActivityResponse {
  success: boolean;
  data: ActivityItem[];
}

/**
 * Recent Activity feed — one newest-first list of what has happened across plans, documents,
 * meetings and marketing, grouped into day buckets (Today / Yesterday / date).
 */
export function RecentActivity() {
  const { data, isLoading, error } = useSWR<RecentActivityResponse>(
    "/api/dashboard/recent-activity",
    jsonFetcher,
    SWR_OPTS,
  );

  const items = data?.data ?? [];
  // Grouping is derived rather than stored so the buckets stay correct if the component is
  // left open across midnight.
  const groups = useMemo(() => groupActivityByDay(items), [items]);

  return (
    <Card className="dark:border-gray-700 dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="text-base dark:text-gray-100">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ActivitySkeleton />
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Couldn’t load recent activity. Try again in a moment.
          </p>
        ) : items.length === 0 ? (
          <div className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground dark:border-gray-700">
            Nothing yet. Activity appears here as you create plans, upload documents
            and schedule meetings.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.key || "unknown"}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  // Full text for the tooltip, since the headline line truncates.
  const tooltip = [item.title, item.planName, item.subject]
    .filter(Boolean)
    .join(" · ");

  const row = (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted",
          meta.className,
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        {/* Headline and plan share one line so the row reads as a single statement of what
            happened and to whom — and plan events, which have no artifact, collapse to one
            line. Kept as one element so a long pair truncates at a single point instead of
            two flex children competing for the space. */}
        <p
          className="truncate text-sm font-medium dark:text-gray-100"
          title={tooltip}
        >
          {item.title}
          {item.planName && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              · {item.planName}
            </span>
          )}
        </p>
        {item.subject && (
          <p
            className="truncate text-xs text-muted-foreground"
            title={item.subject}
          >
            {item.subject}
          </p>
        )}
      </div>

      <span className="shrink-0 text-xs text-muted-foreground">
        {formatUsTime(item.at)}
      </span>
    </div>
  );

  return (
    <li className="border-b border-[#efefef] last:border-b-0 dark:border-gray-700">
      {item.href ? (
        <Link href={item.href} className="block transition-colors hover:bg-muted/50">
          {row}
        </Link>
      ) : (
        row
      )}
    </li>
  );
}

function ActivitySkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="flex items-center gap-3">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-4 w-40 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-56 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </li>
      ))}
    </ul>
  );
}
