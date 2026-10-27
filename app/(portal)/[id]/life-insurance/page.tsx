"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import useSWR from "swr";
import { buildFaqSupportContacts } from "@/lib/faq-support-contacts";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { BenefitsVideoSection } from "@/components/pages/client-portal/sections/benefits-video-section";
import {
  HowCanWeHelpSection,
  formatPlanGroupIdLabel,
} from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { QuickAnswersSection } from "@/components/pages/client-portal/sections/quick-answers-section";
import {
  HAVE_QUESTIONS_SECTION_ID,
  scrollToPortalSection,
} from "@/lib/portal-section-anchors";
import {
  BenefitDocumentSection,
  RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/benefit-document-section";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { mergePlanDocumentRows } from "@/lib/plan-client-documents-merge";
import { sortDocumentRowsByCustomOrder } from "@/lib/documents/document-sort";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import {
  benefitCategoryToDocumentHubLabel,
  mapMergedRowsToBenefitHubItems,
} from "@/lib/map-plan-documents-for-benefit-hub";
import { getBenefitFromPreview } from "@/lib/benefit-data-helpers";
import type { BenefitData } from "@/types/benefit";
import type { TopicsPayload } from "@/types/topic";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const LIFE_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Group Life");


export default function LifeInsurancePage() {
  const { clientData, profile } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [lifeDocs, setLifeDocs] = useState<RetirementDocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  // Fetch benefit data from the new Benefit API
  const { data: benefitApiData } = useSWR(
    clientId
      ? // `withTopics=1`: placements are the hub's only source of questions now that
        // the FAQ accordion is retired, so they are always requested.
        `/api/clients/${clientId}/benefits/Group%20Life?forPortal=1&withTopics=1`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const benefitFromApi: BenefitData | null = benefitApiData?.benefit ?? null;

  // Fall back to legacy employeePortalPreview during dual-write transition
  const benefitData = useMemo(() => {
    if (benefitFromApi) return benefitFromApi;
    return getBenefitFromPreview(
      (clientData as any)?.employeePortalPreview,
      "Group Life",
    );
  }, [benefitFromApi, clientData]);

  // Account-access values from the benefit editor (Plan / Group ID + login URL),
  // shared by the Account Access card and the Access & Materials hero.
  const planGroupIdLabel = formatPlanGroupIdLabel(benefitData?.insurancePlanId);
  const accountAccessHref = benefitData?.insuranceLoginUrl || undefined;

  // TF-2: resolved topic placements for this hub, when the plan is on the framework.
  const topicsPayload = benefitApiData?.topics as
    | TopicsPayload
    | null
    | undefined;
  const topics = topicsPayload ?? null;

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
        const orderedRaw = sortDocumentRowsByCustomOrder(
          mergedRaw as Record<string, unknown>[],
        );
        setLifeDocs(
          mapMergedRowsToBenefitHubItems(orderedRaw, LIFE_DOCUMENT_HUB),
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
        category="Group Life"
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
          category="Group Life"
          // "Schedule with …" scrolls to the key contact's card below instead of
          // opening the scheduling URL in another tab.
          onScheduleClick={() =>
            scrollToPortalSection(HAVE_QUESTIONS_SECTION_ID)
          }
        />

        {/* Hidden entirely when the editor's "Show on page" toggle is off. */}
        {benefitData?.planVideoVisible !== false && (
          <BenefitsVideoSection
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            keyContacts={clientData?.keyContacts}
            category="Group Life"
            videoLabel={benefitData?.planVideoLabel ?? undefined}
            videoThumbnail={benefitData?.planVideoThumbnail ?? undefined}
            // No plan copy → the section's Group Life defaults fill these in.
            mainTitle={(benefitData as any)?.journeyHeader || undefined}
            subtitle={(benefitData as any)?.journeySubtitle || undefined}
            description={
              (benefitData as any)?.journeyBodyText ||
              "Protect what matters most. Our life insurance resources help you understand your coverage options and ensure your loved ones are financially secure, no matter what life brings. Explore term life, whole life, and supplemental coverage tailored to your needs."
            }
            planVideoUrl={benefitData?.planVideo as string | undefined}
            // The plan's own no-video image; when unset the section uses the
            // category's stock image (lib/benefits-video-fallback.ts).
            planVideoFallbackImage={
              benefitData?.planVideoFallbackImage ?? undefined
            }
            // "Schedule with …" scrolls to this contact's card in "Have Questions?"
            // rather than opening another tab.
            onScheduleClick={() =>
              scrollToPortalSection(HAVE_QUESTIONS_SECTION_ID)
            }
            // Videos published to this page from Communications → Webinars, as the
            // closing rail of this section.
            webinarsPlacement="life-insurance"
          />
        )}

        {/* The journey section comes first, then "How Can We Help You Today?" —
            the header's Login button scrolls to this section. */}
        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          category="Group Life"
          // Plan / Group ID, login URL and provider — the same three fields the
          // editor panel writes.
          provider={benefitData?.providerContact ?? null}
          planIdLabel={planGroupIdLabel || undefined}
          accountAccessHref={accountAccessHref}
          topics={topics?.featured}
          actionHubPanels={topics?.actionHubPanels}
          cards={(benefitData as any)?.helpCards ?? undefined}
        />

        {/* Quick Answers replaces the FAQ accordion on this hub. It renders nothing at
            all when the plan has no questions, so the section cannot appear empty. */}
        <QuickAnswersSection
          groups={topics?.groups ?? []}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          basePath={`/${clientId}`}
          actionHubPanels={topics?.actionHubPanels}
        />

        <BenefitDocumentSection
          brandColor={brandColor}
          accentColor={secondaryColor}
          retirementDocs={lifeDocs}
          title="Life Insurance Documents & Forms"
          description="Access all your important life insurance plan documents, forms, and notices in one convenient location."
          accordionHeaderTitle="Life Insurance Documents"
          loading={loadingDocs}
        />

        {/* The category's contacts — the same people listed on My Benefits Team,
            scoped to this benefit (see `supportContactsForFAQ`). The plan's
            contacts come along so the section can label this benefit's key
            contact (the person the banner and the journey section feature). */}
        <HaveQuestions
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          contacts={supportContactsForFAQ}
          keyContacts={clientData?.keyContacts}
          category="Group Life"
        />
      </main>
    </div>
  );
}
