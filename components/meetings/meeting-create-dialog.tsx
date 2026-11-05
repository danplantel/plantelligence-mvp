"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AddressSearch } from "@/components/ui/address-search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimeField } from "@/components/meetings/time-field";
import { MEETING_TYPES } from "@/lib/meetings";
import {
  formatMeetingDuration,
  minutesBetweenTimes,
} from "@/lib/meetings/time-slots";

/**
 * Schedule a meeting from anywhere — the Communications → Meetings page and the
 * portal's News & Events panel use this one form.
 *
 * The essentials of that page's creator: type, when, where, how people join, and
 * the copy shown on the card. Editing, duplicating, the calendar and the custom
 * meeting types the advisor saved themselves stay on the dashboard page.
 *
 * Two deliberate simplifications: the start/end times are native `time` inputs
 * rather than that page's scrollable slot pickers, and a clash is a warning the
 * advisor can schedule past rather than a dialog they must confirm.
 */

const FORMATS = ["Virtual", "In-Person", "Virtual & In-Person"] as const;
const PLATFORMS = ["Zoom", "Teams", "Google Meet", "Other"] as const;
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
] as const;
const CATEGORIES = ["Retirement", "Group Health", "Group Life", "Other"];

/** The card shows three lines, which is what this cap takes. */
const MAX_DESCRIPTION = 180;

const DEFAULT_DESCRIPTION =
  "Learn about upcoming plan options, updates, and key dates so you can make informed choices for the year ahead.";

/** The meeting fields this dialog can edit, as the API returns them. */
export interface MeetingDraft {
  id: string;
  meeting?: string;
  meetingType?: string;
  date?: string;
  time?: string;
  endTime?: string;
  timezone?: string;
  /** Derived on the dashboard ("2 hours"); stored on the row, shown read-only. */
  duration?: string;
  format?: string;
  platform?: string;
  meetingLink?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  description?: string;
  maxAttendees?: string | number;
  language?: string;
  benefitsCategory?: string;
  status?: string;
}

export interface MeetingCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planName: string;
  /**
   * The meeting to edit. Omitted (or null) and the dialog creates a new one —
   * same fields, same validation, PUT instead of POST.
   */
  editing?: MeetingDraft | null;
  onCreated?: () => void;
}


export function MeetingCreateDialog({
  open,
  onOpenChange,
  planId,
  planName,
  editing = null,
  onCreated,
}: MeetingCreateDialogProps) {
  const [meetingType, setMeetingType] = useState("");
  const [customMeetingType, setCustomMeetingType] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [format, setFormat] = useState("");
  const [platform, setPlatform] = useState("");
  const [customPlatform, setCustomPlatform] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [maxAttendees, setMaxAttendees] = useState("");
  const [language, setLanguage] = useState("English");
  const [benefitsCategory, setBenefitsCategory] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const duration = useMemo(
    () =>
      formatMeetingDuration(minutesBetweenTimes(startTime, endTime)),
    [startTime, endTime],
  );

  // Selecting a type carries its standard description, the way the Meetings page
  // prefills it — so the card says something useful without the advisor typing.
  useEffect(() => {
    if (meetingType === "Custom") {
      setDescription("");
      return;
    }
    const match = MEETING_TYPES.find((entry) => entry.value === meetingType);
    if (match?.description) setDescription(match.description);
  }, [meetingType]);

  // Seed on open: the row being edited, or a blank form. Depends on `editing`
  // too, so opening a different row in the same mount fills the right values.
  useEffect(() => {
    if (!open) return;

    if (editing) {
      const known = MEETING_TYPES.some(
        (entry) => entry.value === editing.meetingType,
      );
      setMeetingType(known ? String(editing.meetingType) : "Custom");
      setCustomMeetingType(known ? "" : String(editing.meetingType ?? ""));
      setDate(String(editing.date ?? "").slice(0, 10));
      setStartTime(String(editing.time ?? ""));
      setEndTime(String(editing.endTime ?? ""));
      setTimezone(String(editing.timezone || "America/New_York"));
      setFormat(String(editing.format ?? ""));
      setPlatform(String(editing.platform ?? ""));
      setCustomPlatform("");
      setMeetingLink(String(editing.meetingLink ?? ""));
      setAddress(String(editing.address ?? ""));
      setCity(String(editing.city ?? ""));
      setState(String(editing.state ?? ""));
      setZip(String(editing.zip ?? ""));
      setDescription(String(editing.description ?? ""));
      setMaxAttendees(
        editing.maxAttendees === undefined || editing.maxAttendees === null
          ? ""
          : String(editing.maxAttendees),
      );
      setLanguage(String(editing.language || "English"));
      setBenefitsCategory(String(editing.benefitsCategory ?? ""));
      setConflict(null);
      setError(null);
      return;
    }

    setMeetingType("");
    setCustomMeetingType("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setTimezone("America/New_York");
    setFormat("");
    setPlatform("");
    setCustomPlatform("");
    setMeetingLink("");
    setAddress("");
    setCity("");
    setState("");
    setZip("");
    setDescription(DEFAULT_DESCRIPTION);
    setMaxAttendees("");
    setLanguage("English");
    setBenefitsCategory("");
    setConflict(null);
    setError(null);
  }, [open, editing]);

  /**
   * Warn when the plan already has a meeting at that date and time.
   *
   * The dashboard refuses the same slot outright; here it is a warning, because
   * a second session in one slot is occasionally deliberate and the advisor can
   * see the clash in the copy before saving.
   */
  const checkConflict = useCallback(async () => {
    if (!date || !startTime) return;
    try {
      const response = await fetch(
        `/api/meetings?clientId=${encodeURIComponent(planId)}`,
      );
      const payload = await response.json().catch(() => null);
      const rows: { date?: string; time?: string }[] = Array.isArray(
        payload?.data,
      )
        ? payload.data
        : [];
      const clash = rows.some(
        (row) =>
          String(row.date || "").startsWith(date) &&
          row.time === startTime,
      );
      setConflict(
        clash
          ? "Another meeting is already scheduled at that date and time. You can still save it."
          : null,
      );
    } catch {
      // A failed check is not a reason to block the save.
      setConflict(null);
    }
  }, [date, startTime, planId]);

  /**
   * Save the meeting, as an upcoming session or as a draft.
   *
   * A draft is the dashboard's "Save as Draft": the schedule can be empty
   * because the point of a draft is to capture the intent now and pick the slot
   * later. Missing values are filled the way that page fills them, so the row is
   * always something the Meetings list can render.
   */
  const save = async (status: "Upcoming" | "Draft") => {
    const type = meetingType === "Custom" ? customMeetingType.trim() : meetingType;

    if (status === "Upcoming") {
      const problems: string[] = [];
      if (!type) problems.push("a meeting type");
      if (!date) problems.push("a date");
      if (!startTime || !endTime) problems.push("a start and end time");
      if (!format) problems.push("a format");
      if (format === "Virtual" && !platform) problems.push("a platform");
      if (
        (format === "In-Person" || format === "Virtual & In-Person") &&
        !address.trim()
      ) {
        problems.push("a location");
      }
      if (
        (format === "Virtual" || format === "Virtual & In-Person") &&
        !meetingLink.trim()
      ) {
        problems.push("a meeting link");
      }
      if (problems.length > 0) {
        setError(`This meeting still needs ${problems.join(", ")}.`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(
        editing ? `/api/meetings/${editing.id}` : "/api/meetings",
        {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting: type || "Draft Meeting",
          meetingType: type || "Open Enrollment",
          client: planName,
          clientId: planId,
          date: date || today,
          time: startTime || "12:00",
          endTime: endTime || "13:00",
          timezone,
          duration: duration || "1 hour",
          format: format || "Virtual",
          platform:
            (platform === "Other" ? customPlatform.trim() : platform) || "Zoom",
          meetingUrl: "",
          meetingLink: meetingLink.trim(),
          maxAttendees,
          description,
          address,
          city,
          state,
          zip,
          language,
          benefitsCategory,
          status: editing?.status === "Draft" && status === "Draft"
            ? "Draft"
            : status,
        }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Could not save this meeting.");
      }

      onOpenChange(false);
      onCreated?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this meeting.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `z-[110]` clears the portal's Editing Panel (`z-[51]`) and the
          published pop-up (`z-[100]`). */}
      <DialogContent
        overlayClassName="z-[110]"
        className="max-w-2xl max-h-[90vh] overflow-y-auto z-[110]"
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit meeting" : "Schedule a meeting"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Updating a session for ${planName}.`
              : `A session for ${planName}. It appears on the plan's meetings list and can seed a flyer or invite.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Meeting type</Label>
              <Select value={meetingType} onValueChange={setMeetingType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_TYPES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              {meetingType === "Custom" && (
                <Input
                  placeholder="Name this session"
                  value={customMeetingType}
                  onChange={(event) => setCustomMeetingType(event.target.value)}
                />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="meeting-date">Date</Label>
              <Input
                id="meeting-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                onBlur={() => void checkConflict()}
              />
            </div>
            {/* The Meetings page's own time picker: type "1:30pm" or click a
                quarter-hour slot, and the end field offers only later slots with
                the duration each would produce. */}
            <TimeField
              id="meeting-start"
              label="Starts"
              value={startTime}
              onChange={(next) => {
                setStartTime(next);
                void checkConflict();
              }}
            />
            <TimeField
              id="meeting-end"
              label="Ends"
              value={endTime}
              onChange={setEndTime}
              afterTime={startTime || undefined}
              disabled={!startTime}
              placeholder="e.g. 2:00pm"
            />
            <div className="space-y-1">
              <Label>Duration</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                {duration || "Set a start and end time"}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a format" />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {format === "Virtual" && (
              <div className="space-y-1">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {platform === "Other" && (
                  <Input
                    placeholder="Platform name"
                    value={customPlatform}
                    onChange={(event) =>
                      setCustomPlatform(event.target.value)
                    }
                  />
                )}
              </div>
            )}
          </div>

          {(format === "Virtual" || format === "Virtual & In-Person") && (
            <div className="space-y-1">
              <Label htmlFor="meeting-link">Meeting link</Label>
              <Input
                id="meeting-link"
                placeholder="https://"
                value={meetingLink}
                onChange={(event) => setMeetingLink(event.target.value)}
              />
            </div>
          )}

          {(format === "In-Person" || format === "Virtual & In-Person") && (
            <div className="space-y-1">
              <Label>Location</Label>
              <AddressSearch
                value={address}
                onChange={setAddress}
                onLocationSelect={(location) => {
                  setAddress(location.address);
                  setCity(location.city);
                  setState(location.state);
                  setZip(location.zip);
                }}
              />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="meeting-description">Description</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {description.length}/{MAX_DESCRIPTION}
              </span>
            </div>
            <Textarea
              id="meeting-description"
              rows={3}
              maxLength={MAX_DESCRIPTION}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="meeting-max">Max attendees</Label>
              <Input
                id="meeting-max"
                type="number"
                placeholder="50"
                value={maxAttendees}
                onChange={(event) => setMaxAttendees(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Spanish">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Benefit category</Label>
              <Select
                value={benefitsCategory}
                onValueChange={setBenefitsCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {conflict && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {conflict}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => void save("Draft")}
          >
            Save as draft
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() => void save("Upcoming")}
          >
            {isSaving
              ? "Saving…"
              : editing
                ? "Update meeting"
                : "Schedule meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
