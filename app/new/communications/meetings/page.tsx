"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { flushSync, createPortal } from "react-dom";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { format } from "date-fns";
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
  status?: string;
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
    "customMeetingType", "date", "time", "hour", "minute", "ampm", "duration",
    "customDuration", "format", "platform", "customPlatform", "meetingUrl",
    "meetingLink", "maxAttendees", "address", "city", "state", "zip", "language", "benefitsCategory",
  ];
  return keysToCheck.some((key) => formData[key] !== DEFAULT_MEETING_FORM_DATA[key]);
}

const FORMATS = ["Virtual", "In-Person"];

const PLATFORMS = [
  { value: "Zoom", label: "Zoom" },
  { value: "Teams", label: "Teams" },
  { value: "Google Meet", label: "Google Meet" },
  { value: "Other", label: "Other" },
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const AMPM_OPTIONS = ["AM", "PM"];
const DURATION_HOURS = Array.from({ length: 9 }, (_, i) => i);
const DURATION_MINUTES = Array.from({ length: 13 }, (_, i) => i * 5);

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

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

const formatIcons = { Virtual: Video, "In-Person": MapPin };

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

function PlanSearchBar({ plans, value, onChange, disabled }: { plans: Client[]; value: string; onChange: (planId: string) => void; disabled?: boolean; }) {
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
      <div className="flex items-center justify-between">
        <CardTitle className="text-2xl font-bold">Meeting Sessions</CardTitle>
        {value && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/new/view/${value}`, "_blank")}
            className="gap-1.5 shrink-0 bg-accent-blue text-white hover:bg-accent-blue/90"
          >
            <ExternalLink className="h-4 w-4" />
            Open Portal
          </Button>
        )}
      </div>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Select a plan<span className="text-red-500"> *</span></label>

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input ref={inputRef} type="text" placeholder={selectedPlan ? selectedPlan.companyName : "Search plans\u2026"} value={query} onChange={(e) => { if (!open) setOpen(true); setQuery(e.target.value); }} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} disabled={disabled} className="h-9 pl-9 pr-3 bg-white dark:bg-gray-800" aria-label="Search plans" aria-expanded={open} aria-haspopup="listbox" autoComplete="off" />
      </div>
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
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const meetingFormRef = useRef<HTMLFormElement | null>(null);
  const isSubmittingRef = useRef(false);
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
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [tempDurationHour, setTempDurationHour] = useState("0");
  const [tempDurationMinute, setTempDurationMinute] = useState("0");
  const [durationHour, setDurationHour] = useState("0");
  const [durationMinute, setDurationMinute] = useState("0");
  const durationHourRef = useRef(durationHour);
  const durationMinuteRef = useRef(durationMinute);
  useEffect(() => { durationHourRef.current = durationHour; }, [durationHour]);
  useEffect(() => { durationMinuteRef.current = durationMinute; }, [durationMinute]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [timeConflictWarning, setTimeConflictWarning] = useState<string>("");
  const [hasConfirmedConflict, setHasConfirmedConflict] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [isValueCastom, setValueCastom] = useState<string>("");
  const [openModel, setOpenModel] = useState<boolean>(false);
  const [openDeleteModel, setOpenDeleteModel] = useState<boolean>(false);
  const [typeId, setTypeId] = useState<string>("");
  const [valueCustomName, setValueCustomName] = useState<string>();
  const [savedMeetingForm, setSavedMeetingForm] = useState<MeetingType>({ value: "", label: "", description: "" });
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<{ id: string; title: string } | null>(null);
  const [postSaveDialogOpen, setPostSaveDialogOpen] = useState(false);
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
  const addCustomMeeting = useMeetingStore((state) => state.addCustomMeeting);
  const toastShownRef = useRef(false);
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
        if (!toastShownRef.current) { toastShownRef.current = true; setTimeout(() => { toast.success(`Meeting form pre-filled with ${clientParam}`); }, 300); }
      }
    } else if (idFromUrl && clients.length > 0) {
      const client = clients.find((c) => c.id === idFromUrl);
      if (client && formData.clientId !== client.id) {
        setFormData((prev) => ({ ...prev, client: client.companyName, clientId: client.id }));
        setClientFilter(client.companyName);
        setSelectedPlan(client.id);
        persistPlanSelection("communications", client.id);
        if (!toastShownRef.current) { toastShownRef.current = true; setTimeout(() => { toast.success(`Meeting form pre-filled with ${client.companyName}`); }, 300); }
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
    const newURL = params.toString() ? `/new/communications/meetings?${params.toString()}` : "/new/communications/meetings";
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
    router.replace(`/new/communications/meetings?${params.toString()}`);
  };
  const handlePlanChange = (clientId: string) => { setSelectedPlan(clientId); handlePlanClientChange(clientId); };
  const handleInputChange = (field: keyof MeetingFormData, value: string) => {
    setFormData((prev) => { const newData = { ...prev, [field]: value };
      if (field === "meetingType") {
        setErrors((prev) => ({ ...prev, customMeetingType: false }));
        const selectedType = allMeetingTypes.find((type) => type.value === value);
        if (selectedType) { setValueCastom(value); newData.description = value === "Custom" ? "" : selectedType.description; }
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
  const handleDurationChange = useCallback((field: "hour" | "minute", value: string) => {
    if (field === "hour") setDurationHour(value); else setDurationMinute(value);
    const hour = field === "hour" ? value : durationHourRef.current;
    const minute = field === "minute" ? value : durationMinuteRef.current;
    let durationText = "";
    if (hour !== "0" || minute !== "0") { const parts = []; if (hour !== "0") parts.push(`${hour} ${hour === "1" ? "hour" : "hours"}`); if (minute !== "0") parts.push(`${minute} ${minute === "1" ? "minute" : "minutes"}`); durationText = parts.join(" "); }
    handleInputChange("duration", durationText);
    if (errors.duration) setErrors((prev) => ({ ...prev, duration: false }));
  }, [errors.duration, handleInputChange]);
  const handleLocationSelect = (location: { address: string; city: string; state: string; zip: string; lat?: number; lng?: number; }) => {
    setFormData((prev) => ({ ...prev, address: location.address, city: location.city, state: location.state, zip: location.zip }));
    if (errors.address) setErrors((prev) => ({ ...prev, address: false }));
  };
  const validateForm = () => {
    const newErrors: Record<string, boolean> = {};
    if (!formData.meetingType) newErrors.meetingType = true;
    if (formData.meetingType === "Custom" && !formData.customMeetingType.trim()) newErrors.customMeetingType = true;
    if (!formData.clientId) newErrors.client = true;
    if (!formData.date) newErrors.date = true;
    if (!formData.time) newErrors.time = true;
    if (!formData.duration) newErrors.duration = true;
    if (!formData.format) newErrors.format = true;
    if (formData.format === "Virtual" && !formData.platform) newErrors.platform = true;
    if (formData.format === "Virtual" && formData.platform === "Other" && !formData.customPlatform.trim()) newErrors.customPlatform = true;
    if (formData.format === "In-Person" && !formData.address) newErrors.address = true;
    if (!resolveRsvpUrl(formData)) newErrors.meetingLink = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const resetMeetingForm = useCallback(() => {
    setFormData({ ...DEFAULT_MEETING_FORM_DATA });
    setDurationHour("0");
    setDurationMinute("0");
    setErrors({});
    setTimeConflictWarning("");
    setHasConfirmedConflict(false);
    setEditingMeetingId(null);
    setValueCastom("");
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) { toast.error("You must select a plan before scheduling a meeting"); return; }
    if (!validateForm()) { toast.error("Please fill in all required fields"); return; }
    if (isValueCastom === "Custom") { setOpenModel(true); return; }
    setIsSubmitting(true);
    try {
      const isEditing = editingMeetingId !== null;
      const url = isEditing ? `/api/meetings/${editingMeetingId}` : "/api/meetings";
      const response = await fetch(url, { method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, meetingType: formData.meetingType === "Custom" ? formData.customMeetingType : formData.meetingType, duration: formData.duration, meetingLink: resolveRsvpUrl(formData), status: "Upcoming" }) });
      const result = await response.json();
      if (response.ok) {
        toast.success(isEditing ? "Meeting updated successfully!" : "Meeting created successfully!");
        if (isEditing) { setFormData({ ...DEFAULT_MEETING_FORM_DATA, meetingType: formData.meetingType, client: formData.client, clientId: formData.clientId }); setDurationHour("0"); setDurationMinute("0"); setErrors({}); setTimeConflictWarning(""); setHasConfirmedConflict(false); setEditingMeetingId(null); setMeetingModalOpen(false); }
        else { resetMeetingForm(); setMeetingModalOpen(false); setPostSaveDialogOpen(true); }
        await fetchMeetings();
      } else toast.error(result.error || `Failed to ${isEditing ? "update" : "create"} meeting`);
    } catch (error) { toast.error(`An error occurred while ${editingMeetingId ? "updating" : "creating"} the meeting`); }
    finally { setIsSubmitting(false); }
  };
  const handleGenerateWithAI = () => { toast.info("AI generation feature coming soon!"); };
  const handleSort = (column: SortColumn) => { if (sortColumn === column) setSortDirection(sortDirection === "asc" ? "desc" : "asc"); else { setSortColumn(column); setSortDirection("asc"); } };
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
    setFormData({ meetingType: meeting.meetingType || "", customMeetingType: "", client: meeting.client || "", clientId: resolveClientIdForMeeting(meeting), date: meeting.date || "", time: meeting.time || "", hour: (h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24).toString(), minute: minute || "00", ampm: h24 >= 12 ? "PM" : "AM", timezone: meeting.timezone || "", duration: meeting.duration || "", customDuration: "", format: meeting.format || "", platform: meeting.platform || "", customPlatform: meeting.customPlatform || "", meetingUrl: meeting.meetingUrl || "", meetingLink: meeting.meetingLink || "", maxAttendees: meeting.maxAttendees?.toString() || "", description: meeting.description || "", address: meeting.address || "", city: meeting.city || "", state: meeting.state || "", zip: meeting.zip || "", language: meeting.language || "", benefitsCategory: meeting.benefitsCategory || "", customBenefitsCategory: meeting.customBenefitsCategory || "" });
    setEditingMeetingId(meeting.id); setHasConfirmedConflict(false); setMeetingModalOpen(true);
    toast.success("Meeting data loaded for editing. Make your changes and submit to update.");
  };
  function handleSubmitDialod(save: boolean = false) {
    const customMeeting = { value: formData.customMeetingType || "Custom Meeting", label: formData.customMeetingType || "Custom Meeting", description: formData.description };
    if (save) addCustomMeeting(customMeeting);
    setOpenModel(false); setValueCastom("");
    setTimeout(() => { const form = document.querySelector("form"); form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); }, 0);
  }
  const handleDuplicateMeeting = (meeting: Meeting) => {
    const [hour24, minute] = meeting.time.split(":"); const h24 = parseInt(hour24);
    setFormData({ meetingType: meeting.meetingType || "", customMeetingType: "", client: meeting.client || "", clientId: resolveClientIdForMeeting(meeting), date: meeting.date || "", time: meeting.time || "", hour: (h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24).toString(), minute: minute || "00", ampm: h24 >= 12 ? "PM" : "AM", timezone: meeting.timezone || "", duration: meeting.duration || "", customDuration: "", format: meeting.format || "", platform: meeting.platform || "", customPlatform: meeting.customPlatform || "", meetingUrl: meeting.meetingUrl || "", meetingLink: meeting.meetingLink || "", maxAttendees: meeting.maxAttendees?.toString() || "", description: meeting.description || "", address: meeting.address || "", city: meeting.city || "", state: meeting.state || "", zip: meeting.zip || "", language: meeting.language || "", benefitsCategory: meeting.benefitsCategory || "", customBenefitsCategory: meeting.customBenefitsCategory || "" });
    setEditingMeetingId(null); setHasConfirmedConflict(false); setMeetingModalOpen(true);
    if (meeting.date && meeting.time) { const hasConflict = checkTimeConflict(meeting.date, meeting.time, meeting.address || "", meeting.format); if (hasConflict) toast.warning("Meeting duplicated. \u26A0\uFE0F Time conflict detected - please choose a different time or confirm to proceed.", { duration: 5000 }); else toast.success("Meeting duplicated successfully. Review the details and submit."); }
    else toast.success("Meeting duplicated successfully. Review the details and submit.");
  };
  const handleCancelEdit = () => {
    setFormData({ meetingType: "", customMeetingType: "", client: "", clientId: "", date: "", time: "", hour: "", minute: "", ampm: "", timezone: "America/New_York", duration: "", customDuration: "", format: "", platform: "", customPlatform: "", meetingUrl: "", meetingLink: "", maxAttendees: "", description: "", address: "", city: "", state: "", zip: "", language: "", benefitsCategory: "", customBenefitsCategory: "" });
    setDurationHour("0"); setDurationMinute("0"); setErrors({}); setTimeConflictWarning(""); setHasConfirmedConflict(false); setEditingMeetingId(null); setMeetingModalOpen(false);
    toast.info("Edit cancelled. Form reset to create new meeting.");
  };
  const now = new Date();
  const upcomingMeetings = meetings.filter((m) => { if (m.status === "Draft") return true; const md = parseLocalDate(m.date); const [h, mn] = m.time.split(":").map(Number); const mdt = new Date(md); mdt.setHours(h, mn, 0, 0); return mdt >= now; });
  const pastMeetings = meetings.filter((m) => { if (m.status === "Draft") return false; const md = parseLocalDate(m.date); const [h, mn] = m.time.split(":").map(Number); const mdt = new Date(md); mdt.setHours(h, mn, 0, 0); return mdt < now; });
  const currentMeetings = activeTab === "upcoming" ? upcomingMeetings : pastMeetings;
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
              <><PlanSearchBar plans={clients} value={selectedPlan} onChange={handlePlanChange} disabled={clients.length === 0} /></>
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
                      <div className="flex space-x-1 bg-[#F2F2F4] dark:bg-[#030303] border border-[#efefef] dark:border-[#1c1c1c] p-0.5 rounded-lg shrink-0">
                        <button onClick={() => setActiveTab("upcoming")} className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 h-9 text-[0.75em] font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-[100px] ${activeTab === "upcoming" ? "bg-accent-blue dark:bg-accent-blue text-white shadow" : "text-muted-foreground hover:text-foreground"}`}>Upcoming ({upcomingMeetings.length})</button>
                        <button onClick={() => setActiveTab("past")} className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 h-9 text-[0.75em] font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-[100px] ${activeTab === "past" ? "bg-accent-blue dark:bg-accent-blue text-white shadow" : "text-muted-foreground hover:text-foreground"}`}>Past ({pastMeetings.length})</button>
                      </div>
                      <div className="w-px h-9 bg-border mx-1 shrink-0" />
                      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32 h-9 bg-white dark:bg-gray-800 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="Upcoming">Upcoming</SelectItem><SelectItem value="Past">Past</SelectItem><SelectItem value="Draft">Draft</SelectItem></SelectContent></Select>
                      <Select value={benefitsCategoryFilter} onValueChange={setBenefitsCategoryFilter}><SelectTrigger className="w-40 h-9 bg-white dark:bg-gray-800 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem><SelectItem value="Retirement">Retirement</SelectItem><SelectItem value="Group Health">Group Health</SelectItem><SelectItem value="Group Life">Group Life</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
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
                            {meeting.description && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/40 rounded-md px-2 py-1.5 border-l-2 border-primary/20">{meeting.description}</p>}
                          </div>
                          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 opacity-50"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleEditMeeting(meeting)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem><DropdownMenuItem onClick={() => handleDuplicateMeeting(meeting)}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem><DropdownMenuItem onClick={() => handleDeleteMeeting(meeting)} className="text-destructive dark:text-red-500"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3 pl-1">
                          <div className="space-y-1"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Calendar className="h-3 w-3 shrink-0" /><span className="font-medium uppercase tracking-wider">Date</span></div><div className="text-xs font-semibold pl-[18px]">{meetingDate}</div><div className="text-[11px] text-muted-foreground pl-[18px]">{formatTime12h(meeting.time)}{meeting.timezone && <span className="text-[10px] ml-1 opacity-75">({getTimezoneAbbr(meeting.timezone)})</span>}</div></div>
                          <div className="space-y-1"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock className="h-3 w-3 shrink-0" /><span className="font-medium uppercase tracking-wider">Duration</span></div><div className="text-xs font-semibold pl-[18px]">{meeting.duration}</div></div>
                          <div className="space-y-1"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Users className="h-3 w-3 shrink-0" /><span className="font-medium uppercase tracking-wider">Attendees</span></div><div className="text-xs font-semibold pl-[18px]">{meeting.attendees}{meeting.maxAttendees && ` / ${meeting.maxAttendees}`}</div></div>
                          <div className="space-y-1 min-w-0"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><FormatIcon className="h-3 w-3 shrink-0" /><span className="font-medium uppercase tracking-wider truncate">{meeting.format === "Virtual" && meeting.platform ? meeting.platform : meeting.format}</span></div>{meeting.format === "Virtual" && meeting.meetingLink && <div className="text-xs font-medium pl-[18px] text-primary/80 truncate">View link &rarr;</div>}{meeting.format === "Virtual" && !meeting.meetingLink && <div className="text-xs font-medium pl-[18px] text-muted-foreground truncate">No link</div>}{meeting.format === "In-Person" && meeting.address && <div className="text-xs font-semibold pl-[18px] truncate">{meeting.city}, {meeting.state}</div>}{meeting.format === "In-Person" && !meeting.address && <div className="text-xs font-medium pl-[18px] text-muted-foreground">TBA</div>}</div>
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
                      onSelect={(d) => { if (d) setTempDate(format(d, "yyyy-MM-dd")); }} initialFocus />
                    <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
                      <Button type="button" size="sm" variant="outline" onClick={() => setDatePickerOpen(false)}>Cancel</Button>
                      <Button type="button" size="sm" onClick={() => { if (tempDate) handleInputChange("date", tempDate); setDatePickerOpen(false); }}>OK</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label>Time <span className="text-red-500">*</span></Label>
                <Popover open={timePickerOpen} onOpenChange={(open) => {
                  setTimePickerOpen(open);
                  if (open) {
                    setTempHour(formData.hour);
                    setTempMinute(formData.minute);
                    setTempAmpm(formData.ampm);
                  }
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full justify-start text-left font-normal ${!formData.time && "text-muted-foreground"} ${errors.time ? "border-red-500" : ""} dark:bg-gray-800`}>
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
                          <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={h.toString()}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Minute</Label>
                        <Select value={tempMinute} onValueChange={setTempMinute}>
                          <SelectTrigger className="dark:bg-gray-800"><SelectValue placeholder="-" /></SelectTrigger>
                          <SelectContent>{MINUTES.map((m) => <SelectItem key={m} value={m.toString().padStart(2, "0")}>{m.toString().padStart(2, "0")}</SelectItem>)}</SelectContent>
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
                          setFormData((prev) => {
                            const hour24 = tempAmpm === "AM"
                              ? (tempHour === "12" ? "00" : tempHour.padStart(2, "0"))
                              : tempHour === "12" ? "12" : (parseInt(tempHour) + 12).toString();
                            return {
                              ...prev,
                              hour: tempHour,
                              minute: tempMinute,
                              ampm: tempAmpm,
                              time: `${hour24}:${tempMinute.padStart(2, "0")}`,
                            };
                          });
                          if (errors.time) setErrors((prev) => ({ ...prev, time: false }));
                        }
                        setTimePickerOpen(false);
                      }}>OK</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Duration <span className="text-red-500">*</span></Label>
                <Popover open={durationPickerOpen} onOpenChange={(open) => {
                  setDurationPickerOpen(open);
                  if (open) {
                    setTempDurationHour(durationHour);
                    setTempDurationMinute(durationMinute);
                  }
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full justify-start text-left font-normal ${!formData.duration && "text-muted-foreground"} ${errors.duration ? "border-red-500" : ""} dark:bg-gray-800`}>
                      <Clock className="mr-2 h-4 w-4" />
                      {formData.duration || "Select duration"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4" align="start">
                    <div className="grid grid-cols-2 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Hours</Label>
                        <Select value={tempDurationHour} onValueChange={setTempDurationHour}>
                          <SelectTrigger className="dark:bg-gray-800"><SelectValue /></SelectTrigger>
                          <SelectContent>{DURATION_HOURS.map((h) => <SelectItem key={h} value={h.toString()}>{h.toString()}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Minutes</Label>
                        <Select value={tempDurationMinute} onValueChange={setTempDurationMinute}>
                          <SelectTrigger className="dark:bg-gray-800"><SelectValue /></SelectTrigger>
                          <SelectContent>{DURATION_MINUTES.map((m) => <SelectItem key={m} value={m.toString()}>{m.toString()}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-3">
                      <Button type="button" size="sm" variant="outline" onClick={() => setDurationPickerOpen(false)}>Cancel</Button>
                      <Button type="button" size="sm" onClick={() => {
                        setDurationHour(tempDurationHour);
                        setDurationMinute(tempDurationMinute);
                        const hour = tempDurationHour;
                        const minute = tempDurationMinute;
                        let durationText = "";
                        if (hour !== "0" || minute !== "0") {
                          const parts = [];
                          if (hour !== "0") parts.push(`${hour} ${hour === "1" ? "hour" : "hours"}`);
                          if (minute !== "0") parts.push(`${minute} ${minute === "1" ? "minute" : "minutes"}`);
                          durationText = parts.join(" ");
                        }
                        handleInputChange("duration", durationText);
                        if (errors.duration) setErrors((prev) => ({ ...prev, duration: false }));
                        setDurationPickerOpen(false);
                      }}>OK</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

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

              {/* Address (In-Person) */}
              {formData.format === "In-Person" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Location <span className="text-red-500">*</span></Label>
                  <AddressSearch value={formData.address} onChange={(v) => handleInputChange("address", v)} onLocationSelect={handleLocationSelect} />
                  {formData.address && (
                    <p className="text-xs text-muted-foreground">{formData.address}, {formData.city}, {formData.state} {formData.zip}</p>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)}
                rows={3} placeholder={DEFAULT_MEETING_DESCRIPTION} />
            </div>

            {/* RSVP Link */}
            <div className="space-y-2">
              <Label>Meeting Link <span className="text-red-500">*</span></Label>
              <Input value={formData.meetingLink} onChange={(e) => handleInputChange("meetingLink", e.target.value)}
                placeholder="https://" className={errors.meetingLink ? "border-red-500" : ""} />
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
      <Dialog open={postSaveDialogOpen} onOpenChange={setPostSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Meeting Created</DialogTitle>
            <DialogDescription>
              The meeting has been successfully scheduled. Would you like to create a duplicate of this meeting?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setFormData({ ...DEFAULT_MEETING_FORM_DATA, client: formData.client, clientId: formData.clientId });
              setDurationHour("0");
              setDurationMinute("0");
              setPostSaveDialogOpen(false);
            }}>
              No
            </Button>
            <Button onClick={() => {
              const currentData = { ...formData };
              setPostSaveDialogOpen(false);
              setMeetingModalOpen(true);
              toast.success("Form pre-filled for duplication. Adjust any details and submit.");
            }}>
              Yes, duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog â€” shows meetings as they appear in the client portal */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Meeting Preview</DialogTitle>
            <DialogDescription>
              This is how meetings will appear to clients in the portal.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {formData.clientId ? (
              <WebinarsSection
                clientId={formData.clientId}
                onLoadComplete={() => setPreviewLoading(false)}
              />
            ) : (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <p>Select a plan first to preview its meetings.</p>
              </div>
            )}
          </div>
          <DialogFooter>
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


