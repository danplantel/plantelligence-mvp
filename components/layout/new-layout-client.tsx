"use client";

import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/new-sidebar";
import { OnboardingGuard } from "@/components/guards/onboarding-guard";
import { OnboardingPageGuard } from "@/components/guards/onboarding-page-guard";
import { usePathname } from "next/navigation";
import { WizardStepper } from "@/components/wizard/wizard-stepper";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";

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

  // Determine if we're on the new client wizard page to show stepper in header
  const isNewClientPage = pathname === "/new/new-client";

  // Read wizard state for the step title shown next to the page title
  const storeSteps = useNewClientWizardStore((s) => s.steps);
  const storeCurrentStep = useNewClientWizardStore((s) => s.currentStep);
  const stepTitle = isNewClientPage
    ? storeSteps.find((s) => s.id === storeCurrentStep)?.title ?? ""
    : undefined;

  return (
    <OnboardingGuard>
      <Header
        stepper={
          isNewClientPage ? (
            <WizardStepper />
          ) : undefined
        }
        stepTitle={stepTitle}
      />
      <div className="flex bg-background">
        <Sidebar />
        <main
          className={`flex-1 ${isNewClientPage ? "pt-[72px]" : "pt-16"} overflow-y-auto transition-all duration-200 ease-in-out bg-background`}
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
