"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { flushSync, createPortal } from "react-dom";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Users,
  MoreHorizontal,
  ChevronsUpDown,
  RefreshCw,
  Plus,
  CalendarDays,
  Zap,
  Building2,
  Edit,
  Copy,
  FileText,
  Languages,
  X,
  Trash2,
  AlertTriangle,
  UserPlus,
  Globe,
  Link,
  Hash,
  CheckCircle,
  Search,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { format, addDays, startOfDay, isBefore } from "date-fns";
import { formatUsDate } from "@/lib/date";
import { toast } from "sonner";
import { AddressSearch } from "@/components/ui/address-search";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useMeetingStore,
  MEETING_TYPES,
  MeetingType,
  useSaveMeetingDebugStore,
} from "@/lib/meetings";
import { StickyPlanCombobox } from "@/components/plan-selector/sticky-plan-combobox";
import {
  getLastPlanId,
  getRecentPlanIds,
  persistPlanSelection,
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WebinarsSection } from "@/components/pages/client-portal/sections/webinars-section";
import { resolveRsvpUrl } from "@/lib/meetings/meeting-schedule-shared";
import {
  getBenefitsHubAbsoluteUrl,
  getBenefitsHubPath,
} from "@/lib/marketing/hub-url";

interface Meeting {
  id: string;
  meeting: string;
  meetingType: string;
  client: string;
  clientId?: string | null;
  date: string;
  time: string;
  timezone?: string;
  duration: string;
  format: string;
  platform?: string;
  customPlatform?: string;
  meetingUrl?: string;
  attendees: number;
  status: string;
  meetingLink?: string;
  maxAttendees?: number;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  language?: string;
  benefitsCategory?: string;
  customBenefitsCategory?: string;
}

interface Client {
  id: string;
  companyName: string;
  slug?: string;
  status?: string;
  brandColor?: string;
  secondaryColor?: string;
}

const benefitsChipStyles = {
  current: "bg-[#23919C]/10 text-[#23919C] border-[#23919C]/30",
  other: "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#23919C]/40 hover:text-[#23919C] dark:bg-gray-700 dark:text-muted-foreground dark:border-gray-600 dark:hover:border-[#23919C]/50",
};

interface MeetingFormData {
  meetingType: string;
  customMeetingType: string;
  client: string;
  clientId: string;
  date: string;
  time: string;
  hour: string;
  minute: string;
  ampm: string;
  endTime: string;
  endHour: string;
  endMinute: string;
  endAmpm: string;
  timezone: string;
  duration: string;
  customDuration: string;
  format: string;
  platform: string;
  customPlatform: string;
  meetingUrl: string;
  meetingLink: string;
  maxAttendees: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  language: string;
  benefitsCategory: string;
  customBenefitsCategory: string;
}

const MAX_DESCRIPTION_LENGTH = 180;

const DEFAULT_MEETING_DESCRIPTION =
  "Learn about upcoming plan options, updates, and key dates so you can make informed choices for the year ahead.";

const DEFAULT_MEETING_FORM_DATA: MeetingFormData = {
  meetingType: "Open Enrollment",
  customMeetingType: "",
  client: "",
  clientId: "",
  date: "",
  time: "",
  hour: "",
  minute: "",
  ampm: "",
  endTime: "",
  endHour: "",
  endMinute: "",
  endAmpm: "",
  timezone: "America/New_York",
  duration: "",
  customDuration: "",
  format: "",
  platform: "",
  customPlatform: "",
  meetingUrl: "",
  meetingLink: "",
  maxAttendees: "",
  description: DEFAULT_MEETING_DESCRIPTION,
  address: "",
  city: "",
  state: "",
  zip: "",
  language: "",
  benefitsCategory: "",
  customBenefitsCategory: "",
};

function hasMeaningfulMeetingChanges(formData: MeetingFormData, editingMeetingId: string | null) {
  if (editingMeetingId) return true;
  const keysToCheck: (keyof MeetingFormData)[] = [
    "customMeetingType", "date", "time", "hour", "minute", "ampm",
    "endTime", "endHour", "endMinute", "endAmpm", "duration",
    "customDuration", "format", "platform", "customPlatform", "meetingUrl",
    "meetingLink", "maxAttendees", "address", "city", "state", "zip", "language", "benefitsCategory",
  ];
  return keysToCheck.some((key) => formData[key] !== DEFAULT_MEETING_FORM_DATA[key]);
}

const FORMATS = ["Virtual", "In-Person", "Virtual & In-Person"];

const PLATFORMS = [
  { value: "Zoom", label: "Zoom" },
  { value: "Teams", label: "Teams" },
  { value: "Google Meet", label: "Google Meet" },
  { value: "Other", label: "Other" },
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const AMPM_OPTIONS = ["AM", "PM"];
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const minutes = i * 15;
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const value = `${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  const label = `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
  return { value, label };
});

/** Pixel height of one time row (py-1.5 + text-sm line-height) and how many rows show. */
const TIME_ROW_HEIGHT = 32;
const TIME_VISIBLE_ROWS = 5;

const parseLocalDate = (dateStr: string): Date => {
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};

const getTimezoneAbbr = (timezone: string) => {
  const tzMap: Record<string, string> = {
    "America/New_York": "ET", "America/Chicago": "CT", "America/Denver": "MT",
    "America/Los_Angeles": "PT", "America/Anchorage": "AT", "Pacific/Honolulu": "HT",
    "Europe/London": "GMT", "Europe/Paris": "CET", "Europe/Berlin": "CET",
    "Europe/Rome": "CET", "Europe/Madrid": "CET", "Europe/Amsterdam": "CET",
    "Europe/Zurich": "CET", "Europe/Vienna": "CET", "Europe/Stockholm": "CET",
    "Europe/Oslo": "CET", "Europe/Copenhagen": "CET", "Europe/Helsinki": "EET",
    "Europe/Warsaw": "CET", "Europe/Prague": "CET", "Europe/Budapest": "CET",
    "Europe/Athens": "EET", "Europe/Istanbul": "TRT", "Europe/Moscow": "MSK",
    "Asia/Tokyo": "JST", "Asia/Shanghai": "CST", "Asia/Hong_Kong": "HKT",
    "Asia/Singapore": "SGT", "Asia/Seoul": "KST", "Asia/Taipei": "CST",
    "Asia/Bangkok": "ICT", "Asia/Jakarta": "WIB", "Asia/Manila": "PHT",
    "Asia/Kolkata": "IST", "Asia/Dubai": "GST", "Asia/Tehran": "IRST",
    "Asia/Karachi": "PKT", "Asia/Dhaka": "BST", "Asia/Kathmandu": "NPT",
    "Asia/Colombo": "SLST", "Asia/Riyadh": "AST", "Asia/Jerusalem": "IST",
    "Australia/Sydney": "AEST", "Australia/Melbourne": "AEST", "Australia/Brisbane": "AEST",
    "Australia/Perth": "AWST", "Australia/Adelaide": "ACST", "Pacific/Auckland": "NZST",
    "Pacific/Fiji": "FJT", "America/Toronto": "ET", "America/Vancouver": "PT",
    "America/Mexico_City": "CST", "America/Sao_Paulo": "BRT", "America/Buenos_Aires": "ART",
    "America/Lima": "PET", "America/Bogota": "COT", "America/Santiago": "CLT",
    "America/Caracas": "VET", "Africa/Cairo": "EET", "Africa/Johannesburg": "SAST",
    "Africa/Lagos": "WAT", "Africa/Nairobi": "EAT", "Africa/Casablanca": "WET",
    "Africa/Tunis": "CET", "Africa/Algiers": "CET",
  };
  return tzMap[timezone] || timezone.split("/")[1] || timezone;
};

const formatTime12h = (time24: string): string => {
  if (!time24) return "";
  const [hour24, minute] = time24.split(":").map(Number);
  if (isNaN(hour24) || isNaN(minute)) return time24;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

/** Compact time label like Google Calendar ("1:00am", "1:15pm"). */
const formatTimeAbbrev = (time24: string): string => {
  const [h, m] = time24.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
};

/** Format a duration in minutes like Google Calendar ("2 hours", "1.5 hours"). */
const formatMeetingDuration = (minutes: number): string => {
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} ${mins === 1 ? "minute" : "minutes"}`;
  if (mins === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  if (mins === 30) return `${hours}.5 hours`;
  return `${hours} ${hours === 1 ? "hour" : "hours"} ${mins} ${mins === 1 ? "minute" : "minutes"}`;
};

/** Minutes between two "HH:MM" times on the same day; 0 when invalid or end <= start. */
const minutesBetweenTimes = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return endMin > startMin ? endMin - startMin : 0;
};

/** Parse a human-readable duration ("2 hours", "1.5 hours", "30 minutes") into minutes. */
const parseDurationToMinutes = (duration: string): number => {
  if (!duration) return 0;
  const trimmed = duration.trim().toLowerCase();
  let total = 0;
  const hourMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*hours?/);
  if (hourMatch) total += Math.round(parseFloat(hourMatch[1]) * 60);
  const minuteMatch = trimmed.match(/(\d+)\s*minutes?/);
  if (minuteMatch) total += parseInt(minuteMatch[1], 10);
  return total;
};

/** Add minutes to a "HH:MM" time, wrapping within a 24-hour day. */
const addMinutesToTime = (time24: string, minutes: number): string => {
  const [h, m] = time24.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const total = (h * 60 + m + minutes) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${nh.toString().padStart(2, "0")}:${nm.toString().padStart(2, "0")}`;
};

/** Split a "HH:MM" time into 12-hour picker fields. */
const timeToFields = (time24: string): { hour: string; minute: string; ampm: string } => {
  const [h, m] = time24.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return { hour: "", minute: "", ampm: "" };
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour: hour12.toString(), minute: m.toString().padStart(2, "0"), ampm };
};

/** Derive end-time fields and a normalized duration from start time + duration. */
const deriveEndTimeFields = (time24: string, durationText: string) => {
  const minutes = parseDurationToMinutes(durationText);
  if (!time24 || minutes <= 0) {
    return { endTime: "", endHour: "", endMinute: "", endAmpm: "", duration: durationText };
  }
  const endTime = addMinutesToTime(time24, minutes);
  const fields = timeToFields(endTime);
  return { endTime, endHour: fields.hour, endMinute: fields.minute, endAmpm: fields.ampm, duration: formatMeetingDuration(minutes) };
};

/** Parse a user-typed time into "HH:MM" (24h) or null.
 *  Accepts "1:30pm", "1:30 pm", "1:30p", "13:30", "1330", "130pm", "2pm", "2 pm", "1:30". */
const parseTimeInput = (text: string): string | null => {
  const raw = text.trim().toLowerCase();
  if (!raw) return null;
  let ampm: "am" | "pm" | null = null;
  let body = raw;
  const ampmMatch = raw.match(/([ap])\.?m?\.?\s*$/);
  if (ampmMatch) {
    ampm = ampmMatch[1] === "a" ? "am" : "pm";
    body = raw.slice(0, ampmMatch.index).replace(/\s+$/, "").trim();
  }
  // "H:mm" — with am/pm treated as 12-hour, without as 24-hour.
  const colon = body.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    let hour = parseInt(colon[1], 10);
    const minute = parseInt(colon[2], 10);
    if (minute > 59) return null;
    if (ampm) {
      if (hour < 1 || hour > 12) return null;
      hour = ampm === "pm" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
    } else if (hour > 23) {
      return null;
    }
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }
  // Military "Hmm" (3-4 digits): 1330, 900, or "130pm".
  const military = body.match(/^(\d{3,4})$/);
  if (military) {
    const digits = military[1];
    let hour = parseInt(digits.slice(0, -2), 10);
    const minute = parseInt(digits.slice(-2), 10);
    if (minute > 59) return null;
    if (ampm) {
      if (hour < 1 || hour > 12) return null;
      hour = ampm === "pm" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
    } else if (hour > 23) {
      return null;
    }
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }
  // "H" + am/pm: 2pm, 12am
  const hourOnly = body.match(/^(\d{1,2})$/);
  if (hourOnly && ampm) {
    let hour = parseInt(hourOnly[1], 10);
    if (hour < 1 || hour > 12) return null;
    hour = ampm === "pm" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
    return `${hour.toString().padStart(2, "0")}:00`;
  }
  return null;
};

/** Index (within `options`) of the option closest to a "HH:MM" value; -1 if no value. */
const indexOfClosestInList = (value: string, options: typeof TIME_OPTIONS): number => {
  if (!value) return -1;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  const target = h * 60 + m;
  let best = -1;
  let bestDiff = Infinity;
  options.forEach((opt, i) => {
    const [oh, om] = opt.value.split(":").map(Number);
    const diff = Math.abs((oh * 60 + om) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
};

/** Ensure a URL has a scheme so it opens as an absolute link (e.g. "google.com" → "https://google.com"). */
const normalizeUrl = (url?: string): string => {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

const formatIcons = { Virtual: Video, "In-Person": MapPin, "Virtual & In-Person": Link };

const statusColors: Record<string, string> = {
  Upcoming: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700/50",
  Past: "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-100 border-gray-200 dark:border-gray-700/50",
  Draft: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700/50",
};

const STATUS_LABEL_MAP: Record<string, string> = {
  Scheduled: "Upcoming", Confirmed: "Upcoming", Completed: "Past", Cancelled: "Past", "In Progress": "Upcoming",
};

interface MeetingSaveType { id?: string; label: string; value: string; description?: string; }
type SortColumn = "meeting" | "client" | "date" | "status";
type SortDirection = "asc" | "desc";
const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const SORT_OPTIONS: { value: string; label: string; column: SortColumn; direction: SortDirection }[] = [
  { value: "date-desc", label: "Furthest Meeting Date", column: "date", direction: "desc" },
  { value: "date-asc", label: "Closest Meeting Date", column: "date", direction: "asc" },
];

function PlanSearchBar({ plans, value, onChange, disabled, userSubdomain }: { plans: Client[]; value: string; onChange: (planId: string) => void; disabled?: boolean; userSubdomain?: string; }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recentIds = getRecentPlanIds();
  const planMap = useMemo(() => { const m = new Map<string, Client>(); plans.forEach((p) => m.set(p.id, p)); return m; }, [plans]);
  const recentPlanObjects = useMemo(() => { const result: Client[] = []; const seen = new Set<string>(); for (const id of recentIds) { const p = planMap.get(id); if (p && !seen.has(id)) { result.push(p); seen.add(id); } } return result; }, [recentIds, planMap]);
  const allPlansSorted = useMemo(() => { const recentSet = new Set(recentPlanObjects.map((p) => p.id)); const recents: Client[] = []; const others: Client[] = []; for (const p of plans) { if (recentSet.has(p.id)) recents.push(p); else others.push(p); } others.sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: "base" })); return [...recents, ...others]; }, [plans, recentPlanObjects]);
  const dropdownItems = useMemo(() => { if (!query.trim()) return allPlansSorted; const q = query.toLowerCase(); return allPlansSorted.filter((p) => p.companyName.toLowerCase().includes(q)); }, [query, allPlansSorted]);
  const selectedPlan = useMemo(() => plans.find((p) => p.id === value), [plans, value]);
  useEffect(() => { if (!open) return; const handler = (e: MouseEvent) => { const t = e.target as Node; if (containerRef.current?.contains(t)) return; if (dropdownRef.current?.contains(t)) return; setOpen(false); setQuery(""); }; document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }, [open]);
  useEffect(() => { setHighlight(0); }, [dropdownItems.length, open]);
  const isCurrentPlan = (id: string) => value === id;
  const selectPlan = (planId: string) => { persistPlanSelection("communications", planId); onChange(planId); setOpen(false); setQuery(""); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); setQuery(""); return; }
    if (dropdownItems.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % dropdownItems.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + dropdownItems.length) % dropdownItems.length); }
    else if (e.key === "Enter") { e.preventDefault(); const item = dropdownItems[highlight]; if (item) selectPlan(item.id); }
  };
  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-2xl font-bold shrink-0">Meeting Sessions</CardTitle>
          {selectedPlan && (
            <span
              className="text-xl font-semibold text-accent-blue truncate max-w-[280px]"
              title={selectedPlan.companyName}
            >
              {selectedPlan.companyName}
            </span>
          )}
        </div>
        {value && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const slug =
                (selectedPlan as any)?.slug;
              const resolvedSlug = slug || value;
              const url =
                process.env.NODE_ENV === "development"
                  ? `${window.location.origin}${getBenefitsHubPath(resolvedSlug)}`
                  : getBenefitsHubAbsoluteUrl(resolvedSlug, userSubdomain);
              window.open(url, "_blank");
            }}
            className="gap-1.5 shrink-0 bg-accent-blue text-white hover:bg-accent-blue/90"
          >
            <ExternalLink className="h-4 w-4" />
            Open Portal
          </Button>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input ref={inputRef} type="text" placeholder="Search for a plan" value={query} onChange={(e) => { if (!open) setOpen(true); setQuery(e.target.value); }} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} disabled={disabled} className="h-9 pl-9 pr-3 bg-white dark:bg-gray-800" aria-label="Search plans" aria-expanded={open} aria-haspopup="listbox" autoComplete="off" />
      </div>

      {/* Recent Plans chips (same style as benefits page) */}
      {recentPlanObjects.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Clock className="size-3 text-gray-400 shrink-0" />
          {recentPlanObjects.slice(0, 5).map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => selectPlan(plan.id)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                isCurrentPlan(plan.id)
                  ? "bg-[#23919C]/10 text-[#23919C] border-[#23919C]/30"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#23919C]/40 hover:text-[#23919C] dark:bg-gray-700 text-muted-foreground dark:border-gray-600 dark:hover:border-[#23919C]/50",
              )}
            >
              {plan.companyName}
            </button>
          ))}
        </div>
      )}
      {open && typeof document !== "undefined" ? createPortal(
        <div ref={dropdownRef} role="listbox" className="rounded-md border border-input bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-50" style={{ position: "fixed", top: (containerRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: containerRef.current?.getBoundingClientRect().left ?? 0, width: containerRef.current?.getBoundingClientRect().width ?? 300, maxHeight: 288 }}>
          {query.trim() && <div className="px-3 py-1.5 border-b border-border/60"><p className="text-xs text-muted-foreground">{dropdownItems.length} plan{dropdownItems.length !== 1 ? "s" : ""} found</p></div>}
          <div className="overflow-y-auto max-h-[256px] py-1">
            {dropdownItems.length > 0 && (
              <>
                {recentPlanObjects.length > 0 && (
                  <div className="px-2 pb-1">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5"><Clock className="h-3 w-3" />Recent</div>
                    {recentPlanObjects.map((plan, idx) => { const isHi = highlight === idx; return (<button key={`r-${plan.id}`} type="button" role="option" aria-selected={value === plan.id} className={cn("w-full rounded-sm px-3 py-2 text-left text-sm transition-colors", isHi && "bg-accent-blue/10 text-accent-blue font-medium", !isHi && "hover:bg-muted")} onClick={() => selectPlan(plan.id)} onMouseEnter={() => setHighlight(idx)}>{plan.companyName}</button>); })}
                  </div>
                )}
                {dropdownItems.length > recentPlanObjects.length && (
                  <div className={cn("px-2", recentPlanObjects.length > 0 && "pt-1 border-t border-border/60")}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5">{query.trim() ? "Matching plans" : "All plans"}</div>
                    {dropdownItems.slice(recentPlanObjects.length).map((plan, idx) => { const globalIdx = recentPlanObjects.length + idx; const isHi = highlight === globalIdx; return (<button key={plan.id} type="button" role="option" aria-selected={value === plan.id} className={cn("w-full rounded-sm px-3 py-2 text-left text-sm transition-colors", isHi && "bg-accent-blue/10 text-accent-blue font-medium", !isHi && "hover:bg-muted")} onClick={() => selectPlan(plan.id)} onMouseEnter={() => setHighlight(globalIdx)}>{plan.companyName}</button>); })}
                  </div>
                )}
              </>
            )}
            {dropdownItems.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">{query.trim() ? "No plans match your search." : "No plans available."}</div>}
          </div>
        </div>, document.body
      ) : null}
    </div>
  );
}

function RecentPlanLabels({ plans, onSelect }: { plans: Client[]; onSelect: (planId: string) => void }) {
  const recentIds = getRecentPlanIds();
  const recentPlanObjects = useMemo(() => { const planMap = new Map(plans.map((p) => [p.id, p])); const result: Client[] = []; const seen = new Set<string>(); for (const id of recentIds) { const p = planMap.get(id); if (p && !seen.has(id)) { result.push(p); seen.add(id); } } return result; }, [recentIds, plans]);
  if (recentPlanObjects.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
      {recentPlanObjects.slice(0, 5).map((plan) => (
        <button key={plan.id} type="button" onClick={() => { persistPlanSelection("communications", plan.id); onSelect(plan.id); }} className="inline-flex items-center rounded-md border border-accent-blue/30 bg-accent-blue/5 px-2 py-0.5 text-xs font-medium text-accent-blue hover:bg-accent-blue/10 hover:border-accent-blue/50 transition-colors">{plan.companyName}</button>
      ))}
    </div>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const { setTitle } = usePageTitleContext();
  useEffect(() => { setTitle("Meetings"); }, [setTitle]);
  const [formData, setFormData] = useState<MeetingFormData>({ ...DEFAULT_MEETING_FORM_DATA });
  const searchParams = useSearchParams();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [benefitsCategoryFilter, setBenefitsCategoryFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const meetingFormRef = useRef<HTMLFormElement | null>(null);
  const isSubmittingRef = useRef(false);
  const { data: profileData } = useSWR("/api/profile", jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const userSubdomain: string | undefined = profileData?.subdomain || undefined;
  const { data: clientsData, isLoading: isLoadingClients } = useSWR("/api/clients", jsonFetcher, { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false });
  const clients: Client[] = useMemo(() => (clientsData?.data ?? []).filter((c: Client) => c.status !== "Archived"), [clientsData]);
  const meetingsKey = useMemo(() => { const params = new URLSearchParams(); if (statusFilter !== "all") params.append("status", statusFilter); return `/api/meetings?${params.toString()}`; }, [statusFilter]);
  const { data: meetingsData, isLoading: meetingsLoading, mutate: refreshMeetings } = useSWR(meetingsKey, jsonFetcher, { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false });
  const meetings: Meeting[] = meetingsData?.data ?? [];
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState("");
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [tempHour, setTempHour] = useState("");
  const [tempMinute, setTempMinute] = useState("");
  const [tempAmpm, setTempAmpm] = useState("");
  const [endTimePickerOpen, setEndTimePickerOpen] = useState(false);
  const [startTimeText, setStartTimeText] = useState("");
  const [endTimeText, setEndTimeText] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [timeConflictWarning, setTimeConflictWarning] = useState<string>("");
  const [hasConfirmedConflict, setHasConfirmedConflict] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [openDeleteModel, setOpenDeleteModel] = useState<boolean>(false);
  const [typeId, setTypeId] = useState<string>("");
  const [valueCustomName, setValueCustomName] = useState<string>();
  const [savedMeetingForm, setSavedMeetingForm] = useState<MeetingType>({ value: "", label: "", description: "" });
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<{ id: string; title: string } | null>(null);
  const [postSaveDialogOpen, setPostSaveDialogOpen] = useState(false);
  const [postSaveView, setPostSaveView] = useState<"created" | "duplicate">("created");
  /** Snapshot of the just-created meeting so the duplicate form inherits all fields
   *  (meetingType, duration, format, etc.) that the duplicate page doesn't re-collect. */
  const createdMeetingData = useRef<MeetingFormData | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const hasClients = clients.length > 0;
  const fetchCustomMeetings = useMeetingStore((state) => state.fetchCustomMeetings);
  const customMeetings = useMeetingStore((state) => state.customMeetings);
  const debugSavedMeetings = useSaveMeetingDebugStore((state) => state.savedMeetings);
  const saveDebugMeeting = useSaveMeetingDebugStore((state) => state.saveCustomMeeting);
  const rebaseCustomMeeting = useSaveMeetingDebugStore((state) => state.rebaseCustomMeeting);
  const deleteCustomMeeting = useMeetingStore((state) => state.deleteCustomMeeting);
  const [allMeetingTypes, setAllMeetingTypes] = useState<MeetingType[]>([]);
  const hasUnsavedChanges = hasMeaningfulMeetingChanges(formData, editingMeetingId);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);
  useEffect(() => { isSubmittingRef.current = isSubmitting; }, [isSubmitting]);
  const leaveGuard = useNavigateAwayGuard({ enabled: true, hasUnsavedChanges, onSaveAndExit: async () => {
    if (!hasUnsavedChangesRef.current) return;
    const form = meetingFormRef.current;
    if (!form) throw new Error("Could not find meeting form to save.");
    form.requestSubmit();
    const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });
    const start = Date.now();
    while (isSubmittingRef.current && Date.now() - start < 15000) { await wait(150); }
    await wait(100);
    if (hasUnsavedChangesRef.current) throw new Error("Could not save meeting changes. Please resolve validation errors and try again.");
  }});
  useEffect(() => { fetchCustomMeetings(); }, [fetchCustomMeetings]);
  useEffect(() => { setAllMeetingTypes([...customMeetings]); }, [customMeetings, debugSavedMeetings]);
  useEffect(() => {
    const clientParam = searchParams.get("client");
    const idFromUrl = searchParams.get("planId")?.trim() || searchParams.get("clientId")?.trim() || null;
    const statusParam = searchParams.get("status");
    if (statusParam) setStatusFilter(statusParam);
    if (clientParam) {
      setClientFilter(clientParam);
      if (clientParam && formData.client !== clientParam) {
        const found = clients.find((c) => c.companyName.toLowerCase() === clientParam.toLowerCase());
        setFormData((prev) => ({ ...prev, client: found?.companyName ?? clientParam, clientId: found?.id ?? "" }));
        if (found) setSelectedPlan(found.id);
      }
    } else if (idFromUrl && clients.length > 0) {
      const client = clients.find((c) => c.id === idFromUrl);
      if (client && formData.clientId !== client.id) {
        setFormData((prev) => ({ ...prev, client: client.companyName, clientId: client.id }));
        setClientFilter(client.companyName);
        setSelectedPlan(client.id);
        persistPlanSelection("communications", client.id);
      }
    }
  }, [searchParams, clients]);
  const meetingsStickyInit = useRef(false);
  useEffect(() => {
    if (clients.length === 0 || meetingsStickyInit.current) return;
    const idFromUrl = searchParams.get("planId")?.trim() || searchParams.get("clientId")?.trim();
    const companyFromUrl = searchParams.get("client");
    if (idFromUrl || companyFromUrl) { meetingsStickyInit.current = true; return; }
    if (!getLastPlanId("communications")) return;
    const resolved = resolveStickyPlanId(clients, "communications", null);
    if (!resolved) return;
    const c = clients.find((x) => x.id === resolved);
    if (!c) return;
    meetingsStickyInit.current = true;
    setSelectedPlan(resolved);
    setFormData((prev) => { if (prev.clientId) return prev; return { ...prev, clientId: resolved, client: c.companyName }; });
    setClientFilter(c.companyName);
  }, [clients, searchParams]);
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (formData.clientId) params.set("planId", formData.clientId);
    const newURL = params.toString() ? `/communications/meetings?${params.toString()}` : "/communications/meetings";
    router.replace(newURL);
  }, [statusFilter, clientFilter, formData.clientId, router]);
  useEffect(() => { updateURL(); }, [updateURL]);
  const fetchMeetings = useCallback(async () => { refreshMeetings(); }, [refreshMeetings]);
  const handlePlanClientChange = (clientId: string) => {
    const c = clients.find((x) => x.id === clientId);
    setFormData((prev) => ({ ...prev, clientId, client: c?.companyName || "" }));
    if (c) setClientFilter(c.companyName);
    if (errors.client) setErrors((prev) => ({ ...prev, client: false }));
    const params = new URLSearchParams(window.location.search);
    params.set("planId", clientId);
    router.replace(`/communications/meetings?${params.toString()}`);
  };
  const handlePlanChange = (clientId: string) => { setSelectedPlan(clientId); handlePlanClientChange(clientId); };
  const handleInputChange = (field: keyof MeetingFormData, value: string) => {
    setFormData((prev) => { const newData = { ...prev, [field]: value };
      if (field === "meetingType") {
        setErrors((prev) => ({ ...prev, customMeetingType: false }));
        const selectedType = allMeetingTypes.find((type) => type.value === value);
        if (selectedType) { newData.description = value === "Custom" ? "" : selectedType.description; }
      }
      return newData;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: false }));
    if (field === "meetingUrl" || field === "meetingLink") setErrors((prev) => ({ ...prev, meetingLink: false }));
    if (field === "format") setErrors((prev) => ({ ...prev, platform: false, address: false }));
    if (field === "duration") setErrors((prev) => ({ ...prev, customDuration: false }));
  };
  const handleTimeChange = useCallback((field: "hour" | "minute" | "ampm", value: string) => {
    flushSync(() => {
      setFormData((prev) => { const newData = { ...prev, [field]: value };
        if (newData.hour && newData.minute && newData.ampm) {
          const hour24 = newData.ampm === "AM" ? (newData.hour === "12" ? "00" : newData.hour.padStart(2, "0")) : newData.hour === "12" ? "12" : (parseInt(newData.hour) + 12).toString();
          newData.time = `${hour24}:${newData.minute.padStart(2, "0")}`;
        }
        return newData;
      });
      if (errors.time) setErrors((prev) => ({ ...prev, time: false }));
    });
  }, [errors.time]);
  const getOccupiedTimes = useCallback((date: string, address: string, format: string) => {
    if (!date) return [];
    const normalizeDate = (dateStr: string) => parseLocalDate(dateStr).toISOString().split("T")[0];
    const formDateNormalized = normalizeDate(date);
    return meetings.filter((meeting) => { const mdn = normalizeDate(meeting.date); const dm = mdn === formDateNormalized; if (format === "In-Person" && meeting.format === "In-Person" && address) return dm && meeting.address === address; return dm; }).map((m) => m.time);
  }, [meetings]);
  const isTimeOccupied = useCallback((hour: string, minute: string, ampm: string) => {
    if (!formData.date) return false;
    const hour24 = ampm === "AM" ? (hour === "12" ? "00" : hour.padStart(2, "0")) : hour === "12" ? "12" : (parseInt(hour) + 12).toString();
    return getOccupiedTimes(formData.date, formData.address || "", formData.format).includes(`${hour24}:${minute.padStart(2, "0")}`);
  }, [formData.date, formData.address, formData.format, getOccupiedTimes]);
  const checkTimeConflict = useCallback((date: string, time: string, address: string, format: string, excludeMeetingId?: string) => {
    if (!date || !time) { setTimeConflictWarning(""); return false; }
    if (meetings.length === 0) { setTimeConflictWarning(""); return false; }
    const normalizeDate = (dateStr: string) => new Date(dateStr).toISOString().split("T")[0];
    const fdn = normalizeDate(date);
    const conflict = meetings.filter((m) => {
      if (excludeMeetingId && m.id === excludeMeetingId) return false;
      const mdn = normalizeDate(m.date);
      const dm = mdn === fdn;
      const tm = m.time === time;
      let ic = dm && tm;
      if (format === "In-Person" && m.format === "In-Person" && address) ic = dm && tm && m.address === address;
      return ic;
    });
    if (conflict.length > 0) { setTimeConflictWarning("Duplicate time selected. Please change the time or confirm if this is intentional."); return true; }
    setTimeConflictWarning(""); return false;
  }, [meetings]);
  const handleDeleteCusromTypeMeeting = async (meetingId: string) => {
    try { const userRes = await fetch("/api/auth/session"); const userData = await userRes.json(); const userId = userData.user.id; if (!userId) return; const res = await fetch(`/api/user/${userId}/custom-meetings`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId }) }); const data = await res.json(); if (data.success) setAllMeetingTypes((prev) => prev.filter((m) => m.id && m.id !== meetingId)); else console.error("Failed to delete meeting:", data.error); } catch (err) { console.error("Delete meeting error:", err); }
  };
  const handleLocationSelect = (location: { address: string; city: string; state: string; zip: string; lat?: number; lng?: number; }) => {
    setFormData((prev) => ({ ...prev, address: location.address, city: location.city, state: location.state, zip: location.zip }));
    if (errors.address) setErrors((prev) => ({ ...prev, address: false }));
  };
  const applyStartTime = (value: string) => {
    const fields = timeToFields(value);
    setFormData((prev) => ({
      ...prev,
      time: value,
      hour: fields.hour,
      minute: fields.minute,
      ampm: fields.ampm,
      duration: formatMeetingDuration(minutesBetweenTimes(value, prev.endTime)),
    }));
    if (errors.time) setErrors((prev) => ({ ...prev, time: false }));
    if (errors.duration) setErrors((prev) => ({ ...prev, duration: false }));
  };

  const applyEndTime = (value: string) => {
    const fields = timeToFields(value);
    setFormData((prev) => ({
      ...prev,
      endTime: value,
      endHour: fields.hour,
      endMinute: fields.minute,
      endAmpm: fields.ampm,
      duration: formatMeetingDuration(minutesBetweenTimes(prev.time, value)),
    }));
    if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: false }));
    if (errors.duration) setErrors((prev) => ({ ...prev, duration: false }));
  };

  const handleStartTimeTextChange = (value: string) => {
    setStartTimeText(value);
    const parsed = parseTimeInput(value);
    if (parsed) applyStartTime(parsed);
  };

  const handleStartTimeBlur = () => {
    if (!parseTimeInput(startTimeText)) {
      setStartTimeText(formData.time ? formatTimeAbbrev(formData.time) : "");
    }
  };

  const handleEndTimeTextChange = (value: string) => {
    setEndTimeText(value);
    const parsed = parseTimeInput(value);
    if (parsed) applyEndTime(parsed);
  };

  const handleEndTimeBlur = () => {
    if (!parseTimeInput(endTimeText)) {
      setEndTimeText(formData.endTime ? formatTimeAbbrev(formData.endTime) : "");
    }
  };
  // Scroll refs + highlight state for the Start/End time picker lists.
  const startTimeListRef = useRef<HTMLDivElement | null>(null);
  const endTimeListRef = useRef<HTMLDivElement | null>(null);

  const startTimeHighlightIndex = useMemo(() => {
    const parsed = parseTimeInput(startTimeText) || formData.time;
    return indexOfClosestInList(parsed, TIME_OPTIONS);
  }, [startTimeText, formData.time]);

  const endTimeOptions = useMemo(
    () => TIME_OPTIONS.filter((opt) => !formData.time || opt.value > formData.time),
    [formData.time],
  );
  const endTimeHighlightIndex = useMemo(() => {
    const parsed = parseTimeInput(endTimeText) || formData.endTime;
    return indexOfClosestInList(parsed, endTimeOptions);
  }, [endTimeText, formData.endTime, endTimeOptions]);

  // Keep the highlighted slot centered as the 3rd of 5 visible rows.
  useEffect(() => {
    if (!timePickerOpen || startTimeHighlightIndex < 0 || !startTimeListRef.current) return;
    startTimeListRef.current.scrollTop = Math.max(
      0,
      startTimeHighlightIndex * TIME_ROW_HEIGHT - ((TIME_VISIBLE_ROWS - 1) / 2) * TIME_ROW_HEIGHT,
    );
  }, [timePickerOpen, startTimeHighlightIndex]);
  useEffect(() => {
    if (!endTimePickerOpen || endTimeHighlightIndex < 0 || !endTimeListRef.current) return;
    endTimeListRef.current.scrollTop = Math.max(
      0,
      endTimeHighlightIndex * TIME_ROW_HEIGHT - ((TIME_VISIBLE_ROWS - 1) / 2) * TIME_ROW_HEIGHT,
    );
  }, [endTimePickerOpen, endTimeHighlightIndex]);
  const validateForm = () => {
    const newErrors: Record<string, boolean> = {};
    if (!formData.meetingType) newErrors.meetingType = true;
    if (formData.meetingType === "Custom" && !formData.customMeetingType.trim()) newErrors.customMeetingType = true;
    if (!formData.clientId) newErrors.client = true;
    if (!formData.date) newErrors.date = true;
    if (!formData.time) newErrors.time = true;
    if (!formData.endTime) newErrors.endTime = true;
    if (!formData.duration) newErrors.duration = true;
    if (formData.time && formData.endTime && minutesBetweenTimes(formData.time, formData.endTime) <= 0) {
      newErrors.endTime = true;
      newErrors.duration = true;
    }
    if (!formData.format) newErrors.format = true;
    if (formData.format === "Virtual" && !formData.platform) newErrors.platform = true;
    if (formData.format === "Virtual" && formData.platform === "Other" && !formData.customPlatform.trim()) newErrors.customPlatform = true;
    if ((formData.format === "In-Person" || formData.format === "Virtual & In-Person") && !formData.address) newErrors.address = true;
    if ((formData.format === "Virtual" || formData.format === "Virtual & In-Person") && !resolveRsvpUrl(formData)) newErrors.meetingLink = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const resetMeetingForm = useCallback(() => {
    // Keep the currently selected plan so it's not lost when the modal opens
    // (the plan is chosen before the "Schedule a Meeting" dialog is shown).
    // Resolve from `selectedPlan` (never cleared by resets) rather than the
    // previous form values, which other flows (e.g. cancel edit) can wipe.
    setFormData((prev) => {
      const plan = clients.find((c) => c.id === selectedPlan);
      return {
        ...DEFAULT_MEETING_FORM_DATA,
        client: plan?.companyName ?? prev.client,
        clientId: plan?.id ?? prev.clientId,
      };
    });
    setStartTimeText("");
    setEndTimeText("");
    setErrors({});
    setTimeConflictWarning("");
    setHasConfirmedConflict(false);
    setEditingMeetingId(null);
  }, [clients, selectedPlan]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) { toast.error("You must select a plan before scheduling a meeting"); return; }
    if (!validateForm()) { toast.error("Please fill in all required fields"); return; }
    setIsSubmitting(true);
    try {
      const isEditing = editingMeetingId !== null;
      const url = isEditing ? `/api/meetings/${editingMeetingId}` : "/api/meetings";
      const response = await fetch(url, { method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, meetingType: formData.meetingType === "Custom" ? formData.customMeetingType : formData.meetingType, duration: formData.duration, meetingLink: resolveRsvpUrl(formData), status: "Upcoming" }) });
      const result = await response.json();
      if (response.ok) {
        toast.success(isEditing ? "Meeting updated successfully!" : "Meeting created successfully!");
        if (isEditing) { setFormData({ ...DEFAULT_MEETING_FORM_DATA, meetingType: formData.meetingType, client: formData.client, clientId: formData.clientId }); setStartTimeText(""); setEndTimeText(""); setErrors({}); setTimeConflictWarning(""); setHasConfirmedConflict(false); setEditingMeetingId(null); setMeetingModalOpen(false); }
        else { createdMeetingData.current = { ...formData }; resetMeetingForm(); setMeetingModalOpen(false); setPostSaveView("created"); setPostSaveDialogOpen(true); }
        await fetchMeetings();
      } else toast.error(result.error || `Failed to ${isEditing ? "update" : "create"} meeting`);
    } catch (error) { toast.error(`An error occurred while ${editingMeetingId ? "updating" : "creating"} the meeting`); }
    finally { setIsSubmitting(false); }
  };
  const handleGenerateWithAI = () => { toast.info("AI generation feature coming soon!"); };
  const handleSort = (column: SortColumn) => { if (sortColumn === column) setSortDirection(sortDirection === "asc" ? "desc" : "asc"); else { setSortColumn(column); setSortDirection("asc"); } };
  const currentSortValue = `${sortColumn}-${sortDirection}`;
  const handleSortSelect = (value: string) => {
    const opt = SORT_OPTIONS.find((o) => o.value === value);
    if (opt) {
      setSortColumn(opt.column);
      setSortDirection(opt.direction);
    }
  };
  const handleSaveAsDraft = async () => {
    setIsSubmitting(true);
    try {
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const response = await fetch("/api/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meeting: formData.meetingType || "Draft Meeting", meetingType: formData.meetingType || "Open Enrollment", client: formData.client || "Draft", clientId: formData.clientId || selectedPlan, date: formData.date || todayStr, time: formData.time || "12:00", timezone: formData.timezone || "America/New_York", duration: formData.duration || "1 hour", format: formData.format || "Virtual", platform: formData.platform || "Zoom", meetingUrl: formData.meetingUrl || "", meetingLink: formData.meetingLink || "", maxAttendees: formData.maxAttendees || "50", description: formData.description || "", address: formData.address || "", city: formData.city || "", state: formData.state || "", zip: formData.zip || "", language: formData.language || "English", benefitsCategory: formData.benefitsCategory || "", status: "Draft" }) });
      const result = await response.json();
      if (response.ok) { toast.success("Draft meeting saved successfully!"); resetMeetingForm(); setMeetingModalOpen(false); await fetchMeetings(); }
      else toast.error(result.error || "Failed to save draft meeting");
    } catch { toast.error("An error occurred while saving the draft"); }
    finally { setIsSubmitting(false); }
  };
  const handleCreateDuplicate = async () => {
    if (!formData.clientId) { toast.error("You must select a plan before scheduling a meeting"); return; }
    if (!formData.date || !formData.time) { toast.error("Date and time are required to duplicate the meeting"); return; }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          meetingType: formData.meetingType === "Custom" ? formData.customMeetingType : formData.meetingType,
          duration: formData.duration,
          meetingLink: formData.meetingLink || resolveRsvpUrl(formData),
          status: "Upcoming",
        }),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success("Meeting duplicated successfully!");
        setPostSaveDialogOpen(false);
        setPostSaveView("created");
        createdMeetingData.current = null;
        await fetchMeetings();
      } else {
        toast.error(result.error || "Failed to duplicate meeting");
      }
    } catch {
      toast.error("An error occurred while duplicating the meeting");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDeleteMeeting = (meeting: Meeting) => { setMeetingToDelete({ id: meeting.id, title: meeting.meeting }); setDeleteConfirmOpen(true); };
  const handleConfirmDelete = async () => {
    if (!meetingToDelete) return;
    setDeletingMeetingId(meetingToDelete.id);
    try { const response = await fetch(`/api/meetings/${meetingToDelete.id}`, { method: "DELETE" }); if (response.ok) { toast.success("Meeting deleted successfully!"); fetchMeetings(); } else toast.error("Failed to delete meeting"); }
    catch (error) { toast.error("An error occurred while deleting the meeting"); }
    finally { setDeletingMeetingId(null); setMeetingToDelete(null); }
  };
  const resolveClientIdForMeeting = (m: Meeting) => { if (m.clientId) return m.clientId; const byName = clients.find((c) => c.companyName.toLowerCase() === (m.client || "").toLowerCase()); return byName?.id ?? ""; };
  const handleEditMeeting = (meeting: Meeting) => {
    const [hour24, minute] = meeting.time.split(":"); const h24 = parseInt(hour24);
    const end = deriveEndTimeFields(meeting.time || "", meeting.duration || "");
    // A meeting type that isn't one of the preset types was entered via the
    // "Custom" option — on edit, select "Custom" and pre-fill the custom name.
    const isCustomType = !MEETING_TYPES.some((t) => t.value === meeting.meetingType);
    setFormData({
      meetingType: isCustomType ? "Custom" : (meeting.meetingType || ""),
      customMeetingType: isCustomType ? (meeting.meetingType || "") : "",
      client: meeting.client || "", clientId: resolveClientIdForMeeting(meeting),
      date: meeting.date || "", time: meeting.time || "",
      hour: (h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24).toString(), minute: minute || "00", ampm: h24 >= 12 ? "PM" : "AM",
      endTime: end.endTime, endHour: end.endHour, endMinute: end.endMinute, endAmpm: end.endAmpm,
      timezone: meeting.timezone || "", duration: end.duration || meeting.duration || "", customDuration: "",
      format: meeting.format || "", platform: meeting.platform || "", customPlatform: meeting.customPlatform || "",
      meetingUrl: meeting.meetingUrl || "", meetingLink: meeting.meetingLink || "", maxAttendees: meeting.maxAttendees?.toString() || "",
      description: meeting.description || "", address: meeting.address || "", city: meeting.city || "", state: meeting.state || "", zip: meeting.zip || "",
      language: meeting.language || "", benefitsCategory: meeting.benefitsCategory || "", customBenefitsCategory: meeting.customBenefitsCategory || ""
    });
    setStartTimeText(formatTimeAbbrev(meeting.time || ""));
    setEndTimeText(formatTimeAbbrev(end.endTime || ""));
    setEditingMeetingId(meeting.id); setHasConfirmedConflict(false); setMeetingModalOpen(true);
    toast.success("Meeting data loaded for editing. Make your changes and submit to update.");
  };
  const handleDuplicateMeeting = (meeting: Meeting) => {
    const [hour24, minute] = meeting.time.split(":"); const h24 = parseInt(hour24);
    const end = deriveEndTimeFields(meeting.time || "", meeting.duration || "");
    // A meeting type that isn't one of the preset types was entered via the
    // "Custom" option — on duplicate, select "Custom" and pre-fill the custom name.
    const isCustomType = !MEETING_TYPES.some((t) => t.value === meeting.meetingType);
    setFormData({
      meetingType: isCustomType ? "Custom" : (meeting.meetingType || ""),
      customMeetingType: isCustomType ? (meeting.meetingType || "") : "",
      client: meeting.client || "", clientId: resolveClientIdForMeeting(meeting),
      date: meeting.date || "", time: meeting.time || "",
      hour: (h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24).toString(), minute: minute || "00", ampm: h24 >= 12 ? "PM" : "AM",
      endTime: end.endTime, endHour: end.endHour, endMinute: end.endMinute, endAmpm: end.endAmpm,
      timezone: meeting.timezone || "", duration: end.duration || meeting.duration || "", customDuration: "",
      format: meeting.format || "", platform: meeting.platform || "", customPlatform: meeting.customPlatform || "",
      meetingUrl: meeting.meetingUrl || "", meetingLink: meeting.meetingLink || "", maxAttendees: meeting.maxAttendees?.toString() || "",
      description: meeting.description || "", address: meeting.address || "", city: meeting.city || "", state: meeting.state || "", zip: meeting.zip || "",
      language: meeting.language || "", benefitsCategory: meeting.benefitsCategory || "", customBenefitsCategory: meeting.customBenefitsCategory || ""
    });
    setStartTimeText(formatTimeAbbrev(meeting.time || ""));
    setEndTimeText(formatTimeAbbrev(end.endTime || ""));
    setEditingMeetingId(null); setHasConfirmedConflict(false); setMeetingModalOpen(true);
    if (meeting.date && meeting.time) { const hasConflict = checkTimeConflict(meeting.date, meeting.time, meeting.address || "", meeting.format); if (hasConflict) toast.warning("Meeting duplicated. \u26A0\uFE0F Time conflict detected - please choose a different time or confirm to proceed.", { duration: 5000 }); else toast.success("Meeting duplicated successfully. Review the details and submit."); }
    else toast.success("Meeting duplicated successfully. Review the details and submit.");
  };
  const handleCancelEdit = () => {
    setFormData({ meetingType: "", customMeetingType: "", client: "", clientId: "", date: "", time: "", hour: "", minute: "", ampm: "", endTime: "", endHour: "", endMinute: "", endAmpm: "", timezone: "America/New_York", duration: "", customDuration: "", format: "", platform: "", customPlatform: "", meetingUrl: "", meetingLink: "", maxAttendees: "", description: "", address: "", city: "", state: "", zip: "", language: "", benefitsCategory: "", customBenefitsCategory: "" });
    setStartTimeText(""); setEndTimeText(""); setErrors({}); setTimeConflictWarning(""); setHasConfirmedConflict(false); setEditingMeetingId(null); setMeetingModalOpen(false);
    toast.info("Edit cancelled. Form reset to create new meeting.");
  };
  // Earliest selectable meeting date: tomorrow (disable today and all past days).
  const minSelectableDate = addDays(startOfDay(new Date()), 1);
  // Show all meetings (upcoming + past + drafts) — the Upcoming/Past toggle was removed.
  const currentMeetings = meetings;
  const filteredMeetings = currentMeetings.filter((m) => (statusFilter === "all" || m.status === statusFilter) && (clientFilter === "all" || m.client.toLowerCase() === clientFilter.toLowerCase()) && (benefitsCategoryFilter === "all" || m.benefitsCategory === benefitsCategoryFilter));
  const sortedMeetings = [...filteredMeetings].sort((a, b) => { let av: any = a[sortColumn]; let bv: any = b[sortColumn]; if (sortColumn === "date") { av = new Date(av).getTime(); bv = new Date(bv).getTime(); } else { av = av?.toString().toLowerCase() || ""; bv = bv?.toString().toLowerCase() || ""; } return sortDirection === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); });

  // Determine if the selected plan has any meetings (regardless of current tab/filters)
  const selectedPlanHasMeetings = useMemo(() => {
    if (!selectedPlan) return false;
    const planClient = clients.find((c) => c.id === selectedPlan);
    if (!planClient) return false;
    return meetings.some(
      (m) =>
        (m.clientId && m.clientId === selectedPlan) ||
        (m.client && m.client.toLowerCase() === planClient.companyName.toLowerCase()),
    );
  }, [meetings, selectedPlan, clients]);
  return (
    <div className="p-6 bg-background">
      <div className="w-full space-y-6 max-w-4xl mx-auto">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            {!clientsData ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="relative"><Skeleton className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded" /><Skeleton className="h-9 w-full rounded-md" /></div>
              </div>
            ) : (
              <><PlanSearchBar plans={clients} value={selectedPlan} onChange={handlePlanChange} disabled={clients.length === 0} userSubdomain={userSubdomain} /></>
            )}
          </CardContent>
        </Card>
        {selectedPlan && (
          <>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {selectedPlanHasMeetings && (
                    <div className="flex items-center justify-start gap-2 flex-wrap">
                      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32 h-9 bg-white dark:bg-gray-800 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="Upcoming">Upcoming</SelectItem><SelectItem value="Past">Past</SelectItem><SelectItem value="Draft">Draft</SelectItem></SelectContent></Select>
                      <Select value={benefitsCategoryFilter} onValueChange={setBenefitsCategoryFilter}><SelectTrigger className="w-40 h-9 bg-white dark:bg-gray-800 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem><SelectItem value="Retirement">Retirement</SelectItem><SelectItem value="Group Health">Group Health</SelectItem><SelectItem value="Group Life">Group Life</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
                      <div className="w-px h-9 bg-border mx-1 shrink-0" />
                      <Select value={currentSortValue} onValueChange={handleSortSelect}><SelectTrigger className="w-44 h-9 bg-white dark:bg-gray-800 text-xs"><SelectValue placeholder="Sort by" /></SelectTrigger><SelectContent>{SORT_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select>
                      <div className="w-px h-9 bg-border mx-1 shrink-0" />
                      <Button variant="outline" onClick={() => setPreviewDialogOpen(true)} className="gap-1.5 flex-1"><FileText className="h-4 w-4" />Preview</Button>
                      <Button onClick={() => { resetMeetingForm(); setMeetingModalOpen(true); }} className="gap-1.5 flex-1"><Plus className="h-4 w-4" />Add Meeting</Button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedMeetings.length === 0 ? (
                      <div className="col-span-full flex items-center justify-center py-10">
                        <div className="text-center max-w-sm"><div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-5"><CalendarDays className="h-8 w-8 text-muted-foreground/60" /></div><h3 className="text-lg font-semibold text-foreground mb-2">No meetings added yet</h3><p className="text-sm text-muted-foreground mb-6 leading-relaxed">Get started by scheduling your first meeting session for a client.</p><Button onClick={() => { resetMeetingForm(); setMeetingModalOpen(true); }} className="gap-2"><Plus className="h-4 w-4" />Add Meeting</Button></div>
                      </div>
                    ) : sortedMeetings.map((meeting) => { const FormatIcon = formatIcons[meeting.format as keyof typeof formatIcons]; const meetingDate = formatUsDate(parseLocalDate(meeting.date)); const sc: Record<string, string> = { Upcoming: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-700/50", Past: "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-100 border-gray-200 dark:border-gray-700/50", Draft: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-700/50" }; const ds = STATUS_LABEL_MAP[meeting.status] || meeting.status; return (
                      <div key={meeting.id} className={`p-4 dark:bg-gray-800 border border-border/60 rounded-xl bg-card flex flex-col h-full relative ${deletingMeetingId === meeting.id ? "opacity-50 pointer-events-none" : ""}`}>
                        {deletingMeetingId === meeting.id && <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-xl z-10"><div className="flex items-center gap-2 px-3 py-2 bg-card border border-border/60 rounded-lg shadow-sm"><RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Deleting...</span></div></div>}
                        <div className="flex items-start justify-between mb-3 pl-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1"><h4 className="font-semibold text-sm truncate leading-tight">{meeting.meeting}</h4></div>
                            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                              <Badge className={`text-[10px] border px-1.5 py-px shrink-0 hover:bg-transparent ${sc[STATUS_LABEL_MAP[meeting.status] || meeting.status] || sc.Upcoming}`}>{ds}</Badge>
                              {meeting.benefitsCategory && <span className="text-[10px] font-medium text-muted-foreground/60 border border-border/40 px-1.5 py-px rounded shrink-0 leading-tight">{meeting.benefitsCategory}</span>}
                              {meeting.language && <span className={`text-[10px] font-semibold px-1.5 py-px rounded shrink-0 leading-tight ${meeting.language === "Spanish" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-700/50" : "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-200 border border-sky-200 dark:border-sky-700/50"}`}>{meeting.language === "Spanish" ? "ES" : "EN"}</span>}
                            </div>
                            {meeting.description && (
                              <div className="group relative mt-1">
                                <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2 border-l-2 border-accent-blue/20 hover:border-accent-blue/40 transition-colors">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                                  <p
                                    className="text-xs text-muted-foreground leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all duration-200"
                                    title={meeting.description}
                                  >
                                    {meeting.description}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 opacity-50"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleEditMeeting(meeting)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem><DropdownMenuItem onClick={() => handleDuplicateMeeting(meeting)}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem><DropdownMenuItem onClick={() => handleDeleteMeeting(meeting)} className="text-destructive dark:text-red-500"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3 pl-1">
                          <div className="space-y-1"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Calendar className="h-3 w-3 shrink-0" /><span className="font-medium uppercase tracking-wider">Date</span></div><div className="text-xs font-semibold pl-[18px]">{meetingDate}</div><div className="text-[11px] text-muted-foreground pl-[18px]">{formatTime12h(meeting.time)}{meeting.timezone && <span className="text-[10px] ml-1 opacity-75">({getTimezoneAbbr(meeting.timezone)})</span>}</div></div>
                          <div className="space-y-1"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock className="h-3 w-3 shrink-0" /><span className="font-medium uppercase tracking-wider">Duration</span></div><div className="text-xs font-semibold pl-[18px]">{meeting.duration}</div></div>
                          <div className="space-y-1"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Users className="h-3 w-3 shrink-0" /><span className="font-medium uppercase tracking-wider">Attendees</span></div><div className="text-xs font-semibold pl-[18px]">{meeting.attendees}{meeting.maxAttendees && ` / ${meeting.maxAttendees}`}</div></div>
                          <div className="space-y-1 min-w-0"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><FormatIcon className="h-3 w-3 shrink-0" /><span className="font-medium uppercase tracking-wider truncate">{meeting.format === "Virtual" && meeting.platform ? meeting.platform : meeting.format}</span></div>{meeting.format !== "In-Person" && meeting.meetingLink && <a href={normalizeUrl(meeting.meetingLink || meeting.meetingUrl)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium pl-[18px] text-primary/80 truncate hover:underline">View link &rarr;</a>}{meeting.format !== "In-Person" && !meeting.meetingLink && <div className="text-xs font-medium pl-[18px] text-muted-foreground truncate">No link</div>}{(meeting.format === "In-Person" || meeting.format === "Virtual & In-Person") && meeting.address && <div className="text-xs font-semibold pl-[18px] truncate">{meeting.city}, {meeting.state}</div>}{(meeting.format === "In-Person" || meeting.format === "Virtual & In-Person") && !meeting.address && <div className="text-xs font-medium pl-[18px] text-muted-foreground">TBA</div>}</div>
                        </div>
                        <div className="flex items-center gap-1.5 pt-2.5 border-t border-border/50 mt-auto bg-muted/30 -mx-4 -mb-4 px-4 pb-3 rounded-b-xl"><Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-[11px] font-medium text-muted-foreground/70 shrink-0">Client</span><span className="text-xs font-semibold truncate">{meeting.client}</span></div>
                      </div>
                    ); })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Add/Edit Meeting Dialog */}
      <Dialog open={meetingModalOpen} onOpenChange={setMeetingModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeetingId ? "Edit Meeting" : "Schedule a Meeting"}</DialogTitle>
            <DialogDescription>
              Fill in the details below to {editingMeetingId ? "update the" : "create a new"} meeting session.
            </DialogDescription>
          </DialogHeader>
          <form ref={meetingFormRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Meeting Type */}
              <div className="space-y-2">
                <Label>Meeting Type <span className="text-red-500">*</span></Label>
                <Select value={formData.meetingType} onValueChange={(v) => handleInputChange("meetingType", v)}>
                  <SelectTrigger className={`${errors.meetingType ? "border-red-500" : ""} dark:bg-gray-800`}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMeetingTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.meetingType === "Custom" && (
                  <Input placeholder="Enter custom meeting type" value={formData.customMeetingType}
                    onChange={(e) => handleInputChange("customMeetingType", e.target.value)}
                    className={errors.customMeetingType ? "border-red-500" : ""} />
                )}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>Date <span className="text-red-500">*</span></Label>
                <Popover open={datePickerOpen} onOpenChange={(open) => {
                  setDatePickerOpen(open);
                  if (open) setTempDate(formData.date);
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full justify-start text-left font-normal ${!formData.date && "text-muted-foreground"} ${errors.date ? "border-red-500" : ""} dark:bg-gray-800`}>
                      <Calendar className="mr-2 h-4 w-4" />
                      {formData.date ? format(parseLocalDate(formData.date), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={tempDate ? parseLocalDate(tempDate) : undefined}
                      onSelect={(d) => { if (d) setTempDate(format(d, "yyyy-MM-dd")); }}
                      disabled={(date) => isBefore(date, minSelectableDate)} initialFocus />
                    <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
                      <Button type="button" size="sm" variant="outline" onClick={() => setDatePickerOpen(false)}>Cancel</Button>
                      <Button type="button" size="sm" onClick={() => { if (tempDate) handleInputChange("date", tempDate); setDatePickerOpen(false); }}>OK</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label>Start Time <span className="text-red-500">*</span></Label>
                <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
                  <div className="relative">
                    <Input
                      value={startTimeText}
                      onChange={(e) => handleStartTimeTextChange(e.target.value)}
                      onBlur={handleStartTimeBlur}
                      onFocus={() => setTimePickerOpen(true)}
                      onKeyDown={(e) => { if (e.key === "Enter") setTimePickerOpen(false); }}
                      placeholder="e.g. 1:30pm"
                      className={`pr-9 ${errors.time ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""} dark:bg-gray-800`}
                    />
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Pick start time"
                        onClick={(e) => { e.preventDefault(); setTimePickerOpen(true); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                  </div>
                  <PopoverContent className="w-56 p-1" align="end" side="bottom">
                    <div
                      ref={startTimeListRef}
                      className="max-h-[160px] overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent"
                      style={{ scrollbarWidth: "thin" }}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {TIME_OPTIONS.map((opt, index) => {
                        const isHighlighted = startTimeHighlightIndex === index;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { applyStartTime(opt.value); setStartTimeText(opt.label); setTimePickerOpen(false); }}
                            className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${isHighlighted ? "bg-accent-blue/20 text-accent-blue font-medium" : "hover:bg-muted"}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <Label>End Time <span className="text-red-500">*</span></Label>
                <Popover open={endTimePickerOpen} onOpenChange={setEndTimePickerOpen}>
                  <div className="relative">
                    <Input
                      value={endTimeText}
                      onChange={(e) => handleEndTimeTextChange(e.target.value)}
                      onBlur={handleEndTimeBlur}
                      onFocus={() => { if (formData.time) setEndTimePickerOpen(true); }}
                      onKeyDown={(e) => { if (e.key === "Enter") setEndTimePickerOpen(false); }}
                      placeholder="e.g. 2:00pm"
                      disabled={!formData.time}
                      className={`pr-9 ${errors.endTime ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""} dark:bg-gray-800`}
                    />
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Pick end time"
                        disabled={!formData.time}
                        onClick={(e) => { e.preventDefault(); if (formData.time) setEndTimePickerOpen(true); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                  </div>
                  <PopoverContent className="w-64 p-1" align="end" side="bottom">
                    <div
                      ref={endTimeListRef}
                      className="max-h-[160px] overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent"
                      style={{ scrollbarWidth: "thin" }}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {endTimeOptions.map((opt, index) => {
                        const isHighlighted = endTimeHighlightIndex === index;
                        const durationLabel = formatMeetingDuration(minutesBetweenTimes(formData.time, opt.value));
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { applyEndTime(opt.value); setEndTimeText(opt.label); setEndTimePickerOpen(false); }}
                            className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors ${isHighlighted ? "bg-accent-blue/20 text-accent-blue font-medium" : "hover:bg-muted"}`}
                          >
                            <span>{opt.label}</span>
                            {durationLabel && (
                              <span className="text-xs text-muted-foreground shrink-0">({durationLabel})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Duration (derived from Start / End Time) */}
              {formData.duration && (
                <div className="space-y-1 md:col-span-2">
                  <Label>Duration</Label>
                  <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{formData.duration}</span>
                  </div>
                </div>
              )}

              {/* Format */}
              <div className="space-y-2">
                <Label>Format <span className="text-red-500">*</span></Label>
                <Select value={formData.format || undefined} onValueChange={(v) => handleInputChange("format", v)}>
                  <SelectTrigger className={cn(`${errors.format ? "border-red-500" : ""} dark:bg-gray-800`, !formData.format && "text-gray-400 dark:text-gray-500")}>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((fmt) => <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={formData.timezone} onValueChange={(v) => handleInputChange("timezone", v)}>
                  <SelectTrigger className="dark:bg-gray-800"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Platform (Virtual) */}
              {formData.format === "Virtual" && (
                <div className="space-y-2">
                  <Label>Platform <span className="text-red-500">*</span></Label>
                  <Select value={formData.platform} onValueChange={(v) => handleInputChange("platform", v)}>
                    <SelectTrigger className={`${errors.platform ? "border-red-500" : ""} dark:bg-gray-800`}>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formData.platform === "Other" && (
                    <Input placeholder="Enter platform name" value={formData.customPlatform}
                      onChange={(e) => handleInputChange("customPlatform", e.target.value)}
                      className={errors.customPlatform ? "border-red-500" : ""} />
                  )}
                </div>
              )}

              {/* Address (In-Person / Virtual & In-Person) */}
              {(formData.format === "In-Person" || formData.format === "Virtual & In-Person") && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Location <span className="text-red-500">*</span></Label>
                  <AddressSearch value={formData.address} onChange={(v) => handleInputChange("address", v)} onLocationSelect={handleLocationSelect} />
                </div>
              )}
            </div>

            {/* RSVP Link — shown only when a format that uses a link is selected */}
            {(formData.format === "Virtual" || formData.format === "Virtual & In-Person") && (
              <div className="space-y-2">
                <Label>Meeting Link <span className="text-red-500">*</span></Label>
                <Input value={formData.meetingLink} onChange={(e) => handleInputChange("meetingLink", e.target.value)}
                  placeholder="https://" className={errors.meetingLink ? "border-red-500" : ""} />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)}
                rows={3} placeholder={DEFAULT_MEETING_DESCRIPTION} maxLength={MAX_DESCRIPTION_LENGTH} />
              <div className="flex justify-end">
                <span className={cn(
                  "text-xs tabular-nums",
                  formData.description.length >= MAX_DESCRIPTION_LENGTH
                    ? "text-red-500 font-medium"
                    : formData.description.length >= MAX_DESCRIPTION_LENGTH * 0.9
                      ? "text-amber-500"
                      : "text-muted-foreground"
                )}>
                  {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
                </span>
              </div>
            </div>

            {/* Max Attendees */}
            <div className="space-y-2">
              <Label>Max Attendees</Label>
              <Input type="number" value={formData.maxAttendees} onChange={(e) => handleInputChange("maxAttendees", e.target.value)}
                placeholder="50" />
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={formData.language || undefined} onValueChange={(v) => handleInputChange("language", v)}>
                <SelectTrigger className={cn("dark:bg-gray-800", !formData.language && "text-gray-400 dark:text-gray-500")}><SelectValue placeholder="Select language" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Spanish">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Benefits Category */}
            <div className="space-y-2">
              <Label>Benefits Category</Label>
              <Select value={formData.benefitsCategory || undefined} onValueChange={(v) => handleInputChange("benefitsCategory", v)}>
                <SelectTrigger className={cn("dark:bg-gray-800", !formData.benefitsCategory && "text-gray-400 dark:text-gray-500")}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retirement">Retirement</SelectItem>
                  <SelectItem value="Group Health">Group Health</SelectItem>
                  <SelectItem value="Group Life">Group Life</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time Conflict Warning */}
            {timeConflictWarning && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-md">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700 dark:text-amber-200">
                  <p className="font-medium mb-1">Time Conflict</p>
                  <p>{timeConflictWarning}</p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setMeetingModalOpen(false)}>Cancel</Button>
              {!editingMeetingId && (
                <Button type="button" variant="secondary" onClick={handleSaveAsDraft} disabled={isSubmitting}>
                  Save as Draft
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingMeetingId ? "Update Meeting" : "Schedule Meeting"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Post-Save Dialog â€” ask if user wants to duplicate */}
      <Dialog open={postSaveDialogOpen} onOpenChange={(open) => { setPostSaveDialogOpen(open); if (!open) setPostSaveView("created"); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          {postSaveView === "created" ? (
            <div key="created">
              <DialogHeader>
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <DialogTitle>Meeting Created</DialogTitle>
                <DialogDescription>
                  The meeting has been successfully scheduled. Would you like to create a duplicate of this meeting?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => {
                  // Always start with empty editable fields (date, time, language,
                  // format, link) — only inherit the hidden fields required by the API.
                  const snap = createdMeetingData.current;
                  setFormData({
                    ...DEFAULT_MEETING_FORM_DATA,
                    ...(snap ? {
                      meetingType: snap.meetingType,
                      customMeetingType: snap.customMeetingType || "",
                      client: snap.client,
                      clientId: snap.clientId,
                      duration: snap.duration,
                      description: snap.description || DEFAULT_MEETING_DESCRIPTION,
                      platform: snap.platform || "",
                      maxAttendees: snap.maxAttendees || "",
                      meetingUrl: snap.meetingUrl || "",
                      timezone: snap.timezone || "America/New_York",
                      benefitsCategory: snap.benefitsCategory || "",
                      customBenefitsCategory: snap.customBenefitsCategory || "",
                    } : {}),
                  });
                  setStartTimeText("");
                  setEndTimeText("");
                  setPostSaveView("duplicate");
                }}>
                  Yes, duplicate
                </Button>
                <Button onClick={() => { resetMeetingForm(); setPostSaveDialogOpen(false); }}>
                  No
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div key="duplicate" className="animate-in slide-in-from-right-5 duration-300">
              <DialogHeader>
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-12 rounded-full bg-accent-blue/10 flex items-center justify-center">
                    <Copy className="h-6 w-6 text-accent-blue" />
                  </div>
                </div>
                <DialogTitle>Duplicate Meeting</DialogTitle>
                <DialogDescription>
                  Adjust the language, date, time, and meeting link for the duplicated meeting.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Inherited meeting info (read-only fields not editable here) */}
                <div className="bg-muted/50 rounded-lg p-3 border border-border/60">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Meeting Type:</span>
                    <span className="font-medium truncate">{formData.meetingType || "—"}</span>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">{formData.duration || "—"}</span>
                    <span className="text-muted-foreground">Plan:</span>
                    <span className="font-medium truncate">{formData.client || "—"}</span>
                    <span className="text-muted-foreground">Benefit Category:</span>
                    <span className="font-medium truncate">{formData.benefitsCategory || "—"}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <span className="block text-xs text-muted-foreground mb-0.5">Description</span>
                    <p className="text-xs font-medium text-foreground leading-relaxed">{formData.description || "—"}</p>
                  </div>
                </div>

                {/* Language */}
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={formData.language || undefined} onValueChange={(v) => handleInputChange("language", v)}>
                    <SelectTrigger className="dark:bg-gray-800"><SelectValue placeholder="Select language" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Spanish">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover open={datePickerOpen} onOpenChange={(open) => { setDatePickerOpen(open); if (open) setTempDate(formData.date); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start text-left font-normal ${!formData.date && "text-muted-foreground"} dark:bg-gray-800`}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.date ? format(parseLocalDate(formData.date), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" side="top">
                      <div className="flex max-h-[70vh] flex-col overflow-hidden">
                        <div className="overflow-y-auto min-h-0">
                          <CalendarComponent mode="single" selected={tempDate ? parseLocalDate(tempDate) : undefined} onSelect={(d) => { if (d) setTempDate(format(d, "yyyy-MM-dd")); }} disabled={(date) => isBefore(date, minSelectableDate)} initialFocus />
                        </div>
                        <div className="flex items-center justify-end gap-2 p-3 border-t border-border shrink-0">
                          <Button type="button" size="sm" variant="outline" onClick={() => setDatePickerOpen(false)}>Cancel</Button>
                          <Button type="button" size="sm" onClick={() => { if (tempDate) handleInputChange("date", tempDate); setDatePickerOpen(false); }}>OK</Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time */}
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Popover open={timePickerOpen} onOpenChange={(open) => { setTimePickerOpen(open); if (open) { setTempHour(formData.hour); setTempMinute(formData.minute); setTempAmpm(formData.ampm); } }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`w-full justify-start text-left font-normal ${!formData.time && "text-muted-foreground"} dark:bg-gray-800`}>
                        <Clock className="mr-2 h-4 w-4" />
                        {formData.time ? formatTime12h(formData.time) : "Select time"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-4" align="start">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Hour</Label>
                          <Select value={tempHour} onValueChange={setTempHour}>
                            <SelectTrigger className="dark:bg-gray-800"><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent position="popper" side="bottom" align="start" avoidCollisions={false} className="max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent" style={{ scrollbarWidth: "thin" }}>{HOURS.map((h) => <SelectItem key={h} value={h.toString()}>{h}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Minute</Label>
                          <Select value={tempMinute} onValueChange={setTempMinute}>
                            <SelectTrigger className="dark:bg-gray-800"><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent" style={{ scrollbarWidth: "thin" }}>{MINUTES.map((m) => <SelectItem key={m} value={m.toString().padStart(2, "0")}>{m.toString().padStart(2, "0")}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">AM/PM</Label>
                          <Select value={tempAmpm} onValueChange={setTempAmpm}>
                            <SelectTrigger className="dark:bg-gray-800"><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent>{AMPM_OPTIONS.map((ap) => <SelectItem key={ap} value={ap}>{ap}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-3">
                        <Button type="button" size="sm" variant="outline" onClick={() => setTimePickerOpen(false)}>Cancel</Button>
                        <Button type="button" size="sm" onClick={() => {
                          if (tempHour && tempMinute && tempAmpm) {
                            const hour24 = tempAmpm === "AM" ? (tempHour === "12" ? "00" : tempHour.padStart(2, "0")) : tempHour === "12" ? "12" : (parseInt(tempHour) + 12).toString();
                            handleInputChange("time", `${hour24}:${tempMinute.padStart(2, "0")}`);
                            setFormData((prev) => ({ ...prev, hour: tempHour, minute: tempMinute, ampm: tempAmpm }));
                          }
                          setTimePickerOpen(false);
                        }}>OK</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Format */}
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={formData.format || undefined} onValueChange={(v) => handleInputChange("format", v)}>
                    <SelectTrigger className={cn("dark:bg-gray-800", !formData.format && "text-gray-400 dark:text-gray-500")}>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((fmt) => <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Link (Virtual / Virtual & In-Person) or Location (In-Person / Virtual & In-Person) */}
                {(formData.format === "Virtual" || formData.format === "Virtual & In-Person") && (
                  <div className="space-y-2">
                    <Label>Meeting Link</Label>
                    <Input value={formData.meetingLink} onChange={(e) => handleInputChange("meetingLink", e.target.value)} placeholder="https://" />
                  </div>
                )}
                {(formData.format === "In-Person" || formData.format === "Virtual & In-Person") && (
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <AddressSearch value={formData.address} onChange={(v) => handleInputChange("address", v)} onLocationSelect={handleLocationSelect} />
                    {formData.address && (
                      <p className="text-xs text-muted-foreground">{formData.address}, {formData.city}, {formData.state} {formData.zip}</p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setPostSaveView("created")}>Back</Button>
                <Button type="button" onClick={handleCreateDuplicate} disabled={isSubmitting}>
                  {isSubmitting ? "Duplicating..." : "Create Duplicate"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog shows meetings as they appear in the client portal */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col p-0 overflow-hidden [&>button.absolute]:hidden">
          {/* Fixed header: title, description, and close button on one row */}
          <div className="shrink-0 flex items-center justify-between gap-4 border-b px-6 py-4 bg-background">
            <div className="flex items-center gap-3 min-w-0">
              <DialogTitle className="shrink-0">Meeting Preview</DialogTitle>
              <DialogDescription className="truncate">
                This is how meetings will appear to clients in the portal.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6">
            {formData.clientId ? (
              <WebinarsSection
                clientId={formData.clientId}
                brandColor={(() => {
                  const client = clients.find((c) => c.id === formData.clientId);
                  return client?.brandColor || "#002B5B";
                })()}
                secondaryColor={(() => {
                  const client = clients.find((c) => c.id === formData.clientId);
                  return client?.secondaryColor || "#C9A961";
                })()}
                onLoadComplete={() => setPreviewLoading(false)}
              />
            ) : (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <p>Select a plan first to preview its meetings.</p>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Meeting"
        description={`Are you sure you want to delete "${meetingToDelete?.title ?? "this meeting"}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={!!deletingMeetingId}
      />
    </div>
  );
}


