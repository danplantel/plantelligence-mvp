"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useClientPortal } from "@/contexts/client-portal-context";
import { useParams } from "next/navigation";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions-faq";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import {
  RetirementJourneySection,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import {
  RetirementDocumentsAccordion,
  RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { mergePlanDocumentRows } from "@/lib/plan-client-documents-merge";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import {
  benefitCategoryToDocumentHubLabel,
  mapMergedRowsToBenefitHubItems,
} from "@/lib/map-plan-documents-for-benefit-hub";

/** Same hub label as Create Benefits → Retirement card (`resolvePersistedDocumentCategory("Document", "Retirement")`). */
const RETIREMENT_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Retirement");

const RETIREMENT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80";

export default function RetirementPage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [retirementDocs, setRetirementDocs] = useState<
    RetirementDocumentItem[]
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  // Extract benefit data (benefitTitle, shortDescription) for this category
  const benefitData = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    return benefits.find((b: any) => b.category === "Retirement");
  }, [clientData?.employeePortalPreview]);

  /** Re-merge documents when embedded list ids change — avoids re-fetching on every clientData reference churn. */
  const documentsSig = useMemo(() => {
    const d = clientData?.documents;
    if (!Array.isArray(d)) return "";
    return `${d.length}:${d
      .map((x: { id?: string }) => String(x?.id ?? ""))
      .sort()
      .join(",")}`;
  }, [clientData?.documents]);

  const clientDataRef = useRef(clientData);
  clientDataRef.current = clientData;

  // Extract FAQs for this category from employeePortalPreview.benefits.
  // Falls back to Retirement-specific defaults when no custom FAQs are saved yet.
  const faqsForCategory = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const retirementBenefit = benefits.find(
      (b: any) => b.category === "Retirement",
    );
    const faqs = retirementBenefit?.faqs;
    if (faqs && Array.isArray(faqs)) {
      const enabled = faqs.filter(
        (f: any) => f.enabled !== false,
      ) as DynamicFAQItem[];
      if (enabled.length > 0) return enabled;
    }
    // Fall back to default Retirement FAQs when no custom ones are saved
    const defaults = DEFAULT_FAQS["Retirement"];
    if (defaults && defaults.length > 0) {
      return defaults as DynamicFAQItem[];
    }
    return undefined;
  }, [clientData?.employeePortalPreview]);

  // Resolve support contacts from the benefit's supportContacts (selected in wizard Step 3).
  // Cross-references contactId with keyContacts for email/phone/headshot.
  // Returns undefined when no support contacts are selected — hides the card entirely.
  const supportContactsForFAQ = useMemo(() => {
    const rawContacts = Array.isArray(clientData?.keyContacts)
      ? clientData?.keyContacts
      : (clientData?.keyContacts as any)?.contacts || [];

    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const retirementBenefit = benefits.find(
      (b: any) => b.category === "Retirement",
    );
    const rawSupportContacts = retirementBenefit?.supportContacts;
    if (!Array.isArray(rawSupportContacts)) return undefined;

    const enabled = rawSupportContacts.filter((sc: any) => sc.enabled !== false);
    if (enabled.length === 0) return undefined;

    return enabled.map((sc: any) => {
      const matched = rawContacts.find((c: any) => c.id === sc.contactId);
      return {
        id: sc.contactId,
        title: sc.title || matched?.name || `${matched?.firstName ?? ""} ${matched?.lastName ?? ""}`.trim() || "Support Contact",
        description: sc.description || matched?.customRole || matched?.title || "",
        email: matched?.email || "",
        phone: matched?.phone || "",
        phoneExtension: matched?.phoneExtension,
        headshot: matched?.headshot || undefined,
      } as FAQContact;
    });
  }, [clientData?.employeePortalPreview, clientData?.keyContacts]);

  // Same data as Benefits Step 4: GET /api/documents/client + embedded docs from context
  useEffect(() => {
    if (!clientId) {
      setLoadingDocs(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingDocs(true);
        const apiRows = await fetchPlanDocumentsForClient(clientId);
        if (cancelled) return;

        const embeddedDocs = clientDataRef.current?.documents;
        const embedded = Array.isArray(embeddedDocs) ? embeddedDocs : [];

        const mergedRaw = mergePlanDocumentRows(
          apiRows as unknown[],
          embedded as unknown[],
        );
        setRetirementDocs(
          mapMergedRowsToBenefitHubItems(
            mergedRaw as Record<string, unknown>[],
            RETIREMENT_DOCUMENT_HUB,
          ),
        );
      } catch (error) {
        console.error("Error fetching retirement documents:", error);
        const embeddedDocs = clientDataRef.current?.documents;
        const embedded = Array.isArray(embeddedDocs) ? embeddedDocs : [];
        setRetirementDocs(
          mapMergedRowsToBenefitHubItems(
            mergePlanDocumentRows([], embedded as unknown[]),
            RETIREMENT_DOCUMENT_HUB,
          ),
        );
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, documentsSig]);

  return (
    <div className="min-h-screen w-full">
      <CompletenessAutoTrigger
        category="Retirement"
        clientData={clientData}
        clientId={clientId}
      />
      <main className="w-full">
        <PortalWelcomeBanner
          clientData={clientData}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          customHeadline={benefitData?.title}
          customDescription={benefitData?.shortDescription}
          category="Retirement"
        />

        <RetirementJourneySection
          brandColor={brandColor}
          mainTitle={benefitData?.journeyHeader || benefitData?.title || "Your Retirement Journey Starts Here"}
          subtitle={benefitData?.journeySubtitle || "Build your future with confidence."}
          description={benefitData?.journeyBodyText || benefitData?.shortDescription || "Take control of your financial future with our comprehensive retirement planning resources. Whether you're just starting your career or preparing for the next chapter, we provide the tools and guidance you need to build a secure retirement."}
          planVideoUrl={(benefitData as any)?.planVideo}
          planVideoFallbackImage={RETIREMENT_FALLBACK_IMAGE}
        />

        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
        />

        <FAQSection brandColor={brandColor} secondaryColor={secondaryColor} faqs={faqsForCategory} contacts={supportContactsForFAQ} />

        <PortalMaterialsHero brandColor={brandColor} cardHeading="Retirement Plan Account Access" category="Retirement" />

        <RetirementDocumentsAccordion
          brandColor={brandColor}
          accentColor={secondaryColor}
          retirementDocs={retirementDocs}
          title="Retirement Plan Documents & Forms"
          description="Access all your important retirement plan documents, forms, and notices in one convenient location."
          loading={loadingDocs}
        />

        <HaveQuestions brandColor={brandColor} secondaryColor={secondaryColor} contacts={supportContactsForFAQ} />

      </main>
    </div>
  );
}
