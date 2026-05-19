"use client";

import { OnboardingWizard } from "@/components/wizard/wizard";
import { useWizardInit } from "@/hooks/useWizardInit";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { useEffect, useState } from "react";
import {
  Step1UserProfile,
  Step2Services,
  Step3Branding,
  Step4UserSetup,
  Step5Summary,
} from "@/components/wizard/steps";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { hasUnsavedOnboardingWork } from "@/lib/onboarding-wizard-dirty";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";

export default function OnboardingPage() {
  const { isInitialized } = useWizardInit();
  const { setTitle } = usePageTitleContext();
  const { data: session } = useSession();
  const router = useRouter();
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isStep5Valid, setIsStep5Valid] = useState(false);
  const saveSummaryData = useOnboardingWizardStore((s) => s.saveSummaryData);
  const hasUnsavedChanges = useOnboardingWizardStore((s) =>
    hasUnsavedOnboardingWork({
      currentStep: s.currentStep,
      isCompleted: s.isCompleted,
      stepData: s.stepData,
    }),
  );
  const leaveGuard = useNavigateAwayGuard({
    enabled: isInitialized && !isCheckingStatus,
    hasUnsavedChanges,
    onSaveAndExit: async () => {
      const stepData = useOnboardingWizardStore.getState().stepData;
      await saveSummaryData(stepData);
    },
  });

  const handleStep5Validation = (isValid: boolean) => {
    setIsStep5Valid(isValid);
  };

  useEffect(() => {
    setTitle("New User Onboarding");
  }, [setTitle]);

  useEffect(() => {
    const checkStatus = async () => {
      if (session?.user?.id) {
        try {
          const res = await fetch("/api/onboarding-wizard/onboarding-status");
          if (res.ok) {
            const json = await res.json();
            if (json.completed) {
              router.push("/new/dashboard");
              return;
            }
          } else {
            console.error("Failed to fetch onboarding status");
          }
        } catch (error) {
          console.error("Error checking onboarding status:", error);
        }
      }
      setIsCheckingStatus(false);
    };

    checkStatus();
  }, [session, router]);

  if (!isInitialized || isCheckingStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background">
      <OnboardingWizard isStep5Valid={isStep5Valid}>
        <WizardContent onValidationChange={handleStep5Validation} />
      </OnboardingWizard>
      <NavigateAwayWarningDialog
        open={leaveGuard.dialogOpen}
        isSaving={leaveGuard.isSaving}
        onStay={leaveGuard.stayAndKeepEditing}
        onSaveAndExit={leaveGuard.saveAndExit}
        onDiscardWithoutSaving={leaveGuard.discardWithoutSaving}
        onDialogOpenChange={leaveGuard.dialogOnOpenChange}
        onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose}
      />
    </div>
  );
}

function WizardContent({
  onValidationChange,
}: {
  onValidationChange: (isValid: boolean) => void;
}) {
  const { currentStep, errorFields } = useOnboardingWizardStore();

  switch (currentStep) {
    case 1:
      return <Step1UserProfile errorFields={errorFields} />;
    case 2:
      return <Step2Services errorFields={errorFields} />;
    case 3:
      return <Step3Branding errorFields={errorFields} />;
    case 4:
      return <Step4UserSetup errorFields={errorFields} />;
    case 5:
      return (
        <Step5Summary
          errorFields={errorFields}
          onValidationChange={onValidationChange}
        />
      );
    default:
      return <Step1UserProfile errorFields={errorFields} />;
  }
}
