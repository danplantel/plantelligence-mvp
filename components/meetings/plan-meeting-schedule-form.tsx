"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Link,
  MapPin,
  Pencil,
  Trash2,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { AddressSearch } from "@/components/ui/address-search";
import { useMeetingStore, type MeetingType } from "@/lib/meetings";
import { MEETING_TYPES } from "@/lib/meetings/meeting-store";
import {
  AMPM_OPTIONS,
  DURATION_HOURS,
  DURATION_MINUTES,
  FORMATS,
  HOURS,
  MINUTES,
  PLATFORMS,
  TIMEZONE_OPTIONS,
  buildHubLocationFromForm,
  defaultMeetingScheduleForm,
  parseDurationPickers,
  parseLocalDate,
  type MeetingScheduleFormData,
  resolveRsvpUrl,
  validateMeetingScheduleForm,
} from "@/lib/meetings/meeting-schedule-shared";

// minute column uses 5-min steps; snap any DB value into range
function snapMinute(m: number) {
  const clamped = Math.max(0, Math.min(55, Math.round(m / 5) * 5));
  return MINUTES.includes(clamped) ? clamped : 0;
}

type PlanMeetingRow = {
  id: string;
  meeting: string;
  meetingType: string;
  date: string;
  time: string;
  timezone?: string | null;
  duration?: string;
  format?: string;
  platform?: string | null;
  meetingLink?: string | null;
  description?: string | null;
  maxAttendees?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  hubLocation?: string | null;
  registrationUrl?: string | null;
  replayUrl?: string | null;
  displayOnPortal?: boolean;
};

const STANDARD_PLATFORMS = ["Zoom", "Teams", "Google Meet", "Phone"];

function splitPlatform(platform: string | null | undefined): {
  platform: string;
  customPlatform: string;
} {
  const p = platform || "";
  if (!p || STANDARD_PLATFORMS.includes(p)) {
    return { platform: p, customPlatform: "" };
  }
  return { platform: "Other", customPlatform: p };
}

function apiRowToFormData(
  m: PlanMeetingRow,
  companyName: string,
  types: MeetingType[],
): MeetingScheduleFormData {
  const base = defaultMeetingScheduleForm(companyName);
  const typeValues = new Set(types.map((t) => t.value));
  const mt = m.meetingType || m.meeting || "";
  let meetingType = mt;
  let customMeetingType = "";
  if (mt && !typeValues.has(mt)) {
    meetingType = "Custom";
    customMeetingType = mt;
  }

  const [h24s, mins = "00"] = (m.time || "12:00").split(":");
  const h24Int = parseInt(h24s, 10);
  const ampm = h24Int >= 12 ? "PM" : "AM";
  const hour12 =
    h24Int === 0 ? 12 : h24Int > 12 ? h24Int - 12 : h24Int;
  const minuteNum = parseInt(mins.slice(0, 2), 10) || 0;
  const roundedMin = snapMinute(Number.isNaN(minuteNum) ? 0 : minuteNum);

  const { platform, customPlatform } = splitPlatform(m.platform);

  return {
    ...base,
    meetingType: meetingType || base.meetingType,
    customMeetingType,
    date: m.date.slice(0, 10),
    time: m.time,
    hour: String(hour12),
    minute: String(roundedMin),
    ampm,
    timezone: m.timezone || base.timezone,
    duration: m.duration || "",
    format: m.format || "",
    platform,
    customPlatform,
    meetingUrl: "",
    meetingLink: m.meetingLink || m.registrationUrl || "",
    maxAttendees:
      m.maxAttendees != null ? String(m.maxAttendees) : "",
    description: m.description || "",
    address: m.address || "",
    city: m.city || "",
    state: m.state || "",
    zip: m.zip || "",
    displayOnPortal: m.displayOnPortal !== false,
    replayUrl: m.replayUrl || "",
  };
}

export function PlanMeetingScheduleForm({
  clientId,
  companyName,
}: {
  clientId: string;
  companyName: string;
}) {
  const fetchCustomMeetings = useMeetingStore((s) => s.fetchCustomMeetings);
  const addCustomMeeting = useMeetingStore((s) => s.addCustomMeeting);
  const customMeetings = useMeetingStore((s) => s.customMeetings);
  const resetToDefaultMeetings = useMeetingStore(
    (s) => s.resetToDefaultMeetings,
  );

  const [formData, setFormData] = useState<MeetingScheduleFormData>(() =>
    defaultMeetingScheduleForm(companyName),
  );
  const [meetings, setMeetings] = useState<PlanMeetingRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [durationHour, setDurationHour] = useState("0");
  const [durationMinute, setDurationMinute] = useState("0");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [timeConflictWarning, setTimeConflictWarning] = useState("");
  const [hasConfirmedConflict, setHasConfirmedConflict] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openModel, setOpenModel] = useState(false);
  const [allMeetingTypes, setAllMeetingTypes] = useState<MeetingType[]>([]);

  useEffect(() => {
    fetchCustomMeetings();
  }, [fetchCustomMeetings]);

  useEffect(() => {
    setAllMeetingTypes([...customMeetings]);
  }, [customMeetings]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, client: companyName }));
  }, [companyName]);

  const loadMeetings = useCallback(async () => {
    if (!clientId) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/meetings`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setMeetings(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Could not load meetings");
    } finally {
      setListLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleInputChange = useCallback(
    (field: keyof MeetingScheduleFormData, value: string | boolean) => {
      setFormData((prev) => {
        const newData = { ...prev, [field]: value } as MeetingScheduleFormData;
        if (field === "meetingType" && typeof value === "string") {
          setErrors((e) => ({ ...e, customMeetingType: false }));
          const selectedType = allMeetingTypes.find((t) => t.value === value);
          if (selectedType) {
            if (value === "Custom") {
              newData.description = "";
            } else {
              newData.description = selectedType.description;
            }
          }
        }
        return newData;
      });
      if (typeof value === "string" && errors[field as string]) {
        setErrors((prev) => ({ ...prev, [field]: false }));
      }
      if (field === "meetingUrl" || field === "meetingLink") {
        setErrors((prev) => ({ ...prev, meetingLink: false }));
      }
      if (field === "format") {
        setErrors((prev) => ({ ...prev, platform: false, address: false }));
      }
    },
    [allMeetingTypes, errors],
  );

  const handleTimeChange = useCallback(
    (field: "hour" | "minute" | "ampm", value: string) => {
      flushSync(() => {
        setFormData((prev) => {
          const newData = { ...prev, [field]: value };
          if (newData.hour && newData.minute && newData.ampm) {
            const hour24 =
              newData.ampm === "AM"
                ? newData.hour === "12"
                  ? "00"
                  : newData.hour.padStart(2, "0")
                : newData.hour === "12"
                  ? "12"
                  : (parseInt(newData.hour, 10) + 12).toString();
            const minute24 = newData.minute.padStart(2, "0");
            newData.time = `${hour24}:${minute24}`;
          }
          return newData;
        });
        if (errors.time) {
          setErrors((prev) => ({ ...prev, time: false }));
        }
      });
    },
    [errors.time],
  );

  const getOccupiedTimes = useCallback(
    (
      date: string,
      address: string,
      meetingFormat: string,
      excludeId?: string | null,
    ) => {
      if (!date) return [];
      const normalizeDate = (dateStr: string) =>
        parseLocalDate(dateStr.slice(0, 10)).toISOString().split("T")[0];
      const formDateNorm = normalizeDate(date);
      return meetings
        .filter((meeting) => {
          if (excludeId && meeting.id === excludeId) return false;
          const dateMatch = normalizeDate(meeting.date) === formDateNorm;
          if (
            meetingFormat === "In-Person" &&
            meeting.format === "In-Person" &&
            address
          ) {
            return dateMatch && meeting.address === address;
          }
          return dateMatch;
        })
        .map((meeting) => meeting.time);
    },
    [meetings],
  );

  const isTimeOccupied = useCallback(
    (hour: string, minute: string, ampm: string) => {
      if (!formData.date) return false;
      const hour24 =
        ampm === "AM"
          ? hour === "12"
            ? "00"
            : hour.padStart(2, "0")
          : hour === "12"
            ? "12"
            : (parseInt(hour, 10) + 12).toString();
      const minute24 = minute.padStart(2, "0");
      const timeToCheck = `${hour24}:${minute24}`;
      const occupied = getOccupiedTimes(
        formData.date,
        formData.address || "",
        formData.format,
        editingMeetingId,
      );
      return occupied.includes(timeToCheck);
    },
    [
      formData.date,
      formData.address,
      formData.format,
      getOccupiedTimes,
      editingMeetingId,
    ],
  );

  const checkTimeConflict = useCallback(
    (
      date: string,
      time: string,
      address: string,
      meetingFormat: string,
      excludeMeetingId?: string,
    ) => {
      if (!date || !time) {
        setTimeConflictWarning("");
        return false;
      }
      const normalizeDate = (dateStr: string) =>
        parseLocalDate(dateStr.slice(0, 10)).toISOString().split("T")[0];
      const formDateNorm = normalizeDate(date);
      const conflicting = meetings.filter((meeting) => {
        if (excludeMeetingId && meeting.id === excludeMeetingId) return false;
        const dateMatch =
          normalizeDate(meeting.date.slice(0, 10)) === formDateNorm;
        const timeMatch = meeting.time === time;
        let isConflict = dateMatch && timeMatch;
        if (
          meetingFormat === "In-Person" &&
          meeting.format === "In-Person" &&
          address
        ) {
          isConflict = dateMatch && timeMatch && meeting.address === address;
        }
        return isConflict;
      });
      if (conflicting.length > 0) {
        setTimeConflictWarning(
          "Duplicate time selected. Please change the time or confirm if this is intentional.",
        );
        return true;
      }
      setTimeConflictWarning("");
      return false;
    },
    [meetings],
  );

  useEffect(() => {
    setHasConfirmedConflict(false);
    if (formData.date && formData.time) {
      checkTimeConflict(
        formData.date,
        formData.time,
        formData.address || "",
        formData.format,
        editingMeetingId ?? undefined,
      );
    } else {
      setTimeConflictWarning("");
    }
  }, [
    formData.date,
    formData.time,
    formData.address,
    formData.format,
    checkTimeConflict,
    editingMeetingId,
  ]);

  const handleDurationChange = useCallback(
    (field: "hour" | "minute", value: string) => {
      if (field === "hour") setDurationHour(value);
      else setDurationMinute(value);
      const hour = field === "hour" ? value : durationHour;
      const minute = field === "minute" ? value : durationMinute;
      let text = "";
      if (hour !== "0" || minute !== "0") {
        const parts: string[] = [];
        if (hour !== "0")
          parts.push(`${hour} ${hour === "1" ? "hour" : "hours"}`);
        if (minute !== "0")
          parts.push(`${minute} ${minute === "1" ? "minute" : "minutes"}`);
        text = parts.join(" ");
      }
      setFormData((prev) => ({ ...prev, duration: text }));
      if (errors.duration) {
        setErrors((prev) => ({ ...prev, duration: false }));
      }
    },
    [durationHour, durationMinute, errors.duration],
  );

  const handleLocationSelect = (location: {
    address: string;
    city: string;
    state: string;
    zip: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      address: location.address,
      city: location.city,
      state: location.state,
      zip: location.zip,
    }));
    if (errors.address) {
      setErrors((prev) => ({ ...prev, address: false }));
    }
  };

  const validateForm = () => {
    const formForValidate = { ...formData, client: companyName };
    const newErrors = validateMeetingScheduleForm(formForValidate, {
      requireClient: true,
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAfterSave = () => {
    const fresh = defaultMeetingScheduleForm(companyName);
    setFormData(fresh);
    setDurationHour("0");
    setDurationMinute("0");
    setErrors({});
    setTimeConflictWarning("");
    setHasConfirmedConflict(false);
    setEditingMeetingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !clientId) {
      toast.error("Plan name is missing");
      return;
    }
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.date && formData.time) {
      const normalizeDate = (dateStr: string) =>
        parseLocalDate(dateStr.slice(0, 10)).toISOString().split("T")[0];
      const formNorm = normalizeDate(formData.date);
      const conflicting = meetings.filter((meeting) => {
        if (editingMeetingId && meeting.id === editingMeetingId) return false;
        const dateMatch = normalizeDate(meeting.date) === formNorm;
        const timeMatch = meeting.time === formData.time;
        let isConflict = dateMatch && timeMatch;
        if (
          formData.format === "In-Person" &&
          meeting.format === "In-Person" &&
          formData.address
        ) {
          isConflict =
            dateMatch && timeMatch && meeting.address === formData.address;
        }
        return isConflict;
      });
      if (conflicting.length > 0 && !hasConfirmedConflict) {
        setHasConfirmedConflict(true);
        setTimeConflictWarning(
          "Conflict confirmed. Click 'Confirm to Add Meeting' again to proceed.",
        );
        toast.warning(
          "Time conflict confirmed! Click the submit button once more to proceed.",
          { duration: 5000 },
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    if (formData.meetingType === "Custom") {
      setOpenModel(true);
      return;
    }

    await persistMeeting();
  };

  const persistMeeting = async (saveCustomType = false) => {
    if (saveCustomType && formData.meetingType === "Custom") {
      await addCustomMeeting({
        value: formData.customMeetingType || "Custom Meeting",
        label: formData.customMeetingType || "Custom Meeting",
        description: formData.description,
      });
    }

    setIsSubmitting(true);
    try {
      const isEdit = editingMeetingId !== null;
      const url = isEdit
        ? `/api/clients/${clientId}/meetings/${editingMeetingId}`
        : `/api/clients/${clientId}/meetings`;
      const method = isEdit ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        meetingType: formData.meetingType,
        customMeetingType: formData.customMeetingType,
        client: companyName,
        date: formData.date,
        time: formData.time,
        timezone: formData.timezone,
        duration: formData.duration,
        format: formData.format,
        platform: formData.platform,
        customPlatform: formData.customPlatform,
        meetingUrl: formData.meetingUrl,
        meetingLink: resolveRsvpUrl(formData),
        maxAttendees: formData.maxAttendees,
        description: formData.description,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        displayOnPortal: formData.displayOnPortal,
        replayUrl: formData.replayUrl,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Save failed");
        return;
      }
      toast.success(isEdit ? "Meeting updated" : "Meeting created");
      resetFormAfterSave();
      await loadMeetings();
    } catch (err) {
      toast.error("Save failed");
    } finally {
      setIsSubmitting(false);
      setOpenModel(false);
    }
  };

  const handleSubmitDialog = async (save: boolean) => {
    setOpenModel(false);
    await persistMeeting(save);
  };

  const startEdit = (m: PlanMeetingRow) => {
    const fd = apiRowToFormData(m, companyName, allMeetingTypes);
    setFormData(fd);
    const d = parseDurationPickers(fd.duration);
    setDurationHour(d.hour);
    setDurationMinute(d.minute);
    setEditingMeetingId(m.id);
    setHasConfirmedConflict(false);
    setErrors({});
    toast.success("Loaded meeting for editing.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    resetFormAfterSave();
    toast.info("Edit cancelled.");
  };

  const archiveMeeting = async (id: string) => {
    if (!confirm("Archive this meeting?")) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/meetings/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Archived");
      if (editingMeetingId === id) resetFormAfterSave();
      await loadMeetings();
    } catch {
      toast.error("Archive failed");
    }
  };

  const toggleHub = async (m: PlanMeetingRow) => {
    const next = !m.displayOnPortal;
    try {
      const res = await fetch(`/api/clients/${clientId}/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayOnPortal: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? "Shown on Benefits Hub" : "Hidden from hub");
      setMeetings((prev) =>
        prev.map((r) =>
          r.id === m.id ? { ...r, displayOnPortal: next } : r,
        ),
      );
    } catch {
      toast.error("Update failed");
    }
  };

  const canUseForm = Boolean(companyName && clientId);

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Plan: </span>
          <span className="font-medium">{companyName}</span>
        </div>

        {/* Meeting types */}
        <div className="space-y-2">
          <Label>
            Meeting Type <span className="text-red-500">*</span>
          </Label>
          {errors.meetingType && (
            <p className="text-sm text-red-500">This field is required</p>
          )}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {allMeetingTypes.map((type) => (
              <div
                key={type.id ?? type.value}
                className={`relative p-3 border rounded-lg transition-colors ${
                  !canUseForm
                    ? "opacity-50 cursor-not-allowed"
                    : formData.meetingType === type.value
                      ? "border-primary bg-primary/5 cursor-pointer"
                      : errors.meetingType
                        ? "border-red-500 cursor-pointer"
                        : "hover:bg-muted/50 cursor-pointer"
                }`}
                onClick={() =>
                  canUseForm && handleInputChange("meetingType", type.value)
                }
              >
                <div className="flex items-start space-x-2">
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.meetingType === type.value
                        ? "border-primary bg-primary"
                        : "border-gray-300"
                    }`}
                  >
                    {formData.meetingType === type.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{type.label}</div>
                    {type.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {type.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {MEETING_TYPES.some(
            (base) =>
              !allMeetingTypes.some((t) => t.value === base.value),
          ) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => resetToDefaultMeetings()}
            >
              Restore Default Meetings
            </Button>
          )}
        </div>

        {formData.meetingType === "Custom" && (
          <div className="space-y-2">
            <Label htmlFor="customMeetingType">
              Custom Meeting Type <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customMeetingType"
              icon={<FileText className="h-4 w-4" />}
              value={formData.customMeetingType}
              onChange={(e) =>
                handleInputChange("customMeetingType", e.target.value)
              }
              disabled={!canUseForm}
              className={errors.customMeetingType ? "border-red-500" : ""}
            />
            {errors.customMeetingType && (
              <p className="text-sm text-red-500">Required</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Meeting Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            disabled={!canUseForm}
            className="min-h-20 resize-none"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toast.info("AI generation coming soon")}
            disabled={!canUseForm}
          >
            <Zap className="mr-2 h-4 w-4" />
            Generate with AI
          </Button>
        </div>

        <div className="space-y-2">
          <Label>
            Date <span className="text-red-500">*</span>
          </Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={!canUseForm}
                className={`w-full justify-start text-left font-normal ${
                  errors.date ? "border-red-500" : ""
                }`}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {formData.date
                  ? format(parseLocalDate(formData.date), "MM/dd/yyyy")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={
                  formData.date
                    ? parseLocalDate(formData.date)
                    : undefined
                }
                onSelect={(d) => {
                  if (d) {
                    handleInputChange("date", format(d, "yyyy-MM-dd"));
                    setDatePickerOpen(false);
                  }
                }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.date && (
            <p className="text-sm text-red-500">Required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Time <span className="text-red-500">*</span>
          </Label>
          <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={!canUseForm}
                className={`w-full justify-start text-left font-normal ${
                  errors.time ? "border-red-500" : ""
                }`}
              >
                <Clock className="mr-2 h-4 w-4" />
                {formData.hour && formData.minute && formData.ampm
                  ? `${formData.hour}:${formData.minute.padStart(2, "0")} ${formData.ampm}`
                  : "Select time"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 rounded-md border bg-popover shadow-md"
              align="start"
            >
              <div className="flex rounded-md overflow-hidden">
                <div className="border-r border-border">
                  <div className="px-3 py-2 text-sm font-medium text-center border-b bg-muted/50">
                    Hour
                  </div>
                  <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                    {HOURS.map((hour) => {
                      const occ =
                        formData.minute &&
                        formData.ampm &&
                        isTimeOccupied(
                          hour.toString(),
                          formData.minute,
                          formData.ampm,
                        );
                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() =>
                            !occ && handleTimeChange("hour", hour.toString())
                          }
                          disabled={!!occ}
                          className={`w-2/3 px-4 py-2 text-sm ${
                            formData.hour === hour.toString()
                              ? "bg-accent-blue text-white rounded-md"
                              : occ
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-accent"
                          }`}
                        >
                          {hour}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="border-r border-border">
                  <div className="px-3 py-2 text-sm font-medium text-center border-b bg-muted/50">
                    Min
                  </div>
                  <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                    {MINUTES.map((minute) => {
                      const occ =
                        formData.hour &&
                        formData.ampm &&
                        isTimeOccupied(
                          formData.hour,
                          minute.toString(),
                          formData.ampm,
                        );
                      return (
                        <button
                          key={minute}
                          type="button"
                          onClick={() =>
                            !occ &&
                            handleTimeChange("minute", minute.toString())
                          }
                          disabled={!!occ}
                          className={`w-2/3 py-2 text-sm ${
                            formData.minute === minute.toString()
                              ? "bg-accent-blue text-white rounded-md"
                              : occ
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-accent"
                          }`}
                        >
                          {minute.toString().padStart(2, "0")}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="px-3 py-2 text-sm font-medium text-center border-b bg-muted/50">
                    AM/PM
                  </div>
                  <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                    {AMPM_OPTIONS.map((ampm) => {
                      const occ =
                        formData.hour &&
                        formData.minute &&
                        isTimeOccupied(
                          formData.hour,
                          formData.minute,
                          ampm,
                        );
                      return (
                        <button
                          key={ampm}
                          type="button"
                          onClick={() =>
                            !occ && handleTimeChange("ampm", ampm)
                          }
                          disabled={!!occ}
                          className={`w-2/3 px-4 py-2 text-sm ${
                            formData.ampm === ampm
                              ? "bg-accent-blue text-white rounded-md"
                              : occ
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-accent"
                          }`}
                        >
                          {ampm}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {errors.time && (
            <p className="text-sm text-red-500">Required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select
            value={formData.timezone}
            onValueChange={(v) => handleInputChange("timezone", v)}
            disabled={!canUseForm}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[280px] overflow-y-auto">
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>
            Duration <span className="text-red-500">*</span>
          </Label>
          <Popover
            open={durationPickerOpen}
            onOpenChange={setDurationPickerOpen}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={!canUseForm}
                className={`w-full justify-start text-left font-normal ${
                  errors.duration ? "border-red-500" : ""
                }`}
              >
                <Clock className="mr-2 h-4 w-4" />
                {formData.duration || "Select duration"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 rounded-md border bg-popover shadow-md"
              align="start"
            >
              <div className="flex rounded-md overflow-hidden">
                <div className="border-r border-border">
                  <div className="px-3 py-2 text-sm font-medium text-center border-b bg-muted/50">
                    Hour
                  </div>
                  <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                    {DURATION_HOURS.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() =>
                          handleDurationChange("hour", hour.toString())
                        }
                        className={`w-2/3 px-4 py-2 text-sm ${
                          durationHour === hour.toString()
                            ? "bg-accent-blue text-white rounded-md"
                            : "hover:bg-accent"
                        }`}
                      >
                        {hour}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="px-3 py-2 text-sm font-medium text-center border-b bg-muted/50">
                    Min
                  </div>
                  <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                    {DURATION_MINUTES.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        onClick={() =>
                          handleDurationChange("minute", minute.toString())
                        }
                        className={`w-2/3 py-2 text-sm ${
                          durationMinute === minute.toString()
                            ? "bg-accent-blue text-white rounded-md"
                            : "hover:bg-accent"
                        }`}
                      >
                        {minute.toString().padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {errors.duration && (
            <p className="text-sm text-red-500">Required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxAttendees">Max Attendees</Label>
          <Input
            id="maxAttendees"
            icon={<Users className="h-4 w-4" />}
            type="number"
            value={formData.maxAttendees}
            onChange={(e) => handleInputChange("maxAttendees", e.target.value)}
            disabled={!canUseForm}
            min={1}
          />
        </div>

        <div className="space-y-2">
          <Label>
            Location <span className="text-red-500">*</span>
          </Label>
          {errors.format && (
            <p className="text-sm text-red-500">Required</p>
          )}
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => handleInputChange("format", fmt)}
                disabled={!canUseForm}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  formData.format === fmt
                    ? "border-primary bg-primary text-white"
                    : errors.format
                      ? "border-red-500"
                      : "border-gray-300"
                }`}
              >
                {fmt === "Virtual" ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {fmt}
              </button>
            ))}
          </div>

          {formData.format === "Virtual" && (
            <div className="mt-3 space-y-2">
              <Label>
                Select Platform <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.platform}
                onValueChange={(v) => handleInputChange("platform", v)}
                disabled={!canUseForm}
              >
                <SelectTrigger
                  className={errors.platform ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.platform && (
                <p className="text-sm text-red-500">Required</p>
              )}
              {formData.platform === "Other" && (
                <div>
                  <Label>Custom Platform *</Label>
                  <Input
                    value={formData.customPlatform}
                    onChange={(e) =>
                      handleInputChange("customPlatform", e.target.value)
                    }
                    className={
                      errors.customPlatform ? "border-red-500" : ""
                    }
                  />
                  {errors.customPlatform && (
                    <p className="text-sm text-red-500">Required</p>
                  )}
                </div>
              )}
            </div>
          )}

          {formData.format === "Virtual" && (
            <div className="space-y-2">
              <Label htmlFor="meetingUrl">Meeting URL (optional)</Label>
              <Input
                id="meetingUrl"
                icon={<Link className="h-4 w-4" />}
                value={formData.meetingUrl}
                onChange={(e) => handleInputChange("meetingUrl", e.target.value)}
              />
            </div>
          )}

          {formData.format === "In-Person" && (
            <div className="space-y-2">
              <AddressSearch
                value={formData.address}
                onChange={(address) => handleInputChange("address", address)}
                onLocationSelect={handleLocationSelect}
                disabled={!canUseForm}
              />
              {errors.address && (
                <p className="text-sm text-red-500">Required</p>
              )}
              {formData.address && (
                <p className="text-sm text-muted-foreground">
                  {formData.address}, {formData.city}, {formData.state}{" "}
                  {formData.zip}
                </p>
              )}
            </div>
          )}
        </div>

        {timeConflictWarning && (
          <div
            className={`rounded-lg border p-4 ${
              hasConfirmedConflict
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex items-start gap-3">
              {hasConfirmedConflict ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <p
                className={`text-sm ${
                  hasConfirmedConflict ? "text-green-800" : "text-amber-800"
                }`}
              >
                {timeConflictWarning}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="meetingLink">
            RSVP URL <span className="text-red-500">*</span>
          </Label>
          <Input
            id="meetingLink"
            icon={<Link className="h-4 w-4" />}
            value={formData.meetingLink}
            onChange={(e) => handleInputChange("meetingLink", e.target.value)}
            className={errors.meetingLink ? "border-red-500" : ""}
          />
          {errors.meetingLink && (
            <p className="text-sm text-red-500">
              Enter an RSVP URL, or paste your virtual meeting link in Meeting URL.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium text-sm">Show on Benefits Hub</p>
            <p className="text-xs text-muted-foreground">
              Hidden meetings do not appear in the employee portal.
            </p>
          </div>
          <Switch
            checked={formData.displayOnPortal}
            onCheckedChange={(c) => handleInputChange("displayOnPortal", c)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="replayUrl">Replay link (optional)</Label>
          <Input
            id="replayUrl"
            type="url"
            value={formData.replayUrl}
            onChange={(e) => handleInputChange("replayUrl", e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {editingMeetingId && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isSubmitting}
            >
              Cancel Edit
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || !canUseForm}
            className={
              timeConflictWarning && !hasConfirmedConflict
                ? "bg-amber-600 hover:bg-amber-700"
                : ""
            }
          >
            {isSubmitting
              ? "Saving…"
              : timeConflictWarning && !hasConfirmedConflict
                ? "Confirm to add meeting"
                : editingMeetingId
                  ? "Update Meeting"
                  : "Add Meeting"}
          </Button>
        </div>
      </form>

      <Dialog open={openModel} onOpenChange={setOpenModel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogDescription className="text-base">
              Save this meeting type for future use?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleSubmitDialog(false)}>
              No
            </Button>
            <Button type="button" onClick={() => handleSubmitDialog(true)}>
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Meetings for this plan</h3>
        {listLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
            No meetings yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {meetings.map((m) => (
              <li
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.meeting}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.meetingType} · {m.date.slice(0, 10)} · {m.time}
                  </p>
                  {m.format && (
                    <p className="text-xs text-muted-foreground">{m.format}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Hub</span>
                    <Switch
                      checked={m.displayOnPortal !== false}
                      onCheckedChange={() => toggleHub(m)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(m)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => archiveMeeting(m.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Archive
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

