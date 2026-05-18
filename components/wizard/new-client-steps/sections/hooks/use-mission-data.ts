import { useState, useEffect, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { MISSION_STATEMENT_PRESETS } from "../../constants/welcome-statements";

const defaultHeadline = "Here to Support You - Today and Every Day.";
const defaultWelcomeBodyText =
  "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

export function useMissionData() {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();
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

  const [useDefaultHeadline, setUseDefaultHeadline] = useState(true);
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

  // Handle default headline initialization
  useEffect(() => {
    const currentHeadline = stepData.companyBasics?.missionHeadline;
    if (useDefaultHeadline && (!currentHeadline || currentHeadline.trim() === "")) {
      handleHeadlineChange(defaultHeadline);
    }
  }, []);

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
    if (useDefaultHeadline && value !== defaultHeadline) {
      setUseDefaultHeadline(false);
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
    if (useDefaultBody && value !== defaultWelcomeBodyText) {
      setUseDefaultBody(false);
    }
  };

  const handleUseDefaultHeadline = (checked: boolean) => {
    setUseDefaultHeadline(checked);
    if (checked) {
      if (stepData.companyBasics) {
        saveStepDataLocally("companyBasics", {
          ...stepData.companyBasics,
          missionHeadline: defaultHeadline,
        });
      }
    } else {
      // Clear the headline when unchecked
      handleHeadlineChange("");
    }
  };

  const handleUseDefaultBody = (checked: boolean) => {
    setUseDefaultBody(checked);
    if (checked) {
      if (stepData.companyBasics) {
        saveStepDataLocally("companyBasics", {
          ...stepData.companyBasics,
          missionBody: defaultWelcomeBodyText,
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
  const isBodyValid = bodyCharCount >= 250 && bodyCharCount <= 2000;

  return {
    missionHeadline: missionHeadlineLocal,
    missionBody: missionBodyLocal,
    useDefaultHeadline,
    useDefaultBody,
    headlineCharCount,
    bodyCharCount,
    isHeadlineValid,
    isBodyValid,
    handleHeadlineChange,
    handleBodyChange,
    handleUseDefaultHeadline,
    handleUseDefaultBody,
    handleGenerateMissionHeadline,
    handleGenerateMissionBody,
    isUserTypingRef,
  };
}

