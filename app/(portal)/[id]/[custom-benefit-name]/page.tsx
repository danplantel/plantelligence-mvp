"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, notFound } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import useSWR from "swr";
import { FAQSection, DynamicFAQItem } from "@/components/faq-section";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { buildFaqSupportContacts } from "@/lib/faq-support-contacts";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import {
  BenefitsVideoSection,
} from "@/components/pages/client-portal/sections/benefits-video-section";
import { BenefitsHubWebinarsSection } from "@/components/pages/client-portal/sections/benefits-hub-webinars-section";
import {
  BenefitDocumentSection,
  RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/benefit-document-section";
import { mergePlanDocumentRows } from "@/lib/plan-client-documents-merge";
import { sortDocumentRowsByCustomOrder } from "@/lib/documents/document-sort";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import {
  benefitCategoryToDocumentHubLabel,
  mapMergedRowsToBenefitHubItems,
} from "@/lib/map-plan-documents-for-benefit-hub";
import { getBenefitFromPreview } from "@/lib/benefit-data-helpers";
import { isCustomBenefitRouteSegment } from "@/lib/benefit-custom-name";
import type { BenefitData } from "@/types/benefit";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const WELLNESS_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Company / Plan Sponsor");

const WELLNESS_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1600&q=80";

/**
 * The Custom benefit's portal page.
 *
 * Served at `/[planId]/[custom-benefit-name]` — the segment is the advisor's own name
 * for the benefit (slugified), not a fixed "wellness-programs" path. The legacy
 * segment is still accepted so already-published links keep working. An unknown
 * segment renders the portal's not-found.
 */
export default function CustomBenefitPage() {
  const { clientData, profile } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  // The `[custom-benefit-name]` segment — the URL's own claim about which benefit this is.
  const routeSegment = decodeURIComponent(
    String((params as Record<string, string | string[] | undefined>)["custom-benefit-name"] || ""),
  );
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

  /**
   * The segment must resolve to this plan's Custom benefit: either its name's slug, or
   * the legacy "wellness-programs" alias. Validate only once the benefit read has
   * answered, so a slow load is not mistaken for a bad URL.
   */
  if (
    benefitApiData !== undefined &&
    !isCustomBenefitRouteSegment(routeSegment, benefitData?.title)
  ) {
    notFound();
  }

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
        const orderedRaw = sortDocumentRowsByCustomOrder(
          mergedRaw as Record<string, unknown>[],
        );
        setWellnessDocs(
          mapMergedRowsToBenefitHubItems(
            orderedRaw,
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

  // Resolve the category's support contacts from the benefit's selection. The resolver
  // matches each `contactId` against the plan's LIVE contacts (profile + assignment) and
  // drops ids that no longer resolve, so the card always reflects the person's current
  // headshot, email and phone — and a stale id can't render a photo-less phantom card.
  const supportContactsForFAQ = useMemo(
    () =>
      buildFaqSupportContacts({
        keyContacts: clientData?.keyContacts,
        supportContacts: benefitData?.supportContacts,
      }),
    [benefitData?.supportContacts, clientData?.keyContacts],
  );


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
          profile={profile}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          customHeadline={benefitData?.title}
          customDescription={benefitData?.shortDescription ?? undefined}
          category="Company / Plan Sponsor"
        />


        <BenefitsVideoSection
          brandColor={brandColor}
          mainTitle={(benefitData as any)?.journeyHeader || "Whole-Person Wellness Programs"}
          subtitle={(benefitData as any)?.journeySubtitle || "Supporting your health, mind, and financial well-being."}
          description={(benefitData as any)?.journeyBodyText || "Your well-being goes beyond traditional benefits. Discover programs designed to support your physical, mental, and financial health—from fitness stipends and nutrition coaching to mental health resources and financial wellness tools. Thrive at work and at home."}
          planVideoUrl={benefitData?.planVideo as string | undefined}
          planVideoFallbackImage={WELLNESS_FALLBACK_IMAGE}
        />

        {/* Videos published to this page from Communications → Webinars. The key stays
            "wellness-programs" — it is the stored placement value on every saved row. */}
        <BenefitsHubWebinarsSection
          placement="wellness-programs"
          brandColor={brandColor}
          secondaryColor={secondaryColor}
        />

        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          cards={(benefitData as any)?.helpCards ?? undefined}
        />

        <FAQSection brandColor={brandColor} secondaryColor={secondaryColor} faqs={faqsForCategory} contacts={supportContactsForFAQ} />

        <PortalMaterialsHero
          brandColor={brandColor}
          cardHeading="Wellness Program Account Access"
          category="Company / Plan Sponsor"
          provider={benefitData?.providerContact ?? null}
        />

        <BenefitDocumentSection
          brandColor={brandColor}
          accentColor={secondaryColor}
          retirementDocs={wellnessDocs}
          title="Wellness Program Documents & Forms"
          description="Access all your important wellness program documents, forms, and notices in one convenient location."
          accordionHeaderTitle="Wellness Program Documents"
          loading={loadingDocs}
        />

        {/* The category's contacts — the same people listed on My Benefits Team,
            scoped to this benefit (see `supportContactsForFAQ`). */}
        <HaveQuestions
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          contacts={supportContactsForFAQ}
        />
      </main>
    </div>
  );
}
