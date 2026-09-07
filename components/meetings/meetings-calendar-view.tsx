"use client";

import { useMemo } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarMeeting {
  id: string;
  title: string;
  /** Local date as YYYY-MM-DD. */
  date: string;
  /** 24-hour "HH:mm" time. */
  time?: string;
  /** Meeting status, e.g. "Upcoming", "Past", "Draft". */
  status?: string;
}

interface MeetingsCalendarViewProps {
  /** Meetings to plot (already scoped to the selected plan). */
  meetings: CalendarMeeting[];
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_SIZE = 42; // 6 weeks so every month grid stays uniform

const parseLocalDate = (value: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
};

const formatTimeAbbrev = (time24: string): string => {
  const [h, m] = time24.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
};

export function MeetingsCalendarView({ meetings }: MeetingsCalendarViewProps) {
  const today = useMemo(() => startOfDay(new Date()), []);

  // 12 month anchors, starting at the current month.
  const monthAnchors = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(today), i)),
    [today],
  );

  // Only consider meetings that fall inside the rendered window.
  const windowMeetings = useMemo(() => {
    const start = startOfMonth(today);
    const end = endOfMonth(addMonths(start, 11));
    return meetings.filter((m) => {
      const d = parseLocalDate(m.date);
      return d >= start && d <= end;
    });
  }, [meetings, today]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, CalendarMeeting[]>();
    for (const m of windowMeetings) {
      const dayKey = format(parseLocalDate(m.date), "yyyy-MM-dd");
      const list = map.get(dayKey);
      if (list) list.push(m);
      else map.set(dayKey, [m]);
    }
    return map;
  }, [windowMeetings]);

  const scheduledCount = windowMeetings.length;

  return (
    <div className="space-y-4">
      {/* Summary / no-meetings tag */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          {scheduledCount === 0 ? (
            <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
              No Meetings Scheduled
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {scheduledCount} meeting{scheduledCount === 1 ? "" : "s"} scheduled over the next 12 months
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            Today
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent-blue" />
            Scheduled meeting
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            Draft meeting
          </span>
        </div>
      </div>

      {/* Month grids */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {monthAnchors.map((month) => {
          const monthKey = format(month, "yyyy-MM");
          const gridStart = startOfWeek(month, { weekStartsOn: 0 });
          const cells = Array.from({ length: GRID_SIZE }, (_, i) => addDays(gridStart, i));
          const monthMeetingCount = cells.reduce(
            (total, cell) => total + (meetingsByDay.get(format(cell, "yyyy-MM-dd"))?.length ?? 0),
            0,
          );
          return (
            <div
              key={monthKey}
              className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
                <h4 className="text-sm font-semibold text-foreground">{format(month, "MMMM yyyy")}</h4>
                {monthMeetingCount > 0 && (
                  <span className="shrink-0 rounded-full bg-accent-blue/10 px-2 py-0.5 text-[10px] font-semibold text-accent-blue">
                    {monthMeetingCount} meeting{monthMeetingCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20 text-center">
                {WEEKDAY_LABELS.map((label) => (
                  <span
                    key={label}
                    className="py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-border/40 p-px">
                {cells.map((cell) => {
                  const dayKey = format(cell, "yyyy-MM-dd");
                  const dayMeetings = meetingsByDay.get(dayKey) ?? [];
                  const inMonth = isSameMonth(cell, month);
                  const isToday = isSameDay(cell, today);
                  return (
                    <div
                      key={dayKey}
                      title={
                        dayMeetings.length > 0
                          ? dayMeetings
                              .map((m) => `${m.time ? formatTimeAbbrev(m.time) : "All day"} · ${m.title}`)
                              .join("\n")
                          : undefined
                      }
                      className={cn(
                        "flex min-h-[46px] flex-col bg-card p-0.5 transition-colors duration-150",
                        !inMonth && "bg-muted/40",
                        inMonth && "cursor-default hover:bg-accent-blue-light",
                        dayMeetings.length > 0 && "bg-accent-blue/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "mx-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums leading-none",
                          isToday && "bg-blue-500 font-bold text-white",
                          !isToday && inMonth && dayMeetings.length > 0 && "font-semibold text-foreground",
                          !isToday && inMonth && dayMeetings.length === 0 && "text-muted-foreground",
                          !isToday && !inMonth && "text-muted-foreground/40",
                        )}
                      >
                        {format(cell, "d")}
                      </span>
                      {inMonth && dayMeetings.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5">
                          {dayMeetings.slice(0, 2).map((m) => {
                            const isDraft = (m.status || "").toLowerCase() === "draft";
                            return (
                              <div
                                key={m.id}
                                className={cn(
                                  "truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight",
                                  isDraft
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                                    : "bg-accent-blue/10 text-accent-blue",
                                )}
                                title={m.title}
                              >
                                {m.time ? formatTimeAbbrev(m.time) : "All day"}
                              </div>
                            );
                          })}
                          {dayMeetings.length > 2 && (
                            <div className="text-center text-[9px] font-semibold text-muted-foreground">
                              +{dayMeetings.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
