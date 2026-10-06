"use client";

import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { usePathname } from "next/navigation";
import { WizardStepper } from "@/components/wizard/wizard-stepper";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { SWRConfig } from "swr";
import { NoAccessNotice } from "@/components/pages/no-access-notice";
import {
  useViewerAccess,
  VIEWER_ACCESS_KEY,
  type ViewerAccessData,
} from "@/hooks/useViewerAccess";
import { mayUsePath } from "@/lib/teammates/nav-access";

interface NewLayoutClientProps {
  children: React.ReactNode;
  /**
   * The server-resolved access summary (see `app/(dashboard)/layout.tsx`). It seeds the
   * client read, so the nav and the guard are correct on the FIRST paint instead of
   * correcting themselves a frame later.
   */
  viewerAccess: ViewerAccessData;
}

export function NewLayoutClient({
  children,
  viewerAccess,
}: NewLayoutClientProps) {
  const pathname = usePathname();
  // Chrome-level access for the guard below. This hook runs OUTSIDE the SWRConfig this
  // component renders, so it takes the server value directly; everything deeper in the
  // tree (the sidebar, Settings) reads the same value from that provider's `fallback`.
  const { isCollaborator, can } = useViewerAccess(viewerAccess);

  // If it's onboarding page, render without header/sidebar (the onboarding
  // gate is handled server-side by middleware, not by a client guard).
  if (pathname.includes("/onboarding")) {
    return <>{children}</>;
  }

  // Auth pages render standalone (no header/sidebar)
  if (
    pathname.startsWith("/signin") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forget") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-code")
  ) {
    return <>{children}</>;
  }

  // Determine which wizard page we're on to show the correct stepper in header
  const isNewClientPage = pathname === "/new-client";
  // The Create Benefit wizard now lives at /new-benefits; /benefits is the
  // Browse Benefits list (which shows no stepper).
  const isBenefitsPage = pathname === "/new-benefits";

  // Read new-client wizard state for the step title shown next to the page title
  const newClientSteps = useNewClientWizardStore((s) => s.steps);
  const newClientCurrentStep = useNewClientWizardStore((s) => s.currentStep);

  // Read benefits wizard state
  const benefitsSteps = useBenefitsWizardStore((s) => s.steps);
  const benefitsCurrentStep = useBenefitsWizardStore((s) => s.currentStep);
  const benefitsTotalSteps = useBenefitsWizardStore((s) => s.totalSteps);

  // The benefits wizard does not append a step title next to the page title —
  // the header reads "Create Benefits / <Company Name>" (the company name is set
  // by the benefits page via the page-title context) and the WizardStepper in
  // the header center already conveys the step. Only the Create Plan wizard
  // keeps a step title.
  const stepTitle = isNewClientPage
    ? newClientSteps.find((s) => s.id === newClientCurrentStep)?.title ?? ""
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

  // The URL-level half of the sidebar rule: a page the nav hides is refused here too,
  // so typing it directly lands on the restricted notice instead of the page.
  const canUseThisPage = mayUsePath(pathname, { isCollaborator, can });

  return (
    // Seed the access summary into SWR's cache for the whole dashboard tree. Every
    // `useViewerAccess()` below — the guard, the sidebar, the settings page — reads it
    // synchronously, so none of them renders the wrong thing before the server's answer
    // arrives. `fallback` (not a prop) is what lets a deep consumer like Settings use it.
    <SWRConfig value={{ fallback: { [VIEWER_ACCESS_KEY]: viewerAccess } }}>
    <>
      <Header
        stepper={stepperElement}
        stepTitle={stepTitle}
      />
      <div className="flex bg-background">
        <Sidebar />
        <main
          className={`flex-1 ${isWizardPage ? "pt-[72px]" : "pt-16"} overflow-y-auto duration-200 ease-in-out bg-background`}
          style={{
            // Clears the sidebar *and* any Preview inline Editing Panel
            // (`--editor-inset` is only set by the Preview pages).
            marginLeft:
              "calc(var(--sidebar-width, 16rem) + var(--editor-inset, 0px))",
          }}
        >
          {canUseThisPage ? (
            children
          ) : (
            // `NoAccessNotice` positions itself absolutely, so it needs a positioned box
            // to centre inside rather than the raw <main>.
            <div className="relative min-h-[60vh]">
              <NoAccessNotice
                message="You don't have access to this page"
                reason="page_restricted_for_collaborator"
                backHref="/benefits"
                backLabel="Back to Benefits"
              />
            </div>
          )}
        </main>
      </div>
    </>
    </SWRConfig>
  );
}
