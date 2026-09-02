import { NewLayoutClient } from "@/components/layout/layout-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PlanTelligence",
  description: "PlanTelligence Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NewLayoutClient>{children}</NewLayoutClient>;
}
