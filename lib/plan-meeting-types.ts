export const PLAN_MEETING_TYPES = [
  "Open Enrollment",
  "Webinar",
  "1:1",
  "General",
] as const;

export type PlanMeetingType = (typeof PLAN_MEETING_TYPES)[number];

export function isPlanMeetingType(v: string): v is PlanMeetingType {
  return (PLAN_MEETING_TYPES as readonly string[]).includes(v);
}

export const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (US)" },
  { value: "America/Chicago", label: "Central (US)" },
  { value: "America/Denver", label: "Mountain (US)" },
  { value: "America/Los_Angeles", label: "Pacific (US)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "UTC", label: "UTC" },
] as const;
