import { useEffect, useRef } from "react";
import { BenefitPortalPreview } from "./benefit-portal-preview";
import { BenefitsEditorPanel } from "./benefits-editor-panel";
import { useBenefitsEditorState } from "./hooks/use-benefits-editor-state";
import { useBenefitsLenisScroll } from "./hooks/use-benefits-lenis-scroll";

export function BenefitsStep5() {
    const editorState = useBenefitsEditorState();
    const { editorScrollContainerRef } = useBenefitsLenisScroll(editorState.isEditorOpen);


    return (
        <div className="w-screen mx-auto pb-20 overflow-x-auto relative" style={{ marginLeft: 'calc(-50vw + 50%)', width: '100vw' }}>
            <BenefitsEditorPanel
                isOpen={editorState.isEditorOpen}
                isAnimating={editorState.isEditorAnimating}
                onClose={editorState.handleCloseEditor}
                activeSection={editorState.activeSection}
                highlightedField={editorState.highlightedField}
                editorScrollContainerRef={editorScrollContainerRef}
            />

            <div className="mb-6 text-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Portal Preview</h2>
                    <p className="text-gray-500 dark:text-gray-200">Preview exactly how this benefit will appear to employees on the portal.</p>
                </div>
            </div>

            <div className="relative">
                <div className="relative">
                    <BenefitPortalPreview />
                </div>
            </div>
        </div>
    );
}
