"use client";

import { useEffect, useRef, useState } from "react";
import { BenefitPortalPreview } from "./benefit-portal-preview";
import { BenefitsEditorPanel } from "./benefits-editor-panel";
import { useBenefitsEditorState } from "./hooks/use-benefits-editor-state";
import { useBenefitsLenisScroll } from "./hooks/use-benefits-lenis-scroll";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

export function BenefitsStep2() {
    const editorState = useBenefitsEditorState();
    const { editorScrollContainerRef } = useBenefitsLenisScroll(editorState.isEditorOpen);
    const { currentStep } = useBenefitsWizardStore();
    const [editorInitialized, setEditorInitialized] = useState(false);

    // Initialize editor as open on mount with default section
    useEffect(() => {
        if (!editorInitialized) {
            setEditorInitialized(true);
            // Auto-open editor after a brief delay for layout
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

    const editorIsOpen = editorState.isEditorOpen || editorState.isEditorAnimating;

    return (
        <div className="w-full space-y-4 transition-all duration-200">
            {/* Toggle edit panel button */}
            <div className="flex items-center gap-3 px-4 py-3 -mx-4 rounded-lg bg-gray-100 dark:bg-gray-800">
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

            {/* Editor Panel */}
            <BenefitsEditorPanel
                isOpen={editorState.isEditorOpen}
                isAnimating={editorState.isEditorAnimating}
                onClose={editorState.handleCloseEditor}
                activeSection={editorState.activeSection}
                highlightedField={editorState.highlightedField}
                editorScrollContainerRef={editorScrollContainerRef}
            />

            {/* Preview */}
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Portal Preview</h2>
                <p className="text-gray-500 dark:text-gray-200">Preview exactly how this benefit will appear to employees on the portal.</p>
            </div>

            <div className="relative w-screen overflow-x-auto" style={{ marginLeft: 'calc(-50vw + 50%)', width: '100vw' }}>
                <div className="relative">
                    <BenefitPortalPreview />
                </div>
            </div>
        </div>
    );
}
