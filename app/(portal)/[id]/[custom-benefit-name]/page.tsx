"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, notFound } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import useSWR from "swr";
import { buildFaqSupportContacts } from "@/lib/faq-support-contacts";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { PortalSectionEditButton } from "@/components/portal-editing/portal-section-edit-button";
import { benefitEditAnchor } from "@/lib/portal-editor-sections";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
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
  BenefitsVideoSection,
} from "@/components/pages/client-portal/sections/benefits-video-section";
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
import { benefitPrimaryContactId } from "@/lib/benefit-contacts";
import { isCustomBenefitRouteSegment } from "@/lib/benefit-custom-name";
import type { BenefitData } from "@/types/benefit";
import type { TopicsPayload } from "@/types/topic";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const WELLNESS_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Company / Plan Sponsor");


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
  // `withTopics=1`: placements are the hub's only source of questions now that the
  // FAQ accordion is retired, so they are always requested.
  const { data: benefitApiData } = useSWR(
    clientId
      ? `/api/clients/${clientId}/benefits/Company%20%2F%20Plan%20Sponsor?forPortal=1&withTopics=1`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const benefitFromApi: BenefitData | null = benefitApiData?.benefit ?? null;

  // Fall back to legacy employeePortalPreview during dual-write transition
  const benefitData = useMemo(() => {
    if (benefitFromApi) return benefitFromApi;
    return getBenefitFromPreview((clientData as any)?.employeePortalPreview, "Company / Plan Sponsor");
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


  // The Key Contact chosen for this benefit in Create/Edit Benefit. The banner,
  // the journey section and the closing row all feature this person, so it is
  // resolved once and handed to each — see `benefitPrimaryContactId`.
  const keyContactId = benefitPrimaryContactId(benefitData);

  return (
    <div className="min-h-screen w-full">
      <CompletenessAutoTrigger
        category="Company / Plan Sponsor"
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
            category="Company / Plan Sponsor"
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
              category="Company / Plan Sponsor"
              primaryContactId={keyContactId}
              videoLabel={benefitData?.planVideoLabel ?? undefined}
              videoThumbnail={benefitData?.planVideoThumbnail ?? undefined}
              // No plan copy → the section's Custom-hub defaults fill these in.
              mainTitle={(benefitData as any)?.journeyHeader || undefined}
              subtitle={(benefitData as any)?.journeySubtitle || undefined}
              description={(benefitData as any)?.journeyBodyText || "Your well-being goes beyond traditional benefits. Discover programs designed to support your physical, mental, and financial health—from fitness stipends and nutrition coaching to mental health resources and financial wellness tools. Thrive at work and at home."}
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
              // closing rail of this section. The key stays "wellness-programs" — it
              // is the stored placement value on every saved row.
              webinarsPlacement="wellness-programs"
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
            // The Custom hub's category label is the advisor's own name for it.
            category={benefitData?.title?.trim() || undefined}
            // Plan / Group ID, login URL and provider — the same three fields the
            // editor panel writes.
            provider={benefitData?.providerContact ?? null}
            planIdLabel={planGroupIdLabel || undefined}
            accountAccessHref={accountAccessHref}
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
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            basePath={`/${clientId}`}
            actionHubPanels={topics?.actionHubPanels}
            category="Company / Plan Sponsor"
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
          retirementDocs={wellnessDocs}
          title="Wellness Program Documents & Forms"
          description="Access all your important wellness program documents, forms, and notices in one convenient location."
          accordionHeaderTitle="Wellness Program Documents"
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
            category="Company / Plan Sponsor"
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
