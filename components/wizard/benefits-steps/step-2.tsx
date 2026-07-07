"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BenefitPortalPreview } from "./benefit-portal-preview";
import { BenefitsEditorPanel } from "./benefits-editor-panel";
import { useBenefitsEditorState } from "./hooks/use-benefits-editor-state";
import { useBenefitsLenisScroll } from "./hooks/use-benefits-lenis-scroll";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

/** The native (unscaled) desktop width of the preview in px */
const NATIVE_PREVIEW_WIDTH = 1400;
/** Width of the editor panel when open */
const EDITOR_PANEL_WIDTH = 420;

export function BenefitsStep2() {
    const editorState = useBenefitsEditorState();
    const { editorScrollContainerRef } = useBenefitsLenisScroll(editorState.isEditorOpen);
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

    // Measure bar height for the spacer
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

    // ── Scale calculation: fit the 1400px desktop preview into the available pane ──
    const updateScale = useCallback(() => {
        const container = previewContainerRef.current;
        const content = previewContentRef.current;
        if (!container || !content) return;

        const availableWidth = container.clientWidth;
        const newScale = Math.min(availableWidth / NATIVE_PREVIEW_WIDTH, 1);
        setScale(newScale);

        // The scaled wrapper needs an explicit height because CSS transform
        // does not affect layout – the element still occupies its original size.
        // We set the wrapper height to contentHeight × scale so the scrollable
        // area matches the visual size.
        const contentHeight = content.scrollHeight;
        setScaledHeight(contentHeight * newScale);
    }, []);

    useEffect(() => {
        // Initial measurement after layout
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

    // Also recalculate when editor open/close transition completes
    useEffect(() => {
        if (!editorState.isEditorOpen) {
            // Editor just closed – preview container width changed, recalc after paint
            const timer = setTimeout(() => updateScale(), 350);
            return () => clearTimeout(timer);
        }
    }, [editorState.isEditorOpen, updateScale]);

    const editorIsOpen = editorState.isEditorOpen || editorState.isEditorAnimating;

    return (
        <div className="w-full transition-all duration-200">
            {/* Spacer so content doesn't jump behind the fixed bar */}
            <div style={{ height: barHeight }} />

            {/* Toggle edit panel button — always fixed directly under the app header */}
            <div
                ref={barRef}
                className="fixed top-0 z-[45]"
                style={{
                    left: "var(--sidebar-width, 18rem)",
                    width: "calc(100% - var(--sidebar-width, 18rem))",
                }}
            >
                {/* 55px invisible spacer to sit below the fixed header */}
                <div style={{ height: "55px" }} />
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
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

            {/* ════════════════════════════════════════════════════════════════
                Elementor-style flex layout: Edit Panel | Preview
                ════════════════════════════════════════════════════════════════ */}
            <div
                className="flex"
                style={{
                    height: `calc(100vh - 55px - ${barHeight}px)`,
                }}
            >
                {/* ── Editor Panel (inline, not fixed) ── */}
                {editorIsOpen && (
                    <div
                        className="flex-shrink-0 h-full overflow-hidden border-r border-gray-200 dark:border-gray-700 transition-all duration-300"
                        style={{ width: `${EDITOR_PANEL_WIDTH}px` }}
                    >
                        <BenefitsEditorPanel
                            isOpen={editorState.isEditorOpen}
                            isAnimating={editorState.isEditorAnimating}
                            onClose={editorState.handleCloseEditor}
                            activeSection={editorState.activeSection}
                            highlightedField={editorState.highlightedField}
                            editorScrollContainerRef={editorScrollContainerRef}
                            variant="inline"
                        />
                    </div>
                )}

                {/* ── Preview pane — fills remaining space ── */}
                <div
                    ref={previewContainerRef}
                    className="flex-1 h-full overflow-auto bg-gray-300 dark:bg-gray-950"
                >
                    {/*
                     * Outer wrapper: explicit height = contentHeight × scale
                     * so the scrollable area matches the visual size of the
                     * scaled content beneath.
                     */}
                    <div
                        style={{
                            height: scaledHeight != null ? `${scaledHeight}px` : "100%",
                        }}
                    >
                        {/*
                         * Inner wrapper: rendered at native desktop width (1400px)
                         * then scaled down via CSS transform to fit the preview pane.
                         * transform-origin: top left ensures it aligns to the top-left
                         * of the container.
                         */}
                        <div
                            ref={previewContentRef}
                            style={{
                                transform: `scale(${scale})`,
                                transformOrigin: "top left",
                                width: `${NATIVE_PREVIEW_WIDTH}px`,
                            }}
                        >
                            <BenefitPortalPreview />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
