import {
  Bell,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Plus,
  Settings,
  Upload,
  Megaphone,
} from "lucide-react";

export interface DemoStat {
  title: string;
  value: number;
  icon: any;
  color: string;
}

export interface QuickAction {
  icon: any;
  label: string;
  href: string;
  description: string;
}

export const demoStats: DemoStat[] = [
  {
    title: "Active Plans",
    value: 24,
    icon: TrendingUp,
    color: "text-accent-blue",
  },
  {
    title: "Upcoming Meetings",
    value: 3,
    icon: Calendar,
    color: "text-[#155DFC]",
  },
  {
    title: "Docs Expiring Soon",
    value: 5,
    icon: AlertTriangle,
    color: "text-[#FF6900]",
  },
  {
    title: "Notifications",
    value: 2,
    icon: Bell,
    color: "text-[#4A5565]",
  },
];

export const quickActions: QuickAction[] = [
  {
    icon: Plus,
    label: "Create Plan",
    href: "/new/new-client",
    description: "Set up a new branded benefits hub",
  },
  {
    icon: Settings,
    label: "View Plans",
    href: "/new/clients",
    description: "Update & manage clients & prospects",
  },
  {
    icon: Calendar,
    label: "Create Meeting/Event",
    href: "/new/communications",
    description: "Schedule webinars & sessions",
  },
  {
    icon: Upload,
    label: "Upload Documents",
    href: "#",
    description: "Add compliance docs",
  },
  {
    icon: Megaphone,
    label: "Marketing",
    href: "#",
    description: "Create flyers & announcements",
  },
];

export const userInfo = {
  name: "Alicia",
  title: "Senior Financial Advisor",
  avatar: "",
  logo: "/logo-2.png",
};
