"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";

import { PortalEditorActionBar } from "@/components/portal-editing/portal-editor-action-bar";
import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { usePortalDirtyReport } from "@/components/portal-editing/portal-draft-badge";
import { PortalEmployeeResourcesVisibilityToggle } from "@/components/portal-editing/portal-employee-resources-visibility-toggle";
import { PortalFooterSection } from "@/components/portal-editing/portal-footer-section";
import { brandImagesFromClient } from "@/components/portal-editing/portal-brand-images";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { TypographySection } from "@/components/wizard/new-client-steps/sections/typography-section";
import {
  normalizeTypographyThemeId,
  type TypographyThemeId,
} from "@/lib/typography-themes";
import { sameDraft } from "@/lib/portal-draft-compare";
import {
  QuickAnswersBuilder,
  type BoardPayload,
} from "@/components/wizard/benefits-steps/quick-answers-builder";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { usePortalPublishAccess } from "@/components/portal-editing/portal-visibility-switch";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  PORTAL_SECTION_IDS,
  portalEditAnchor,
} from "@/lib/portal-editor-sections";
import type { BrandImagesData } from "@/types/new-client-wizard";

/**
 * Employee Resources editor — whether the page is published, the plan's typography
 * theme, the page's hero background, then the two sections the page itself renders:
 * "How Can We Help You Today?" and "Quick Answers".
 *
 * Visibility is Section 1 because the hub is opt-in per plan: an advisor arranging
 * questions on a hidden page has to see that first. Typography follows, because the
 * theme is the whole page's frame — the same picker Create/Edit Client and Edit Benefit
 * show — and it is a PLAN-level value (`Client.typographyTheme`), not something this hub
 * owns. It drafts and saves with the hero: the page and header beside the panel repaint
 * through `patchClientData`, and the value is written on Save.
 *
 * The hero is the "Employee Resources Header" Brand Images slot, the same
 * control Create Client Step 1 shows. That slot has no Client column: the save
 * route stores it inside `employeePortalPreview.employeeResourcesHeroImage`,
 * which is exactly what the page reads — then a default of its own. It does NOT
 * fall back to the Page Image Header: that belongs to the interior benefit pages
 * and to News & Events, and borrowing it made a News & Events hero silently
 * replace this page's default.
 *
 * The hero is a DRAFT, like the other portal panels: the page beside the panel
 * repaints through `patchClientData`, but nothing is written until Save. Because
 * that route writes the value verbatim, an uploaded image is sent to R2 first
 * and the stored key is what the PUT carries.
 *
 * The two question sections are the SAME placement board split in half: the
 * Featured cards (`mode="featured"`) and the grouped questions
 * (`mode="answers"`). Each instance edits only its own half and still saves the
 * complete board, so neither can drop the other's work.
 */
export function PortalEmployeeResourcesEditor() {
  const {
    planId,
    beginSave,
    finishSave,
    failSave,
    resetSave,
    patchClientData,
    refetchPortal,
    employeeResourcesReadKey,
  } = usePortalEditing();
  const { clientData } = useClientPortal();
  const { mutate } = useSWRConfig();

  /**
   * Whether the "Visibility" section is offered at all, and therefore whether every
   * section below it moves down one. The same decision the switch itself makes — a
   * viewer who may not publish does not see an empty section 1.
   */
  const { mayPublish } = usePortalPublishAccess();
  const sectionNumber = (index: number) => index + (mayPublish ? 1 : 0);

  /**
   * This page answers from its own read, not from the board the builders below edit.
   * Both builders hand back the whole board the moment a question moves, so the page
   * beside the panel repaints in the same frame instead of waiting for this read to
   * come back.
   *
   * The read is the BUILDER payload, not the participant `?forPortal=1` one: that
   * answers `topics: null` while the hub is unpublished, so a patch would repaint
   * nothing and the page's Quick Answers section would stay empty until publishing.
   * The page reads this same key in an armed edit view (and the dashboard preview
   * supplies its own via the provider), so this patch and the page share one cache
   * entry and the board is visible even while the hub is unpublished.
   */
  const topicsKey = planId
    ? employeeResourcesReadKey ??
      `/api/clients/${planId}/employee-resources`
    : null;
  const patchTopics = useCallback(
    (board: BoardPayload) => {
      if (!topicsKey) return;
      void mutate(
        topicsKey,
        (current: { topics?: Record<string, unknown> } | undefined) =>
          current
            ? {
                ...current,
                topics: {
                  ...(current.topics ?? {}),
                  featured: board.featured,
                  groups: board.groups,
                  hiddenCount: board.hidden.length,
                },
              }
            : current,
        { revalidate: false },
      );
    },
    [mutate, topicsKey],
  );

  const savedBrandImages = useMemo(
    () => brandImagesFromClient(clientData as Record<string, any> | null),
    [clientData],
  );
  const [brandImages, setBrandImages] =
    useState<BrandImagesData>(savedBrandImages);
  const brandImagesRef = useRef<BrandImagesData>(savedBrandImages);
  const heroDirtyRef = useRef(false);
  /**
   * What this panel LOADED, for "is this actually a change?".
   *
   * `savedBrandImages` follows the live portal context, which this editor patches
   * on every upload, so it cannot serve as the baseline. This snapshot changes only
   * when the draft is (re)seeded or saved — which is what makes a revert to the
   * original image read as clean again.
   */
  const baselineBrandImagesRef = useRef<BrandImagesData>(savedBrandImages);

  /**
   * Section 1 — the plan's typography theme.
   *
   * `Client.typographyTheme`, like Create/Edit Client and Edit Benefit: the theme frames
   * the whole portal page, so it is drafted here and written with the hero on Save.
   */
  const savedTheme = useMemo(
    () =>
      normalizeTypographyThemeId(
        clientData?.typographyTheme,
      ) as TypographyThemeId,
    [clientData?.typographyTheme],
  );
  const [themeDraft, setThemeDraft] =
    useState<TypographyThemeId>(savedTheme);
  const themeDirtyRef = useRef(false);
  /** The theme the panel loaded — same role as the hero baseline above. */
  const baselineThemeRef = useRef<TypographyThemeId>(savedTheme);

  /**
   * The badge follows the DRAFT, not the click: pick a value, pick the original
   * back, and this is false again. Nothing else has to remember to clear it.
   */
  const themeDirty = themeDraft !== baselineThemeRef.current;
  const heroDirty = !sameDraft(brandImages, baselineBrandImagesRef.current);
  const isDirty = themeDirty || heroDirty;
  usePortalDirtyReport(isDirty);

  // Re-seed from the plan whenever it reloads and the advisor has not picked one.
  useEffect(() => {
    if (themeDirtyRef.current) return;
    baselineThemeRef.current = savedTheme;
    setThemeDraft(savedTheme);
  }, [savedTheme]);

  /** Live-preview the theme: the page and the header read it from the context. */
  const changeTheme = useCallback(
    (id: TypographyThemeId) => {
      themeDirtyRef.current = true;
      setThemeDraft(id);
      patchClientData({ typographyTheme: id } as any);
    },
    [patchClientData],
  );

  // Re-seed from the plan whenever it reloads and nothing is drafted. Guarded by
  // the serialized value so an equal-but-new object cannot re-render forever.
  const seededHeroRef = useRef<string>("");
  useEffect(() => {
    const json = JSON.stringify(savedBrandImages);
    if (heroDirtyRef.current) {
      seededHeroRef.current = json;
      return;
    }
    if (seededHeroRef.current === json) return;
    seededHeroRef.current = json;
    baselineBrandImagesRef.current = savedBrandImages;
    brandImagesRef.current = savedBrandImages;
    setBrandImages(savedBrandImages);
  }, [savedBrandImages]);

  /** Live-preview the header band while the advisor adjusts it. */
  const changeBrandImages = useCallback(
    async (next: BrandImagesData) => {
      const hero = next.employeeResourcesHero ?? null;
      const currentPlan = (clientData ?? {}) as Record<string, any>;
      brandImagesRef.current = next;
      heroDirtyRef.current = true;
      setBrandImages(next);
      // `employeePortalPreview` is merged here: `patchClientData` replaces the
      // key it is given, and this hub's image lives inside that blob.
      patchClientData({
        brandImages: next,
        employeePortalPreview: {
          ...((currentPlan.employeePortalPreview as Record<string, unknown>) ??
            {}),
          employeeResourcesHeroImage: hero?.url ?? "",
        },
      });
    },
    [clientData, patchClientData],
  );

  /**
   * Re-seed the drafts AND their baselines from the saved plan.
   *
   * Save and Cancel both land here: the optimistic draft may have patched the
   * context, so "equal to what the server now holds" has to be re-established, not
   * assumed. That is what leaves the header badge clean afterwards.
   */
  const reseedFromPlan = useCallback((plan: Record<string, any> | null) => {
    const nextTheme = normalizeTypographyThemeId(
      plan?.typographyTheme,
    ) as TypographyThemeId;
    const nextBrandImages = brandImagesFromClient(plan);
    baselineThemeRef.current = nextTheme;
    setThemeDraft(nextTheme);
    baselineBrandImagesRef.current = nextBrandImages;
    brandImagesRef.current = nextBrandImages;
    setBrandImages(nextBrandImages);
    seededHeroRef.current = JSON.stringify(nextBrandImages);
  }, []);

  /** Persist the drafted hero and theme. Only the bar calls this. */
  const save = useCallback(async () => {
    if (!planId || !isDirty) return;

    beginSave();
    try {
      let payload = brandImagesRef.current;
      const hero = payload.employeeResourcesHero ?? null;

      // The plan route stores this slot's URL as-is (no base64 pass), so the
      // upload has to become an R2 object before it is sent.
      if (hero?.url?.startsWith("data:")) {
        const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
        const key = await uploadBrandingToR2({
          dataUrlOrFile: hero.url,
          fileName: hero.fileName || "employee-resources-header.png",
          clientId: planId,
          slot: "employeeResourcesHero",
        });
        if (key) {
          payload = {
            ...payload,
            employeeResourcesHero: { ...hero, url: key },
          };
        }
      }

      const response = await fetch(`/api/clients/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // The theme travels with the hero: both are plan-level values this panel drafts.
        body: JSON.stringify({
          brandImages: payload,
          typographyTheme: themeDraft,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not save the header image.");
      }

      heroDirtyRef.current = false;
      themeDirtyRef.current = false;
      finishSave();
      // The stored value replaces the optimistic data URL (and the R2 key the
      // upload produced), so the drafts are re-seeded from the saved plan.
      const fresh = await refetchPortal();
      reseedFromPlan(fresh as Record<string, any> | null);
    } catch (error) {
      failSave(
        error instanceof Error
          ? error.message
          : "Could not save the header image.",
      );
    }
  }, [
    planId,
    isDirty,
    themeDraft,
    beginSave,
    finishSave,
    failSave,
    refetchPortal,
    reseedFromPlan,
  ]);

  /** Throw the draft away; the portal refetch restores the saved band. */
  const cancel = useCallback(async () => {
    heroDirtyRef.current = false;
    themeDirtyRef.current = false;
    resetSave();
    const fresh = await refetchPortal();
    reseedFromPlan(fresh as Record<string, any> | null);
  }, [refetchPortal, resetSave, reseedFromPlan]);

  return (
    <PortalEditorShell
      footer={
        <PortalEditorActionBar
          isDirty={isDirty}
          onSave={() => void save()}
          onCancel={() => void cancel()}
        />
      }
    >
      <div className="space-y-8">
        {/* Section 1 — can employees reach this page at all? The hub is opt-in per
            plan, so its state belongs at the top: an advisor who sets up questions on
            a hidden hub has to know they are not live yet. */}
        {mayPublish ? (
          <section className="space-y-4">
            <SectionHeader number={1} title="Visibility" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Whether employees can reach this page. Publishing adds Employee
              Resources to the plan&rsquo;s portal header; hiding it removes the link - nothing is deleted.
            </p>
            <PortalEmployeeResourcesVisibilityToggle />
          </section>
        ) : null}

        {/* This panel renders its sections as children rather than through the
            wrapper's `sections` list, so each one carries its own anchor — the
            address the page's three blue buttons scroll to. */}
        <section className="space-y-4">
          <SectionHeader number={sectionNumber(1)} title="Typography Theme" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The fonts and corner treatment for this plan&rsquo;s whole portal. It is
            the same PLAN-level setting Create Plan → Step 2, Edit Plan and the benefit
            panels edit, so changing it here changes every portal page.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <TypographySection
              value={themeDraft}
              onChange={changeTheme}
              // The panel is narrow: one card per row.
              compact
              enableAiSuggestion
              websiteUrl={clientData?.companyWebsite}
              companyName={clientData?.companyName}
            />
          </div>
        </section>

        <section
          className="space-y-4"
          data-edit-anchor={portalEditAnchor.employeeResourcesHero}
        >
          <SectionHeader number={sectionNumber(2)} title="Hero Background" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The image behind this page&rsquo;s &ldquo;Employee Resources&rdquo;
            title. It fills a band 400&nbsp;px tall on a desktop screen
            (1440&times;400 is the recommended image), so keep the subject
            centred. When none is set, this page uses its own bundled default
            &mdash; the Page Image Header is not borrowed.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <BrandImagesSection
              brandImages={brandImages}
              visibleSlots={["employeeResourcesHero"]}
              onBrandImagesChange={changeBrandImages}
              logoUrl={clientData?.companyLogo ?? null}
              companyName={clientData?.companyName}
              // The live page is already beside this panel.
              showNewsEventsPreview={false}
            />
          </div>
        </section>

        <section
          className="space-y-4"
          data-edit-anchor={portalEditAnchor.employeeResourcesHelp}
        >
          <SectionHeader number={sectionNumber(3)} title="How Can We Help You Today?" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The cards participants choose from, in the order they appear.
            Promote a question here, reorder the cards, or move one down to
            Quick Answers.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <QuickAnswersBuilder
              planId={planId}
              location="employee_resources"
              mode="featured"
              onBoardChange={patchTopics}
            />
          </div>
        </section>

        <section
          className="space-y-4"
          data-edit-anchor={portalEditAnchor.employeeResourcesQuickAnswers}
        >
          <SectionHeader number={sectionNumber(4)} title="Quick Answers" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The grouped questions below the cards — the same board as above, so
            a question is always in exactly one place.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <QuickAnswersBuilder
              planId={planId}
              location="employee_resources"
              mode="answers"
              onBoardChange={patchTopics}
            />
          </div>
        </section>

        {/* The footer disclosure shared by the four non-hub pages. */}
        <section
          className="space-y-4"
          data-edit-anchor={PORTAL_SECTION_IDS.disclosure}
        >
          <SectionHeader number={sectionNumber(5)} title="Disclosure" />
          <PortalFooterSection />
        </section>
      </div>
    </PortalEditorShell>
  );
}
