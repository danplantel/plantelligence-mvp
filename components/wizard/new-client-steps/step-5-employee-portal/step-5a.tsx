"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Step5Disclaimers } from "../../steps/step-5-disclaimers";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Disclaimer } from "@/types/new-client-wizard";

interface NewClientStep5aProps {
    errorFields?: string[];
    onValidationChange?: (isValid: boolean) => void;
}

// Default/base disclaimer text
const DEFAULT_DISCLAIMER_TEXT = `The information and resources provided on this website are for educational and informational purposes only and are not intended as ERISA, tax, legal, investment, insurance, medical, or other professional advice. Each plan, employer, and participant situation is unique. Plan sponsors, employers, and participants should consult their qualified legal, tax, investment, insurance, medical, or other licensed professionals regarding their specific circumstances.

Nothing on this website should be construed as a solicitation, recommendation, or endorsement to buy, sell, or maintain any security, insurance product, or investment strategy. PlanTelligence does not provide investment advice, does not act as an ERISA fiduciary, and does not determine plan design, benefit eligibility, or coverage.

PlanTelligence is an independent technology platform and is not affiliated with any broker-dealer, registered investment advisor, insurance carrier, recordkeeper, or third-party administrator.

Links to external websites are provided for informational purposes only and do not constitute an endorsement or approval by PlanTelligence or any associated firms.

PlanTelligence, <Organization Name>, and <Company Name> are separate and unaffiliated entities.

© 2026 PlanTelligence. All rights reserved.`;

export function NewClientStep5a({
    errorFields = [],
    onValidationChange,
}: NewClientStep5aProps) {
    const {
        stepData: newClientStepData,
        saveStepDataLocally,
        saveStepDataToServer,
        saveAsDraft,
        loadStepData,
        draftClientId,
    } = useNewClientWizardStore();

    const { stepData: onboardingStepData, loadAllWizardData } =
        useOnboardingWizardStore();

    const [hasInitialized, setHasInitialized] = useState(false);

    const existingDisclaimers = newClientStepData.disclaimers?.disclaimers || [];

    const organizationName =
        onboardingStepData.branding?.organizationName || "[Organization Name]";

    const companyName =
        newClientStepData.companyBasics?.companyName || "[Company Name]";

    useEffect(() => {
        if (!onboardingStepData.branding?.organizationName && loadAllWizardData) {
            loadAllWizardData();
        }
    }, [onboardingStepData.branding?.organizationName, loadAllWizardData]);

    const replacePlaceholders = (
        text: string,
        orgName: string,
        compName: string,
    ): string => {
        return text
            .replace(/[<\[]Organization Name[>\]]/g, orgName)
            .replace(/[<\[]Company Name[>\]]/g, compName);
    };

    useEffect(() => {
        const initializeDisclaimers = async () => {


            // Get current organization and company names for placeholder replacement
            const currentOrgName =
                onboardingStepData.branding?.organizationName || "[Organization Name]";
            const currentCompName =
                newClientStepData.companyBasics?.companyName || "[Company Name]";

            try {
                if (!draftClientId) {

                    const onboardingResponse = await fetch(
                        "/api/onboarding-wizard/disclaimers",
                    );
                    if (onboardingResponse.ok) {
                        const onboardingData = await onboardingResponse.json();
                        if (onboardingData.disclaimers?.disclaimers?.length > 0) {

                            // Replace placeholders in disclaimers from API
                            const updated = onboardingData.disclaimers.disclaimers.map(
                                (disclaimer: Disclaimer) => ({
                                    ...disclaimer,
                                    text: replacePlaceholders(
                                        disclaimer.text,
                                        currentOrgName,
                                        currentCompName,
                                    ),
                                }),
                            );
                            saveStepDataLocally("disclaimers", { disclaimers: updated });
                            setHasInitialized(true);
                            return;
                        }
                    }
                }

                // 2. If it's a DRAFT, check if disclaimers already exist in the local store state
                // (e.g. if they were already loaded or hydrated from the draft)
                if (draftClientId && existingDisclaimers.length > 0) {
                    setHasInitialized(true);
                    return;
                }

                // 3. Try to load from the New Client Wizard API (session/draft)
                const data = await loadStepData("disclaimers");
                if (data?.disclaimers?.length > 0) {
                    // Replace placeholders in disclaimers from API
                    const updated = data.disclaimers.map((disclaimer: Disclaimer) => ({
                        ...disclaimer,
                        text: replacePlaceholders(
                            disclaimer.text,
                            currentOrgName,
                            currentCompName,
                        ),
                    }));
                    saveStepDataLocally("disclaimers", { disclaimers: updated });
                    setHasInitialized(true);
                    return;
                }

                // 4. If no disclaimers found anywhere, create a default one

                const defaultDisclaimer: Disclaimer = {
                    id: Date.now().toString(),
                    text: DEFAULT_DISCLAIMER_TEXT.replace(
                        "<Organization Name>",
                        organizationName,
                    ).replace("<Company Name>", companyName),
                    locations: ["Global"],
                    customLocation: "",
                };

                const updated = [defaultDisclaimer];
                saveStepDataLocally("disclaimers", { disclaimers: updated });

                setHasInitialized(true);
            } catch (error) {
                console.error("❌ Error initializing disclaimers:", error);
                setHasInitialized(true); // Mark as initialized to prevent infinite retry
            }
        };

        initializeDisclaimers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount

    useEffect(() => {
        const updateDisclaimers = async () => {
            if (
                hasInitialized &&
                existingDisclaimers.length > 0 &&
                (organizationName !== "[Organization Name]" ||
                    companyName !== "[Company Name]")
            ) {
                const updatedDisclaimers = existingDisclaimers.map((disclaimer) => {
                    // Only update if it contains placeholders
                    if (
                        disclaimer.text.includes("<Organization Name>") ||
                        disclaimer.text.includes("<Company Name>")
                    ) {
                        return {
                            ...disclaimer,
                            text: disclaimer.text
                                .replace(/<Organization Name>/g, organizationName)
                                .replace(/<Company Name>/g, companyName),
                        };
                    }
                    return disclaimer;
                });

                // Check if any disclaimer was updated
                const hasChanges = updatedDisclaimers.some(
                    (updated, index) => updated.text !== existingDisclaimers[index]?.text,
                );

                if (hasChanges) {
                    saveStepDataLocally("disclaimers", {
                        disclaimers: updatedDisclaimers,
                    });
                    // Save to server and draft
                    try {
                        await saveStepDataToServer("disclaimers", {
                            disclaimers: updatedDisclaimers,
                        });
                        await saveAsDraft();
                    } catch (error) {
                        console.error("Failed to save draft when updating disclaimers:", error);
                    }
                }
            }
        };

        updateDisclaimers();
    }, [
        organizationName,
        companyName,
        existingDisclaimers,
        hasInitialized,
        saveStepDataLocally,
        saveStepDataToServer,
        saveAsDraft,
    ]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Disclaimers</h1>
                <p className="text-muted-foreground">
                    {existingDisclaimers.length > 0
                        ? "Review and manage your disclaimers for this plan"
                        : "Add any necessary disclaimers for your employee portal"}
                </p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <Step5Disclaimers
                        onValidationChange={onValidationChange}
                        errorFields={errorFields}
                        companyName={companyName}
                        organizationName={organizationName}
                        useNewClientStore={true}
                        disclaimerScopeFlag={true}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
