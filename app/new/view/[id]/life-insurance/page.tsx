"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions-faq";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import {
  RetirementJourneySection,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
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

const LIFE_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Group Life");

const LIFE_INSURANCE_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&q=80";

export default function LifeInsurancePage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [lifeDocs, setLifeDocs] = useState<RetirementDocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

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

  // Fetch life insurance plan documents
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
        setLifeDocs(
          mapMergedRowsToBenefitHubItems(
            mergedRaw as Record<string, unknown>[],
            LIFE_DOCUMENT_HUB,
          ),
        );
      } catch (error) {
        console.error("Error fetching life insurance documents:", error);
        const embeddedDocs = clientDataRef.current?.documents;
        const embedded = Array.isArray(embeddedDocs) ? embeddedDocs : [];
        setLifeDocs(
          mapMergedRowsToBenefitHubItems(
            mergePlanDocumentRows([], embedded as unknown[]),
            LIFE_DOCUMENT_HUB,
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

  // Extract FAQs for this category from employeePortalPreview.benefits.
  const faqsForCategory = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const lifeBenefit = benefits.find(
      (b: any) => b.category === "Group Life",
    );
    const faqs = lifeBenefit?.faqs;
    if (faqs && Array.isArray(faqs)) {
      const enabled = faqs.filter(
        (f: any) => f.enabled !== false,
      ) as DynamicFAQItem[];
      if (enabled.length > 0) return enabled;
    }
    const defaults = DEFAULT_FAQS["Group Life"];
    if (defaults && defaults.length > 0) {
      return defaults as DynamicFAQItem[];
    }
    return undefined;
  }, [clientData?.employeePortalPreview]);

  // Resolve support contacts
  const supportContactsForFAQ = useMemo(() => {
    const rawContacts = Array.isArray(clientData?.keyContacts)
      ? clientData?.keyContacts
      : (clientData?.keyContacts as any)?.contacts || [];

    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const lifeBenefit = benefits.find(
      (b: any) => b.category === "Group Life",
    );
    const rawSupportContacts = lifeBenefit?.supportContacts;
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

  // Extract benefit data (benefitTitle, shortDescription) for this category
  const benefitData = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    return benefits.find((b: any) => b.category === "Group Life");
  }, [clientData?.employeePortalPreview]);

  return (
    <div className="min-h-screen w-full">
      <CompletenessAutoTrigger
        category="Group Life"
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
          category="Group Life"
        />

        <RetirementJourneySection
          brandColor={brandColor}
          mainTitle={benefitData?.journeyHeader || benefitData?.title || "Life Insurance: Protecting What Matters Most"}
          subtitle={benefitData?.journeySubtitle || "Secure your family's financial future with the right coverage."}
          description={benefitData?.journeyBodyText || benefitData?.shortDescription || "Protect what matters most. Our life insurance resources help you understand your coverage options and ensure your loved ones are financially secure, no matter what life brings. Explore term life, whole life, and supplemental coverage tailored to your needs."}
          planVideoUrl={(benefitData as any)?.planVideo}
          planVideoFallbackImage={LIFE_INSURANCE_FALLBACK_IMAGE}
        />

        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
        />

        <FAQSection brandColor={brandColor} secondaryColor={secondaryColor} faqs={faqsForCategory} contacts={supportContactsForFAQ} />

        <PortalMaterialsHero brandColor={brandColor} cardHeading="Group Life Insurance Account Access" category="Group Life" />

        <RetirementDocumentsAccordion
          brandColor={brandColor}
          accentColor={secondaryColor}
          retirementDocs={lifeDocs}
          title="Life Insurance Documents & Forms"
          description="Access all your important life insurance plan documents, forms, and notices in one convenient location."
          accordionHeaderTitle="Life Insurance Documents"
          loading={loadingDocs}
        />

        <HaveQuestions brandColor={brandColor} secondaryColor={secondaryColor} contacts={supportContactsForFAQ} />
      </main>
    </div>
  );
}
