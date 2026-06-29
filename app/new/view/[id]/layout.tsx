"use client";

import { useParams, usePathname } from "next/navigation";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import { Footer } from "@/components/footer";
import {
  ClientPortalProvider,
  useClientPortal,
} from "@/contexts/client-portal-context";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PortalPlanHeader } from "@/components/pages/client-portal/sections/portal-plan-header";
import { AnimatePresence, motion } from "framer-motion";
import { DEFAULT_DISCLOSURES_TEXT } from "@/lib/disclaimer-constants";

function ClientViewLayoutContent({ children }: { children: React.ReactNode }) {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const pathname = usePathname();
  const [previousPage, setPreviousPage] = useState(true);
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";
  const basePath = clientId ? `/new/view/${clientId}` : "";

  const planRoutes = basePath
    ? [
      `${basePath}/401k-plan-materials`,
      `${basePath}/financial-planning`,
      `${basePath}/rollovers-distributions`,
      `${basePath}/meetings-announcements`,
      `${basePath}/schedule-appointment`,
    ]
    : [];

  const showPlanHeader = planRoutes.some(
    (route) => pathname?.startsWith(route),
  );

  useEffect(() => {
    const prev = sessionStorage.getItem("previousPage");
    setPreviousPage(false);

    if (prev) {
      setPreviousPage(true);
      sessionStorage.removeItem("previousPage");
    }
  }, []);

  const onClick = () => {
    window.location.href = `/new/edit-client/${clientId}`;
  };

  // Determine current category from pathname
  const getCurrentCategory = () => {
    if (pathname?.includes("/retirement")) return "Retirement Plan";
    if (pathname?.includes("/health-insurance")) return "Group Health / Dental / Vision";
    if (pathname?.includes("/life-insurance")) return "Group Life / Disability";
    if (pathname?.includes("/wellness-programs")) return "Wellness Programs";
    return "Benefits Hub / Client Website"; // Default to hub for main page or other plan pages
  };

  // Parse and filter disclaimers based on priority
  const getDisclosuresText = () => {
    // Note: clientData might not have 'branding' sub-object in this context
    const orgName = (clientData as any)?.branding?.organizationName || clientData?.companyName || "[Organization Name]";
    const compName = clientData?.companyName || "[Company Name]";

    // Universal disclaimer text with replaced placeholders
    const universalText = DEFAULT_DISCLOSURES_TEXT
      .replace(/[<\\[]Organization Name[>\\]]/g, orgName)
      .replace(/[<\\[]Company Name[>\\]]/g, compName);

    if (!clientData?.disclaimers) return universalText;

    let disclaimersArray: any[] = [];
    let savedDisclosuresText: string | null = null;
    let useDefaultDisclosures = false;

    try {
      const parsed = typeof clientData.disclaimers === "string"
        ? JSON.parse(clientData.disclaimers)
        : clientData.disclaimers;

      if (parsed && typeof parsed === "object") {
        disclaimersArray = Array.isArray(parsed.disclaimers) ? parsed.disclaimers : [];
        savedDisclosuresText = parsed.disclosuresText || null;
        useDefaultDisclosures = !!parsed.useDefaultDisclosures;
      }
    } catch (e) {
      console.warn("Failed to parse disclaimers:", e);
      // Fallback to treating as string if it's not JSON
      if (typeof clientData.disclaimers === "string") {
        return clientData.disclaimers;
      }
      return universalText;
    }

    const currentCategory = getCurrentCategory();

    // 1. Category-specific disclaimers (apply_all = false, matches category)
    // Note: If user selected "Benefits Hub" and apply_all = false, it only shows on the Hub main page ("benefits_hub").
    const categorySpecific = disclaimersArray.filter((d: any) =>
      !d.apply_all_benefits_categories && (d.locations?.includes(currentCategory) || d.locations?.includes("global"))
    );

    // 2. All-categories disclaimers (apply_all = true)
    // These appear across all categories regardless of the specific category selected in locations, 
    // as long as they are targeted at the Hub/Portal components.
    const allCategories = disclaimersArray.filter((d: any) =>
      d.apply_all_benefits_categories === true
    );

    // Combine following priority: Category-specific > All-categories > Universal
    // (We include universal if useDefaultDisclosures is true OR if it's the final fallback)
    const prioritizedTexts = [
      ...categorySpecific.map(d => d.text),
      ...allCategories.map(d => d.text)
    ];

    // Add universal disclaimer if enabled or as final priority
    if (useDefaultDisclosures || prioritizedTexts.length === 0) {
      prioritizedTexts.push(universalText);
    } else if (savedDisclosuresText && disclaimersArray.length === 0) {
      // Legacy support for single string
      return savedDisclosuresText;
    }

    if (prioritizedTexts.length > 0) {
      // Remove exactly duplicate texts (case-insensitive trim) and join
      const uniqueTexts = Array.from(new Set(prioritizedTexts.map(t => t?.trim()).filter(Boolean)));
      return uniqueTexts.join("\n\n");
    }

    return universalText;
  };

  const disclosuresText = getDisclosuresText();

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 left-0 w-full z-50">
        {previousPage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
            <Button
              onClick={() => (window.location.href = `/new/dashboard`)}
              className="px-10 mr-3 py-4 text-lg bg-[#1F3A60] text-white font-semibold rounded-full shadow-xl hover:bg-[#2c4b80] hover:scale-105 transition-all duration-200"
            >
              ← Go back to dashboard
            </Button>

            <Button
              onClick={onClick}
              className="px-10 py-4 text-lg bg-[#1F3A60] text-white font-semibold rounded-full shadow-xl hover:bg-[#2c4b80] hover:scale-105 transition-all duration-200"
            >
              ← Go back to editing
            </Button>
          </div>
        )}
        {showPlanHeader ? (
          <PortalPlanHeader
            companyData={{
              companyLogo: clientData?.companyLogo,
            }}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            clientId={clientId}
            appointmentLink={clientData?.appointmentLink}
          />
        ) : (
          <PortalHeader
            companyData={{
              companyLogo: clientData?.companyLogo,
            }}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            clientId={clientId}
            categoryPortalVisibility={(clientData as any)?.categoryPortalVisibility}
            benefits={(clientData as any)?.employeePortalPreview?.benefits}
          />
        )}
      </div>
      <div
        style={
          {
            "--brand-color": brandColor,
            "--secondary-color": secondaryColor,
          } as React.CSSProperties
        }
      >
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </div>
      <Footer brandColor={brandColor} disclosuresText={disclosuresText} />
    </div>
  );
}

export default function ClientViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientPortalProvider>
      <ClientViewLayoutContent>{children}</ClientViewLayoutContent>
    </ClientPortalProvider>
  );
}
