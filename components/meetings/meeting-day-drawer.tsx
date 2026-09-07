"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, isBefore, startOfDay } from "date-fns";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  Clock,
  Copy,
  Edit,
  FileText,
  Link as LinkIcon,
  MapPin,
  Plus,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatUsDate } from "@/lib/date";
import {
  formatTime12h,
  getTimezoneAbbr,
  parseLocalDate,
} from "@/lib/meetings/meeting-schedule-shared";

/** Structural subset of the page's `Meeting` type (extra fields are fine). */
export interface DayDrawerMeeting {
  id: string;
  meeting: string;
  date: string;
  time: string;
  timezone?: string;
  duration?: string;
  format?: string;
  platform?: string;
  meetingLink?: string;
  meetingUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  description?: string;
  attendees?: number;
  maxAttendees?: number;
  status: string;
  language?: string;
  benefitsCategory?: string;
  client?: string;
}

interface MeetingDayDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Selected day as YYYY-MM-DD. */
  dateKey?: string | null;
  /** Meetings on the selected day (already plan-scoped). */
  meetings: DayDrawerMeeting[];
  onAdd?: () => void;
  onEdit?: (meeting: DayDrawerMeeting) => void;
  onDuplicate?: (meeting: DayDrawerMeeting) => void;
  onDelete?: (meeting: DayDrawerMeeting) => void;
}

const STATUS_LABEL_MAP: Record<string, string> = {
  Scheduled: "Upcoming",
  Confirmed: "Upcoming",
  Completed: "Past",
  Cancelled: "Past",
  "In Progress": "Upcoming",
};

const STATUS_BADGE: Record<string, string> = {
  Upcoming:
    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-700/50",
  Past: "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-100 border border-gray-200 dark:border-gray-700/50",
  Draft:
    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-700/50",
};

const FORMAT_ICONS: Record<string, typeof Video> = {
  Virtual: Video,
  "In-Person": MapPin,
  "Virtual & In-Person": LinkIcon,
};

/** Ensure a URL has a scheme so it opens as an absolute link. */
const normalizeUrl = (url?: string): string => {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
};

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />}
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-xs font-medium text-foreground leading-relaxed">{children || "—"}</div>
      </div>
    </div>
  );
}

export function MeetingDayDrawer({
  open,
  onOpenChange,
  dateKey,
  meetings,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
}: MeetingDayDrawerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reset the expanded row whenever the drawer reopens.
  useEffect(() => {
    if (open) setExpandedId(null);
  }, [open, dateKey]);

  const dayDate = dateKey ? parseLocalDate(dateKey) : null;

  // Scheduling is allowed from tomorrow onward (today and past are read-only).
  const canAdd = useMemo(() => {
    if (!dateKey) return false;
    const minSchedulable = addDays(startOfDay(new Date()), 1);
    return !isBefore(parseLocalDate(dateKey), minSchedulable);
  }, [dateKey]);

  const sortedMeetings = useMemo(
    () =>
      [...meetings].sort((a, b) => {
        const at = a.time ? parseInt(a.time.replace(":", ""), 10) : 0;
        const bt = b.time ? parseInt(b.time.replace(":", ""), 10) : 0;
        return at - bt;
      }),
    [meetings],
  );

  const addButton = (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 flex-1"
      disabled={!canAdd}
      onClick={onAdd}
      title={canAdd ? "Schedule a new meeting for this day" : undefined}
    >
      <Plus className="h-4 w-4" />
      Add Meeting
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <div className="flex h-full flex-col gap-4">
          {/* Header */}
          <div className="shrink-0 space-y-3 pr-6">
            <div>
              <SheetTitle className="text-base">Meetings for this day</SheetTitle>
              <SheetDescription className="mt-0.5 text-sm font-medium text-foreground">
                {dayDate ? format(dayDate, "EEEE, MMMM d, yyyy") : ""}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {addButton}
              {meetings.length > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {meetings.length} meeting{meetings.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {!canAdd && dateKey && (
              <p className="text-[11px] text-muted-foreground">
                Scheduling is available starting tomorrow. Past and today are read-only for
                scheduling, but existing meetings can still be viewed, edited, or duplicated.
              </p>
            )}
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {sortedMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                  <CalendarDays className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-foreground">No meetings on this day</p>
                <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                  {canAdd
                    ? "Schedule a meeting for this date to get started."
                    : "This day is not open for scheduling yet."}
                </p>
                {canAdd && (
                  <Button size="sm" className="mt-4 gap-1.5" onClick={onAdd}>
                    <Plus className="h-4 w-4" />
                    Add Meeting
                  </Button>
                )}
              </div>
            ) : (
              sortedMeetings.map((m) => {
                const isExpanded = expandedId === m.id;
                const label = STATUS_LABEL_MAP[m.status] || m.status;
                const badgeClass = STATUS_BADGE[label] || STATUS_BADGE.Upcoming;
                const FormatIcon = FORMAT_ICONS[m.format as keyof typeof FORMAT_ICONS] || Video;
                const isVirtual = m.format === "Virtual" || m.format === "Virtual & In-Person";
                const hasLocation =
                  m.format === "In-Person" || m.format === "Virtual & In-Person";
                const link = normalizeUrl(m.meetingLink || m.meetingUrl);
                return (
                  <div
                    key={m.id}
                    className="overflow-hidden rounded-xl border border-border/60 bg-card"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10">
                        <FormatIcon className="h-4 w-4 text-accent-blue" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{m.meeting}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatTime12h(m.time)}
                          {m.timezone && (
                            <span className="ml-1 opacity-75">({getTimezoneAbbr(m.timezone)})</span>
                          )}
                        </p>
                      </div>
                      <Badge className={cn("shrink-0 text-[10px]", badgeClass)}>{label}</Badge>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </button>

                    {isExpanded && (
                      <div className="space-y-3 border-t border-border/60 px-3 py-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <DetailRow icon={Calendar} label="Date">
                            {formatUsDate(m.date)}
                          </DetailRow>
                          <DetailRow icon={Clock} label="Time">
                            {formatTime12h(m.time)}
                            {m.timezone && (
                              <span className="ml-1 text-[10px] opacity-75">
                                ({getTimezoneAbbr(m.timezone)})
                              </span>
                            )}
                          </DetailRow>
                          <DetailRow icon={Clock} label="Duration">
                            {m.duration || "—"}
                          </DetailRow>
                          <DetailRow icon={Users} label="Attendees">
                            {m.attendees}
                            {m.maxAttendees != null && ` / ${m.maxAttendees}`}
                          </DetailRow>
                          <DetailRow icon={Video} label="Format">
                            {m.format || "—"}
                            {m.format === "Virtual" && m.platform && ` · ${m.platform}`}
                          </DetailRow>
                          <DetailRow icon={MapPin} label="Client">
                            {m.client || "—"}
                          </DetailRow>
                          {m.language && (
                            <DetailRow label="Language">{m.language}</DetailRow>
                          )}
                          {m.benefitsCategory && (
                            <DetailRow label="Benefits Category">{m.benefitsCategory}</DetailRow>
                          )}
                        </div>

                        {hasLocation && m.address && (
                          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Location: </span>
                            {m.address}
                            {[m.city, m.state, m.zip].filter(Boolean).join(", ")
                              ? `, ${[m.city, m.state, m.zip].filter(Boolean).join(", ")}`
                              : ""}
                          </div>
                        )}

                        {isVirtual && (
                          <div>
                            {link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                              >
                                <LinkIcon className="h-3.5 w-3.5" />
                                Open meeting link
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">No meeting link set.</span>
                            )}
                          </div>
                        )}

                        {m.description && (
                          <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
                            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {m.description}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                          {onEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 flex-1"
                              onClick={() => {
                                setExpandedId(null);
                                onEdit(m);
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          )}
                          {onDuplicate && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 flex-1"
                              onClick={() => {
                                setExpandedId(null);
                                onDuplicate(m);
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 flex-1 text-destructive dark:text-red-500"
                              onClick={() => {
                                setExpandedId(null);
                                onDelete(m);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
