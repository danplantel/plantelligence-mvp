"use client";

import { useState, useEffect, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { CompanyInformationSection, KeyContactsSection } from "./sections";
import { WelcomeMissionSection } from "./sections/welcome-mission-section";
import { MISSION_STATEMENT_PRESETS } from "./constants/welcome-statements";
import {
  CompanyData,
  KeyContact,
  WelcomeStatementData,
} from "@/types/new-client-wizard";

type CompanyBasicsSubStep = "branding" | "welcomeMission";
const defaultWelcomeBody = MISSION_STATEMENT_PRESETS[0]?.bodyText || "";

export function NewClientStep1() {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();

  // Default Mission content comes from MISSION_STATEMENT_PRESETS[0].
  const originalMissionBodyTemplate = MISSION_STATEMENT_PRESETS[0].bodyText;

  const [companyData, setCompanyData] = useState<CompanyData>({
    companyName: "",
    companyWebsite: "",
    companyLogo: "",
    logoFileName: "",
    brandColor: "#1F3A60",
    secondaryColor: "#6B7280",
    missionHeadline: MISSION_STATEMENT_PRESETS[0].headline,
    missionBody: originalMissionBodyTemplate,
    isColorPickerOpen: false,
    isSecondaryColorPickerOpen: false,
    appointmentLink: "",
    backgroundImg: "",
    backgroundImgName: "",
  });

  const [keyContacts, setKeyContacts] = useState<KeyContact[]>([]);
  const [appointmentType, setAppointmentType] = useState<
    "email" | "url" | "invalid" | ""
  >("");
  const [isMissionBodyEdited, setIsMissionBodyEdited] = useState(false);
  const normalizeWelcomeStatement = (
    data?: Partial<WelcomeStatementData>,
  ): WelcomeStatementData => ({
    headline: data?.headline || "",
    bodyText: data?.bodyText || "",
    isAIGenerated: data?.isAIGenerated || false,
    advisorName: data?.advisorName || "",
    advisorAvatar: data?.advisorAvatar || null,
  });
  const normalizedInitialWelcomeData = normalizeWelcomeStatement(
    stepData.welcomeStatement,
  );
  const [welcomeData, setWelcomeData] = useState<WelcomeStatementData>(
    normalizedInitialWelcomeData,
  );
  const missionGenerationOrderRef = useRef<number[]>([]);
  const missionRemainingIndexesRef = useRef<number[]>([]);
  const missionCyclePositionRef = useRef(0);
  const missionTrackerInitializedRef = useRef(false);
  const [missionLimitReached, setMissionLimitReached] = useState(false);
  const [useDefaultBody, setUseDefaultBody] = useState(false);
  const [isGeneratingWelcome, setIsGeneratingWelcome] = useState(false);
  const generationOrderRef = useRef<number[]>([]);
  const remainingStatementIndexesRef = useRef<number[]>([]);
  const cyclePositionRef = useRef(0);
  const trackerInitializedRef = useRef(false);
  const lastPersistedWelcomeData = useRef<WelcomeStatementData>(
    normalizedInitialWelcomeData,
  );
  const isSyncingFromMission = useRef(false);
  const isSyncingFromWelcome = useRef(false);
  const storedSubStep =
    ((stepData as any)?.companyBasicsSubStep
      ?.current as CompanyBasicsSubStep) ||
    ((stepData as any)?.companyBasicsSubStep as CompanyBasicsSubStep) ||
    "branding";
  const currentSubStep: CompanyBasicsSubStep =
    storedSubStep === "welcomeMission" ? "welcomeMission" : "branding";

  const validateAppointmentLink = (value: string) => {
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (emailRegex.test(value)) return "email";

    // Check if it's a clean domain (no www, no protocol)
    if (value && value.trim() !== "" && value.includes(".")) {
      if (
        value.startsWith("www.") ||
        value.startsWith("https://") ||
        value.startsWith("http://")
      ) {
        return "invalid";
      }
      return "url";
    }
    return "invalid";
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (companyData.appointmentLink) {
        const type = validateAppointmentLink(companyData.appointmentLink);
        setAppointmentType(type);
      } else {
        setAppointmentType("");
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [companyData.appointmentLink]);

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      // Load data if it exists, otherwise start with clean data
      if (stepData.clientInfo) {
        setCompanyData((prev) => ({
          ...prev,
          ...stepData.clientInfo?.companyData,
        }));
        setKeyContacts(stepData.clientInfo?.keyContacts || []);
      }
      initialized.current = true;
    }
  }, [stepData.clientInfo]);

  // Sync welcome statement data with store
  useEffect(() => {
    const normalizedWelcomeData = normalizeWelcomeStatement(
      stepData.welcomeStatement,
    );
    lastPersistedWelcomeData.current = normalizedWelcomeData;
    setWelcomeData((prev) =>
      JSON.stringify(prev) === JSON.stringify(normalizedWelcomeData)
        ? prev
        : normalizedWelcomeData,
    );
  }, [stepData.welcomeStatement]);

  useEffect(() => {
    if (initialized.current) {
      saveStepDataLocally("clientInfo", { companyData, keyContacts });
    }
  }, [companyData, keyContacts, saveStepDataLocally]);

  // Sync missionHeadline and missionBody with welcomeStatement
  useEffect(() => {
    if (isSyncingFromWelcome.current) {
      isSyncingFromWelcome.current = false;
      return;
    }
    let shouldUpdate = false;
    const updates: Partial<WelcomeStatementData> = {};

    if (
      companyData.missionHeadline &&
      companyData.missionHeadline !== welcomeData.headline
    ) {
      updates.headline = companyData.missionHeadline;
      shouldUpdate = true;
    }
    if (
      companyData.missionBody &&
      companyData.missionBody !== welcomeData.bodyText
    ) {
      updates.bodyText = companyData.missionBody;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      isSyncingFromMission.current = true;
      setWelcomeData((prev) => ({ ...prev, ...updates }));
    }
  }, [companyData.missionHeadline, companyData.missionBody]);

  useEffect(() => {
    if (
      JSON.stringify(lastPersistedWelcomeData.current) ===
      JSON.stringify(welcomeData)
    ) {
      return;
    }
    lastPersistedWelcomeData.current = welcomeData;
    saveStepDataLocally("welcomeStatement", welcomeData);

    // Sync with missionHeadline and missionBody in companyBasics (not heroTitle/heroDescription)
    // Hero Title/Description are independent from Welcome Statement
    if (stepData.companyBasics) {
      const updatedCompanyBasics = {
        ...stepData.companyBasics,
        missionHeadline: welcomeData.headline,
        missionBody: welcomeData.bodyText,
      };

      saveStepDataLocally("companyBasics", updatedCompanyBasics);
    }

    // Sync with companyData (missionHeadline and missionBody)
    // Only update if values are different and we're not already syncing from mission
    if (
      !isSyncingFromMission.current &&
      (welcomeData.headline !== companyData.missionHeadline ||
        welcomeData.bodyText !== companyData.missionBody)
    ) {
      isSyncingFromWelcome.current = true;
      setCompanyData((prev) => ({
        ...prev,
        missionHeadline: welcomeData.headline,
        missionBody: welcomeData.bodyText,
      }));
    }
    isSyncingFromMission.current = false;
  }, [welcomeData, saveStepDataLocally, stepData.companyBasics]);

  const getAutoWelcomeHeadline = () => {
    if (companyData.companyName.trim().length > 0) {
      return `Welcome to ${companyData.companyName}`;
    }
    return "Welcome to Your Benefits Hub";
  };
  const headlineCharCount = welcomeData.headline.length;
  const bodyCharCount = welcomeData.bodyText.length;
  const isHeadlineValid = headlineCharCount <= 60;
  const isBodyValid = bodyCharCount >= 250 && bodyCharCount <= 2000;

  const updateWelcomeField = (
    field: keyof WelcomeStatementData,
    value: WelcomeStatementData[keyof WelcomeStatementData],
  ) => {
    setWelcomeData((prev) => ({ ...prev, [field]: value }));
  };

  // No auto-syncing here

  useEffect(() => {
    if (trackerInitializedRef.current) return;
    const allIndexes = MISSION_STATEMENT_PRESETS.map((_, index) => index);
    const initialMatchIndex = MISSION_STATEMENT_PRESETS.findIndex(
      (statement) => statement.bodyText === (welcomeData.bodyText || ""),
    );

    if (initialMatchIndex >= 0) {
      generationOrderRef.current = [initialMatchIndex];
      remainingStatementIndexesRef.current = allIndexes.filter(
        (idx) => idx !== initialMatchIndex,
      );
    } else {
      generationOrderRef.current = [];
      remainingStatementIndexesRef.current = allIndexes;
    }
    trackerInitializedRef.current = true;
  }, [welcomeData.bodyText]);

  useEffect(() => {
    if (missionTrackerInitializedRef.current) return;
    const allIndexes = MISSION_STATEMENT_PRESETS.map((_, index) => index);
    const initialMatchIndex = MISSION_STATEMENT_PRESETS.findIndex(
      (statement) =>
        statement.bodyText === (companyData.missionBody || "") &&
        statement.headline === (companyData.missionHeadline || ""),
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
  }, [companyData.missionBody, companyData.missionHeadline]);

  const handleDataChange = (field: keyof CompanyData, value: any) => {
    setCompanyData((prev) => {
      const newData = { ...prev, [field]: value };

      // If company name changes, update the mission body to replace {{COMPANY_NAME}}
      if (field === "companyName") {
        // Only auto-replace if user hasn't manually edited the mission body
        if (!isMissionBodyEdited) {
          if (value) {
            newData.missionBody = originalMissionBodyTemplate.replace(
              /\{\{COMPANY_NAME\}\}/g,
              value,
            );
          } else {
            // If no company name, use original template
            newData.missionBody = originalMissionBodyTemplate;
          }
        }
      }

      // Track if user manually edits mission body
      if (field === "missionBody") {
        setIsMissionBodyEdited(true);
      }

      return newData;
    });
  };

  const handleLogoFileUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCompanyData((prev) => ({
        ...prev,
        companyLogo: result,
        logoFileName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileRemove = () => {
    setCompanyData((prev) => ({
      ...prev,
      companyLogo: "",
      logoFileName: "",
    }));
  };

  const handleBackgroundImgUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCompanyData((prev) => ({
        ...prev,
        backgroundImg: result,
        backgroundImgName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundImgRemove = () => {
    setCompanyData((prev) => ({
      ...prev,
      backgroundImg: "",
      backgroundImgName: "",
    }));
  };

  const handleHeadshotUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setKeyContacts((prev) =>
        prev.map((c, i) =>
          i === index
            ? { ...c, headshot: result, headshotFileName: file.name }
            : c,
        ),
      );
    };
    reader.readAsDataURL(file);
  };

  const handleHeadshotRemove = (index: number) => {
    setKeyContacts((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, headshot: "", headshotFileName: "" } : c,
      ),
    );
  };

  const handleWelcomeDescriptionChange = (value: string) => {
    if (useDefaultBody) {
      setUseDefaultBody(false);
    }
    updateWelcomeField("bodyText", value);
  };

  const applyPredefinedStatement = (index: number) => {
    const statement = MISSION_STATEMENT_PRESETS[index];
    if (!statement) return;
    updateWelcomeField("bodyText", statement.bodyText);
    updateWelcomeField("isAIGenerated", true);
    setUseDefaultBody(false);
  };

  const handleGenerateNewStatement = () => {
    const availableStatements = remainingStatementIndexesRef.current;

    if (availableStatements.length > 0) {
      const randomIndex = Math.floor(
        Math.random() * availableStatements.length,
      );
      const statementIndex = availableStatements.splice(randomIndex, 1)[0];

      generationOrderRef.current.push(statementIndex);
      applyPredefinedStatement(statementIndex);
      return;
    }

    if (generationOrderRef.current.length === 0) {
      return;
    }

    const statementIndex = generationOrderRef.current[cyclePositionRef.current];
    cyclePositionRef.current =
      (cyclePositionRef.current + 1) % generationOrderRef.current.length;

    applyPredefinedStatement(statementIndex);
  };

  const generateWelcomeWithAI = async () => {
    if (!companyData.companyName.trim()) {
      alert("Please add a company name in Step 1A first.");
      return;
    }

    setIsGeneratingWelcome(true);
    try {
      const generatedBody = `At ${companyData.companyName}, we believe that our employees are our greatest asset. This benefits portal is designed to provide you with easy access to all your benefits information, resources, and tools in one convenient location. Whether you're exploring health insurance options, planning for retirement, or accessing wellness programs, everything you need is right here. We're committed to supporting your well-being and helping you make the most of your benefits package.`;

      updateWelcomeField("bodyText", generatedBody);
      updateWelcomeField("isAIGenerated", true);
      setUseDefaultBody(false);
    } catch (error) {
      console.error("Failed to generate welcome copy:", error);
      alert("Failed to generate content. Please try again.");
    } finally {
      setIsGeneratingWelcome(false);
    }
  };

  const handleUseDefaultBody = (checked: boolean) => {
    setUseDefaultBody(checked);
    if (checked) {
      updateWelcomeField("bodyText", defaultWelcomeBody);
      updateWelcomeField("isAIGenerated", false);
    }
  };

  return (
    <div className="space-y-6">
      {currentSubStep === "branding" && (
        <>
          <CompanyInformationSection
            data={companyData}
            appointmentType={appointmentType}
            onDataChange={handleDataChange}
            onLogoFileUpload={handleLogoFileUpload}
            onLogoFileRemove={handleLogoFileRemove}
            onBackgroundImgUpload={handleBackgroundImgUpload}
            onBackgroundImgRemove={handleBackgroundImgRemove}
          />

          <KeyContactsSection
            contacts={keyContacts}
            onContactsChange={setKeyContacts}
            onHeadshotUpload={handleHeadshotUpload}
            onHeadshotRemove={handleHeadshotRemove}
            title="Key Contacts"
            description="Add key contacts for this client"
          />
        </>
      )}

      {currentSubStep === "welcomeMission" && (
        <WelcomeMissionSection
          welcomeData={welcomeData}
          companyData={companyData}
          companyName={companyData.companyName}
          onWelcomeDescriptionChange={handleWelcomeDescriptionChange}
          onMissionFieldChange={(field, value) =>
            handleDataChange(field as keyof CompanyData, value)
          }
          onGenerateStatement={handleGenerateNewStatement}
          onGenerateAI={generateWelcomeWithAI}
          isGenerating={isGeneratingWelcome}
          useDefaultBody={useDefaultBody}
          onToggleDefaultBody={handleUseDefaultBody}
          headlineCharCount={headlineCharCount}
          bodyCharCount={bodyCharCount}
          isHeadlineValid={isHeadlineValid}
          isBodyValid={isBodyValid}
          defaultBodyText={defaultWelcomeBody}
        />
      )}
    </div>
  );
}
