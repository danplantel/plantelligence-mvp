"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, X } from "lucide-react";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import { BenefitPortalPreview } from "@/components/wizard/benefits-steps/benefit-portal-preview";
import { BenefitsEditorPanel } from "@/components/wizard/benefits-steps/benefits-editor-panel";
import { MobilePreviewFrame } from "@/components/wizard/benefits-steps/step-2";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { applyTypographyToElement } from "@/lib/typography-themes";
import {
  usePreviewEditorLayout,
  PREVIEW_EDITOR_PANEL_WIDTH,
} from "@/lib/preview-editor-layout";

/** Native width the portal content is laid out at before being scaled down. */
const DESKTOP_WIDTH = 1400;
/** Mobile preview width in px (the phone frame's screen). */
const MOBILE_WIDTH = 200;
/** Mobile preview aspect ratio (18:9 phone). */
const MOBILE_ASPECT_RATIO = 18 / 9;
/**
 * Width of the inline Editing Panel column. The panel is reserved this much room
 * beside the (rail-collapsed) sidebar while open — the same contract
 * `EditPlanPreviewSection` uses. See lib/preview-editor-layout.ts.
 */
const EDITOR_PANEL_WIDTH = PREVIEW_EDITOR_PANEL_WIDTH;

type PreviewMode = "desktop" | "mobile";

interface EditBenefitPreviewSectionProps {
  /**
   * Fixed vertical offset (px) for the toolbar + preview area, used to clear the
   * app header above them. The Edit Benefit page hides its own header on the
   * Preview tab, so this is just the 64px app header height by default.
   */
  topOffset?: number;
}

/**
 * Edit Benefit → **Preview** tab.
 *
 * Mirrors the Edit Plan page's Preview tab
 * ([`EditPlanPreviewSection`](components/wizard/new-client-steps/sections/edit-plan-preview-section.tsx)):
 * the live benefit portal preview (desktop/mobile) sits side-by-side with an
 * inline Editing Panel. While the panel is open the sidebar is widened to
 * {@link EDITOR_PANEL_WIDTH} and the preview area's left edge follows, so the
 * fixed-width portal canvas is scaled down to the smaller width — the preview
 * visibly shrinks rather than being covered by the panel.
 *
 * The preview composition (PortalHeader + `BenefitPortalPreview`, phone frame,
 * toolbar) is the same one the Create Benefits wizard's Step 2 uses.
 */
export function EditBenefitPreviewSection({
  topOffset = 64,
}: EditBenefitPreviewSectionProps) {
  const step1Data = useBenefitsWizardStore((s) => s.stepData.step1);
  const selectedPlan = step1Data?.selectedPlan as any;
  const planId = step1Data?.planId;

  // ── Editor panel state ──
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditorAnimating, setIsEditorAnimating] = useState(false);
  const editorIsOpen = isEditorOpen || isEditorAnimating;

  // Auto-open the Editing Panel when the Preview tab mounts so the advisor lands
  // straight in the editor — matching Edit Plan's Preview tab and the Create
  // Benefits wizard's Step 2. The panel fades in only once `isAnimating` flips,
  // so both setters are needed. Empty deps keep the cleanup for unmount only (a
  // cleanup tied to a re-render would clear the animation timer before it fires).
  useEffect(() => {
    setIsEditorOpen(true);
    const timer = setTimeout(() => setIsEditorAnimating(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // ── Preview layout ──
  // Reserve a column for the Editing Panel beside the (rail-collapsed) sidebar
  // instead of pinning the panel to `left: 0` and widening `--sidebar-width` to
  // 36rem, which painted it over the nav. See lib/preview-editor-layout.ts.
  usePreviewEditorLayout(editorIsOpen);

  // Notify the app header when this inline Editing Panel opens/closes so it can
  // hide the page title and right-align the Edit Benefit tabs.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("step5EditorStateChange", {
        detail: { isOpen: isEditorOpen },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("step5EditorStateChange", { detail: { isOpen: false } }),
      );
    };
  }, [isEditorOpen]);

  // ── Portal typography theme ──
  // Applied to the document root so both the desktop preview (inherited CSS
  // variables) and the mobile preview iframe (which copies root custom
  // properties) reflect the selected theme live. Restored on unmount / change.
  const typographyTheme = step1Data?.typographyTheme;
  useEffect(() => {
    return applyTypographyToElement(
      typeof document !== "undefined" ? document.documentElement : null,
      typographyTheme,
    );
  }, [typographyTheme]);

  // ── Plan details ──
  // The store deliberately does not persist `selectedPlan`, so a reload that
  // lands directly on the Preview tab would otherwise render a logo-less header.
  // Fetch the plan (authoritative) and fall back to the store's selection.
  const [planDetails, setPlanDetails] = useState<any>(null);
  useEffect(() => {
    if (!planId) {
      setPlanDetails(null);
      return;
    }
    // Reset before fetching so switching plans never shows the previous logo.
    setPlanDetails(null);
    let cancelled = false;
    fetch(`/api/clients/${planId}`)
      .then((r) => r.json())
      .then((result) => {
        if (cancelled || !result?.data) return;
        setPlanDetails(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [planId]);

  // Prefill the typography theme from the plan's saved value when this session
  // has none, so the theme shown here matches what the live portal already uses.
  useEffect(() => {
    const savedTheme = planDetails?.typographyTheme;
    if (!savedTheme) return;
    const store = useBenefitsWizardStore.getState();
    const latest = store.stepData.step1;
    if (!latest || latest.typographyTheme) return;
    store.saveStepData(1, { ...latest, typographyTheme: savedTheme });
  }, [planDetails?.typographyTheme]);

  const resolveCompanyLogo = (p: any): string | undefined => {
    if (!p) return undefined;
    return typeof p.companyLogo === "object"
      ? (p.companyLogo as any)?.url
      : p.companyLogo || undefined;
  };

  const planCompanyLogo =
    resolveCompanyLogo(planDetails) ||
    resolveCompanyLogo(step1Data?.companyLogo) ||
    resolveCompanyLogo(selectedPlan) ||
    undefined;

  const brandColor =
    planDetails?.brandColor ||
    selectedPlan?.brandColor ||
    selectedPlan?.primaryColor ||
    "#1F3A60";
  const secondaryColor =
    planDetails?.secondaryColor || selectedPlan?.secondaryColor || "#6B7280";

  // ── Preview mode ──
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const togglePreviewMode = () =>
    setPreviewMode((prev) => (prev === "mobile" ? "desktop" : "mobile"));

  // ── Refs ──
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(52);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);

  // ── Scale state and calculations (desktop only) ──
  // The portal is laid out at DESKTOP_WIDTH and then scaled to fit whatever
  // width the preview area has. Opening the Editing Panel reserves 36rem for it
  // between the sidebar and the preview, so the scale drops and the preview
  // shrinks.
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(
    undefined,
  );
  const [contentWidth, setContentWidth] = useState(DESKTOP_WIDTH);

  const updateScale = useCallback(() => {
    if (previewMode === "mobile") return;
    const content = previewContentRef.current;
    const scrollable = scrollableRef.current;
    if (!content || !scrollable) return;
    const availableWidth = scrollable.clientWidth;
    if (availableWidth >= DESKTOP_WIDTH) {
      // Enough space — fill the full width, no scaling needed.
      setContentWidth(availableWidth);
      setScale(1);
      setScaledHeight(content.scrollHeight);
    } else {
      // Limited space (i.e. the Editing Panel is open) — fixed width, scaled down.
      setContentWidth(DESKTOP_WIDTH);
      const newScale = availableWidth / DESKTOP_WIDTH;
      setScale(newScale);
      setScaledHeight(content.scrollHeight * newScale);
    }
  }, [previewMode]);

  useEffect(() => {
    if (previewMode === "mobile") return;
    const raf = requestAnimationFrame(() => updateScale());
    return () => cancelAnimationFrame(raf);
  }, [updateScale, isEditorOpen, previewMode]);

  // Observe the scaled content div for size changes (e.g. images loading) so
  // scaledHeight stays in sync with the actual content height.
  useEffect(() => {
    const content = previewContentRef.current;
    if (!content || previewMode === "mobile") return;
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(content);
    return () => observer.disconnect();
  }, [updateScale, previewMode]);

  // The preview area's width changes when the panel opens/closes (the left edge
  // follows `--sidebar-width`), so watch it and re-scale.
  useEffect(() => {
    const scrollable = scrollableRef.current;
    if (!scrollable) return;
    const observer = new ResizeObserver(() => {
      if (previewMode !== "mobile") updateScale();
    });
    observer.observe(scrollable);
    return () => observer.disconnect();
  }, [updateScale, previewMode]);

  useEffect(() => {
    if (previewMode !== "mobile") {
      const timer = setTimeout(() => updateScale(), 100);
      return () => clearTimeout(timer);
    }
  }, [previewMode, updateScale]);

  // Mobile mode renders inside an iframe at its own scale — reset desktop state.
  useEffect(() => {
    if (previewMode === "mobile") {
      setScale(1);
      setScaledHeight(undefined);
    }
  }, [previewMode]);

  // ── Measure the toolbar height so the preview clears it ──
  useEffect(() => {
    if (!barRef.current) return;
    setBarHeight(barRef.current.offsetHeight);
    const observer = new ResizeObserver(() => {
      if (barRef.current) setBarHeight(barRef.current.offsetHeight);
    });
    observer.observe(barRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Editor panel handlers ──
  const handleCloseEditor = useCallback(() => {
    setIsEditorAnimating(false);
    setIsEditorOpen(false);
  }, []);

  const handleOpenEditor = useCallback(() => {
    setIsEditorOpen(true);
    setTimeout(() => setIsEditorAnimating(true), 10);
  }, []);

  const handleToggleEditor = useCallback(() => {
    if (editorIsOpen) {
      handleCloseEditor();
    } else {
      handleOpenEditor();
    }
  }, [editorIsOpen, handleCloseEditor, handleOpenEditor]);

  // ── Scroll the preview to a section when its editor input is focused ──
  // `BenefitsEditorPanel` dispatches `benefitsPreviewScrollTo`; the preview
  // carries `data-preview-scroll-container` and `BenefitPortalPreview` the
  // matching `data-preview-field` markers.
  useEffect(() => {
    const handlePreviewScroll = (e: Event) => {
      const field = (e as CustomEvent<{ field?: string }>).detail?.field;
      if (!field) return;
      const container = document.querySelector(
        "[data-preview-scroll-container]",
      ) as HTMLElement | null;
      if (!container) return;

      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-preview-field="${field}"]`);
        if (!el) return;
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const elCenter = elRect.top + elRect.height / 2;
        const containerCenter = containerRect.top + container.clientHeight / 2;
        const delta = elCenter - containerCenter;
        const maxScroll = container.scrollHeight - container.clientHeight;
        const targetScroll = Math.min(
          Math.max(0, container.scrollTop + delta),
          maxScroll,
        );
        container.scrollTo({ top: targetScroll, behavior: "smooth" });
      });
    };
    window.addEventListener("benefitsPreviewScrollTo", handlePreviewScroll);
    return () =>
      window.removeEventListener("benefitsPreviewScrollTo", handlePreviewScroll);
  }, []);

  const planCompanyName =
    ((planDetails?.companyName as string | undefined) || "").trim() ||
    ((selectedPlan?.companyName as string | undefined) || "").trim();

  const companyWebsite =
    planDetails?.companyWebsite || selectedPlan?.companyWebsite || "";

  return (
    <div className="w-full">
      {/* ── Toolbar (fixed, shifts with the sidebar via left offset) ── */}
      <div
        ref={barRef}
        className="fixed z-[45] flex items-center justify-between gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm"
        style={{
          top: `${topOffset}px`,
          left:
            "calc(var(--sidebar-width, 16rem) + var(--editor-inset, 0px))",
          right: 0,
          transition: "left 300ms ease-in-out",
        }}
      >
        {/* Left: Edit Panel toggle */}
        <button
          type="button"
          onClick={handleToggleEditor}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {editorIsOpen ? (
            <>
              <X className="w-4 h-4" />
              Close Edit Panel
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Open Edit Panel
            </>
          )}
        </button>

        {/* Right: preview mode toggle. Save is no longer rendered here — the
            page's fixed bottom action bar owns Cancel + Save Changes on every
            tab, matching Edit Client. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePreviewMode}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            title={
              previewMode === "mobile"
                ? "Switch to Desktop preview"
                : "Switch to Mobile preview"
            }
          >
            {previewMode === "mobile" ? (
              <>
                <Monitor className="w-4 h-4" /> Desktop Preview
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" /> Mobile Preview
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Preview area (fixed, shifts with the sidebar via left offset) ── */}
      <div
        className="fixed z-20 flex flex-col"
        style={{
          top: `${topOffset + (barHeight > 0 ? barHeight : 50)}px`,
          left:
            "calc(var(--sidebar-width, 16rem) + var(--editor-inset, 0px))",
          right: 0,
          bottom: 0,
          transition: "left 300ms ease-in-out",
        }}
      >
        {/* Portal header — sticky at the top of the scroll container. Hidden in
            mobile mode, where it renders inside the iframe instead. */}
        {previewMode !== "mobile" && (
          <div className="sticky top-0 z-10 shadow-md flex-shrink-0">
            <PortalHeader
              companyData={{ companyLogo: planCompanyLogo }}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              clientId={planId}
              categoryPortalVisibility={step1Data?.benefitVisibility ?? null}
              benefits={selectedPlan?.employeePortalPreview?.benefits ?? null}
              enableNavigation={false}
              scale={scale}
              referenceWidth={contentWidth}
            />
          </div>
        )}

        {/* Scrollable content — items-center keeps the preview centered */}
        <div
          ref={scrollableRef}
          data-preview-scroll-container
          className={`flex-1 overflow-x-hidden bg-gray-300 dark:bg-gray-950 flex flex-col items-center ${
            previewMode === "mobile"
              ? "overflow-y-hidden justify-center"
              : "overflow-y-auto"
          }`}
        >
          {previewMode === "mobile" ? (
            /* ── Mobile phone frame — centered without scrolling ── */
            <div className="flex items-center justify-center w-full py-6 px-4 flex-shrink-0">
              <div
                className="relative rounded-[36px] border-[4px] border-gray-800 dark:border-gray-700 bg-gray-900 shadow-2xl flex-shrink-0 overflow-hidden"
                style={{ width: MOBILE_WIDTH + 20 }}
              >
                {/* Phone notch */}
                <div className="absolute top-[7px] left-1/2 -translate-x-1/2 w-[90px] h-[5px] bg-gray-900 dark:bg-gray-800 rounded-full z-50" />
                {/* Side buttons (decorative) */}
                <div className="absolute top-24 -left-[3px] w-[3px] h-8 bg-gray-700 dark:bg-gray-600 rounded-l" />
                <div className="absolute top-36 -left-[3px] w-[3px] h-12 bg-gray-700 dark:bg-gray-600 rounded-l" />
                <div className="absolute top-20 -right-[3px] w-[3px] h-10 bg-gray-700 dark:bg-gray-600 rounded-r" />
                <div className="flex items-center justify-center py-2">
                  <MobilePreviewFrame
                    width={MOBILE_WIDTH}
                    themeKey={typographyTheme}
                  >
                    <div className="sticky top-0 w-full z-50 shrink-0">
                      <PortalHeader
                        companyData={{ companyLogo: planCompanyLogo }}
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        clientId={planId}
                        categoryPortalVisibility={
                          step1Data?.benefitVisibility ?? null
                        }
                        benefits={
                          selectedPlan?.employeePortalPreview?.benefits ?? null
                        }
                        enableNavigation={false}
                      />
                    </div>
                    <div>
                      <BenefitPortalPreview
                        mobile
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                      />
                    </div>
                  </MobilePreviewFrame>
                </div>
              </div>
            </div>
          ) : (
            /* ── Desktop: scaled preview ── */
            <div
              style={{
                height: scaledHeight != null ? `${scaledHeight}px` : "100%",
              }}
            >
              <div
                ref={previewContentRef}
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "center top",
                  width: `${contentWidth}px`,
                  overflowX: "hidden",
                }}
              >
                <BenefitPortalPreview
                  brandColor={brandColor}
                  secondaryColor={secondaryColor}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Inline Editing Panel (fixed column beside the sidebar) ──
          Rendered only while open/animating (the wrapper renders nothing once
          closed) so no empty column is left beside the sidebar.
          `top: 0` matches Edit Plan's EditorPanelWrapper (fixed variant uses
          `top-0`) and `left` starts at the rail-collapsed sidebar, so the panel
          sits flush to the top and beside the nav instead of covering it. */}
      {editorIsOpen && (
        <div
          className="fixed z-[51] flex flex-col"
          style={{
            top: 0,
            left: "var(--sidebar-width, 16rem)",
            bottom: 0,
            width: EDITOR_PANEL_WIDTH,
            transition: "width 300ms ease-in-out",
          }}
        >
          <BenefitsEditorPanel
            variant="inline"
            isOpen={isEditorOpen}
            isAnimating={isEditorAnimating}
            onClose={handleCloseEditor}
            planCompanyName={planCompanyName}
            companyWebsite={companyWebsite}
          />
        </div>
      )}
    </div>
  );
}
