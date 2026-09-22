import {
  Bell,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Plus,
  Settings,
  Upload,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

/** A single KPI tile rendered by the `QuickInsights` component. */
export interface QuickInsight {
  /** Stable identity for keying/rendering. */
  id: string;
  title: string;
  /** Placeholder shown before live data arrives. Omit for tiles driven by `statsKey`. */
  value?: number;
  /** Supporting line shown beneath the title. */
  hint?: string;
  icon: LucideIcon;
  /** Tailwind text-colour class for the icon accent. */
  color: string;
  /**
   * Field on `/api/dashboard/stats` (`data[statsKey]`) that supplies `value`.
   * Omit while a metric has no backing query yet — the tile then keeps its placeholder value.
   */
  statsKey?: "activePlans" | "meetingsThisWeek" | "needsAttention";
}

export interface QuickAction {
  icon: any;
  label: string;
  href: string;
  description: string;
}

export const quickInsights: QuickInsight[] = [
  {
    id: "active-plans",
    title: "Active Plans",
    hint: "Currently published",
    icon: TrendingUp,
    color: "text-accent-blue",
    statsKey: "activePlans",
  },
  {
    id: "needs-attention",
    title: "Needs Attention",
    hint: "Incomplete or unclassified",
    icon: AlertTriangle,
    color: "text-[#FF6900]",
    statsKey: "needsAttention",
  },
  {
    id: "meetings-this-week",
    title: "Meetings this Week",
    hint: "Sunday to Saturday",
    icon: Calendar,
    color: "text-[#155DFC]",
    statsKey: "meetingsThisWeek",
  },
  {
    // Metric not chosen yet — no statsKey means the tile shows this placeholder.
    id: "kpi-4",
    title: "KPI 4",
    value: 0,
    hint: "Metric to be defined",
    icon: Bell,
    color: "text-[#4A5565]",
  },
];

export const quickActions: QuickAction[] = [
  {
    icon: Plus,
    label: "Create Plan",
    href: "/new-client",
    description: "Set up a new branded benefits hub",
  },
  {
    icon: Settings,
    label: "View Plans",
    href: "/clients",
    description: "Update & manage clients & prospects",
  },
  {
    icon: Calendar,
    label: "Create Meeting/Event",
    href: "/communications/meetings",
    description: "Schedule webinars & sessions",
  },
  {
    icon: Upload,
    label: "Upload Documents",
    href: "/documents",
    description: "Add compliance docs",
  },
  {
    icon: Megaphone,
    label: "Marketing",
    href: "/communications/marketing",
    description: "Create flyers & announcements",
  },
];

export const userInfo = {
  name: "Alicia",
  title: "Senior Financial Advisor",
  avatar: "",
  rawAvatar: "",
  logo: "/logo-2.png",
};
