"use client";

import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/new-sidebar";
import { OnboardingGuard } from "@/components/guards/onboarding-guard";
import { OnboardingPageGuard } from "@/components/guards/onboarding-page-guard";
import { usePathname } from "next/navigation";
import { WizardStepper } from "@/components/wizard/wizard-stepper";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

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

  // Determine which wizard page we're on to show the correct stepper in header
  const isNewClientPage = pathname === "/new/new-client";
  const isBenefitsPage = pathname === "/new/benefits";

  // Read new-client wizard state for the step title shown next to the page title
  const newClientSteps = useNewClientWizardStore((s) => s.steps);
  const newClientCurrentStep = useNewClientWizardStore((s) => s.currentStep);

  // Read benefits wizard state
  const benefitsSteps = useBenefitsWizardStore((s) => s.steps);
  const benefitsCurrentStep = useBenefitsWizardStore((s) => s.currentStep);
  const benefitsTotalSteps = useBenefitsWizardStore((s) => s.totalSteps);

  const stepTitle = isNewClientPage
    ? newClientSteps.find((s) => s.id === newClientCurrentStep)?.title ?? ""
    : isBenefitsPage
      ? benefitsSteps.find((s) => s.id === benefitsCurrentStep)?.title ?? ""
      : undefined;

  const stepperElement = isNewClientPage ? (
    <WizardStepper />
  ) : isBenefitsPage ? (
    <WizardStepper
      steps={benefitsSteps}
      currentStep={benefitsCurrentStep}
      totalSteps={benefitsTotalSteps}
    />
  ) : undefined;

  const isWizardPage = isNewClientPage || isBenefitsPage;

  return (
    <OnboardingGuard>
      <Header
        stepper={stepperElement}
        stepTitle={stepTitle}
      />
      <div className="flex bg-background">
        <Sidebar />
        <main
          className={`flex-1 ${isWizardPage ? "pt-[72px]" : "pt-16"} overflow-y-auto duration-200 ease-in-out bg-background`}
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
