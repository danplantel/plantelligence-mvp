"use client";

import { useState, useEffect } from "react";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { EditorPanelWrapper } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { KeyContact } from "@/types/new-client-wizard";

export function BenefitsStep1b() {
    const { stepData } = useBenefitsWizardStore();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isEditorAnimating, setIsEditorAnimating] = useState(false);

    const step1Data = stepData.step1 || {
        planId: "",
        benefitCategory: "",
        contactId: "",
        benefitTitle: "",
        companyLogo: null,
        brandImages: { header: null, thumbnail: null, secondaryBanner: null, favicon: null },
    };

    // Broadcast editor state changes to the global stepper
    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent("step1EditorStateChange", {
                detail: { isOpen: isEditorOpen },
            }),
        );
    }, [isEditorOpen]);

    // Handle animation for editor modal
    useEffect(() => {
        if (isEditorOpen) {
            setTimeout(() => setIsEditorAnimating(true), 10);
        } else {
            setIsEditorAnimating(false);
        }
    }, [isEditorOpen]);

    // Listen for editor toggle events from the global stepper
    useEffect(() => {
        const handleOpenEditor = () => {
            setIsEditorOpen(true);
            setTimeout(() => setIsEditorAnimating(true), 10);
        };

        const handleCloseEditor = () => {
            setIsEditorAnimating(false);
            setTimeout(() => setIsEditorOpen(false), 200);
        };

        window.addEventListener("openStep1Editor" as any, handleOpenEditor);
        window.addEventListener("closeStep1Editor" as any, handleCloseEditor);

        return () => {
            window.removeEventListener("openStep1Editor" as any, handleOpenEditor);
            window.removeEventListener("closeStep1Editor" as any, handleCloseEditor);
        };
    }, []);

    const selectedPlan = step1Data.selectedPlan;
    const selectedPlanContacts: KeyContact[] = selectedPlan?.keyContacts ?
        (Array.isArray(selectedPlan.keyContacts) ? selectedPlan.keyContacts : selectedPlan.keyContacts.contacts || []) : [];

    const activeContact = selectedPlanContacts.find(c => c.id === step1Data.contactId);

    const clientData = {
        companyName: selectedPlan?.companyName || "Company",
        companyLogo: step1Data.companyLogo?.url,
        secondaryBannerImg: step1Data.brandImages?.header?.url,
        keyContacts: activeContact ? [{
            name: activeContact.name || `${activeContact.firstName} ${activeContact.lastName}`,
            fullName: activeContact.name || `${activeContact.firstName} ${activeContact.lastName}`,
            title: activeContact.title,
            headshot: step1Data.brandImages?.thumbnail?.url || activeContact.headshot,
            showOnPortal: true,
            isPrimary: true
        }] : []
    };

    const handleCloseEditor = () => {
        setIsEditorAnimating(false);
        setTimeout(() => setIsEditorOpen(false), 200);
    };

    if (process.env.NODE_ENV === 'development') {
        // console.log("[Step 1b Preview] clientData:", clientData);
    }

    return (
        <div className="relative w-full min-h-[600px] animate-in fade-in duration-500">
            {/* Preview Section */}
            <div className="rounded-2xl border border-gray-100 shadow-xl bg-white overflow-hidden">
                <div className="p-0">
                    <PortalWelcomeBanner
                        clientData={clientData as any}
                        customHeadline={step1Data.benefitTitle || step1Data.benefitCategory}
                        customImage={step1Data.companyLogo?.url || undefined}
                    />
                </div>
            </div>

            {/* Editor Panel */}
            <EditorPanelWrapper
                isOpen={isEditorOpen}
                isAnimating={isEditorAnimating}
                onClose={handleCloseEditor}
            >
                <div className="p-2">
                    <div className="bg-gray-50 rounded-xl p-6 border border-dashed border-gray-200 text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Editor Panel Ready</h3>
                        <p className="text-sm text-gray-500">
                            This panel is now controlled by the global "Open Editor" button in the wizard header.
                        </p>
                    </div>
                </div>
            </EditorPanelWrapper>
        </div>
    );
}
