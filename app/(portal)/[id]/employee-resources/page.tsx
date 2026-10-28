"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";

import { useClientPortal } from "@/contexts/client-portal-context";
import { NewsEventsHeader } from "@/components/pages/client-portal/sections/news-events-header";
import {
  HowCanWeHelpSection,
} from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { QuickAnswersSection } from "@/components/pages/client-portal/sections/quick-answers-section";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions";
import { buildFaqSupportContacts } from "@/lib/faq-support-contacts";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { EMPLOYEE_RESOURCES_DEFAULT_BG } from "@/lib/portal-category-hero-background";
import { HAVE_QUESTIONS_SECTION_ID } from "@/lib/portal-section-anchors";
import { portalRadiusValue } from "@/lib/typography-themes";
import type { ActionHubRow, ResolvedLocationTopics } from "@/types/topic";

/**
 * Employee Resources — the fifth hub (TF-6).
 *
 * It uses the SAME template as a benefit category: a header, "How Can We Help You
 * Today?" driven by placements, Quick Answers, then the contact band. What it does
 * NOT have is a `Benefit` row, which is the whole point: it is not a benefit
 * category, so it cannot count toward the 1–4 limit, cannot appear in Benefits at a
 * Glance, and cannot change a plan's completion state.
 *
 * The header is the News & Events band rather than the welcome banner: this hub has
 * no plan mission statement to sign, and a short, image-led hero reads better for an
 * HR-resources index. Its background is the plan's own "Employee Resources Header"
 * image (`employeePortalPreview.employeeResourcesHeroImage`, chosen in Create Plan →
 * Branding or Edit Client → Branding), falling back to the Page Image Header and
 * then to the bundled default.
 *
 * The page is opt-in per plan (`Client.employeeResourcesEnabled`). When the plan has not
 * switched it on, the API answers `enabled: false` and nothing renders — a URL that was
 * bookmarked before the toggle was turned off must not expose HR content.
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

export default function EmployeeResourcesPage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  // The hub's own header image, then the plan's Page Image Header, then nothing —
  // in which case `NewsEventsHeader` renders its bundled default. Resolved through
  // useBrandingImageUrl because the stored value can be an R2 key (`org/…`) as well
  // as an absolute URL; a bare key would be requested as the relative path /org/…
  const storedHeaderImage = [
    (clientData as any)?.employeePortalPreview?.employeeResourcesHeroImage,
    (clientData as any)?.secondaryBannerImg,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value) => value.length > 0);
  const { url: resolvedHeaderImageUrl } = useBrandingImageUrl(
    storedHeaderImage || null,
  );

  const { data, error } = useSWR<EmployeeResourcesResponse>(
    clientId ? `/api/clients/${clientId}/employee-resources?forPortal=1` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

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

  if (!data.enabled) {
    return <HubNotice brandColor={brandColor} />;
  }

  const topics = data.topics;

  return (
    <div className="min-h-screen w-full">
      <main className="w-full">
        <NewsEventsHeader
          title="Employee Resources"
          // Its OWN default, never the News & Events band: two interior pages that
          // open with the same photograph read as the same page.
          backgroundImage={
            resolvedHeaderImageUrl ?? EMPLOYEE_RESOURCES_DEFAULT_BG
          }
          backgroundImageAlt="Employee resources"
        />

        {/* Placements drive both question areas, exactly like a benefit hub. */}
        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          category={CATEGORY}
          topics={topics?.featured}
          actionHubPanels={topics?.actionHubPanels}
        />

        <QuickAnswersSection
          groups={topics?.groups ?? []}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          basePath={`/${clientId}`}
          actionHubPanels={topics?.actionHubPanels}
        />

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
