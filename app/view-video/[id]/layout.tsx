import Header from "@/components/pages/view-video/Header";
import { OnboardingGuard } from "@/components/guards/onboarding-guard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "View | PlanTelligence",
  description: "View PlanTelligence video.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <Header />
      <div className="flex h-screen overflow-hidden">
        {/* <Sidebar /> */}
        <main className="w-full pt-16">{children}</main>
      </div>
    </OnboardingGuard>
  );
}
