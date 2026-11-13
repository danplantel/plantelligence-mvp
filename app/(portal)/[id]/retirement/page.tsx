"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useClientPortal } from "@/contexts/client-portal-context";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { buildFaqSupportContacts } from "@/lib/faq-support-contacts";
import {
  benefitHubApiPath,
  portalBenefitFetcher,
} from "@/lib/benefit-hub-data";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { PortalSectionEditButton } from "@/components/portal-editing/portal-section-edit-button";
import { benefitEditAnchor } from "@/lib/portal-editor-sections";
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
import { benefitPrimaryContactId } from "@/lib/benefit-contacts";
import type { BenefitData } from "@/types/benefit";
import type { TopicsPayload } from "@/types/topic";

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
  // `isLoading` is what the Quick Answers section draws its skeleton from: until the
  // read answers, the section has no questions to show and used to appear late.
  // The URL and fetcher come from `lib/benefit-hub-data` because the portal provider
  // PRELOADS this exact key inside its bootstrap skeleton — a hand-written string here
  // would be a different cache entry and bring the second round of skeletons back.
  const { data: benefitApiData, isLoading: benefitLoading } = useSWR(
    clientId ? benefitHubApiPath(clientId, "Retirement") : null,
    portalBenefitFetcher,
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

  // The Key Contact chosen for this benefit in Create/Edit Benefit. The banner,
  // the journey section and the closing "Have Questions?" row all feature this
  // person, so it is resolved once here and handed to each of them — otherwise
  // they fall back to the plan's contact flags, which a different screen owns,
  // and a Key Contact changed in the editor never reaches the hub.
  const keyContactId = benefitPrimaryContactId(benefitData);

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
        {/* Each region the benefit panel edits carries a blue button, which opens
            that panel on the section that owns it. The wrappers are `relative`
            because PortalSectionEditButton is positioned. */}
        <div className="relative">
          <PortalWelcomeBanner
            clientData={clientData}
            profile={profile}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            customHeadline={benefitData?.title}
            customDescription={benefitData?.shortDescription ?? undefined}
            category="Retirement"
            primaryContactId={keyContactId}
            // A pencil on each editable element of the card, each naming the panel
            // section that owns it: the copy lives in "Benefit Messaging", the
            // portrait and the provider logo in "Branding".
            editTargets={{
              title: benefitEditAnchor.messaging,
              description: benefitEditAnchor.messaging,
              portrait: benefitEditAnchor.keyContactImage,
              logo: benefitEditAnchor.providerLogo,
            }}
            // "Schedule with …" scrolls to the key contact's card below instead of
            // opening the scheduling URL in another tab.
            onScheduleClick={() =>
              scrollToPortalSection(HAVE_QUESTIONS_SECTION_ID)
            }
          />
          <PortalSectionEditButton
            sectionId={benefitEditAnchor.heroImage}
            label="Edit header background"
            className="right-4 top-4"
          />
        </div>

        {/* Hidden entirely when the editor's "Show on page" toggle is off. */}
        {benefitData?.planVideoVisible !== false && (
          <div className="relative">
            <BenefitsVideoSection
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              keyContacts={clientData?.keyContacts}
              category="Retirement"
              primaryContactId={keyContactId}
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
            <PortalSectionEditButton
              sectionId={benefitEditAnchor.video}
              label="Edit video section"
              className="right-4 top-4"
            />
          </div>
        )}

        {/* The journey section comes first, then "How Can We Help You Today?" —
            the header's Login button scrolls to this section. */}
        <div className="relative">
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
          <PortalSectionEditButton
            sectionId={benefitEditAnchor.help}
            label="Edit how we can help"
            className="right-4 top-4"
          />
        </div>

        {/* Quick Answers replaces the FAQ accordion on this hub. It renders nothing at
            all when the plan has no questions, so the section cannot appear empty. */}
        <div className="relative">
          <QuickAnswersSection
            groups={topics?.groups ?? []}
            // Placeholder frame until this hub's placements arrive, so the section
            // does not materialise after the ones around it.
            loading={benefitLoading}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            basePath={`/${clientId}`}
            actionHubPanels={topics?.actionHubPanels}
            category="Retirement"
            // Per-plan values a topic's copy and CTA may name.
            recordkeeperUrl={accountAccessHref}
            recordkeeperName={benefitData?.providerContact?.companyName ?? undefined}
            planSponsorName={clientData?.companyName}
          />
          <PortalSectionEditButton
            sectionId={benefitEditAnchor.quickAnswers}
            label="Edit quick answers"
            className="right-4 top-4"
          />
        </div>

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
        <div className="relative">
          <HaveQuestions
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            contacts={supportContactsForFAQ}
            // Section 8 of the benefit editor: how this benefit's key contact is drawn.
            keyContactCardStyle={benefitData?.keyContactCardStyle ?? undefined}
            keyContacts={clientData?.keyContacts}
            category="Retirement"
            primaryContactId={keyContactId}
          />
          <PortalSectionEditButton
            sectionId={benefitEditAnchor.haveQuestions}
            label="Edit have questions"
            className="right-4 top-4"
          />
        </div>
      </main>
    </div>
  );
}
