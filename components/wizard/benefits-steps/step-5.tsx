import { useEffect, useRef } from "react";
import { BenefitPortalPreview } from "./benefit-portal-preview";
import { BenefitsEditorPanel } from "./benefits-editor-panel";
import { useBenefitsEditorState } from "./hooks/use-benefits-editor-state";
import { useBenefitsLenisScroll } from "./hooks/use-benefits-lenis-scroll";

export function BenefitsStep5() {
    const editorState = useBenefitsEditorState();
    const { editorScrollContainerRef } = useBenefitsLenisScroll(editorState.isEditorOpen);


    return (
        <div className="max-w-[1600px] mx-auto pb-20">
            <BenefitsEditorPanel
                isOpen={editorState.isEditorOpen}
                isAnimating={editorState.isEditorAnimating}
                onClose={editorState.handleCloseEditor}
                activeSection={editorState.activeSection}
                highlightedField={editorState.highlightedField}
                editorScrollContainerRef={editorScrollContainerRef}
            />

            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Portal Preview</h2>
                    <p className="text-gray-500">Preview exactly how this benefit will appear to employees on the portal.</p>
                </div>
            </div>

            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#23919C] to-[#0D315F] rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative">
                    <BenefitPortalPreview />
                </div>
            </div>
        </div>
    );
}
