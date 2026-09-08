"use client";

import { useMemo, useState } from "react";
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
import { CalendarDays, ChevronDown, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Document } from "@/components/pages/documents/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { formatUsDate } from "@/lib/date";

interface DocumentsCalendarViewProps {
  /** Documents for the selected plan (used for review dates). */
  documents: Document[];
  /** Open the existing document preview modal for a document. */
  onPreview?: (doc: Document) => void;
  /** Persist a new review date (null clears it). Resolves false on failure. */
  onUpdateReviewDate?: (docId: string, date: string | null) => Promise<boolean>;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_SIZE = 42; // 6 weeks so every month grid stays uniform

const parseLocalDate = (value: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
};

const formatDayKey = (date: Date): string => format(date, "yyyy-MM-dd");

function getStatus(doc: Document) {
  const date = doc.expirationDate ? parseLocalDate(doc.expirationDate) : null;
  if (!date) return null;
  const today = startOfDay(new Date());
  if (isBefore(date, today)) return { label: "Past review", tone: "red" } as const;
  return { label: "Upcoming", tone: "teal" } as const;
}

export function DocumentsCalendarView({
  documents,
  onPreview,
  onUpdateReviewDate,
}: DocumentsCalendarViewProps) {
  const today = useMemo(() => startOfDay(new Date()), []);

  // 15 month anchors starting at the current month (current + 14 months).
  const monthAnchors = useMemo(
    () => Array.from({ length: 15 }, (_, i) => addMonths(startOfMonth(today), i)),
    [today],
  );

  const windowStart = monthAnchors[0];
  const windowEnd = endOfMonth(addMonths(windowStart, 14));

  const docsByDay = useMemo(() => {
    const map = new Map<string, Document[]>();
    for (const doc of documents) {
      if (!doc.expirationDate) continue;
      const date = parseLocalDate(doc.expirationDate);
      if (date < windowStart || date > windowEnd) continue;
      const key = formatDayKey(date);
      const list = map.get(key);
      if (list) list.push(doc);
      else map.set(key, [doc]);
    }
    return map;
  }, [documents, windowStart, windowEnd]);

  const scheduledCount = useMemo(
    () => [...docsByDay.values()].reduce((sum, list) => sum + list.length, 0),
    [docsByDay],
  );

  // Selected day + right drawer state
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Per-document "change date" editing state
  const [dateDocId, setDateDocId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<Date | undefined>(undefined);
  const [savingDocId, setSavingDocId] = useState<string | null>(null);

  const openDay = (dayKey: string) => {
    setSelectedDayKey(dayKey);
    setDrawerOpen(true);
  };

  const startEdit = (doc: Document) => {
    setDateDocId(doc.id);
    setTempDate(doc.expirationDate ? parseLocalDate(doc.expirationDate) : undefined);
  };

  const cancelEdit = () => {
    setDateDocId(null);
    setTempDate(undefined);
  };

  const saveDate = async (doc: Document, value: Date | null) => {
    if (!onUpdateReviewDate) return;
    setSavingDocId(doc.id);
    const dateStr = value ? formatDayKey(value) : null;
    const ok = await onUpdateReviewDate(doc.id, dateStr);
    setSavingDocId(null);
    if (ok) cancelEdit();
  };

  const selectedDayDocs = selectedDayKey ? (docsByDay.get(selectedDayKey) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          {scheduledCount === 0 ? (
            <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
              No review dates scheduled
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {scheduledCount} document{scheduledCount === 1 ? "" : "s"} with a review date in the next 15 months
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
            Documents due for review
          </span>
        </div>
      </div>

      {/* Month grids */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {monthAnchors.map((month) => {
          const monthKey = format(month, "yyyy-MM");
          const gridStart = startOfWeek(month, { weekStartsOn: 0 });
          const cells = Array.from({ length: GRID_SIZE }, (_, i) => addDays(gridStart, i));
          // Only count days that belong to this month (grid includes adjacent-month filler days).
          const monthCount = cells.reduce(
            (total, cell) =>
              total +
              (isSameMonth(cell, month)
                ? (docsByDay.get(formatDayKey(cell))?.length ?? 0)
                : 0),
            0,
          );
          return (
            <div
              key={monthKey}
              className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
                <h4 className="text-sm font-semibold text-foreground">{format(month, "MMMM yyyy")}</h4>
                {monthCount > 0 && (
                  <span className="shrink-0 rounded-full bg-accent-blue/10 px-2 py-0.5 text-[10px] font-semibold text-accent-blue">
                    {monthCount} document{monthCount === 1 ? "" : "s"}
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
                  const dayKey = formatDayKey(cell);
                  const dayDocs = docsByDay.get(dayKey) ?? [];
                  const inMonth = isSameMonth(cell, month);
                  const isToday = isSameDay(cell, today);
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      disabled={!inMonth}
                      onClick={() => openDay(dayKey)}
                      title={dayDocs.length > 0 ? dayDocs.map((d) => d.title).join("\n") : undefined}
                      className={cn(
                        "relative flex min-h-[46px] flex-col items-center bg-card p-0.5 transition-colors duration-150 disabled:cursor-default",
                        !inMonth && "bg-muted/40",
                        inMonth &&
                          "hover:bg-accent-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-blue",
                        dayDocs.length > 0 && "bg-accent-blue/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums leading-none",
                          isToday && "bg-blue-500 font-bold text-white",
                          !isToday && inMonth && dayDocs.length > 0 && "font-semibold text-foreground",
                          !isToday && inMonth && dayDocs.length === 0 && "text-muted-foreground",
                          !isToday && !inMonth && "text-muted-foreground/40",
                        )}
                      >
                        {format(cell, "d")}
                      </span>
                      {inMonth && dayDocs.length > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent-blue/10 px-1.5 py-0.5 text-[9px] font-bold leading-none text-accent-blue">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {dayDocs.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right drawer: documents due on the selected day */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <div className="flex h-full flex-col gap-4">
            <div className="shrink-0 space-y-2 pr-6">
              <SheetTitle className="text-base">Documents for review</SheetTitle>
              <SheetDescription className="mt-0.5 text-sm font-medium text-foreground">
                {selectedDayKey ? format(parseLocalDate(selectedDayKey), "EEEE, MMMM d, yyyy") : ""}
              </SheetDescription>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {selectedDayDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                    <CalendarDays className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No documents due this day</p>
                  <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                    Review dates are set when a document is uploaded.
                  </p>
                </div>
              ) : (
                selectedDayDocs.map((doc) => {
                  const status = getStatus(doc);
                  const saving = savingDocId === doc.id;
                  const editing = dateDocId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      className="overflow-hidden rounded-xl border border-border/60 bg-card"
                    >
                      <div className="flex items-start gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{doc.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {doc.category && (
                              <Badge className="text-[10px] h-5 px-1.5 bg-[#002B5B]/10 text-[#002B5B] hover:bg-[#002B5B] hover:text-white dark:bg-blue-900/30 dark:text-blue-300 border-transparent cursor-default">
                                {doc.category}
                              </Badge>
                            )}
                            {doc.language && (
                              <Badge className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100 border-transparent cursor-default">
                                {doc.language}
                              </Badge>
                            )}
                            {status && (
                              <Badge
                                className={cn(
                                  "text-[10px] h-5 px-1.5 border-transparent cursor-default",
                                  status.tone === "red"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
                                )}
                              >
                                {status.label}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Review date:{" "}
                            <span className="font-medium text-foreground">
                              {doc.expirationDate ? formatUsDate(doc.expirationDate) : "Not set"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
                        {onPreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 flex-1"
                            disabled={saving}
                            onClick={() => onPreview(doc)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        )}
                        <Popover
                          open={editing}
                          onOpenChange={(open) => (open ? startEdit(doc) : cancelEdit())}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 flex-1"
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Pencil className="h-3.5 w-3.5" />
                              )}
                              Change review date
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <div className="p-2">
                              <CalendarPicker
                                mode="single"
                                selected={tempDate}
                                onSelect={setTempDate}
                                initialFocus
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 border-t border-border p-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-destructive dark:text-red-500"
                                disabled={!doc.expirationDate || saving}
                                onClick={() => saveDate(doc, null)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Clear
                              </Button>
                              <div className="flex items-center gap-2">
                                <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!tempDate || saving}
                                  onClick={() => saveDate(doc, tempDate ?? null)}
                                >
                                  Save date
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
