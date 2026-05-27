"use client";

import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/new-sidebar";
import { OnboardingGuard } from "@/components/guards/onboarding-guard";
import { OnboardingPageGuard } from "@/components/guards/onboarding-page-guard";
import { usePathname } from "next/navigation";

interface NewLayoutClientProps {
  children: React.ReactNode;
}

export function NewLayoutClient({ children }: NewLayoutClientProps) {
  const pathname = usePathname();

  // If it's onboarding page, use special guard
  if (pathname.includes("/onboarding")) {
    return <OnboardingPageGuard>{children}</OnboardingPageGuard>;
  }

  // If it's view page, don't show header/sidebar
  if (pathname.includes("/view/")) {
    return <>{children}</>;
  }

  return (
    <OnboardingGuard>
      <Header />
      <div className="flex bg-background">
        <Sidebar />
        <main
          className="flex-1 pt-16 overflow-y-auto transition-all duration-200 ease-in-out bg-background"
          style={{
            marginLeft: "var(--sidebar-width, 16rem)",
          }}
        >
          {children}
        </main>
      </div>
    </OnboardingGuard>
  );
}
