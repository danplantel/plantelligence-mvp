"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { flushSync } from "react-dom";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { format } from "date-fns";
import { formatUsDate } from "@/lib/date";
import { toast } from "sonner";
import { AddressSearch } from "@/components/ui/address-search";
import {
  Dialog,
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
  persistPlanSelection,
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";
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

interface MeetingFormData {
  meetingType: string;
  customMeetingType: string;
  client: string;
  /** Plan (Client) id — required for Benefits Hub /api/clients/[id]/meetings */
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

function hasMeaningfulMeetingChanges(
  formData: MeetingFormData,
  editingMeetingId: string | null,
) {
  if (editingMeetingId) return true;

  const keysToCheck: (keyof MeetingFormData)[] = [
    "customMeetingType",
    "date",
    "time",
    "hour",
    "minute",
    "ampm",
    "duration",
    "customDuration",
    "format",
    "platform",
    "customPlatform",
    "meetingUrl",
    "meetingLink",
    "maxAttendees",
    "address",
    "city",
    "state",
    "zip",
    "language",
    "benefitsCategory",
  ];

  return keysToCheck.some((key) => formData[key] !== DEFAULT_MEETING_FORM_DATA[key]);
}

// Removed Hybrid format
const FORMATS = ["Virtual", "In-Person"];

const PLATFORMS = [
  { value: "Zoom", label: "Zoom" },
  { value: "Teams", label: "Teams" },
  { value: "Google Meet", label: "Google Meet" },
  { value: "Other", label: "Other" },
];

// Time picker options
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const AMPM_OPTIONS = ["AM", "PM"];

// Custom duration picker options
const DURATION_HOURS = Array.from({ length: 9 }, (_, i) => i); // 0-8
const DURATION_MINUTES = Array.from({ length: 13 }, (_, i) => i * 5); // 0, 5, 10, ..., 60

// Helper function to parse date string as local date (avoiding timezone issues)
const parseLocalDate = (dateStr: string): Date => {
  // If dateStr is in "yyyy-MM-dd" format, parse it as local date
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
  }
  // Otherwise, use standard Date parsing
  return new Date(dateStr);
};

// Helper function to get timezone abbreviation
const getTimezoneAbbr = (timezone: string) => {
  const tzMap: Record<string, string> = {
    "America/New_York": "ET",
    "America/Chicago": "CT",
    "America/Denver": "MT",
    "America/Los_Angeles": "PT",
    "America/Anchorage": "AT",
    "Pacific/Honolulu": "HT",
    "Europe/London": "GMT",
    "Europe/Paris": "CET",
    "Europe/Berlin": "CET",
    "Europe/Rome": "CET",
    "Europe/Madrid": "CET",
    "Europe/Amsterdam": "CET",
    "Europe/Zurich": "CET",
    "Europe/Vienna": "CET",
    "Europe/Stockholm": "CET",
    "Europe/Oslo": "CET",
    "Europe/Copenhagen": "CET",
    "Europe/Helsinki": "EET",
    "Europe/Warsaw": "CET",
    "Europe/Prague": "CET",
    "Europe/Budapest": "CET",
    "Europe/Athens": "EET",
    "Europe/Istanbul": "TRT",
    "Europe/Moscow": "MSK",
    "Asia/Tokyo": "JST",
    "Asia/Shanghai": "CST",
    "Asia/Hong_Kong": "HKT",
    "Asia/Singapore": "SGT",
    "Asia/Seoul": "KST",
    "Asia/Taipei": "CST",
    "Asia/Bangkok": "ICT",
    "Asia/Jakarta": "WIB",
    "Asia/Manila": "PHT",
    "Asia/Kolkata": "IST",
    "Asia/Dubai": "GST",
    "Asia/Tehran": "IRST",
    "Asia/Karachi": "PKT",
    "Asia/Dhaka": "BST",
    "Asia/Kathmandu": "NPT",
    "Asia/Colombo": "SLST",
    "Asia/Riyadh": "AST",
    "Asia/Jerusalem": "IST",
    "Australia/Sydney": "AEST",
    "Australia/Melbourne": "AEST",
    "Australia/Brisbane": "AEST",
    "Australia/Perth": "AWST",
    "Australia/Adelaide": "ACST",
    "Pacific/Auckland": "NZST",
    "Pacific/Fiji": "FJT",
    "America/Toronto": "ET",
    "America/Vancouver": "PT",
    "America/Mexico_City": "CST",
    "America/Sao_Paulo": "BRT",
    "America/Buenos_Aires": "ART",
    "America/Lima": "PET",
    "America/Bogota": "COT",
    "America/Santiago": "CLT",
    "America/Caracas": "VET",
    "Africa/Cairo": "EET",
    "Africa/Johannesburg": "SAST",
    "Africa/Lagos": "WAT",
    "Africa/Nairobi": "EAT",
    "Africa/Casablanca": "WET",
    "Africa/Tunis": "CET",
    "Africa/Algiers": "CET",
  };

  return tzMap[timezone] || timezone.split("/")[1] || timezone;
};

// For MVP, limit timezone options to common US timezones to avoid overwhelming
//  users and because our main user base is in the US. Can expand later if needed.
const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" }
];

const formatIcons = {
  Virtual: Video,
  "In-Person": MapPin,
};

const statusColors = {
  Scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  "In Progress": "bg-amber-100 text-amber-800 border-amber-200",
  Completed: "bg-green-100 text-green-800 border-green-200",
  Cancelled: "bg-red-100 text-red-800 border-red-200",
};

interface MeetingSaveType {
  id?: string;
  label: string;
  value: string;
  description?: string;
}

type SortColumn = "meeting" | "client" | "date" | "status";
type SortDirection = "asc" | "desc";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

export default function MeetingsPage() {
  const router = useRouter();
  const { setTitle } = usePageTitleContext();

  // Set page title
  useEffect(() => {
    setTitle("Meetings");
  }, [setTitle]);

  // Form state
  const [formData, setFormData] = useState<MeetingFormData>({
    ...DEFAULT_MEETING_FORM_DATA,
  });

  const searchParams = useSearchParams();

  // Meetings list state
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const meetingFormRef = useRef<HTMLFormElement | null>(null);
  const isSubmittingRef = useRef(false);

  // SWR: clients — cached, shows instantly on revisit
  const { data: clientsData, isLoading: isLoadingClients } = useSWR(
    "/api/clients",
    jsonFetcher,
    { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const clients: Client[] = useMemo(
    () => (clientsData?.data ?? []).filter((c: Client) => c.status !== "Archived"),
    [clientsData],
  );

  // SWR: meetings — key changes with filters so each combo is cached
  const meetingsKey = useMemo(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.append("search", searchTerm);
    if (typeFilter !== "all") params.append("type", typeFilter);
    if (statusFilter !== "all") params.append("status", statusFilter);
    return `/api/meetings?${params.toString()}`;
  }, [searchTerm, typeFilter, statusFilter]);

  const { data: meetingsData, isLoading: meetingsLoading, mutate: refreshMeetings } = useSWR(
    meetingsKey,
    jsonFetcher,
    { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const meetings: Meeting[] = meetingsData?.data ?? [];
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [durationHour, setDurationHour] = useState("0");
  const [durationMinute, setDurationMinute] = useState("0");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [timeConflictWarning, setTimeConflictWarning] = useState<string>("");
  const [hasConfirmedConflict, setHasConfirmedConflict] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);

  const [isValueCastom, setValueCastom] = useState<string>("");
  const [openModel, setOpenModel] = useState<boolean>(false);
  const [openDeleteModel, setOpenDeleteModel] = useState<boolean>(false);
  const [typeId, setTypeId] = useState<string>("");
  const [valueCustomName, setValueCustomName] = useState<string>();
  const [savedMeetingForm, setSavedMeetingForm] = useState<MeetingType>({
    value: "",
    label: "",
    description: "",
  });
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [postSaveDialogOpen, setPostSaveDialogOpen] = useState(false);

  const hasClients = clients.length > 0;

  const fetchCustomMeetings = useMeetingStore(
    (state) => state.fetchCustomMeetings,
  );
  const customMeetings = useMeetingStore((state) => state.customMeetings);

  const debugSavedMeetings = useSaveMeetingDebugStore(
    (state) => state.savedMeetings,
  );
  const saveDebugMeeting = useSaveMeetingDebugStore(
    (state) => state.saveCustomMeeting,
  );
  const rebaseCustomMeeting = useSaveMeetingDebugStore(
    (state) => state.rebaseCustomMeeting,
  );
  const deleteCustomMeeting = useMeetingStore(
    (state) => state.deleteCustomMeeting,
  );

  const [allMeetingTypes, setAllMeetingTypes] = useState<MeetingType[]>([]);
  const hasUnsavedChanges = hasMeaningfulMeetingChanges(formData, editingMeetingId);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const leaveGuard = useNavigateAwayGuard({
    enabled: true,
    hasUnsavedChanges,
    onSaveAndExit: async () => {
      if (!hasUnsavedChangesRef.current) return;
      const form = meetingFormRef.current;
      if (!form) {
        throw new Error("Could not find meeting form to save.");
      }

      form.requestSubmit();

      const wait = (ms: number) =>
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, ms);
        });

      const start = Date.now();
      while (isSubmittingRef.current && Date.now() - start < 15000) {
        await wait(150);
      }

      await wait(100);
      if (hasUnsavedChangesRef.current) {
        throw new Error(
          "Could not save meeting changes. Please resolve validation errors and try again.",
        );
      }
    },
  });

  useEffect(() => {
    fetchCustomMeetings();
  }, [fetchCustomMeetings]);

  useEffect(() => {
    setAllMeetingTypes([...customMeetings]);
  }, [customMeetings, debugSavedMeetings]);

  const addCustomMeeting = useMeetingStore((state) => state.addCustomMeeting);


  // Sync URL params with filters on mount
  useEffect(() => {
    const clientParam = searchParams.get("client");
    const idFromUrl =
      searchParams.get("planId")?.trim() ||
      searchParams.get("clientId")?.trim() ||
      null;
    const searchParam = searchParams.get("search");
    const typeParam = searchParams.get("type");
    const statusParam = searchParams.get("status");

    if (searchParam) setSearchTerm(searchParam);
    if (typeParam) setTypeFilter(typeParam);
    if (statusParam) setStatusFilter(statusParam);

    // If client param exists, set the filter
    if (clientParam) {
      setClientFilter(clientParam);

      if (clientParam && formData.client !== clientParam) {
        const found = clients.find(
          (c) => c.companyName.toLowerCase() === clientParam.toLowerCase(),
        );
        setFormData((prev) => ({
          ...prev,
          client: found?.companyName ?? clientParam,
          clientId: found?.id ?? "",
        }));
        setTimeout(() => {
          toast.success(`Meeting form pre-filled with ${clientParam}`);
        }, 300);
      }
    } else if (idFromUrl && clients.length > 0) {
      const client = clients.find((c) => c.id === idFromUrl);
      if (client && formData.clientId !== client.id) {
        setFormData((prev) => ({
          ...prev,
          client: client.companyName,
          clientId: client.id,
        }));
        setClientFilter(client.companyName);
        persistPlanSelection("meetings", client.id);
        setTimeout(() => {
          toast.success(`Meeting form pre-filled with ${client.companyName}`);
        }, 300);
      }
    }
  }, [searchParams, clients]);

  const meetingsStickyInit = useRef(false);

  // Default plan from lastPlanId_meetings when no plan in URL
  useEffect(() => {
    if (clients.length === 0 || meetingsStickyInit.current) return;
    const idFromUrl =
      searchParams.get("planId")?.trim() ||
      searchParams.get("clientId")?.trim();
    const companyFromUrl = searchParams.get("client");
    if (idFromUrl || companyFromUrl) {
      meetingsStickyInit.current = true;
      return;
    }
    const resolved = resolveStickyPlanId(clients, "meetings", null);
    if (!resolved) return;
    const c = clients.find((x) => x.id === resolved);
    if (!c) return;
    meetingsStickyInit.current = true;
    setFormData((prev) => {
      if (prev.clientId) return prev;
      return { ...prev, clientId: resolved, client: c.companyName };
    });
    setClientFilter(c.companyName);
  }, [clients, searchParams]);

  // Update URL when filters change
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (formData.clientId) params.set("planId", formData.clientId);

    const newURL = params.toString()
      ? `/new/meetings?${params.toString()}`
      : "/new/meetings";
    router.replace(newURL);
  }, [
    searchTerm,
    typeFilter,
    statusFilter,
    clientFilter,
    formData.clientId,
    router,
  ]);

  useEffect(() => {
    updateURL();
  }, [updateURL]);

  const fetchMeetings = useCallback(async () => {
    refreshMeetings();
  }, [refreshMeetings]);

  const handlePlanClientChange = (clientId: string) => {
    const c = clients.find((x) => x.id === clientId);
    setFormData((prev) => ({
      ...prev,
      clientId,
      client: c?.companyName || "",
    }));
    if (c) setClientFilter(c.companyName);
    if (errors.client) {
      setErrors((prev) => ({ ...prev, client: false }));
    }
    const params = new URLSearchParams(window.location.search);
    params.set("planId", clientId);
    router.replace(`/new/meetings?${params.toString()}`);
  };

  const handleInputChange = (field: keyof MeetingFormData, value: string) => {
    setFormData((prev) => {
      const newData = {
        ...prev,
        [field]: value,
      };

      // When meetingType changes, update description and clear customMeetingType error
      if (field === "meetingType") {
        setErrors((prev) => ({
          ...prev,
          customMeetingType: false,
        }));

        // Find the selected meeting type and update description accordingly
        const selectedType = allMeetingTypes.find(
          (type) => type.value === value,
        );
        if (selectedType) {
          setValueCastom(value);

          if (value === "Custom") {
            // Clear description for Custom meeting type
            newData.description = "";
          } else {
            // Set description to the meeting type's description
            newData.description = selectedType.description;
          }
        }
      }

      return newData;
    });

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: false,
      }));
    }

    if (field === "meetingUrl" || field === "meetingLink") {
      setErrors((prev) => ({ ...prev, meetingLink: false }));
    }

    // When format changes, clear related errors
    if (field === "format") {
      setErrors((prev) => ({
        ...prev,
        platform: false,
        address: false,
      }));
    }

    // When duration changes, clear customDuration error
    if (field === "duration") {
      setErrors((prev) => ({
        ...prev,
        customDuration: false,
      }));
    }
  };

  const handleTimeChange = useCallback(
    (field: "hour" | "minute" | "ampm", value: string) => {
      flushSync(() => {
        setFormData((prev) => {
          const newData = { ...prev, [field]: value };

          // Update the combined time field when all parts are selected
          if (newData.hour && newData.minute && newData.ampm) {
            const hour24 =
              newData.ampm === "AM"
                ? newData.hour === "12"
                  ? "00"
                  : newData.hour.padStart(2, "0")
                : newData.hour === "12"
                ? "12"
                : (parseInt(newData.hour) + 12).toString();
            const minute24 = newData.minute.padStart(2, "0");
            newData.time = `${hour24}:${minute24}`;
          }

          return newData;
        });

        // Clear time error when user selects time
        if (errors.time) {
          setErrors((prev) => ({
            ...prev,
            time: false,
          }));
        }
      });
    },
    [errors.time],
  );

  // Get occupied times for a specific date (any format)
  const getOccupiedTimes = useCallback(
    (date: string, address: string, format: string) => {
      if (!date) {
        return [];
      }

      // Normalize dates for comparison
      const normalizeDate = (dateStr: string) => {
        const d = parseLocalDate(dateStr);
        return d.toISOString().split("T")[0];
      };

      const formDateNormalized = normalizeDate(date);

      return meetings
        .filter((meeting) => {
          const meetingDateNormalized = normalizeDate(meeting.date);
          const dateMatch = meetingDateNormalized === formDateNormalized;

          // For In-Person meetings, also check location
          if (
            format === "In-Person" &&
            meeting.format === "In-Person" &&
            address
          ) {
            return dateMatch && meeting.address === address;
          }

          // For other formats, just check date
          return dateMatch;
        })
        .map((meeting) => meeting.time);
    },
    [meetings],
  );

  // Check if a specific time is occupied
  const isTimeOccupied = useCallback(
    (hour: string, minute: string, ampm: string) => {
      if (!formData.date) {
        return false;
      }

      // Convert to 24-hour format
      const hour24 =
        ampm === "AM"
          ? hour === "12"
            ? "00"
            : hour.padStart(2, "0")
          : hour === "12"
          ? "12"
          : (parseInt(hour) + 12).toString();
      const minute24 = minute.padStart(2, "0");
      const timeToCheck = `${hour24}:${minute24}`;

      const occupiedTimes = getOccupiedTimes(
        formData.date,
        formData.address || "",
        formData.format,
      );
      return occupiedTimes.includes(timeToCheck);
    },
    [formData.date, formData.address, formData.format, getOccupiedTimes],
  );

  // Check for time conflicts
  const checkTimeConflict = useCallback(
    (
      date: string,
      time: string,
      address: string,
      format: string,
      excludeMeetingId?: string,
    ) => {
      if (!date || !time) {
        setTimeConflictWarning("");
        return false;
      }

      if (meetings.length === 0) {
        setTimeConflictWarning("");
        return false;
      }

      // Normalize dates for comparison (both to YYYY-MM-DD format)
      const normalizeDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toISOString().split("T")[0];
      };

      const formDateNormalized = normalizeDate(date);

      // Find meetings at the same date and time (any format)
      const conflictingMeetings = meetings.filter((meeting) => {
        // Exclude the meeting being edited/duplicated if ID provided
        if (excludeMeetingId && meeting.id === excludeMeetingId) {
          return false;
        }

        const meetingDateNormalized = normalizeDate(meeting.date);
        const dateMatch = meetingDateNormalized === formDateNormalized;
        const timeMatch = meeting.time === time;

        // Conflict if same date + time
        let isConflict = dateMatch && timeMatch;

        // For In-Person meetings, also check location
        if (
          format === "In-Person" &&
          meeting.format === "In-Person" &&
          address
        ) {
          const addressMatch = meeting.address === address;
          isConflict = dateMatch && timeMatch && addressMatch;
        }

        return isConflict;
      });

      if (conflictingMeetings.length > 0) {
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

  const handleDeleteCusromTypeMeeting = async (meetingId: string) => {
    try {
      const userRes = await fetch("/api/auth/session");
      const userData = await userRes.json();
      const userId = userData.user.id;

      if (!userId) return;

      const res = await fetch(`/api/user/${userId}/custom-meetings`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ meetingId }),
      });

      const data = await res.json();

      if (data.success) {
        setAllMeetingTypes((prev) =>
          prev.filter((m) => m.id && m.id !== meetingId),
        );
      } else {
        console.error("Failed to delete meeting:", data.error);
      }
    } catch (err) {
      console.error("Delete meeting error:", err);
    }
  };


  const handleDurationChange = useCallback(
    (field: "hour" | "minute", value: string) => {
      if (field === "hour") {
        setDurationHour(value);
      } else {
        setDurationMinute(value);
      }

      // Update duration when both are set
      const hour = field === "hour" ? value : durationHour;
      const minute = field === "minute" ? value : durationMinute;

      let durationText = "";
      if (hour !== "0" || minute !== "0") {
        const parts = [];
        if (hour !== "0") {
          parts.push(`${hour} ${hour === "1" ? "hour" : "hours"}`);
        }
        if (minute !== "0") {
          parts.push(`${minute} ${minute === "1" ? "minute" : "minutes"}`);
        }
        durationText = parts.join(" ");
      }

      handleInputChange("duration", durationText);

      // Clear duration error when user selects duration
      if (errors.duration) {
        setErrors((prev) => ({
          ...prev,
          duration: false,
        }));
      }
    },
    [durationHour, durationMinute, errors.duration, handleInputChange],
  );

  const handleLocationSelect = (location: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  }) => {
    setFormData((prev) => ({
      ...prev,
      address: location.address,
      city: location.city,
      state: location.state,
      zip: location.zip,
    }));

    // Clear address error when location is selected
    if (errors.address) {
      setErrors((prev) => ({
        ...prev,
        address: false,
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, boolean> = {};

    // Required fields validation
    if (!formData.meetingType) newErrors.meetingType = true;
    if (
      formData.meetingType === "Custom" &&
      !formData.customMeetingType.trim()
    ) {
      newErrors.customMeetingType = true;
    }
    if (!formData.clientId) newErrors.client = true;
    if (!formData.date) newErrors.date = true;
    if (!formData.time) newErrors.time = true;
    if (!formData.duration) newErrors.duration = true;
    if (!formData.format) newErrors.format = true;

    // Format-specific validation
    if (formData.format === "Virtual" && !formData.platform) {
      newErrors.platform = true;
    }
    if (
      formData.format === "Virtual" &&
      formData.platform === "Other" &&
      !formData.customPlatform.trim()
    ) {
      newErrors.customPlatform = true;
    }
    if (formData.format === "In-Person") {
      if (!formData.address) newErrors.address = true;
    }

    // RSVP URL required (RSVP field or, for virtual meetings, Meeting URL)
    if (!resolveRsvpUrl(formData)) {
      newErrors.meetingLink = true;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId) {
      toast.error("You must select a plan before scheduling a meeting");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }


    if (isValueCastom === "Custom") {
      setOpenModel(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // Use custom meeting type if "Custom" is selected
      const meetingTypeToSend =
        formData.meetingType === "Custom"
          ? formData.customMeetingType
          : formData.meetingType;

      // Duration is already formatted
      const durationToSend = formData.duration;

      const isEditing = editingMeetingId !== null;
      const url = isEditing
        ? `/api/meetings/${editingMeetingId}`
        : "/api/meetings";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          meetingType: meetingTypeToSend,
          duration: durationToSend,
          meetingLink: resolveRsvpUrl(formData),
          // Remove meetingTitle since we're not using it anymore
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          isEditing
            ? "Meeting updated successfully!"
            : "Meeting created successfully!",
        );
        if (isEditing) {
          // Reset form for editing
          setFormData({
            meetingType: formData.meetingType,
            customMeetingType: "",
            client: formData.client,
            clientId: formData.clientId,
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
            description: "",
            address: "",
            city: "",
            state: "",
            zip: "",
            language: "",
            benefitsCategory: "",
            customBenefitsCategory: "",
          });
          setDurationHour("0");
          setDurationMinute("0");
          setErrors({});
          setTimeConflictWarning("");
          setHasConfirmedConflict(false);
          setEditingMeetingId(null);
          setMeetingModalOpen(false);
        } else {
          // Show post-save dialog for new meetings
          setPostSaveDialogOpen(true);
        }
        // Refresh meetings list
        await fetchMeetings();
      } else {
        toast.error(
          result.error ||
            `Failed to ${isEditing ? "update" : "create"} meeting`,
        );
      }
    } catch (error) {
      toast.error(
        `An error occurred while ${
          editingMeetingId ? "updating" : "creating"
        } the meeting`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateWithAI = () => {
    // TODO: Implement AI generation
    toast.info("AI generation feature coming soon!");
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    setDeletingMeetingId(meetingId);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Meeting deleted successfully!");
        fetchMeetings(); // Refresh the meetings list
      } else {
        toast.error("Failed to delete meeting");
      }
    } catch (error) {
      toast.error("An error occurred while deleting the meeting");
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const resolveClientIdForMeeting = (m: Meeting) => {
    if (m.clientId) return m.clientId;
    const byName = clients.find(
      (c) => c.companyName.toLowerCase() === (m.client || "").toLowerCase(),
    );
    return byName?.id ?? "";
  };

  const handleEditMeeting = (meeting: Meeting) => {
    // Parse time to hour, minute, ampm
    const [hour24, minute] = meeting.time.split(":");
    const hour24Int = parseInt(hour24);
    const ampm = hour24Int >= 12 ? "PM" : "AM";
    const hour12 =
      hour24Int === 0 ? 12 : hour24Int > 12 ? hour24Int - 12 : hour24Int;

    // Fill form with meeting data
    setFormData({
      meetingType: meeting.meetingType || "",
      customMeetingType: "",
      client: meeting.client || "",
      clientId: resolveClientIdForMeeting(meeting),
      date: meeting.date || "",
      time: meeting.time || "",
      hour: hour12.toString(),
      minute: minute || "00",
      ampm: ampm,
      timezone: meeting.timezone || "",
      duration: meeting.duration || "",
      customDuration: "",
      format: meeting.format || "",
      platform: meeting.platform || "",
      customPlatform: meeting.customPlatform || "",
      meetingUrl: meeting.meetingUrl || "",
      meetingLink: meeting.meetingLink || "",
      maxAttendees: meeting.maxAttendees?.toString() || "",
      description: meeting.description || "",
      address: meeting.address || "",
      city: meeting.city || "",
      state: meeting.state || "",
      zip: meeting.zip || "",
      language: meeting.language || "",
      benefitsCategory: meeting.benefitsCategory || "",
      customBenefitsCategory: meeting.customBenefitsCategory || "",
    });

    // Set editing state
    setEditingMeetingId(meeting.id);

    // Reset conflict confirmation
    setHasConfirmedConflict(false);

    // Open the meeting modal
    setMeetingModalOpen(true);

    toast.success(
      "Meeting data loaded for editing. Make your changes and submit to update.",
    );
  };

  function handleSubmitDialod(save: boolean = false) {
    const customMeeting = {
      value: formData.customMeetingType || "Custom Meeting",
      label: formData.customMeetingType || "Custom Meeting",
      description: formData.description,
    };

    if (save) {
      addCustomMeeting(customMeeting);
    }

    setOpenModel(false);
    setValueCastom("");

    setTimeout(() => {
      const form = document.querySelector("form");
      form?.dispatchEvent(
        new Event("submit", {
          cancelable: true,
          bubbles: true,
        }),
      );
    }, 0);
  }

  const handleDuplicateMeeting = (meeting: Meeting) => {
    // Parse time to hour, minute, ampm
    const [hour24, minute] = meeting.time.split(":");
    const hour24Int = parseInt(hour24);
    const ampm = hour24Int >= 12 ? "PM" : "AM";
    const hour12 =
      hour24Int === 0 ? 12 : hour24Int > 12 ? hour24Int - 12 : hour24Int;

    // Fill form with meeting data
    setFormData({
      meetingType: meeting.meetingType || "",
      customMeetingType: "",
      client: meeting.client || "",
      clientId: resolveClientIdForMeeting(meeting),
      date: meeting.date || "",
      time: meeting.time || "",
      hour: hour12.toString(),
      minute: minute || "00",
      ampm: ampm,
      timezone: meeting.timezone || "",
      duration: meeting.duration || "",
      customDuration: "",
      format: meeting.format || "",
      platform: meeting.platform || "",
      customPlatform: meeting.customPlatform || "",
      meetingUrl: meeting.meetingUrl || "",
      meetingLink: meeting.meetingLink || "",
      maxAttendees: meeting.maxAttendees?.toString() || "",
      description: meeting.description || "",
      address: meeting.address || "",
      city: meeting.city || "",
      state: meeting.state || "",
      zip: meeting.zip || "",
      language: meeting.language || "",
      benefitsCategory: meeting.benefitsCategory || "",
      customBenefitsCategory: meeting.customBenefitsCategory || "",
    });

    // Clear editing state for duplicate
    setEditingMeetingId(null);

    // Reset conflict confirmation
    setHasConfirmedConflict(false);

    // Open the meeting modal
    setMeetingModalOpen(true);

    // Check for time conflicts (DO NOT exclude the original meeting - this is a duplicate!)
    // If duplicating to the same time, it IS a conflict that needs confirmation
    if (meeting.date && meeting.time) {
      const hasConflict = checkTimeConflict(
        meeting.date,
        meeting.time,
        meeting.address || "",
        meeting.format,
      );

      if (hasConflict) {
        toast.warning(
          "Meeting duplicated. ⚠️ Time conflict detected - please choose a different time or confirm to proceed.",
          { duration: 5000 },
        );
      } else {
        toast.success(
          "Meeting duplicated successfully. Review the details and submit.",
        );
      }
    } else {
      toast.success(
        "Meeting duplicated successfully. Review the details and submit.",
      );
    }
  };

  const handleCancelEdit = () => {
    // Reset form to default state
    setFormData({
      meetingType: "",
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
      description: "", // Start with empty description
      address: "",
      city: "",
      state: "",
      zip: "",
      language: "",
      benefitsCategory: "",
      customBenefitsCategory: "",
    });
    setDurationHour("0");
    setDurationMinute("0");
    setErrors({});
    setTimeConflictWarning("");
    setHasConfirmedConflict(false);
    setEditingMeetingId(null);
    setMeetingModalOpen(false);
    toast.info("Edit cancelled. Form reset to create new meeting.");
  };

  // Separate meetings into upcoming and past
  const now = new Date();
  const upcomingMeetings = meetings.filter((meeting) => {
    const meetingDate = parseLocalDate(meeting.date);
    const [hours, minutes] = meeting.time.split(":").map(Number);
    const meetingDateTime = new Date(meetingDate);
    meetingDateTime.setHours(hours, minutes, 0, 0);

    return meetingDateTime >= now;
  });

  const pastMeetings = meetings.filter((meeting) => {
    const meetingDate = parseLocalDate(meeting.date);
    const [hours, minutes] = meeting.time.split(":").map(Number);
    const meetingDateTime = new Date(meetingDate);
    meetingDateTime.setHours(hours, minutes, 0, 0);

    return meetingDateTime < now;
  });

  // Apply filters to the appropriate meeting list
  const currentMeetings =
    activeTab === "upcoming" ? upcomingMeetings : pastMeetings;

  const filteredMeetings = currentMeetings.filter((meeting) => {
    const matchesSearch =
      meeting.meeting.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      typeFilter === "all" || meeting.meetingType === typeFilter;
    const matchesStatus =
      statusFilter === "all" || meeting.status === statusFilter;
    const matchesClient =
      clientFilter === "all" ||
      meeting.client.toLowerCase() === clientFilter.toLowerCase();

    return matchesSearch && matchesType && matchesStatus && matchesClient;
  });

  const sortedMeetings = [...filteredMeetings].sort((a, b) => {
    let aValue: any = a[sortColumn];
    let bValue: any = b[sortColumn];

    if (sortColumn === "date") {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    } else {
      aValue = aValue?.toString().toLowerCase() || "";
      bValue = bValue?.toString().toLowerCase() || "";
    }

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return (
    <div className="p-6 bg-background">
      {/* Meeting Sessions - Full Width */}
      <Card className="shadow-sm mx-auto max-w-4xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Meeting Sessions
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.info(
                    "Meeting Preview feature will be implemented soon!",
                  )
                }
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Generate Preview
              </Button>
              <Button
                onClick={() => setMeetingModalOpen(true)}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Meeting
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Search meetings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8"
                />
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.companyName}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Enrollment">Enrollment</SelectItem>
                  <SelectItem value="Annual Review">Annual Review</SelectItem>
                  <SelectItem value="Plan Changes">Plan Changes</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Consultation">Consultation</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={fetchMeetings} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("upcoming")}
                className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
                  activeTab === "upcoming"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Upcoming ({upcomingMeetings.length})
              </button>
              <button
                onClick={() => setActiveTab("past")}
                className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
                  activeTab === "past"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Past ({pastMeetings.length})
              </button>
            </div>

            {/* Meetings List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isLoading ? (
                // Skeleton Loader
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-4 border rounded-lg bg-card animate-pulse"
                    >
                      {/* Header with Title, Badge and Menu */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            {/* Title */}
                            <div className="h-5 bg-gray-200 rounded w-40" />
                            {/* Status Badge */}
                            <div className="h-5 w-20 bg-gray-200 rounded-full" />
                          </div>
                          {/* Description */}
                          <div className="space-y-1.5">
                            <div className="h-4 bg-gray-200 rounded w-full" />
                            <div className="h-4 bg-gray-200 rounded w-2/3" />
                          </div>
                        </div>
                        {/* Menu Button */}
                        <div className="h-6 w-6 bg-gray-200 rounded ml-2" />
                      </div>

                      {/* Meeting Details Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-3 mt-3">
                        {/* Date & Time */}
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <div className="h-3.5 w-3.5 bg-gray-200 rounded" />
                            <div className="h-3 bg-gray-200 rounded w-16" />
                          </div>
                          <div className="h-4 bg-gray-200 rounded w-24 ml-5" />
                          <div className="h-3 bg-gray-200 rounded w-20 ml-5" />
                        </div>

                        {/* Duration */}
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <div className="h-3.5 w-3.5 bg-gray-200 rounded" />
                            <div className="h-3 bg-gray-200 rounded w-14" />
                          </div>
                          <div className="h-4 bg-gray-200 rounded w-16 ml-5" />
                        </div>

                        {/* Format */}
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <div className="h-3.5 w-3.5 bg-gray-200 rounded" />
                            <div className="h-3 bg-gray-200 rounded w-12" />
                          </div>
                          <div className="h-4 bg-gray-200 rounded w-20 ml-5" />
                        </div>

                        {/* Location/Platform */}
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <div className="h-3.5 w-3.5 bg-gray-200 rounded" />
                            <div className="h-3 bg-gray-200 rounded w-16" />
                          </div>
                          <div className="h-4 bg-gray-200 rounded w-28 ml-5" />
                        </div>
                      </div>

                      {/* Client Info */}
                      <div className="flex items-center space-x-2 pt-2 border-t">
                        <div className="h-3.5 w-3.5 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-200 rounded w-10" />
                        <div className="h-4 bg-gray-200 rounded w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sortedMeetings.length === 0 ? (
                <div className="col-span-full flex items-center justify-center py-20">
                  <div className="text-center max-w-sm">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-5">
                      <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No meetings added yet
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      Get started by scheduling your first meeting session for a client.
                    </p>
                    <Button
                      onClick={() => setMeetingModalOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Meeting
                    </Button>
                  </div>
                </div>
              ) : (
                sortedMeetings.map((meeting) => {
                  const FormatIcon =
                    formatIcons[meeting.format as keyof typeof formatIcons];
                  const meetingDate = formatUsDate(
                    parseLocalDate(meeting.date),
                  );

                  // Status badge colors
                  const statusColors = {
                    Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
                    Completed: "bg-green-100 text-green-700 border-green-200",
                    Cancelled: "bg-red-100 text-red-700 border-red-200",
                  };

                  return (
                    <div
                      key={meeting.id}
                      className={`group p-4 border border-border/60 rounded-xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 bg-card flex flex-col h-full relative ${
                        deletingMeetingId === meeting.id ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {deletingMeetingId === meeting.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-xl z-10">
                          <div className="flex items-center gap-2 px-3 py-2 bg-card border border-border/60 rounded-lg shadow-sm">
                            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-medium">Deleting...</span>
                          </div>
                        </div>
                      )}

                      {/* Header with Title and Status */}
                      <div className="flex items-start justify-between mb-3 pl-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm truncate leading-tight">
                              {meeting.meeting}
                            </h4>
                          </div>

                          {/* Tags row */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <Badge
                              className={`text-[10px] border px-1.5 py-px shrink-0 ${
                                statusColors[
                                  meeting.status as keyof typeof statusColors
                                ] || statusColors.Scheduled
                              }`}
                            >
                              {meeting.status}
                            </Badge>
                            {meeting.benefitsCategory && (
                              <span className="text-[10px] font-medium text-muted-foreground/60 border border-border/40 px-1.5 py-px rounded shrink-0 leading-tight">
                                {meeting.benefitsCategory}
                              </span>
                            )}
                            {meeting.language && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-px rounded shrink-0 leading-tight ${
                                  meeting.language === "Spanish"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-sky-50 text-sky-700 border border-sky-200"
                                }`}
                              >
                                {meeting.language === "Spanish" ? "ES" : "EN"}
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          {meeting.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/40 rounded-md px-2 py-1.5 border-l-2 border-primary/20">
                              {meeting.description}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEditMeeting(meeting)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicateMeeting(meeting)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                toast.info(
                                  "Spanish Translation - Coming Soon",
                                );
                              }}
                            >
                              <Languages className="mr-2 h-4 w-4" />
                              Spanish Version
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                toast.info(
                                  "Generate Meeting Page - Coming Soon",
                                );
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Generate Meeting Page
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Meeting Details Grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3 pl-1">
                        {/* Date & Time */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span className="font-medium uppercase tracking-wider">Date</span>
                          </div>
                          <div className="text-xs font-semibold pl-[18px]">
                            {meetingDate}
                          </div>
                          <div className="text-[11px] text-muted-foreground pl-[18px]">
                            {meeting.time}
                            {meeting.timezone && (
                              <span className="text-[10px] ml-1 opacity-75">
                                ({getTimezoneAbbr(meeting.timezone)})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="font-medium uppercase tracking-wider">Duration</span>
                          </div>
                          <div className="text-xs font-semibold pl-[18px]">
                            {meeting.duration}
                          </div>
                        </div>

                        {/* Attendees */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3 shrink-0" />
                            <span className="font-medium uppercase tracking-wider">Attendees</span>
                          </div>
                          <div className="text-xs font-semibold pl-[18px]">
                            {meeting.attendees}
                            {meeting.maxAttendees &&
                              ` / ${meeting.maxAttendees}`}
                          </div>
                        </div>

                        {/* Location */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <FormatIcon className="h-3 w-3 shrink-0" />
                            <span className="font-medium uppercase tracking-wider truncate">
                              {meeting.format === "Virtual" &&
                              meeting.platform
                                ? meeting.platform
                                : meeting.format}
                            </span>
                          </div>
                          {meeting.format === "Virtual" &&
                            meeting.meetingLink && (
                              <div className="text-xs font-medium pl-[18px] text-primary/80 truncate">
                                View link &rarr;
                              </div>
                            )}
                          {meeting.format === "Virtual" &&
                            !meeting.meetingLink && (
                              <div className="text-xs font-medium pl-[18px] text-muted-foreground truncate">
                                No link
                              </div>
                            )}
                          {meeting.format === "In-Person" &&
                            meeting.address && (
                              <div className="text-xs font-semibold pl-[18px] truncate">
                                {meeting.city}, {meeting.state}
                              </div>
                            )}
                          {meeting.format === "In-Person" &&
                            !meeting.address && (
                              <div className="text-xs font-medium pl-[18px] text-muted-foreground">
                                TBA
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Client */}
                      <div className="flex items-center gap-1.5 pt-2.5 border-t border-border/50 mt-auto bg-muted/30 -mx-4 -mb-4 px-4 pb-3 rounded-b-xl">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[11px] font-medium text-muted-foreground/70 shrink-0">
                          Client
                        </span>
                        <span className="text-xs font-semibold truncate">
                          {meeting.client}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add New Meeting Modal */}
      <Dialog open={meetingModalOpen} onOpenChange={setMeetingModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMeetingId ? "Edit Meeting" : "Add New Meeting"}
            </DialogTitle>
            <DialogDescription>
              {editingMeetingId
                ? "Make your changes below and submit to update the meeting"
                : "Fill out the details below to add a meeting session"}
            </DialogDescription>
          </DialogHeader>

          {/* No Plans Warning */}
          {!hasClients && !isLoadingClients && (
            <div className="mb-6 p-6 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-2">
                    No Plans Available
                  </h3>
                  <p className="text-sm text-amber-800 mb-4">
                    You must create at least one plan before scheduling a
                    meeting or event. Please add a plan first to proceed with
                    meeting creation.
                  </p>
                  <Button
                    onClick={() => router.push("/new/new-client")}
                    className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 dark:text-white"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Plan
                  </Button>
                </div>
              </div>
            </div>
          )}

          <form ref={meetingFormRef} onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Select Plan */}
            <div className="space-y-2">
              <StickyPlanCombobox
                module="meetings"
                plans={clients}
                value={formData.clientId}
                onChange={handlePlanClientChange}
                disabled={!hasClients || isLoadingClients}
                required
                label="Select Plan"
                placeholder={
                  isLoadingClients ? "Loading plans..." : "Choose a plan..."
                }
                id="meetings-plan"
                className={errors.client ? "[&_button]:border-red-500" : ""}
              />
              {errors.client && (
                <p className="text-sm text-red-500">This field is required</p>
              )}
            </div>

            {/* Meeting Type */}
            <div className="space-y-2">
              <Label>
                Meeting Type <span className="text-red-500">*</span>
              </Label>
              {errors.meetingType && (
                <p className="text-sm text-red-500">This field is required</p>
              )}
              <div className="space-y-2">
                {allMeetingTypes.map((type) => (
                  <div
                    key={type.id ?? `${type.value}-${Math.random()}`}
                    className={`relative p-3 border rounded-lg transition-colors group ${
                      !formData.clientId
                        ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                        : formData.meetingType === type.value
                        ? "border-primary bg-primary/5 cursor-pointer"
                        : errors.meetingType
                        ? "border-red-500 hover:bg-muted/50 cursor-pointer"
                        : "hover:bg-muted/50 cursor-pointer"
                    }`}
                    onClick={() =>
                      !formData.clientId
                        ? null
                        : handleInputChange("meetingType", type.value)
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
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="cursor-pointer font-medium">
                          {type.label}
                        </div>
                        {type.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {type.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {useSaveMeetingDebugStore.getState().deletedMeeting && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const deleted =
                            useSaveMeetingDebugStore.getState()
                              .deletedMeeting!;
                          useSaveMeetingDebugStore
                            .getState()
                            .saveCustomMeeting(deleted);
                          useSaveMeetingDebugStore.setState({
                            deletedMeeting: undefined,
                          });
                        }}
                      >
                        Restore Last Deleted Meeting
                      </Button>
                    )}
                  </div>
                ))}
                {MEETING_TYPES.some(
                  (base) =>
                    !allMeetingTypes.some(
                      (type) => type.value === base.value,
                    ),
                ) && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      useMeetingStore.getState().resetToDefaultMeetings()
                    }
                  >
                    Restore Default Meetings
                  </Button>
                )}
                {debugSavedMeetings.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => rebaseCustomMeeting()}
                  >
                    {`Rebase ${debugSavedMeetings.length} Custom Meeting${
                      debugSavedMeetings.length > 1 ? "s" : ""
                    }`}
                  </Button>
                )}
              </div>

              {/* Custom Meeting Type Input */}
              {formData.meetingType === "Custom" && (
                <div className="mt-3">
                  <Label htmlFor="customMeetingType">
                    Custom Meeting Type{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="customMeetingType"
                    icon={<FileText className="h-4 w-4" />}
                    value={formData.customMeetingType}
                    onChange={(e) =>
                      handleInputChange("customMeetingType", e.target.value)
                    }
                    placeholder="Enter your custom meeting type..."
                    disabled={!formData.clientId}
                    className={`mt-1 ${
                      errors.customMeetingType ? "border-red-500" : ""
                    }`}
                  />
                  {errors.customMeetingType && (
                    <p className="text-sm text-red-500 mt-1">
                      This field is required
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Meeting Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Meeting Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder={
                  formData.meetingType === "Custom"
                    ? "Enter your custom meeting description..."
                    : "Meeting description will be populated automatically based on the selected meeting type"
                }
                disabled={!formData.clientId}
                className="min-h-20 resize-none"
              />

              {/* Helper text */}
              {formData.meetingType && formData.meetingType !== "Custom" && (
                <p className="text-xs text-muted-foreground">
                  Description automatically populated from "
                  {formData.meetingType}" meeting type. You can edit it
                  if needed.
                </p>
              )}
              {formData.meetingType === "Custom" && (
                <p className="text-xs text-muted-foreground">
                  Enter a custom description for your meeting.
                </p>
              )}

              {/* Generate with AI Button - inside description section */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateWithAI}
                  disabled={!formData.clientId}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Generate with AI
                </Button>
              </div>
            </div>

            {/* Benefits Category */}
            <div className="space-y-2">
              <Label>
                Benefits Category <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-3">
                {["Retirement", "Group Health", "Group Life", "Other"].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleInputChange("benefitsCategory", category)}
                    disabled={!formData.clientId}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm ${
                      !formData.clientId
                        ? "opacity-50 cursor-not-allowed bg-gray-100"
                        : formData.benefitsCategory === category
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              {formData.benefitsCategory === "Other" && (
                <div className="mt-3">
                  <Label htmlFor="customBenefitsCategory">
                    Custom Benefits Category{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="customBenefitsCategory"
                    icon={<Hash className="h-4 w-4" />}
                    type="text"
                    value={formData.customBenefitsCategory || ""}
                    onChange={(e) =>
                      handleInputChange("customBenefitsCategory", e.target.value)
                    }
                    placeholder="Enter custom category..."
                    disabled={!formData.clientId}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>
                Language <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleInputChange("language", "English")}
                  disabled={!formData.clientId}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm ${
                    !formData.clientId
                      ? "opacity-50 cursor-not-allowed bg-gray-100"
                      : formData.language === "English"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange("language", "Spanish")}
                  disabled={!formData.clientId}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm ${
                    !formData.clientId
                      ? "opacity-50 cursor-not-allowed bg-gray-100"
                      : formData.language === "Spanish"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  Spanish
                </button>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>
                Date <span className="text-red-500">*</span>
              </Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!formData.clientId}
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
                    onSelect={(date) => {
                      if (date) {
                        handleInputChange("date", format(date, "yyyy-MM-dd"));
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                  <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDatePickerOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setDatePickerOpen(false)}
                    >
                      OK
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {errors.date && (
                <p className="text-sm text-red-500">This field is required</p>
              )}
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label>
                Time <span className="text-red-500">*</span>
              </Label>
              <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!formData.clientId}
                    className={`w-full justify-start text-left font-normal ${
                      errors.time ? "border-red-500" : ""
                    }`}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {formData.hour && formData.minute && formData.ampm
                      ? `${formData.hour}:${formData.minute.padStart(
                          2,
                          "0",
                        )} ${formData.ampm}`
                      : "Select time"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 rounded-md border bg-popover shadow-md"
                  align="start"
                >
                  <div className="flex rounded-md overflow-hidden">
                    {/* Hour Column */}
                    <div className="border-r border-border">
                      <div className="px-3 py-2 text-sm font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        Hour
                      </div>
                      <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                        {HOURS.map((hour) => {
                          const isOccupied = !!(
                            formData.minute &&
                            formData.ampm &&
                            isTimeOccupied(
                              hour.toString(),
                              formData.minute,
                              formData.ampm,
                            )
                          );
                          return (
                            <button
                              key={hour}
                              onClick={() =>
                                !isOccupied &&
                                handleTimeChange("hour", hour.toString())
                              }
                              disabled={isOccupied}
                              className={`w-2/3 px-4 py-2 text-sm transition-colors focus:outline-none ${
                                formData.hour === hour.toString()
                                  ? "bg-accent-blue text-white rounded-md"
                                  : isOccupied
                                  ? "text-gray-400 cursor-not-allowed opacity-50"
                                  : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                            >
                              {hour}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Minute Column */}
                    <div className="border-r border-border">
                      <div className="px-3 py-2 text-sm font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        Min
                      </div>
                      <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                        {MINUTES.map((minute) => {
                          const isOccupied = !!(
                            formData.hour &&
                            formData.ampm &&
                            isTimeOccupied(
                              formData.hour,
                              minute.toString(),
                              formData.ampm,
                            )
                          );
                          return (
                            <button
                              key={minute}
                              onClick={() =>
                                !isOccupied &&
                                handleTimeChange("minute", minute.toString())
                              }
                              disabled={isOccupied}
                              className={`w-2/3 py-2 text-sm transition-colors focus:outline-none ${
                                formData.minute === minute.toString()
                                  ? "bg-accent-blue text-white rounded-md"
                                  : isOccupied
                                  ? "text-gray-400 cursor-not-allowed opacity-50"
                                  : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                            >
                              {minute.toString().padStart(2, "0")}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* AM/PM Column */}
                    <div>
                      <div className="px-3 py-2 text-sm font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        AM/PM
                      </div>
                      <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                        {AMPM_OPTIONS.map((ampm) => {
                          const isOccupied = !!(
                            formData.hour &&
                            formData.minute &&
                            isTimeOccupied(
                              formData.hour,
                              formData.minute,
                              ampm,
                            )
                          );
                          return (
                            <button
                              key={ampm}
                              onClick={() =>
                                !isOccupied && handleTimeChange("ampm", ampm)
                              }
                              disabled={isOccupied}
                              className={`w-2/3 px-4 py-2 text-sm transition-colors focus:outline-none ${
                                formData.ampm === ampm
                                  ? "bg-accent-blue text-white rounded-md"
                                  : isOccupied
                                  ? "text-gray-400 cursor-not-allowed opacity-50"
                                  : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              }`}
                            >
                              {ampm}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTimePickerOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setTimePickerOpen(false)}
                    >
                      OK
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {errors.time && (
                <p className="text-sm text-red-500 mt-1">
                  This field is required
                </p>
              )}
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) =>
                  handleInputChange("timezone", value)
                }
                disabled={!formData.clientId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">
                Duration <span className="text-red-500">*</span>
              </Label>
              <Popover
                open={durationPickerOpen}
                onOpenChange={setDurationPickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!formData.clientId}
                    className={`w-full justify-start text-left font-normal ${
                      errors.duration ? "border-red-500" : ""
                    }`}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {formData.duration
                      ? formData.duration
                      : "Select duration"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 rounded-md border bg-popover shadow-md"
                  align="start"
                >
                  <div className="flex rounded-md overflow-hidden">
                    {/* Hour Column */}
                    <div className="border-r border-border">
                      <div className="px-3 py-2 text-sm font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        Hour
                      </div>
                      <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                        {DURATION_HOURS.map((hour) => (
                          <button
                            key={hour}
                            onClick={() =>
                              handleDurationChange("hour", hour.toString())
                            }
                            className={`w-2/3 px-4 py-2 text-sm transition-colors focus:outline-none ${
                              durationHour === hour.toString()
                                ? "bg-accent-blue text-white rounded-md"
                                : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                            }`}
                          >
                            {hour}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Minute Column */}
                    <div>
                      <div className="px-3 py-2 text-sm font-medium text-center border-b border-border bg-muted/50 text-muted-foreground">
                        Min
                      </div>
                      <div className="max-h-60 overflow-y-auto w-28 flex flex-col items-center">
                        {DURATION_MINUTES.map((minute) => (
                          <button
                            key={minute}
                            onClick={() =>
                              handleDurationChange(
                                "minute",
                                minute.toString(),
                              )
                            }
                            className={`w-2/3 py-2 text-sm transition-colors focus:outline-none ${
                              durationMinute === minute.toString()
                                ? "bg-accent-blue text-white rounded-md"
                                : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                            }`}
                          >
                            {minute.toString().padStart(2, "0")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDurationPickerOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setDurationPickerOpen(false)}
                    >
                      OK
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {errors.duration && (
                <p className="text-sm text-red-500 mt-1">
                  This field is required
                </p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>
                Location <span className="text-red-500">*</span>
              </Label>
              {errors.format && (
                <p className="text-sm text-red-500">This field is required</p>
              )}
              <div className="flex space-x-2">
                {FORMATS.map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => handleInputChange("format", format)}
                    disabled={!formData.clientId}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors dark:bg-gray-800 ${
                      !formData.clientId
                        ? "opacity-50 cursor-not-allowed bg-gray-100"
                        : formData.format === format
                        ? "border-primary bg-primary text-white"
                        : errors.format
                        ? "border-red-500 hover:bg-gray-50"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {format === "Virtual" ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    <span>{format}</span>
                  </button>
                ))}
              </div>

              {/* Platform selection for Virtual */}
              {formData.format === "Virtual" && (
                <div className="mt-3">
                  <Label htmlFor="platform">
                    Select Platform <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value) =>
                      handleInputChange("platform", value)
                    }
                    disabled={!formData.clientId}
                  >
                    <SelectTrigger
                      className={errors.platform ? "border-red-500" : ""}
                    >
                      <SelectValue>
                        {formData.platform || "Select platform..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((platform) => (
                        <SelectItem
                          key={platform.value}
                          value={platform.value}
                        >
                          {platform.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.platform && (
                    <p className="text-sm text-red-500 mt-1">
                      This field is required
                    </p>
                  )}

                  {/* Custom Platform Input */}
                  {formData.platform === "Other" && (
                    <div className="mt-3">
                      <Label htmlFor="customPlatform">
                        Custom Platform{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customPlatform"
                        type="text"
                        value={formData.customPlatform}
                        onChange={(e) =>
                          handleInputChange("customPlatform", e.target.value)
                        }
                        placeholder="Enter platform name..."
                        disabled={!formData.clientId}
                        className={
                          errors.customPlatform ? "border-red-500" : ""
                        }
                      />
                      {errors.customPlatform && (
                        <p className="text-sm text-red-500 mt-1">
                          This field is required
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Meeting URL for Virtual */}
            {formData.format === "Virtual" && (
              <div className="space-y-2">
                <Label htmlFor="meetingUrl">Meeting URL (optional)</Label>
                <Input
                  id="meetingUrl"
                  icon={<Link className="h-4 w-4" />}
                  type="text"
                  value={formData.meetingUrl}
                  onChange={(e) =>
                    handleInputChange("meetingUrl", e.target.value)
                  }
                  placeholder="Enter meeting URL..."
                  disabled={!formData.clientId}
                />
              </div>
            )}

            {/* Location for In-Person */}
            {formData.format === "In-Person" && (
              <div className="space-y-2">
                <Label>
                  Location <span className="text-red-500">*</span>
                </Label>
                <AddressSearch
                  value={formData.address}
                  onChange={(address) =>
                    handleInputChange("address", address)
                  }
                  onLocationSelect={handleLocationSelect}
                  disabled={!formData.clientId}
                />
                {errors.address && (
                  <p className="text-sm text-red-500">
                    This field is required
                  </p>
                )}
                {formData.address && (
                  <div className="text-sm text-muted-foreground">
                    {formData.address}, {formData.city}, {formData.state}{" "}
                    {formData.zip}
                  </div>
                )}
              </div>
            )}

            {/* RSVP URL */}
            <div className="space-y-2">
              <Label htmlFor="meetingLink">
                RSVP URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="meetingLink"
                icon={<Link className="h-4 w-4" />}
                type="text"
                value={formData.meetingLink}
                onChange={(e) =>
                  handleInputChange("meetingLink", e.target.value)
                }
                placeholder="Enter RSVP URL..."
                disabled={!formData.clientId}
                className={errors.meetingLink ? "border-red-500" : ""}
              />
              {errors.meetingLink && (
                <p className="text-sm text-red-500 mt-1">
                  Enter an RSVP URL. For virtual meetings you can paste the link in Meeting URL
                  above instead.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90 dark:bg-accent-blue dark:text-white dark:hover:bg-accent-blue/90"
                disabled={isSubmitting || !formData.clientId}
              >
                {isSubmitting
                  ? editingMeetingId
                    ? "Updating Meeting..."
                    : "Adding Meeting..."
                  : editingMeetingId
                  ? "Update Meeting"
                  : "Add Meeting"}
              </Button>
            </div>
            <Dialog open={openModel} onOpenChange={setOpenModel}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogDescription className="mt-2 text-base">
                    Save this meeting type for future use?
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSubmitDialod()}
                  >
                    NO
                  </Button>
                  <Button
                    onClick={() => {
                      handleSubmitDialod(true);
                    }}
                  >
                    YES
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={openDeleteModel} onOpenChange={setOpenDeleteModel}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogDescription className="mt-2 text-base">
                    {`Are you sure you want to delete ${valueCustomName}? This action cannot be
                    undone.`}
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpenDeleteModel(false)}
                  >
                    NO
                  </Button>
                  <Button
                    onClick={() => {
                      deleteCustomMeeting(typeId);
                      saveDebugMeeting(savedMeetingForm);

                      setOpenDeleteModel(false);
                    }}
                  >
                    YES
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </form>
        </DialogContent>
      </Dialog>

      {/* Post-Save Duplicate Dialog */}
      <Dialog open={postSaveDialogOpen} onOpenChange={setPostSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Meeting Created!</DialogTitle>
            <DialogDescription>
              What would you like to do next?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-3"
              onClick={() => {
                const newLang = formData.language === "Spanish" ? "English" : "Spanish";
                setFormData((prev) => ({ ...prev, language: newLang, date: "", time: "", hour: "", minute: "", ampm: "" }));
                setPostSaveDialogOpen(false);
              }}
            >
              <Languages className="h-4 w-4" />
              <div className="text-left">
                <div className="text-sm font-medium">Duplicate for Another Language</div>
                <div className="text-xs text-muted-foreground">
                  {formData.language === "Spanish" ? "Create an English version" : "Create a Spanish version"}
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-3"
              onClick={() => {
                setFormData((prev) => ({ ...prev, date: "", time: "", hour: "", minute: "", ampm: "" }));
                setPostSaveDialogOpen(false);
              }}
            >
              <MapPin className="h-4 w-4" />
              <div className="text-left">
                <div className="text-sm font-medium">Duplicate for Another Location</div>
                <div className="text-xs text-muted-foreground">Change the location/format</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-3"
              onClick={() => {
                setFormData((prev) => ({ ...prev, benefitsCategory: "", customBenefitsCategory: "", date: "", time: "", hour: "", minute: "", ampm: "" }));
                setPostSaveDialogOpen(false);
              }}
            >
              <CalendarDays className="h-4 w-4" />
              <div className="text-left">
                <div className="text-sm font-medium">Duplicate for Another Benefit</div>
                <div className="text-xs text-muted-foreground">Change the benefits category</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-3"
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  date: "",
                  time: "",
                  hour: "",
                  minute: "",
                  ampm: "",
                  duration: "",
                  address: "",
                  city: "",
                  state: "",
                  zip: "",
                }));
                setDurationHour("0");
                setDurationMinute("0");
                setPostSaveDialogOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              <div className="text-left">
                <div className="text-sm font-medium">Add Another Meeting</div>
                <div className="text-xs text-muted-foreground">Clear date/time to schedule a new one</div>
              </div>
            </Button>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setFormData({
                  meetingType: formData.meetingType,
                  customMeetingType: "",
                  client: formData.client,
                  clientId: formData.clientId,
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
                  description: "",
                  address: "",
                  city: "",
                  state: "",
                  zip: "",
                  language: "",
                  benefitsCategory: "",
                  customBenefitsCategory: "",
                });
                setDurationHour("0");
                setDurationMinute("0");
                setErrors({});
                setTimeConflictWarning("");
                setHasConfirmedConflict(false);
                setEditingMeetingId(null);
                setMeetingModalOpen(false);
                setPostSaveDialogOpen(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NavigateAwayWarningDialog
        open={leaveGuard.dialogOpen}
        isSaving={leaveGuard.isSaving}
        isDiscarding={leaveGuard.isDiscarding}
        onStay={leaveGuard.stayAndKeepEditing}
        onSaveAndExit={leaveGuard.saveAndExit}
        onDiscardWithoutSaving={leaveGuard.discardWithoutSaving}
        onDialogOpenChange={leaveGuard.dialogOnOpenChange}
        onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose}
      />
    </div>
  );
}
