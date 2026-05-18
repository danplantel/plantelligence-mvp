import Header from "@/components/pages/view-video/Header";
import { OnboardingGuard } from "@/components/guards/onboarding-guard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "View | PlanTelligence",
  description: "PlanTelligence dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <div className="flex h-screen overflow-hidden">
        <main className="w-full">{children}</main>
      </div>
    </OnboardingGuard>
  );
}
