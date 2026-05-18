import { useState, useEffect, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";

interface WelcomeStatementData {
  headline: string;
  bodyText: string;
  isAIGenerated: boolean;
}

export function useWelcomeData() {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();
  const isSyncingFromStore = useRef(false);
  const lastSavedWelcomeData = useRef<WelcomeStatementData | null>(null);

  const getInitialWelcomeData = (): WelcomeStatementData => {
    const fromWelcomeStatement = stepData.welcomeStatement;
    const fromHeroTitle = stepData.companyBasics?.heroTitle;
    const fromHeroDescription = stepData.companyBasics?.heroDescription;
    const companyName = stepData.companyBasics?.companyName || "Company Name";

    const defaultHeadline = `Welcome to the ${companyName} Benefits Hub!`;
    const headline =
      fromHeroTitle && fromHeroTitle.trim()
        ? fromHeroTitle
        : fromWelcomeStatement?.headline && fromWelcomeStatement.headline.trim()
        ? fromWelcomeStatement.headline
        : defaultHeadline;

    return {
      headline,
      bodyText: fromHeroDescription || fromWelcomeStatement?.bodyText || "",
      isAIGenerated: fromWelcomeStatement?.isAIGenerated || false,
    };
  };

  const [welcomeData, setWelcomeData] = useState<WelcomeStatementData>(
    getInitialWelcomeData(),
  );

  // Save data when it changes
  useEffect(() => {
    if (isSyncingFromStore.current) {
      isSyncingFromStore.current = false;
      return;
    }

    if (
      lastSavedWelcomeData.current &&
      JSON.stringify(lastSavedWelcomeData.current) ===
        JSON.stringify(welcomeData)
    ) {
      return;
    }

    lastSavedWelcomeData.current = welcomeData;
    saveStepDataLocally("welcomeStatement", welcomeData);
  }, [welcomeData, saveStepDataLocally]);

  // Sync welcomeData with store when it changes externally
  useEffect(() => {
    const fromWelcomeStatement = stepData.welcomeStatement;
    const companyName = stepData.companyBasics?.companyName || "Company Name";

    const defaultHeadline = `Welcome to the ${companyName} Benefits Hub!`;
    const headline =
      stepData.companyBasics?.heroTitle &&
      stepData.companyBasics.heroTitle.trim()
        ? stepData.companyBasics.heroTitle
        : fromWelcomeStatement?.headline && fromWelcomeStatement.headline.trim()
        ? fromWelcomeStatement.headline
        : defaultHeadline;

    const storeData: WelcomeStatementData = {
      headline,
      bodyText:
        stepData.companyBasics?.heroDescription ||
        fromWelcomeStatement?.bodyText ||
        "",
      isAIGenerated: fromWelcomeStatement?.isAIGenerated || false,
    };

    if (
      JSON.stringify(storeData) !== JSON.stringify(welcomeData) &&
      !isSyncingFromStore.current
    ) {
      isSyncingFromStore.current = true;
      setWelcomeData(storeData);
      lastSavedWelcomeData.current = storeData;
    }
  }, [
    stepData.welcomeStatement,
    stepData.companyBasics?.heroTitle,
    stepData.companyBasics?.heroDescription,
    stepData.companyBasics?.companyName,
    welcomeData,
  ]);

  const updateField = (field: keyof WelcomeStatementData, value: any) => {
    setWelcomeData((prev) => ({ ...prev, [field]: value }));
  };

  return {
    welcomeData,
    setWelcomeData,
    updateField,
  };
}

