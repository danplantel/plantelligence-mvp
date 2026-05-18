import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { OnboardingGuard } from "@/components/guards/onboarding-guard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Content Library | PlanTelligence",
  description: "Content Library",
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
        <Sidebar />
        <main
          className="flex-1 pt-16 overflow-y-auto transition-all duration-200 ease-in-out"
          style={{
            marginLeft: "var(--sidebar-width, 18rem)",
          }}
        >
          {children}
        </main>
      </div>
    </OnboardingGuard>
  );
}
