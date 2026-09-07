"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, PanelRight, Plus } from "lucide-react";
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
  /** Fired when an in-month day is clicked (opens the day drawer). */
  onSelectDay?: (dayKey: string) => void;
  /** Fired when the "Add a Meeting" hover action is chosen. */
  onQuickAdd?: (dayKey: string) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_SIZE = 42; // 6 weeks so every month grid stays uniform

const HOVER_MENU_WIDTH = 168;
const HOVER_MENU_HEIGHT = 88; // approx. height used to keep the menu on-screen

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

export function MeetingsCalendarView({
  meetings,
  onSelectDay,
  onQuickAdd,
}: MeetingsCalendarViewProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  // Scheduling is only allowed at least one day ahead; today and past days are read-only.
  const minSchedulable = useMemo(() => addDays(today, 1), [today]);

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

  // Hover menu: a single portal-anchored menu that appears just under the date
  // number of the hovered day. It always opens from the same relative spot.
  const [hoverMenu, setHoverMenu] = useState<{
    dayKey: string;
    x: number;
    y: number;
  } | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const scheduleCloseMenu = () => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setHoverMenu(null), 160);
  };

  const openHoverMenu = (dayKey: string, el: HTMLElement) => {
    clearHoverTimer();
    const rect = el.getBoundingClientRect();
    // Always open centered under the date number (static location), downward.
    let x = rect.left + rect.width / 2 - HOVER_MENU_WIDTH / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - HOVER_MENU_WIDTH - 8));
    let y = rect.top + 18; // just below the date number
    if (y + HOVER_MENU_HEIGHT > window.innerHeight - 8) {
      y = Math.max(8, rect.top - HOVER_MENU_HEIGHT - 6);
    }
    setHoverMenu({ dayKey, x, y });
  };

  const runHoverAction = (fn?: (dayKey: string) => void) => (dayKey: string) => {
    setHoverMenu(null);
    fn?.(dayKey);
  };

  // Reposition safety: close the menu if the page scrolls/resizes while open.
  useEffect(() => {
    if (!hoverMenu) return;
    const close = () => setHoverMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [hoverMenu]);

  // Clear any pending close timer on unmount.
  useEffect(
    () => () => {
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    },
    [],
  );

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
                  const schedulable = !isBefore(cell, minSchedulable);
                  const meetingTooltip =
                    dayMeetings.length > 0
                      ? dayMeetings
                          .map((m) => `${m.time ? formatTimeAbbrev(m.time) : "All day"} · ${m.title}`)
                          .join("\n")
                      : undefined;

                  const dayNumber = (
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
                  );

                  const canOpenMenu =
                    (schedulable && !!onQuickAdd) ||
                    (dayMeetings.length > 0 && !!onSelectDay);

                  return (
                    <div
                      key={dayKey}
                      onMouseEnter={(e) => {
                        if (!inMonth || !canOpenMenu) return;
                        openHoverMenu(dayKey, e.currentTarget);
                      }}
                      onMouseLeave={() => {
                        if (inMonth) scheduleCloseMenu();
                      }}
                      className={cn(
                        "relative flex min-h-[46px] flex-col bg-card p-0.5 transition-colors duration-150",
                        !inMonth && "bg-muted/40",
                        inMonth && "cursor-default hover:bg-accent-blue-light",
                        dayMeetings.length > 0 && "bg-accent-blue/[0.03]",
                      )}
                    >
                      {inMonth ? (
                        <button
                          type="button"
                          onClick={() => {
                            setHoverMenu(null);
                            onSelectDay?.(dayKey);
                          }}
                          title={meetingTooltip}
                          aria-label={`Open ${format(cell, "EEEE, MMMM d, yyyy")}`}
                          className="flex w-full flex-1 flex-col items-center rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-blue"
                        >
                          {dayNumber}
                          {dayMeetings.length > 0 && (
                            <div className="mt-1 flex w-full items-center justify-center px-0.5">
                              <span
                                title={meetingTooltip}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                                  dayMeetings.some(
                                    (m) => (m.status || "").toLowerCase() === "draft",
                                  )
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                                    : "bg-accent-blue/10 text-accent-blue",
                                )}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {dayMeetings.length}
                              </span>
                            </div>
                          )}
                        </button>
                      ) : (
                        <div className="flex w-full flex-1 flex-col items-center">{dayNumber}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Portal hover menu — static position just under the hovered day's date number */}
      {hoverMenu &&
        (() => {
          const m = hoverMenu;
          const hoverMeetings = meetingsByDay.get(m.dayKey) ?? [];
          const canSchedule = !isBefore(parseLocalDate(m.dayKey), minSchedulable);
          const showAdd = canSchedule && !!onQuickAdd;
          const showView = hoverMeetings.length > 0 && !!onSelectDay;
          if (!showAdd && !showView) return null;
          return createPortal(
            <div
              className="fixed z-[70]"
              style={{ left: m.x, top: m.y }}
              onMouseEnter={clearHoverTimer}
              onMouseLeave={scheduleCloseMenu}
            >
              <div className="w-[168px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-gray-800 shadow-xl dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                {showAdd && (
                  <button
                    type="button"
                    onClick={() => runHoverAction(onQuickAdd)(m.dayKey)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-accent-blue-light hover:text-accent-blue dark:hover:bg-accent-blue/25 dark:hover:text-[#7ce1ea]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add a Meeting
                  </button>
                )}
                {showView && (
                  <button
                    type="button"
                    onClick={() => runHoverAction(onSelectDay)(m.dayKey)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-accent-blue-light hover:text-accent-blue dark:hover:bg-accent-blue/25 dark:hover:text-[#7ce1ea]"
                  >
                    <PanelRight className="h-3.5 w-3.5" />
                    View Meetings
                  </button>
                )}
              </div>
            </div>,
            document.body,
          );
        })()}
    </div>
  );
}
