"use client";

import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { BenefitsStep1a } from "./step-1/step-1a";
import { BenefitsStep1b } from "./step-1/step-1b";

export function BenefitsStep1() {
    const { stepData } = useBenefitsWizardStore();
    const currentSubStep = stepData.step1?.currentSubStep || "a";

    if (currentSubStep === "b") {
        return <BenefitsStep1b />;
    }

    return <BenefitsStep1a />;
}
