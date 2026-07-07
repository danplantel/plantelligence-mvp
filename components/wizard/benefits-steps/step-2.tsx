"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BenefitPortalPreview } from "./benefit-portal-preview";
import { BenefitsEditorPanel } from "./benefits-editor-panel";
import { useBenefitsEditorState } from "./hooks/use-benefits-editor-state";
import { useBenefitsLenisScroll } from "./hooks/use-benefits-lenis-scroll";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

/** The native (unscaled) desktop width of the preview in px */
const NATIVE_PREVIEW_WIDTH = 1400;
/** Height of the fixed app header on wizard pages (h-[72px] with stepper) */
const HEADER_HEIGHT = 72;
/** Estimated height of the fixed bottom navigation bar from BenefitsWizard */
const BOTTOM_NAV_HEIGHT = 72;

export function BenefitsStep2() {
    const editorState = useBenefitsEditorState();
    // Disable main Lenis smooth scroll — the preview uses native scrolling,
    // and the page scroll is locked. Lenis would intercept wheel events and
    // prevent them from reaching the preview container.
    const { editorScrollContainerRef } = useBenefitsLenisScroll(editorState.isEditorOpen, true);
    const { currentStep } = useBenefitsWizardStore();
    const [editorInitialized, setEditorInitialized] = useState(false);
    const barRef = useRef<HTMLDivElement>(null);
    const [barHeight, setBarHeight] = useState(52);

    // ── Preview scaling state ──
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const previewContentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

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
    // The preview has its own scrollable container; the page scrollbar
    // is unnecessary and creates a double-scrollbar appearance.
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

    // ── Scale calculation ──
    const updateScale = useCallback(() => {
        const container = previewContainerRef.current;
        const content = previewContentRef.current;
        if (!container || !content) return;

        const availableWidth = container.clientWidth;
        const newScale = Math.min(availableWidth / NATIVE_PREVIEW_WIDTH, 1);
        setScale(newScale);

        const contentHeight = content.scrollHeight;
        setScaledHeight(contentHeight * newScale);
    }, []);

    useEffect(() => {
        const raf = requestAnimationFrame(() => updateScale());
        return () => cancelAnimationFrame(raf);
    }, [updateScale, editorState.isEditorOpen]);

    useEffect(() => {
        const container = previewContainerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => {
            updateScale();
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [updateScale]);

    // Recalculate when editor closes (sidebar shrinks → preview container widens)
    useEffect(() => {
        if (!editorState.isEditorOpen) {
            const timer = setTimeout(() => updateScale(), 350);
            return () => clearTimeout(timer);
        }
    }, [editorState.isEditorOpen, updateScale]);

    const editorIsOpen = editorState.isEditorOpen || editorState.isEditorAnimating;

    // Total fixed vertical space: header + toggle button bar + bottom nav
    const totalFixedHeight = HEADER_HEIGHT + barHeight + BOTTOM_NAV_HEIGHT;

    return (
        <div className="w-full transition-all duration-200">
            {/* Spacer so content doesn't jump behind the fixed bar */}
            <div style={{ height: HEADER_HEIGHT + barHeight }} />

            {/* Toggle edit panel button — fixed directly under the app header */}
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
                    className="flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
                >
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
                                Edit Branding & Content
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
                Scalable preview — fixed-positioned to fill the viewport minus
                header, toggle bar, and bottom nav. Width is driven by
                --sidebar-width (18rem when closed, 36rem when editor is open).
                ════════════════════════════════════════════════════════════════ */}
            <div
                ref={previewContainerRef}
                className="fixed z-40 overflow-y-auto overflow-x-hidden bg-gray-300 dark:bg-gray-950"
                style={{
                    top: `${HEADER_HEIGHT + barHeight}px`,
                    left: "var(--sidebar-width, 18rem)",
                    width: "calc(100% - var(--sidebar-width, 18rem))",
                    height: `calc(100vh - ${totalFixedHeight}px)`,
                }}
            >
                {/*
                 * Outer wrapper: explicit height = contentHeight × scale
                 * so the scrollable area matches the visual size.
                 */}
                <div
                    style={{
                        height: scaledHeight != null ? `${scaledHeight}px` : "100%",
                    }}
                >
                    {/*
                     * Inner wrapper: rendered at native desktop width (1400px)
                     * then scaled via CSS transform to fit the preview pane.
                     * overflow-x-hidden prevents the preview component's own
                     * overflow-x-auto from creating an extra scrollbar.
                     */}
                    <div
                        ref={previewContentRef}
                        style={{
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                            width: `${NATIVE_PREVIEW_WIDTH}px`,
                            overflowX: "hidden",
                        }}
                    >
                        <BenefitPortalPreview />
                    </div>
                </div>
            </div>
        </div>
    );
}
