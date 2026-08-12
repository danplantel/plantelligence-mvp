"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import useSWR from "swr";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions-faq";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import {
  RetirementJourneySection,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import {
  RetirementDocumentsAccordion,
  RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { mergePlanDocumentRows } from "@/lib/plan-client-documents-merge";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import {
  benefitCategoryToDocumentHubLabel,
  mapMergedRowsToBenefitHubItems,
} from "@/lib/map-plan-documents-for-benefit-hub";
import { getBenefitFromPreview } from "@/lib/benefit-data-helpers";
import type { BenefitData } from "@/types/benefit";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const WELLNESS_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Company / Plan Sponsor");

const WELLNESS_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1600&q=80";

export default function WellnessProgramsPage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [wellnessDocs, setWellnessDocs] = useState<RetirementDocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  // Fetch benefit data from the new Benefit API
  const { data: benefitApiData } = useSWR(
    clientId ? `/api/clients/${clientId}/benefits/Company%20%2F%20Plan%20Sponsor?forPortal=1` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const benefitFromApi: BenefitData | null = benefitApiData?.benefit ?? null;

  // Fall back to legacy employeePortalPreview during dual-write transition
  const benefitData = useMemo(() => {
    if (benefitFromApi) return benefitFromApi;
    return getBenefitFromPreview((clientData as any)?.employeePortalPreview, "Company / Plan Sponsor");
  }, [benefitFromApi, clientData]);

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

  // Fetch wellness program documents
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
        setWellnessDocs(
          mapMergedRowsToBenefitHubItems(
            mergedRaw as Record<string, unknown>[],
            WELLNESS_DOCUMENT_HUB,
          ),
        );
      } catch (error) {
        console.error("Error fetching wellness documents:", error);
        const embeddedDocs = clientDataRef.current?.documents;
        const embedded = Array.isArray(embeddedDocs) ? embeddedDocs : [];
        setWellnessDocs(
          mapMergedRowsToBenefitHubItems(
            mergePlanDocumentRows([], embedded as unknown[]),
            WELLNESS_DOCUMENT_HUB,
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

  // Extract FAQs for this category from the benefit data.
  const faqsForCategory = useMemo(() => {
    const faqs = benefitData?.faqs;
    if (faqs && Array.isArray(faqs)) {
      const enabled = faqs.filter(
        (f: any) => f.enabled !== false,
      ) as DynamicFAQItem[];
      if (enabled.length > 0) return enabled;
    }
    const defaults = DEFAULT_FAQS["Company / Plan Sponsor"];
    if (defaults && defaults.length > 0) {
      return defaults as DynamicFAQItem[];
    }
    return undefined;
  }, [benefitData]);

  // Resolve support contacts for this category.
  const supportContactsForFAQ = useMemo(() => {
    const rawContacts = Array.isArray(clientData?.keyContacts)
      ? clientData?.keyContacts
      : (clientData?.keyContacts as any)?.contacts || [];

    const rawSupportContacts = benefitData?.supportContacts;
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
  }, [benefitData, clientData?.keyContacts]);

  return (
    <div className="min-h-screen w-full">
      <CompletenessAutoTrigger
        category="Company / Plan Sponsor"
        clientData={clientData}
        clientId={clientId}
      />
      <main className="w-full">
        <PortalWelcomeBanner
          clientData={clientData}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          customHeadline={benefitData?.title}
          customDescription={benefitData?.shortDescription ?? undefined}
          category="Company / Plan Sponsor"
        />

        <RetirementJourneySection
          brandColor={brandColor}
          mainTitle={(benefitData as any)?.journeyHeader || "Whole-Person Wellness Programs"}
          subtitle={(benefitData as any)?.journeySubtitle || "Supporting your health, mind, and financial well-being."}
          description={(benefitData as any)?.journeyBodyText || "Your well-being goes beyond traditional benefits. Discover programs designed to support your physical, mental, and financial health—from fitness stipends and nutrition coaching to mental health resources and financial wellness tools. Thrive at work and at home."}
          planVideoUrl={benefitData?.planVideo as string | undefined}
          planVideoFallbackImage={WELLNESS_FALLBACK_IMAGE}
        />

        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
        />

        <FAQSection brandColor={brandColor} secondaryColor={secondaryColor} faqs={faqsForCategory} contacts={supportContactsForFAQ} />

        <PortalMaterialsHero brandColor={brandColor} cardHeading="Wellness Program Account Access" category="Company / Plan Sponsor" />

        <RetirementDocumentsAccordion
          brandColor={brandColor}
          accentColor={secondaryColor}
          retirementDocs={wellnessDocs}
          title="Wellness Program Documents & Forms"
          description="Access all your important wellness program documents, forms, and notices in one convenient location."
          accordionHeaderTitle="Wellness Program Documents"
          loading={loadingDocs}
        />

        <HaveQuestions brandColor={brandColor} secondaryColor={secondaryColor} contacts={supportContactsForFAQ} />
      </main>
    </div>
  );
}
