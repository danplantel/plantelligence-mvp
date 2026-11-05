"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  TIME_OPTIONS,
  TIME_ROW_HEIGHT,
  TIME_VISIBLE_ROWS,
  formatTimeAbbrev,
  indexOfClosestInList,
  minutesBetweenTimes,
  formatMeetingDuration,
  parseTimeInput,
} from "@/lib/meetings/time-slots";

/**
 * A time field the way the Meetings page does it — a Google-Calendar-style
 * quarter-hour picker behind a clock button, with the input still typeable.
 *
 * Type "1:30pm" (or "1330", or "1pm") and it takes; or open the list and click a
 * slot. The list centres on the slot nearest the current value, so opening it
 * never starts you at midnight.
 *
 * `afterTime` turns it into the END field: only later slots are offered, and each
 * shows the duration it would produce.
 */
export interface TimeFieldProps {
  id: string;
  label: string;
  /** "HH:MM", or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** Offer only slots after this one, and show the resulting duration. */
  afterTime?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function TimeField({
  id,
  label,
  value,
  onChange,
  afterTime,
  disabled = false,
  placeholder = "e.g. 1:30pm",
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ? formatTimeAbbrev(value) : "");
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the visible text in step with a value set from elsewhere (a pick, or a
  // reset when the dialog reopens).
  useEffect(() => {
    setText(value ? formatTimeAbbrev(value) : "");
  }, [value]);

  const options = useMemo(
    () =>
      afterTime
        ? TIME_OPTIONS.filter((option) => option.value > afterTime)
        : TIME_OPTIONS,
    [afterTime],
  );

  const highlightIndex = useMemo(() => {
    const parsed = parseTimeInput(text) || value;
    return indexOfClosestInList(parsed, options);
  }, [text, value, options]);

  // Centre the highlighted slot as the middle of the five visible rows.
  useEffect(() => {
    if (!open || highlightIndex < 0 || !listRef.current) return;
    listRef.current.scrollTop = Math.max(
      0,
      highlightIndex * TIME_ROW_HEIGHT -
        ((TIME_VISIBLE_ROWS - 1) / 2) * TIME_ROW_HEIGHT,
    );
  }, [open, highlightIndex]);

  const pick = (next: string, label: string) => {
    onChange(next);
    setText(label);
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <div className="relative">
          <Input
            id={id}
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              const parsed = parseTimeInput(next);
              if (parsed) onChange(parsed);
            }}
            onBlur={() => {
              // Leave an unparseable entry showing the value that is actually set.
              if (!parseTimeInput(text)) {
                setText(value ? formatTimeAbbrev(value) : "");
              }
            }}
            onFocus={() => {
              if (!disabled) setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") setOpen(false);
            }}
            className="pr-9"
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Pick ${label.toLowerCase()}`}
              disabled={disabled}
              onClick={(event) => {
                event.preventDefault();
                setOpen(true);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          // `z-[120]`: this picker lives inside a `z-[110]` dialog, and a popper
          // left at the app's default tier opens underneath that dialog's scrim.
          className="w-64 p-1 z-[120]"
          align="end"
          side="bottom"
        >
          <div
            ref={listRef}
            className="max-h-[160px] overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent"
            style={{ scrollbarWidth: "thin" }}
            onWheel={(event) => event.stopPropagation()}
          >
            {options.map((option, index) => {
              const duration = afterTime
                ? formatMeetingDuration(
                    minutesBetweenTimes(afterTime, option.value),
                  )
                : "";
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => pick(option.value, option.label)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                    highlightIndex === index
                      ? "bg-accent-blue/20 font-medium text-accent-blue"
                      : "hover:bg-muted",
                  )}
                >
                  <span>{option.label}</span>
                  {duration && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ({duration})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
