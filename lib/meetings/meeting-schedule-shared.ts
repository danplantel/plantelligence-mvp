/** Shared with /communications/meetings and plan-scoped edit-client form. */

export interface MeetingScheduleFormData {
  meetingType: string;
  customMeetingType: string;
  client: string;
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
  displayOnPortal: boolean;
  replayUrl: string;
}

export const FORMATS = ["Virtual", "In-Person"] as const;

export const PLATFORMS = [
  { value: "Zoom", label: "Zoom" },
  { value: "Teams", label: "Teams" },
  { value: "Google Meet", label: "Google Meet" },
  { value: "Phone", label: "Phone" },
  { value: "Other", label: "Other" },
] as const;

export const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
export const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
export const AMPM_OPTIONS = ["AM", "PM"] as const;

export const DURATION_HOURS = Array.from({ length: 9 }, (_, i) => i);
export const DURATION_MINUTES = Array.from({ length: 61 }, (_, i) => i);

export function parseLocalDate(dateStr: string): Date {
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

export function getTimezoneAbbr(timezone: string): string {
  const tzMap: Record<string, string> = {
    "America/New_York": "ET",
    "America/Chicago": "CT",
    "America/Denver": "MT",
    "America/Los_Angeles": "PT",
    "America/Phoenix": "MT",
    "America/Anchorage": "AT",
    "Pacific/Honolulu": "HT",
    "UTC": "UTC",
  };
  return tzMap[timezone] || timezone.split("/")[1] || timezone;
}

/** Same list as `app/(dashboard)/communications/meetings/page.tsx` */
export const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Europe/Berlin", label: "Central European Time (CET)" },
  { value: "Europe/Rome", label: "Central European Time (CET)" },
  { value: "Europe/Madrid", label: "Central European Time (CET)" },
  { value: "Europe/Amsterdam", label: "Central European Time (CET)" },
  { value: "Europe/Zurich", label: "Central European Time (CET)" },
  { value: "Europe/Vienna", label: "Central European Time (CET)" },
  { value: "Europe/Stockholm", label: "Central European Time (CET)" },
  { value: "Europe/Oslo", label: "Central European Time (CET)" },
  { value: "Europe/Copenhagen", label: "Central European Time (CET)" },
  { value: "Europe/Helsinki", label: "Eastern European Time (EET)" },
  { value: "Europe/Warsaw", label: "Central European Time (CET)" },
  { value: "Europe/Prague", label: "Central European Time (CET)" },
  { value: "Europe/Budapest", label: "Central European Time (CET)" },
  { value: "Europe/Athens", label: "Eastern European Time (EET)" },
  { value: "Europe/Istanbul", label: "Turkey Time (TRT)" },
  { value: "Europe/Moscow", label: "Moscow Time (MSK)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time (HKT)" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "Asia/Seoul", label: "Korea Standard Time (KST)" },
  { value: "Asia/Taipei", label: "Taiwan Time (CST)" },
  { value: "Asia/Bangkok", label: "Indochina Time (ICT)" },
  { value: "Asia/Jakarta", label: "Western Indonesia Time (WIB)" },
  { value: "Asia/Manila", label: "Philippine Time (PHT)" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)" },
  { value: "Asia/Tehran", label: "Iran Standard Time (IRST)" },
  { value: "Asia/Karachi", label: "Pakistan Standard Time (PKT)" },
  { value: "Asia/Dhaka", label: "Bangladesh Standard Time (BST)" },
  { value: "Asia/Kathmandu", label: "Nepal Time (NPT)" },
  { value: "Asia/Colombo", label: "Sri Lanka Standard Time (SLST)" },
  { value: "Asia/Riyadh", label: "Arabia Standard Time (AST)" },
  { value: "Asia/Jerusalem", label: "Israel Standard Time (IST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AEST)" },
  { value: "Australia/Melbourne", label: "Australian Eastern Time (AEST)" },
  { value: "Australia/Brisbane", label: "Australian Eastern Time (AEST)" },
  { value: "Australia/Perth", label: "Australian Western Time (AWST)" },
  { value: "Australia/Adelaide", label: "Australian Central Time (ACST)" },
  { value: "Australia/Darwin", label: "Australian Central Time (ACST)" },
  { value: "Pacific/Auckland", label: "New Zealand Time (NZST)" },
  { value: "Pacific/Fiji", label: "Fiji Time (FJT)" },
  { value: "America/Sao_Paulo", label: "Brasilia Time (BRT)" },
  { value: "America/Buenos_Aires", label: "Argentina Time (ART)" },
  { value: "America/Lima", label: "Peru Time (PET)" },
  { value: "America/Bogota", label: "Colombia Time (COT)" },
  { value: "America/Santiago", label: "Chile Time (CLT)" },
  { value: "America/Caracas", label: "Venezuela Time (VET)" },
  { value: "Africa/Cairo", label: "Eastern European Time (EET)" },
  { value: "Africa/Johannesburg", label: "South Africa Time (SAST)" },
  { value: "Africa/Lagos", label: "West Africa Time (WAT)" },
  { value: "Africa/Nairobi", label: "East Africa Time (EAT)" },
  { value: "Africa/Casablanca", label: "Western European Time (WET)" },
  { value: "Africa/Tunis", label: "Central European Time (CET)" },
  { value: "Africa/Algiers", label: "Central European Time (CET)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "GMT", label: "Greenwich Mean Time (GMT)" },
];

export function parseDurationPickers(duration: string): {
  hour: string;
  minute: string;
} {
  let h = "0";
  let m = "0";
  const hourMatch = duration.match(/(\d+)\s*hours?/i);
  const minMatch = duration.match(/(\d+)\s*minutes?/i);
  if (hourMatch) h = hourMatch[1];
  if (minMatch) m = minMatch[1];
  return { hour: h, minute: m };
}

export const defaultMeetingScheduleForm = (
  companyName: string,
): MeetingScheduleFormData => ({
  meetingType: "Open Enrollment",
  customMeetingType: "",
  client: companyName,
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
  description:
    "Learn about upcoming plan options, updates, and key dates so you can make informed choices for the year ahead.",
  address: "",
  city: "",
  state: "",
  zip: "",
  displayOnPortal: true,
  replayUrl: "",
});

/**
 * RSVP / registration URL: prefer the dedicated RSVP field; fall back to the optional
 * virtual Meeting URL so users who paste a Zoom/Teams link there still pass validation
 * and persist a single link for the portal.
 */
export function resolveRsvpUrl(
  formData: Pick<MeetingScheduleFormData, "meetingLink" | "meetingUrl">,
): string {
  const primary = (formData.meetingLink ?? "").trim();
  const fallback = (formData.meetingUrl ?? "").trim();
  return primary || fallback;
}

export function validateMeetingScheduleForm(
  formData: MeetingScheduleFormData,
  options: { requireClient: boolean },
): Record<string, boolean> {
  const newErrors: Record<string, boolean> = {};

  if (!formData.meetingType) newErrors.meetingType = true;
  if (
    formData.meetingType === "Custom" &&
    !formData.customMeetingType.trim()
  ) {
    newErrors.customMeetingType = true;
  }
  if (options.requireClient && !formData.client) newErrors.client = true;
  if (!formData.date) newErrors.date = true;
  if (!formData.time) newErrors.time = true;
  if (!formData.duration) newErrors.duration = true;
  if (!formData.format) newErrors.format = true;

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

  if (!resolveRsvpUrl(formData)) {
    newErrors.meetingLink = true;
  }

  return newErrors;
}

export function resolveMeetingTypeToSend(formData: MeetingScheduleFormData) {
  return formData.meetingType === "Custom"
    ? formData.customMeetingType.trim()
    : formData.meetingType;
}

export function buildHubLocationFromForm(formData: MeetingScheduleFormData) {
  if (formData.format === "In-Person") {
    return [formData.address, formData.city, formData.state, formData.zip]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(", ");
  }
  const v = (formData.meetingUrl || formData.meetingLink || "").trim();
  return v || "Virtual";
}

export function resolvePlatformForDb(formData: MeetingScheduleFormData) {
  if (formData.format !== "Virtual") return null;
  if (formData.platform === "Other" && formData.customPlatform.trim()) {
    return formData.customPlatform.trim();
  }
  return formData.platform || null;
}
