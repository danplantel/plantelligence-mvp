"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// Time picker options
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const AMPM_OPTIONS = ["AM", "PM"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface SupportHoursTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SupportHoursTimePicker({
  value,
  onChange,
  disabled = false,
}: SupportHoursTimePickerProps) {
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startHour, setStartHour] = useState<string>("");
  const [startMinute, setStartMinute] = useState<string>("");
  const [startAmpm, setStartAmpm] = useState<string>("");
  const [endHour, setEndHour] = useState<string>("");
  const [endMinute, setEndMinute] = useState<string>("");
  const [endAmpm, setEndAmpm] = useState<string>("");
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // Parse supportHours string into time picker values
  const parseSupportHours = useCallback((hoursStr: string) => {
    if (!hoursStr) {
      setSelectedDays([]);
      setStartHour("");
      setStartMinute("");
      setStartAmpm("");
      setEndHour("");
      setEndMinute("");
      setEndAmpm("");
      return;
    }

    // Parse days
    if (hoursStr.includes("Mon-Sun")) {
      setSelectedDays(DAYS);
    } else if (hoursStr.includes("Mon-Fri")) {
      setSelectedDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    } else {
      const foundDays = DAYS.filter((d) => hoursStr.includes(d));
      if (foundDays.length > 0) {
        setSelectedDays(foundDays);
      }
    }

    // Try to parse formats like "9:00 AM - 5:00 PM" or "9am-5pm"
    const timeRangeRegex =
      /(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?\s*-\s*(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/i;
    const match = hoursStr.match(timeRangeRegex);

    if (match) {
      const [, startH, startM = "00", startA, endH, endM = "00", endA] = match;
      setStartHour(startH);
      setStartMinute(startM.padStart(2, "0"));
      setStartAmpm(startA ? startA.toUpperCase() : "");
      setEndHour(endH);
      setEndMinute(endM.padStart(2, "0"));
      setEndAmpm(endA ? endA.toUpperCase() : "");
    }
  }, []);

  // Format time picker values into supportHours string
  const formatSupportHours = useCallback(() => {
    let daysStr = "";
    if (selectedDays.length === 7) {
      daysStr = "Mon-Sun";
    } else if (
      selectedDays.length === 5 &&
      ["Mon", "Tue", "Wed", "Thu", "Fri"].every((d) =>
        selectedDays.includes(d),
      )
    ) {
      daysStr = "Mon-Fri";
    } else if (selectedDays.length > 0) {
      const sortedDays = [...selectedDays].sort(
        (a, b) => DAYS.indexOf(a) - DAYS.indexOf(b),
      );
      daysStr = sortedDays.join(", ");
    }

    let timeStr = "";
    const startPart =
      startHour || startMinute || startAmpm
        ? `${startHour || "9"}:${(startMinute || "00").padStart(2, "0")} ${startAmpm || "AM"}`
        : "";
    const endPart =
      endHour || endMinute || endAmpm
        ? `${endHour || "5"}:${(endMinute || "00").padStart(2, "0")} ${endAmpm || "PM"}`
        : "";

    if (startPart && endPart) {
      timeStr = `${startPart} - ${endPart}`;
    } else if (startPart) {
      timeStr = startPart;
    } else if (endPart) {
      timeStr = endPart;
    }

    const formatted =
      daysStr && timeStr
        ? `${daysStr}, ${timeStr}`
        : daysStr || timeStr || "";

    onChange(formatted);
    return formatted;
  }, [
    selectedDays,
    startHour,
    startMinute,
    startAmpm,
    endHour,
    endMinute,
    endAmpm,
    onChange,
  ]);

  // Parse supportHours on initial load
  useEffect(() => {
    if (value && selectedDays.length === 0 && !startHour && !endHour) {
      parseSupportHours(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update supportHours when time picker values change
  // Use ref to prevent infinite loops
  const prevTimeValuesRef = useRef<string>("");
  useEffect(() => {
    const timeValuesString = `${selectedDays.join(",")}-${startHour}-${startMinute}-${startAmpm}-${endHour}-${endMinute}-${endAmpm}`;

    // Only update if values actually changed
    if (prevTimeValuesRef.current !== timeValuesString) {
      prevTimeValuesRef.current = timeValuesString;

      if (
        selectedDays.length > 0 ||
        (startHour && startMinute && startAmpm) ||
        (endHour && endMinute && endAmpm)
      ) {
        formatSupportHours();
      }
    }
  }, [selectedDays, startHour, startMinute, startAmpm, endHour, endMinute, endAmpm, formatSupportHours]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    parseSupportHours(newValue);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleTimeChange = (
    type: "start" | "end",
    field: "hour" | "minute" | "ampm",
    value: string,
  ) => {
    if (type === "start") {
      if (field === "hour") setStartHour(value);
      else if (field === "minute") setStartMinute(value);
      else if (field === "ampm") setStartAmpm(value);
    } else {
      if (field === "hour") setEndHour(value);
      else if (field === "minute") setEndMinute(value);
      else if (field === "ampm") setEndAmpm(value);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Support Hours (optional)</Label>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={handleInputChange}
          placeholder="e.g., Monday-Friday, 9am-5pm EST"
          className={cn("flex-1", disabled && "opacity-50 cursor-not-allowed")}
          disabled={disabled}
        />
        <Popover
          open={timePickerOpen && !disabled}
          onOpenChange={(open) => !disabled && setTimePickerOpen(open)}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "shrink-0",
                disabled && "opacity-50 cursor-not-allowed",
              )}
              disabled={disabled}
            >
              <Clock className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[480px] p-0 rounded-md border bg-popover shadow-md"
            align="end"
          >
            <div className="p-4 space-y-4">
              {/* Day Selection */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Select Days</div>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      variant={selectedDays.includes(day) ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 px-2 text-xs transition-colors",
                        selectedDays.includes(day) &&
                        "bg-accent-blue hover:bg-accent-blue/90 text-white",
                      )}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() =>
                      setSelectedDays(["Mon", "Tue", "Wed", "Thu", "Fri"])
                    }
                  >
                    Mon-Fri
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() => setSelectedDays(DAYS)}
                  >
                    Mon-Sun
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() => setSelectedDays([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="text-sm font-medium">Set Time Range</div>
              <div className="flex gap-6">
                {/* Start Time */}
                <div className="space-y-2 flex-1">
                  <Label className="text-xs text-muted-foreground">
                    Start Time
                  </Label>
                  <div className="flex rounded-md overflow-hidden border">
                    {/* Hour Column */}
                    <div className="border-r border-border flex-1">
                      <div className="px-1 py-1 text-[10px] font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        Hour
                      </div>
                      <div
                        className="max-h-40 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col items-center"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {HOURS.map((hour) => (
                          <button
                            key={hour}
                            onClick={() => {
                              handleTimeChange(
                                "start",
                                "hour",
                                hour.toString(),
                              );
                            }}
                            className={`w-full px-1 py-1.5 text-xs transition-colors focus:outline-none ${startHour === hour.toString()
                              ? "bg-accent-blue text-white"
                              : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                          >
                            {hour}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Minute Column */}
                    <div className="border-r border-border flex-1">
                      <div className="px-1 py-1 text-[10px] font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        Min
                      </div>
                      <div
                        className="max-h-40 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col items-center"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {MINUTES.map((minute) => (
                          <button
                            key={minute}
                            onClick={() => {
                              handleTimeChange(
                                "start",
                                "minute",
                                minute.toString().padStart(2, "0"),
                              );
                            }}
                            className={`w-full py-1.5 text-xs transition-colors focus:outline-none ${startMinute === minute.toString().padStart(2, "0")
                              ? "bg-accent-blue text-white"
                              : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                          >
                            {minute.toString().padStart(2, "0")}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AM/PM Column */}
                    <div className="flex-1">
                      <div className="px-1 py-1 text-[10px] font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        AM/PM
                      </div>
                      <div
                        className="max-h-40 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col items-center"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {AMPM_OPTIONS.map((ampm) => (
                          <button
                            key={ampm}
                            onClick={() => {
                              handleTimeChange("start", "ampm", ampm);
                            }}
                            className={`w-full px-1 py-1.5 text-xs transition-colors focus:outline-none ${startAmpm === ampm
                              ? "bg-accent-blue text-white"
                              : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                          >
                            {ampm}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* End Time */}
                <div className="space-y-2 flex-1">
                  <Label className="text-xs text-muted-foreground">
                    End Time
                  </Label>
                  <div className="flex rounded-md overflow-hidden border">
                    {/* Hour Column */}
                    <div className="border-r border-border flex-1">
                      <div className="px-1 py-1 text-[10px] font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        Hour
                      </div>
                      <div
                        className="max-h-40 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col items-center"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {HOURS.map((hour) => (
                          <button
                            key={hour}
                            onClick={() => {
                              handleTimeChange("end", "hour", hour.toString());
                            }}
                            className={`w-full px-1 py-1.5 text-xs transition-colors focus:outline-none ${endHour === hour.toString()
                              ? "bg-accent-blue text-white"
                              : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                          >
                            {hour}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Minute Column */}
                    <div className="border-r border-border flex-1">
                      <div className="px-1 py-1 text-[10px] font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        Min
                      </div>
                      <div
                        className="max-h-40 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col items-center"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {MINUTES.map((minute) => (
                          <button
                            key={minute}
                            onClick={() => {
                              handleTimeChange(
                                "end",
                                "minute",
                                minute.toString().padStart(2, "0"),
                              );
                            }}
                            className={`w-full py-1.5 text-xs transition-colors focus:outline-none ${endMinute === minute.toString().padStart(2, "0")
                              ? "bg-accent-blue text-white"
                              : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                          >
                            {minute.toString().padStart(2, "0")}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AM/PM Column */}
                    <div className="flex-1">
                      <div className="px-1 py-1 text-[10px] font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        AM/PM
                      </div>
                      <div
                        className="max-h-40 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col items-center"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {AMPM_OPTIONS.map((ampm) => (
                          <button
                            key={ampm}
                            onClick={() => {
                              handleTimeChange("end", "ampm", ampm);
                            }}
                            className={`w-full px-1 py-1.5 text-xs transition-colors focus:outline-none ${endAmpm === ampm
                              ? "bg-accent-blue text-white"
                              : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                          >
                            {ampm}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
