"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PortalEditorActionBar } from "@/components/portal-editing/portal-editor-action-bar";
import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { brandImagesFromClient } from "@/components/portal-editing/portal-brand-images";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { QuickAnswersBuilder } from "@/components/wizard/benefits-steps/quick-answers-builder";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { useClientPortal } from "@/contexts/client-portal-context";
import { portalEditAnchor } from "@/lib/portal-editor-sections";
import type { BrandImagesData } from "@/types/new-client-wizard";

/**
 * Employee Resources editor — the page's hero background, then the two sections
 * the page itself renders: "How Can We Help You Today?" and "Quick Answers".
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
  } = usePortalEditing();
  const { clientData } = useClientPortal();

  const savedBrandImages = useMemo(
    () => brandImagesFromClient(clientData as Record<string, any> | null),
    [clientData],
  );
  const [brandImages, setBrandImages] = useState<BrandImagesData>(
    savedBrandImages,
  );
  const [isDirty, setIsDirty] = useState(false);
  const brandImagesRef = useRef<BrandImagesData>(savedBrandImages);
  const heroDirtyRef = useRef(false);

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
      setIsDirty(true);
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

  /** Persist the drafted hero. Only the bar calls this. */
  const save = useCallback(async () => {
    if (!planId || !heroDirtyRef.current) return;

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
        body: JSON.stringify({ brandImages: payload }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not save the header image.");
      }

      heroDirtyRef.current = false;
      setIsDirty(false);
      finishSave();
      // The stored value replaces the optimistic data URL.
      await refetchPortal();
    } catch (error) {
      failSave(
        error instanceof Error
          ? error.message
          : "Could not save the header image.",
      );
    }
  }, [planId, beginSave, finishSave, failSave, refetchPortal]);

  /** Throw the draft away; the portal refetch restores the saved band. */
  const cancel = useCallback(async () => {
    heroDirtyRef.current = false;
    setIsDirty(false);
    resetSave();
    await refetchPortal();
  }, [refetchPortal, resetSave]);

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
        {/* This panel renders its sections as children rather than through the
            wrapper's `sections` list, so each one carries its own anchor — the
            address the page's three blue buttons scroll to. */}
        <section
          className="space-y-4"
          data-edit-anchor={portalEditAnchor.employeeResourcesHero}
        >
          <SectionHeader number={1} title="Hero Background" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The image behind this page&rsquo;s &ldquo;Employee
            Resources&rdquo; title. It fills a band 400&nbsp;px tall on a desktop
            screen (1440&times;400 is the recommended image), so keep the subject
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
          <SectionHeader number={2} title="How Can We Help You Today?" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The cards participants choose from, in the order they appear. Promote
            a question here, reorder the cards, or move one down to Quick
            Answers.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <QuickAnswersBuilder
              planId={planId}
              location="employee_resources"
              mode="featured"
            />
          </div>
        </section>

        <section
          className="space-y-4"
          data-edit-anchor={portalEditAnchor.employeeResourcesQuickAnswers}
        >
          <SectionHeader number={3} title="Quick Answers" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            The grouped questions below the cards — the same board as above, so a
            question is always in exactly one place.
          </p>
          <div className="rounded-lg border border-muted bg-white p-4 dark:bg-gray-800">
            <QuickAnswersBuilder
              planId={planId}
              location="employee_resources"
              mode="answers"
            />
          </div>
        </section>
      </div>
    </PortalEditorShell>
  );
}
