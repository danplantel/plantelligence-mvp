import Header from "@/components/pages/view-video/Header";
import { OnboardingGuard } from "@/components/guards/onboarding-guard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "View | PlanTelligence",
  description: "View on PlanTelligence.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <Header />
      <div className="flex h-screen bg-[#fbfbfb] dark:bg-[#121212]">
        {/* <Sidebar /> */}
        <main className="w-full pt-16">{children}</main>
      </div>
    </OnboardingGuard>
  );
}
