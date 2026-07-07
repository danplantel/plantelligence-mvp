"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { BenefitPortalPreview } from "./benefit-portal-preview";
import { BenefitsEditorPanel } from "./benefits-editor-panel";
import { useBenefitsEditorState } from "./hooks/use-benefits-editor-state";
import { useBenefitsLenisScroll } from "./hooks/use-benefits-lenis-scroll";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import { Smartphone, Monitor } from "lucide-react";

/** Native preview widths for each mode */
const DESKTOP_WIDTH = 1400;
/** Height of the fixed app header on wizard pages (h-[72px] with stepper) */
const HEADER_HEIGHT = 72;
/** Estimated height of the fixed bottom navigation bar from BenefitsWizard */
const BOTTOM_NAV_HEIGHT = 72;
/** Mobile preview aspect ratio (9:21 = width:height) */
const MOBILE_ASPECT_RATIO = 21 / 9;
/** Mobile preview width in px */
const MOBILE_WIDTH = 390;

type PreviewMode = "desktop" | "mobile";

/**
 * Renders children into an iframe so that CSS viewport-based media queries
 * (Tailwind sm:, md:, lg:, etc.) evaluate against the iframe's actual width
 * rather than the parent browser window.
 */
function MobilePreviewFrame({ children, width }: { children: React.ReactNode; width: number }) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const doc = iframe.contentDocument;
        if (!doc) return;

        // Reset the iframe document with viewport meta so media queries
        // evaluate against the iframe's actual width (390px), not a default.
        // Body overflow-x: hidden prevents any horizontal scroll within the iframe.
        doc.open();
        doc.write(
            '<!DOCTYPE html><html style="overflow-x:hidden"><head>' +
            '<meta name="viewport" content="width=' + width + ', initial-scale=1">' +
            '</head><body style="overflow-x:hidden; width:100%; margin:0"></body></html>',
        );
        doc.close();

        // Copy stylesheets from parent to iframe so Tailwind etc. apply.
        const parentStyles = Array.from(
            document.querySelectorAll("style, link[rel=stylesheet]"),
        ) as (HTMLStyleElement | HTMLLinkElement)[];

        parentStyles.forEach((el) => {
            const clone = el.cloneNode(true) as HTMLElement;
            doc.head.appendChild(clone);
        });

        // Copy body classes (dark mode, theme, etc.)
        document.body.classList.forEach((cls) => {
            doc.body.classList.add(cls);
        });

        // Copy CSS custom properties from parent :root
        const rootStyles = getComputedStyle(document.documentElement);
        const vars = Array.from(document.documentElement.style).filter((k) =>
            k.startsWith("--"),
        );
        vars.forEach((k) => {
            doc.documentElement.style.setProperty(k, rootStyles.getPropertyValue(k));
        });

        setMountNode(doc.body);

        return () => {
            setMountNode(null);
        };
    }, [width]);

    const height = Math.round(width * MOBILE_ASPECT_RATIO);

    return (
        <iframe
            ref={iframeRef}
            title="Mobile Preview"
            style={{
                width: `${width}px`,
                height: `${height}px`,
                border: "none",
                background: "white",
                flexShrink: 0,
                maxHeight: "100%",
            }}
        >
            {mountNode &&
                createPortal(
                    <div
                        style={{
                            width: `${width}px`,
                            minHeight: "100%",
                            overflowX: "hidden",
                            overflowY: "auto",
                        }}
                    >
                        {children}
                    </div>,
                    mountNode,
                )}
        </iframe>
    );
}

export function BenefitsStep2() {
    const editorState = useBenefitsEditorState();
    // Disable main Lenis smooth scroll — the preview uses native scrolling,
    // and the page scroll is locked. Lenis would intercept wheel events and
    // prevent them from reaching the preview container.
    const { editorScrollContainerRef } = useBenefitsLenisScroll(editorState.isEditorOpen, true);
    const { currentStep, stepData } = useBenefitsWizardStore();
    const step1Data = stepData.step1;
    const [editorInitialized, setEditorInitialized] = useState(false);
    const barRef = useRef<HTMLDivElement>(null);
    const [barHeight, setBarHeight] = useState(52);

    // ── Preview mode & scaling state ──
    const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");

    const previewContentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

    // Refs for the scrollable preview area and its container
    const scrollableRef = useRef<HTMLDivElement>(null);

    // Initialize editor as open on mount with default section
    useEffect(() => {
        if (!editorInitialized) {
            setEditorInitialized(true);
            const timer = setTimeout(() => {
                editorState.setIsEditorOpen(true);
                setTimeout(() => editorState.setIsEditorAnimating(true), 10);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [editorInitialized, editorState]);

    // Close editor when leaving Step 2
    useEffect(() => {
        if (currentStep !== 2 && editorState.isEditorOpen) {
            editorState.handleCloseEditor();
        }
    }, [currentStep, editorState]);

    // Measure bar height (button bar only, excludes the header spacer)
    useEffect(() => {
        if (barRef.current) {
            setBarHeight(barRef.current.offsetHeight);
            const observer = new ResizeObserver(() => {
                if (barRef.current) setBarHeight(barRef.current.offsetHeight);
            });
            observer.observe(barRef.current);
            return () => observer.disconnect();
        }
    }, []);

    // ── Lock body scroll while on Step 2 ──
    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
        };
    }, []);

    // ── Scale calculation (desktop only — mobile uses iframe, no scaling) ──
    const updateScale = useCallback(() => {
        if (previewMode === "mobile") return;
        const content = previewContentRef.current;
        const scrollable = scrollableRef.current;
        if (!content || !scrollable) return;

        const availableWidth = scrollable.clientWidth;
        const newScale = Math.min(availableWidth / DESKTOP_WIDTH, 1);
        setScale(newScale);

        const contentHeight = content.scrollHeight;
        setScaledHeight(contentHeight * newScale);
    }, [previewMode]);

    useEffect(() => {
        if (previewMode === "mobile") return;
        const raf = requestAnimationFrame(() => updateScale());
        return () => cancelAnimationFrame(raf);
    }, [updateScale, editorState.isEditorOpen, previewMode]);

    useEffect(() => {
        const scrollable = scrollableRef.current;
        if (!scrollable) return;

        const observer = new ResizeObserver(() => {
            if (previewMode !== "mobile") updateScale();
        });
        observer.observe(scrollable);
        return () => observer.disconnect();
    }, [updateScale, previewMode]);

    // Recalculate when preview mode changes (desktop only)
    useEffect(() => {
        if (previewMode !== "mobile") {
            const timer = setTimeout(() => updateScale(), 100);
            return () => clearTimeout(timer);
        }
    }, [previewMode, updateScale]);

    // When mobile mode activates, reset scaling states
    useEffect(() => {
        if (previewMode === "mobile") {
            setScale(1);
            setScaledHeight(undefined);
        }
    }, [previewMode]);

    const editorIsOpen = editorState.isEditorOpen || editorState.isEditorAnimating;

    // Total fixed vertical space: header + toggle button bar + bottom nav
    const totalFixedHeight = HEADER_HEIGHT + barHeight + BOTTOM_NAV_HEIGHT;

    // Resolve plan-level company logo for the portal header
    const planCompanyLogo = typeof step1Data?.selectedPlan?.companyLogo === 'object'
        ? (step1Data?.selectedPlan?.companyLogo as any)?.url
        : step1Data?.selectedPlan?.companyLogo;

    const togglePreviewMode = () => {
        setPreviewMode((prev) => (prev === "desktop" ? "mobile" : "desktop"));
    };

    const brandColor = step1Data?.selectedPlan?.brandColor
        || step1Data?.selectedPlan?.brandColors?.primary
        || "#1F3A60";
    const secondaryColor = step1Data?.selectedPlan?.secondaryColor
        || step1Data?.selectedPlan?.brandColors?.secondary
        || "#6B7280";

    return (
        <div className="w-full transition-all duration-200">
            {/* Spacer so content doesn't jump behind the fixed bar */}
            <div style={{ height: HEADER_HEIGHT + barHeight }} />

            {/* Toggle edit panel button + Mobile Preview toggle — fixed directly under the app header */}
            <div
                className="fixed top-0 z-[45]"
                style={{
                    left: "var(--sidebar-width, 18rem)",
                    width: "calc(100% - var(--sidebar-width, 18rem))",
                }}
            >
                {/* Spacer to clear the fixed header */}
                <div style={{ height: `${HEADER_HEIGHT}px` }} />
                <div
                    ref={barRef}
                    className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
                >
                    {/* Left: Edit Panel toggle */}
                    <button
                        type="button"
                        onClick={() => {
                            if (editorIsOpen) {
                                editorState.handleCloseEditor();
                            } else {
                                editorState.setIsEditorOpen(true);
                                setTimeout(() => editorState.setIsEditorAnimating(true), 10);
                            }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        {editorIsOpen ? (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Close Edit Panel
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Open Edit Panel
                            </>
                        )}
                    </button>

                    {/* Right: Mobile/Desktop preview toggle */}
                    <button
                        type="button"
                        onClick={togglePreviewMode}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        title={previewMode === "mobile" ? "Switch to Desktop preview" : "Switch to Mobile preview"}
                    >
                        {previewMode === "mobile" ? (
                            <>
                                <Monitor className="w-4 h-4" />
                                Desktop Preview
                            </>
                        ) : (
                            <>
                                <Smartphone className="w-4 h-4" />
                                Mobile Preview
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Original fixed-overlay editor panel (slides in from the left) ── */}
            <BenefitsEditorPanel
                isOpen={editorState.isEditorOpen}
                isAnimating={editorState.isEditorAnimating}
                onClose={editorState.handleCloseEditor}
                activeSection={editorState.activeSection}
                highlightedField={editorState.highlightedField}
                editorScrollContainerRef={editorScrollContainerRef}
            />

            {/* ════════════════════════════════════════════════════════════════
                Scalable preview — flex column: portal header (sticky) + scrollable content
                ════════════════════════════════════════════════════════════════ */}
            <div
                className="fixed z-40 flex flex-col"
                style={{
                    top: `${HEADER_HEIGHT + barHeight}px`,
                    left: "var(--sidebar-width, 18rem)",
                    width: "calc(100% - var(--sidebar-width, 18rem))",
                    height: `calc(100vh - ${totalFixedHeight}px)`,
                }}
            >
                {/* Portal header — sticky at top of the scroll container.
                    Hidden in mobile mode where it's rendered inside the iframe. */}
                {previewMode !== "mobile" && (
                    <div className="sticky top-0 z-10 shadow-md">
                        <PortalHeader
                            companyData={{ companyLogo: planCompanyLogo }}
                            brandColor={brandColor}
                            secondaryColor={secondaryColor}
                            clientId={step1Data?.planId}
                            categoryPortalVisibility={step1Data?.benefitVisibility ?? null}
                            benefits={(step1Data?.selectedPlan as any)?.employeePortalPreview?.benefits ?? null}
                        />
                    </div>
                )}

                {/* Scrollable content — items-center keeps the preview centered */}
                <div
                    ref={scrollableRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-300 dark:bg-gray-950 flex flex-col items-center"
                >
                    {previewMode === "mobile" ? (
                        /* ── Mobile: rendered in an iframe so viewport-based
                         *    media queries (Tailwind sm:, md:, lg:) evaluate
                         *    against the iframe's actual MOBILE_WIDTH.
                         *    PortalHeader is wrapped in a fixed container
                         *    matching app/new/view/[id]/layout.tsx structure.
                         *    The iframe uses 9:21 aspect ratio with max-height
                         *    capped to available space so it doesn't overflow
                         *    the bottom nav or toolbar. ── */
                        <MobilePreviewFrame width={MOBILE_WIDTH}>
                            <div className="fixed top-0 left-0 w-full z-50">
                                <PortalHeader
                                    companyData={{ companyLogo: planCompanyLogo }}
                                    brandColor={brandColor}
                                    secondaryColor={secondaryColor}
                                    clientId={step1Data?.planId}
                                    categoryPortalVisibility={step1Data?.benefitVisibility ?? null}
                                    benefits={(step1Data?.selectedPlan as any)?.employeePortalPreview?.benefits ?? null}
                                />
                            </div>
                            <div className="pt-20">
                                <BenefitPortalPreview mobile />
                            </div>
                        </MobilePreviewFrame>
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
                                    width: `${DESKTOP_WIDTH}px`,
                                    overflowX: "hidden",
                                }}
                            >
                                <BenefitPortalPreview />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
