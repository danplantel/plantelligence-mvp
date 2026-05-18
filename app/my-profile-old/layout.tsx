// app/dashboard/layout.tsx
"use client";

import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { OnboardingGuard } from "@/components/guards/onboarding-guard";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize the CSS variable on first render
  useEffect(() => {
    // Default to open sidebar width
    if (!document.documentElement.style.getPropertyValue("--sidebar-width")) {
      document.documentElement.style.setProperty("--sidebar-width", "18rem");
    }
  }, []);

  return (
    <OnboardingGuard>
      <div className="relative flex flex-col h-screen overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main
            className="flex-1 pt-16 overflow-y-auto transition-all duration-200 ease-in-out"
            style={{
              marginLeft: "var(--sidebar-width)",
              width: "calc(100% - var(--sidebar-width))",
            }}
          >
            <div className="p-4">{children}</div>
          </main>
        </div>
      </div>
    </OnboardingGuard>
  );
}
