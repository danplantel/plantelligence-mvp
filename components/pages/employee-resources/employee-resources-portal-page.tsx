"use client";

import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";

import { useClientPortal } from "@/contexts/client-portal-context";
import { NewsEventsHeader } from "@/components/pages/client-portal/sections/news-events-header";
import {
  HowCanWeHelpSection,
} from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { QuickAnswersSection } from "@/components/pages/client-portal/sections/quick-answers-section";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions";
import { PortalSectionEditButton } from "@/components/portal-editing/portal-section-edit-button";
import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { buildFaqSupportContacts } from "@/lib/faq-support-contacts";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { EMPLOYEE_RESOURCES_DEFAULT_BG } from "@/lib/portal-category-hero-background";
import { portalEditAnchor } from "@/lib/portal-editor-sections";
import { HAVE_QUESTIONS_SECTION_ID } from "@/lib/portal-section-anchors";
import { portalRadiusValue } from "@/lib/typography-themes";
import type { ActionHubRow, ResolvedLocationTopics } from "@/types/topic";

/**
 * Employee Resources — the fifth hub (TF-6), as a component.
 *
 * The page is rendered from two places: the portal route
 * ([`app/(portal)/[id]/employee-resources/page.tsx`](<../../../app/(portal)/[id]/employee-resources/page.tsx:1>))
 * and the dashboard's plan-scoped preview, which mounts it beside the portal's own
 * Editing Panel instead of inside a frame. It therefore takes the plan as a PROP rather
 * than reading `useParams()`: on the dashboard the route param is `[planId]`, and
 * silently reading it would tie the hub to whichever route happened to mount it.
 *
 * It uses the SAME template as a benefit category: a header, "How Can We Help You
 * Today?" driven by placements, Quick Answers, then the contact band. What it does
 * NOT have is a `Benefit` row, which is the whole point: it is not a benefit
 * category, so it cannot count toward the 1–4 limit, cannot appear in Benefits at a
 * Glance, and cannot change a plan's completion state.
 *
 * The header is the News & Events band rather than the welcome banner: this hub has
 * no plan mission statement to sign, and a short, image-led hero reads better for an
 * HR-resources index. Its background is this hub's OWN "Employee Resources Header"
 * image (`employeePortalPreview.employeeResourcesHeroImage`, chosen in Create Plan →
 * Branding, Edit Client → Branding or the portal's Editing Panel), then a default of
 * its own.
 *
 * It deliberately does NOT fall back to the Page Image Header: that slot belongs to
 * the interior benefit pages (and to News & Events), so borrowing it meant setting a
 * News & Events hero silently replaced this page's default.
 *
 * The page is opt-in per plan (`Client.employeeResourcesEnabled`). When the plan has not
 * switched it on, the API answers `enabled: false` and participants get the "not
 * available yet" notice — a URL bookmarked before the toggle was turned off must not
 * expose HR content. The ADVISOR's editing view is the one exception: with the editing
 * chrome mounted the sections still render, because the toggle decides what participants
 * see, not what the advisor is allowed to set up. See `isEditorPreview` below.
 */

const CATEGORY = "Employee Resources";

interface EmployeeResourcesResponse {
  enabled: boolean;
  /** Same shape the benefit read returns, plus the TF-5 Action Hub panels. */
  topics:
    | (ResolvedLocationTopics & {
        actionHubPanels?: Record<string, ActionHubRow[]>;
      })
    | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function EmployeeResourcesPortalPage({
  clientId,
}: {
  /** The plan's id or slug — the hub read accepts either. */
  clientId: string;
}) {
  const { clientData } = useClientPortal();
  /**
   * The editing chrome, when this page is open as the advisor's editing view
   * (`?edit=true` + a session on the portal; a mounted provider in the dashboard
   * preview). Participants never get a provider, so the gate below still hides HR
   * content from them.
   */
  const editing = useOptionalPortalEditing();

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  // This hub's own header image, then the bundled default of its own — never the
  // plan's Page Image Header, which belongs to the interior benefit pages and to
  // News & Events. Resolved through useBrandingImageUrl because the stored value can
  // be an R2 key (`org/…`) as well as an absolute URL; a bare key would otherwise be
  // requested as the relative path /org/… and 404.
  const ownHeaderImage =
    (clientData as any)?.employeePortalPreview?.employeeResourcesHeroImage;
  const storedHeaderImage =
    typeof ownHeaderImage === "string" ? ownHeaderImage.trim() : "";
  const { url: resolvedHeaderImageUrl } = useBrandingImageUrl(
    storedHeaderImage || null,
  );

  /**
   * The hub read. Participants get the public payload; a host that mounts this page as
   * an EDITOR (the dashboard preview) passes its own key through the editing provider,
   * because the public read answers `topics: null` while the hub is unpublished — which
   * is exactly when the advisor is setting the questions up.
   */
  const readKey = clientId
    ? (editing?.employeeResourcesReadKey ??
      `/api/clients/${clientId}/employee-resources?forPortal=1`)
    : null;

  const { data, error, mutate } = useSWR<EmployeeResourcesResponse>(
    readKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  /**
   * Give an editor-hosted hub its default question set.
   *
   * A plan that has published the hub already has the library's recommended questions,
   * grouped — the publish path seeds them. A plan that has never been seeded shows an
   * empty board, and the page then has no Quick Answers section to render at all.
   * Seeding here makes the editor preview match what a published plan looks like, which
   * is the whole point of previewing.
   *
   * Only for the editor host (it is the one that supplies `employeeResourcesReadKey`),
   * only when the viewer may edit, and only when the board is entirely empty — the
   * endpoint is idempotent, but a board with anything on it is left untouched.
   */
  const seededRef = useRef(false);
  useEffect(() => {
    if (!editing?.employeeResourcesReadKey || !editing.canEdit) return;
    if (!data || seededRef.current) return;
    const topics = data.topics;
    const nothingPlaced =
      !topics ||
      (topics.featured.length === 0 && topics.groups.length === 0);
    if (!nothingPlaced) return;

    seededRef.current = true;
    void (async () => {
      try {
        // The LOCATION, not the category: this hub is not a benefit category, so a
        // category-only seed request had nothing to resolve and did nothing.
        const response = await fetch(
          `/api/clients/${encodeURIComponent(clientId)}/topics`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ location: "employee_resources" }),
          },
        );
        if (response.ok) await mutate();
      } catch {
        // Seeding is a convenience — a failure leaves the board exactly as it was.
      }
    })();
  }, [clientId, data, editing, mutate]);

  // There is no Benefit row for this hub, so the contact band resolves the plan's own
  // key contacts (the sponsor's HR people) instead of a category's support list.
  const supportContacts = useMemo(
    () =>
      buildFaqSupportContacts({
        keyContacts: clientData?.keyContacts,
        // No Benefit row: there is no per-category support list to merge.
        supportContacts: undefined,
      }),
    [clientData?.keyContacts],
  );

  if (error) {
    return <HubNotice brandColor={brandColor} />;
  }

  if (!data) {
    // Nothing renders until the toggle is known: showing the section and then removing
    // it would flash HR content on a plan that has the hub switched off.
    return <div className="min-h-screen w-full bg-white" />;
  }

  /**
   * An UNPUBLISHED hub still has to be editable.
   *
   * The toggle decides what PARTICIPANTS see; it must not decide what the advisor may
   * work on, or the page could only ever be set up after it went live. So when the
   * editing chrome is mounted (and its access check has answered, or is still running —
   * waiting rather than flashing the notice) the page renders its sections even with
   * `enabled: false`. The API answers `topics: null` in that case, so the boards start
   * empty and are populated when the hub is first published.
   *
   * Everyone else — every participant, and any advisor who opened the plain URL — has
   * no provider here and still gets the notice, which is what keeps HR content out of a
   * plan that switched the hub off.
   */
  const isEditorPreview =
    editing != null && (editing.isAccessLoading || editing.canEdit);

  if (!data.enabled && !isEditorPreview) {
    return <HubNotice brandColor={brandColor} />;
  }

  const topics = data.topics;

  return (
    <div className="min-h-screen w-full">
      <main className="w-full">
        {/* Each region the panel edits gets its own blue button, which opens the
            panel on that section: this page's three sections are Section 1 (the
            header photograph), 2 (the help cards) and 3 (the quick answers).
            `relative` wrappers are the button's anchor — it is positioned. */}
        <div className="relative">
          <NewsEventsHeader
            title="Employee Resources"
            // Its OWN default, never the News & Events band: two interior pages that
            // open with the same photograph read as the same page.
            backgroundImage={
              resolvedHeaderImageUrl ?? EMPLOYEE_RESOURCES_DEFAULT_BG
            }
            backgroundImageAlt="Employee resources"
          />
          <PortalSectionEditButton
            sectionId={portalEditAnchor.employeeResourcesHero}
            label="Edit hero background"
            className="right-4 top-4"
          />
        </div>

        {/* Placements drive both question areas, exactly like a benefit hub. */}
        <div className="relative">
          <HowCanWeHelpSection
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            clientId={clientId}
            category={CATEGORY}
            topics={topics?.featured}
            actionHubPanels={topics?.actionHubPanels}
          />
          <PortalSectionEditButton
            sectionId={portalEditAnchor.employeeResourcesHelp}
            label="Edit how we can help"
            className="right-4 top-4"
          />
        </div>

        <div className="relative">
          <QuickAnswersSection
            groups={topics?.groups ?? []}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            basePath={`/${clientId}`}
            actionHubPanels={topics?.actionHubPanels}
          />
          <PortalSectionEditButton
            sectionId={portalEditAnchor.employeeResourcesQuickAnswers}
            label="Edit quick answers"
            className="right-4 top-4"
          />
        </div>

        <HaveQuestions
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          contacts={supportContacts}
          keyContacts={clientData?.keyContacts}
          category={CATEGORY}
        />
      </main>
    </div>
  );
}

/** Shown when the plan has not enabled the hub, or the read failed. */
function HubNotice({ brandColor }: { brandColor: string }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-4">
      <div
        className="w-full max-w-md border border-neutral-200 p-8 text-center"
        style={{ borderRadius: portalRadiusValue(1.5) }}
      >
        <h1 className="font-dm-serif text-2xl leading-tight text-gray-900">
          Employee Resources is not available yet
        </h1>
        <p className="mt-2 font-red-hat text-sm text-neutral-600">
          Your employer has not published HR resources here. In the meantime,{" "}
          <a
            href={`#${HAVE_QUESTIONS_SECTION_ID}`}
            className="font-semibold underline"
            style={{ color: brandColor }}
          >
            contact your benefits team
          </a>
          .
        </p>
      </div>
    </div>
  );
}
