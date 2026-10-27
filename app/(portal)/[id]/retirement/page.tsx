"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useClientPortal } from "@/contexts/client-portal-context";
import { useParams } from "next/navigation";
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

/** Same hub label as Create Benefits → Retirement card (`resolvePersistedDocumentCategory("Document", "Retirement")`). */
const RETIREMENT_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Retirement");


export default function RetirementPage() {
  const { clientData, profile } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [retirementDocs, setRetirementDocs] = useState<
    RetirementDocumentItem[]
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  // Fetch benefit data from the new Benefit API (typed, no more JSON rummaging).
  // `withTopics=1` asks for the plan's resolved placements: they are now the hub's
  // ONLY source of questions, so they are no longer withheld pending the rollout flag
  // that used to decide between placements and the old FAQ accordion.
  const { data: benefitApiData } = useSWR(
    clientId
      ? `/api/clients/${clientId}/benefits/Retirement?forPortal=1&withTopics=1`
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
      "Retirement",
    );
  }, [benefitFromApi, clientData]);

  // The two account-access values the advisor sets in the benefit editor's
  // "Benefit Access & Materials" panel (Plan / Group ID and the required login URL).
  // The Account Access card in "How Can We Help You Today?" and the Access &
  // Materials hero below both print them, so they are resolved once here rather
  // than each reaching into a different source.
  const planGroupIdLabel = formatPlanGroupIdLabel(benefitData?.insurancePlanId);
  const accountAccessHref = benefitData?.insuranceLoginUrl || undefined;

  // TF-2: this hub's resolved topic placements. `source` says whether participants
  // WOULD have been reading placements before the FAQ accordion was retired; the page
  // renders them either way, because there is no longer a fallback to switch to.
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
        const orderedRaw = sortDocumentRowsByCustomOrder(
          mergedRaw as Record<string, unknown>[],
        );
        setRetirementDocs(
          mapMergedRowsToBenefitHubItems(orderedRaw, RETIREMENT_DOCUMENT_HUB),
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
          profile={profile}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          customHeadline={benefitData?.title}
          customDescription={benefitData?.shortDescription ?? undefined}
          category="Retirement"
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
            category="Retirement"
            videoLabel={benefitData?.planVideoLabel ?? undefined}
            videoThumbnail={benefitData?.planVideoThumbnail ?? undefined}
            // No plan copy → the section's Retirement defaults fill these in.
            mainTitle={(benefitData as any)?.journeyHeader || undefined}
            subtitle={(benefitData as any)?.journeySubtitle || undefined}
            description={
              (benefitData as any)?.journeyBodyText ||
              "Take control of your financial future with our comprehensive retirement planning resources. Whether you're just starting your career or preparing for the next chapter, we provide the tools and guidance you need to build a secure retirement."
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
            webinarsPlacement="retirement"
          />
        )}

        {/* The journey section comes first, then "How Can We Help You Today?" —
            the header's Login button scrolls to this section. */}
        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          category="Retirement"
          // Plan / Group ID, login URL and provider all come from this category's
          // Benefit row — the same three fields the editor panel writes.
          provider={benefitData?.providerContact ?? null}
          planIdLabel={planGroupIdLabel || undefined}
          accountAccessHref={accountAccessHref}
          // Placements win when this plan has them; otherwise the section falls back
          // to the saved legacy card layout.
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
          retirementDocs={retirementDocs}
          title="Retirement Plan Documents & Forms"
          description="Access all your important retirement plan documents, forms, and notices in one convenient location."
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
          category="Retirement"
        />
      </main>
    </div>
  );
}
