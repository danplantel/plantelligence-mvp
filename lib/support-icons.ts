import { Headset, Phone, Users, type LucideIcon } from "lucide-react";

/**
 * Selectable badge icons for Team / Support Line contacts.
 *
 * A Team/Support Line has no headshot, so its card shows an icon in the circular
 * badge slot. Advisors choose which icon it is from the contact form; the value
 * is persisted per contact as `supportIcon`.
 */
export type SupportIconId = "headset" | "users" | "phone";

export interface SupportIconOption {
  id: SupportIconId;
  /** Short label shown under the icon in the picker. */
  label: string;
  /** Tooltip / helper copy describing the icon. */
  description: string;
  Icon: LucideIcon;
}

/** The headset icon is the default (matches the original card design). */
export const DEFAULT_SUPPORT_ICON: SupportIconId = "headset";

export const SUPPORT_ICON_OPTIONS: SupportIconOption[] = [
  {
    id: "headset",
    label: "Support Headset",
    description: "The default support-line icon",
    Icon: Headset,
  },
  {
    id: "users",
    label: "Team",
    description: "A profile icon showing multiple people",
    Icon: Users,
  },
  {
    id: "phone",
    label: "Phone",
    description: "A phone icon for call-based support",
    Icon: Phone,
  },
];

/** Coerce any stored value into a valid icon id (defaults to the headset). */
export function normalizeSupportIconId(value: unknown): SupportIconId {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v === "users" || v === "phone" || v === "headset"
    ? (v as SupportIconId)
    : DEFAULT_SUPPORT_ICON;
}

/** Resolve the icon component to render for a contact's stored `supportIcon`. */
export function getSupportIcon(value: unknown): LucideIcon {
  const id = normalizeSupportIconId(value);
  return SUPPORT_ICON_OPTIONS.find((option) => option.id === id)?.Icon ?? Headset;
}
