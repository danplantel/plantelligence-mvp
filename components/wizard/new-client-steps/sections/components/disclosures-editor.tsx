"use client";

import { useEffect } from "react";
import { Step5Disclaimers } from "@/components/wizard/steps/step-5-disclaimers";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";

interface DisclosuresEditorProps {
    disclosuresText: string;
    useDefaultDisclosures: boolean;
    onDisclosuresTextChange: (value: string) => void;
    onUseDefaultDisclosuresChange: (checked: boolean) => void;
    defaultDisclosuresText: string;
    isHighlighted?: boolean;
}

export function DisclosuresEditor({
    disclosuresText,
    useDefaultDisclosures,
    onDisclosuresTextChange,
    onUseDefaultDisclosuresChange,
    defaultDisclosuresText,
    isHighlighted = false,
}: DisclosuresEditorProps) {
    const { stepData, saveStepDataLocally } = useNewClientWizardStore();
    const { stepData: onboardingStepData } = useOnboardingWizardStore();

    const organizationName =
        onboardingStepData.branding?.organizationName || "[Organization Name]";
    const companyName = stepData.companyBasics?.companyName || "[Company Name]";

    // Sync disclaimers changes to disclosuresText
    useEffect(() => {
        const disclaimers = stepData.disclaimers?.disclaimers || [];
        if (disclaimers.length > 0) {
            // Helper function to format disclaimer with header
            const formatDisclaimer = (disclaimer: any): string => {
                const locations = [
                    ...(disclaimer.locations || []),
                    ...(disclaimer.customLocation ? [disclaimer.customLocation] : []),
                ];

                let formatted = "";

                // Add header with locations if they exist
                if (locations.length > 0) {
                    formatted += locations.join(", ") + "\n\n";
                }

                // Add disclaimer text with preserved whitespace
                formatted += disclaimer.text || "";

                return formatted;
            };

            // Combine all disclaimer texts
            const combinedText = disclaimers
                .map((disclaimer) => formatDisclaimer(disclaimer))
                .filter((text) => text && text.trim())
                .join("\n\n");

            if (combinedText && combinedText !== disclosuresText) {
                onDisclosuresTextChange(combinedText);
                onUseDefaultDisclosuresChange(false);
            }
        }
    }, [
        stepData.disclaimers?.disclaimers,
        disclosuresText,
        onDisclosuresTextChange,
        onUseDefaultDisclosuresChange,
    ]);

    return (
        <div
            className={`pt-6 border-t border-border transition-all duration-500 ${isHighlighted
                ? "bg-white ring-2 ring-accent-blue/40 rounded-lg p-2 -m-2 scale-[1.01] shadow-sm dark:bg-gray-800 dark:ring-accent-blue/60"
                : ""
                }`}
        >
            <Step5Disclaimers
                onValidationChange={() => { }}
                errorFields={[]}
                companyName={companyName}
                organizationName={organizationName}
                useNewClientStore={true}
                disclaimerScopeFlag={true}
            />
        </div>
    );
}
