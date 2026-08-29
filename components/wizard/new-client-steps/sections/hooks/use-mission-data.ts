import { useState, useEffect, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { MISSION_STATEMENT_PRESETS } from "../../constants/welcome-statements";

export function useMissionData() {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();
  // The plan/company name from Step 1 (Company Basics) is used to fill the
  // {{COMPANY_NAME}} placeholders in the default Mission content. Both the
  // Mission Headline and Mission Statement default to MISSION_STATEMENT_PRESETS[0].
  const companyName = stepData.companyBasics?.companyName || "";
  const defaultMissionHeadline = MISSION_STATEMENT_PRESETS[0].headline.replace(
    /\{\{COMPANY_NAME\}\}/g,
    companyName || "our company",
  );
  const defaultMissionBody = MISSION_STATEMENT_PRESETS[0].bodyText.replace(
    /\{\{COMPANY_NAME\}\}/g,
    companyName || "our company",
  );
  const [missionHeadlineLocal, setMissionHeadlineLocal] = useState<string>(
    stepData.companyBasics?.missionHeadline || "",
  );
  const [missionBodyLocal, setMissionBodyLocal] = useState<string>(
    stepData.companyBasics?.missionBody || "",
  );
  const isSyncingMissionFromStoreRef = useRef(false);
  const isUserTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mission generation tracking
  const missionGenerationOrderRef = useRef<number[]>([]);
  const missionRemainingIndexesRef = useRef<number[]>([]);
  const missionCyclePositionRef = useRef(0);
  const missionTrackerInitializedRef = useRef(false);

  const [useDefaultBody, setUseDefaultBody] = useState(false);

  // Initialize mission generation tracker
  useEffect(() => {
    if (missionTrackerInitializedRef.current) return;
    const currentMissionHeadline =
      stepData.companyBasics?.missionHeadline || "";
    const currentMissionBody = stepData.companyBasics?.missionBody || "";
    const allIndexes = MISSION_STATEMENT_PRESETS.map((_, index) => index);
    const initialMatchIndex = MISSION_STATEMENT_PRESETS.findIndex(
      (statement) =>
        statement.bodyText === currentMissionBody &&
        statement.headline === currentMissionHeadline,
    );

    if (initialMatchIndex >= 0) {
      missionGenerationOrderRef.current = [initialMatchIndex];
      missionRemainingIndexesRef.current = allIndexes.filter(
        (idx) => idx !== initialMatchIndex,
      );
    } else {
      missionGenerationOrderRef.current = [];
      missionRemainingIndexesRef.current = allIndexes;
    }
    missionTrackerInitializedRef.current = true;
  }, [
    stepData.companyBasics?.missionHeadline,
    stepData.companyBasics?.missionBody,
  ]);

  // Handle default body initialization — populate the Mission Statement with
  // the default text (filled with the plan's Company Name). This runs on mount
  // (and whenever the company name changes) but only touches the field when it
  // is empty OR still holds the auto-generated default template, so a custom
  // mission statement the user typed is never overwritten.
  useEffect(() => {
    const currentBody = stepData.companyBasics?.missionBody;
    const isDefaultTemplate =
      !!currentBody &&
      (currentBody === defaultMissionBody ||
        currentBody ===
          MISSION_STATEMENT_PRESETS[0].bodyText.replace(
            /\{\{COMPANY_NAME\}\}/g,
            "our company",
          ) ||
        (currentBody.trim().startsWith("At ") &&
          currentBody.includes("this employee benefits portal is one way")));
    if (!currentBody || currentBody.trim() === "" || isDefaultTemplate) {
      handleBodyChange(defaultMissionBody);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultMissionBody]);

  // Handle default headline initialization — populate the Mission Headline with
  // the default headline from MISSION_STATEMENT_PRESETS[0]. This runs on mount
  // (and whenever the company name changes) but only touches the field when it
  // is empty, so a custom headline the user typed is never overwritten.
  useEffect(() => {
    const currentHeadline = stepData.companyBasics?.missionHeadline;
    if (!currentHeadline || currentHeadline.trim() === "") {
      handleHeadlineChange(defaultMissionHeadline);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultMissionHeadline]);

  // No auto-syncing of default toggles based on content emptiness to avoid frustration when clearing fields

  // Keep local mission state in sync with store changes
  useEffect(() => {
    const fromStoreHeadline = stepData.companyBasics?.missionHeadline || "";
    const fromStoreBody = stepData.companyBasics?.missionBody || "";

    if (isSyncingMissionFromStoreRef.current) {
      isSyncingMissionFromStoreRef.current = false;
      return;
    }

    if (fromStoreHeadline !== missionHeadlineLocal) {
      setMissionHeadlineLocal(fromStoreHeadline);
    }
    if (fromStoreBody !== missionBodyLocal) {
      setMissionBodyLocal(fromStoreBody);
    }
  }, [
    stepData.companyBasics?.missionHeadline,
    stepData.companyBasics?.missionBody,
    missionHeadlineLocal,
    missionBodyLocal,
  ]);

  const handleHeadlineChange = (value: string) => {
    setMissionHeadlineLocal(value);
    isUserTypingRef.current = true;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      isUserTypingRef.current = false;
    }, 1000);

    const store = useNewClientWizardStore.getState();
    const currentCompanyBasics = store.stepData.companyBasics;
    if (currentCompanyBasics) {
      isSyncingMissionFromStoreRef.current = true;
      saveStepDataLocally("companyBasics", {
        ...currentCompanyBasics,
        missionHeadline: value,
      });
    }
  };

  const handleBodyChange = (value: string) => {
    setMissionBodyLocal(value);
    isUserTypingRef.current = true;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      isUserTypingRef.current = false;
    }, 1000);

    const store = useNewClientWizardStore.getState();
    const currentCompanyBasics = store.stepData.companyBasics;
    if (currentCompanyBasics) {
      isSyncingMissionFromStoreRef.current = true;
      saveStepDataLocally("companyBasics", {
        ...currentCompanyBasics,
        missionBody: value,
      });
    }
    if (useDefaultBody && value !== defaultMissionBody) {
      setUseDefaultBody(false);
    }
  };

  const handleUseDefaultBody = (checked: boolean) => {
    setUseDefaultBody(checked);
    if (checked) {
      if (stepData.companyBasics) {
        // Using the default applies MISSION_STATEMENT_PRESETS[0] for both
        // the Mission Headline and the Mission Statement.
        saveStepDataLocally("companyBasics", {
          ...stepData.companyBasics,
          missionHeadline: defaultMissionHeadline,
          missionBody: defaultMissionBody,
        });
      }
    }
  };

  const handleGenerateMissionHeadline = () => {
    const remaining = missionRemainingIndexesRef.current;

    if (remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      const presetIndex = remaining[randomIndex];
      const preset = MISSION_STATEMENT_PRESETS[presetIndex];
      if (preset) {
        const companyName = stepData.companyBasics?.companyName || "our company";
        const dynamicHeadline = preset.headline.replace(/\{\{COMPANY_NAME\}\}/g, companyName);
        handleHeadlineChange(dynamicHeadline);
      }
      return;
    }

    if (missionGenerationOrderRef.current.length > 0) {
      const presetIndex =
        missionGenerationOrderRef.current[missionCyclePositionRef.current];
      const preset = MISSION_STATEMENT_PRESETS[presetIndex];
      if (preset) {
        const companyName = stepData.companyBasics?.companyName || "our company";
        const dynamicHeadline = preset.headline.replace(/\{\{COMPANY_NAME\}\}/g, companyName);
        handleHeadlineChange(dynamicHeadline);
      }
      missionCyclePositionRef.current =
        (missionCyclePositionRef.current + 1) %
        missionGenerationOrderRef.current.length;
    }
  };

  const handleGenerateMissionBody = () => {
    const remaining = missionRemainingIndexesRef.current;

    if (remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      const presetIndex = remaining[randomIndex];
      const preset = MISSION_STATEMENT_PRESETS[presetIndex];
      if (preset) {
        const companyName = stepData.companyBasics?.companyName || "our company";
        const dynamicBody = preset.bodyText.replace(/\{\{COMPANY_NAME\}\}/g, companyName);
        handleBodyChange(dynamicBody);
      }
      return;
    }

    if (missionGenerationOrderRef.current.length > 0) {
      const presetIndex =
        missionGenerationOrderRef.current[missionCyclePositionRef.current];
      const preset = MISSION_STATEMENT_PRESETS[presetIndex];
      if (preset) {
        const companyName = stepData.companyBasics?.companyName || "our company";
        const dynamicBody = preset.bodyText.replace(/\{\{COMPANY_NAME\}\}/g, companyName);
        handleBodyChange(dynamicBody);
      }
      missionCyclePositionRef.current =
        (missionCyclePositionRef.current + 1) %
        missionGenerationOrderRef.current.length;
    }
  };

  const headlineCharCount = missionHeadlineLocal.length;
  const bodyCharCount = missionBodyLocal.length;
  const isHeadlineValid = headlineCharCount <= 60;
  const isBodyValid = bodyCharCount >= 250 && bodyCharCount <= 800;

  return {
    missionHeadline: missionHeadlineLocal,
    missionBody: missionBodyLocal,
    defaultMissionHeadline,
    defaultMissionBody,
    useDefaultBody,
    headlineCharCount,
    bodyCharCount,
    isHeadlineValid,
    isBodyValid,
    handleHeadlineChange,
    handleBodyChange,
    handleUseDefaultBody,
    handleGenerateMissionHeadline,
    handleGenerateMissionBody,
    isUserTypingRef,
  };
}

