import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { NewClientStep5a } from "./step-5a";
import { NewClientStep5d } from "./step-5d";
import { useEffect, useState } from "react";

interface NewClientStep5Props {
  errorFields?: string[];
}

export function NewClientStep5({ errorFields = [] }: NewClientStep5Props) {
  const { stepData } = useNewClientWizardStore();
  const [isDisclaimersValid, setIsDisclaimersValid] = useState(true);

  // Default to "disclaimers" if not set
  const currentSubStep: string =
    stepData.employeePortalPreview?.step5SubStep || "disclaimers";

  const handleDisclaimersValidation = (isValid: boolean) => {
    setIsDisclaimersValid(isValid);
  };

  if (currentSubStep === "benefits-team" || currentSubStep === "step5d") {
    return <NewClientStep5d errorFields={errorFields} />;
  }

  return (
    <NewClientStep5a
      errorFields={errorFields}
      onValidationChange={handleDisclaimersValidation}
    />
  );
}
