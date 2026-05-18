"use client";

import React from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";

interface VideoStep3bProps {}

const avatarImagePaths: Record<string, string> = {
  alison: "/images/alison-trans.png",
  chad: "/images/chad-trans.png",
  leah: "/images/leah-trans.png",
  alicia: "/images/alicia-trans.png",
  paul: "/images/paul-trans.png",
  helena: "/images/helena-trans.png",
  maria: "/images/maria-trans.png",
  scott: "/images/scott-trans.png",
  custom: "/images/custom-trans.png",
};

export function VideoStep3b({}: VideoStep3bProps) {
  const { stepData } = useVideoWizardStore();

  // Get employer contributions data from step3a
  const step3aData = (stepData as any).step3a || {};
  const employerContributions = {
    hasContributions: step3aData.hasContributions ?? null,
    hasAdditionalContributions: step3aData.hasAdditionalContributions ?? null,
    contributionTypes: step3aData.contributionTypes || [],
    primaryContributionType: step3aData.primaryContributionType || null,
    companyMatch: step3aData.companyMatch || {
      isPrimary: false,
      formula: "",
      customFormula: "",
      limit: "",
      customLimit: "",
      vesting: "",
      customVesting: "",
    },
    safeHarbor: step3aData.safeHarbor || {
      isPrimary: false,
      type: "",
      customType: "",
      formula: "",
      customFormula: "",
      limit: "",
      customLimit: "",
      vesting: "",
      customVesting: "",
    },
    fixedAmount: step3aData.fixedAmount || {
      isPrimary: false,
      amount: "",
      customAmount: "",
      percentageAmount: "",
      details: "",
      customDetails: "",
      vesting: "",
      customVesting: "",
    },
    profitSharing: step3aData.profitSharing || {
      isPrimary: false,
      details: "",
      customDetails: "",
      conditions: "",
      customConditions: "",
      vesting: "",
      customVesting: "",
    },
  };

  // Get branding data from selected plan or step1
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;
  const step1 = (stepData as any).step1 || {};
  // Use edited values from step1 if available, otherwise use plan data
  const brandColor =
    step1.brandColor ||
    selectedPlan?.brandColor ||
    selectedPlan?.videoThemeColor ||
    "#005F73";
  const backgroundImage =
    step1.editedBackgroundImg ||
    selectedPlan?.backgroundImg ||
    selectedPlan?.videoBackgroundImage ||
    "";
  const barHeight = step1.barHeight ?? 15;
  const avatarChoice =
    stepData.avatarValue ||
    stepData.selectedAvatar ||
    selectedPlan?.videoAvatar ||
    "";

  // Get eligibility data from step2a for service requirement
  const step2aData = (stepData as any).step2a || {};
  const serviceRequirement = step2aData.serviceRequirement || "";
  const customServiceRequirement = step2aData.customServiceRequirement || "";

  // Format service requirement text
  const getServiceRequirementText = () => {
    if (!serviceRequirement || serviceRequirement === "none") {
      return null;
    }
    if (serviceRequirement === "custom" && customServiceRequirement) {
      return `*${customServiceRequirement}`;
    }
    // Map service requirement values to display text
    const serviceRequirementMap: Record<string, string> = {
      "1month": "*Requires 1 month of service",
      "3months": "*Requires 3 months of service",
      "6months": "*Requires 6 months of service",
      "1year": "*Requires 12 months of service",
    };
    return serviceRequirementMap[serviceRequirement] || null;
  };

  const serviceRequirementText = getServiceRequirementText();

  // Get primary contribution type or first type
  const primaryType =
    employerContributions.primaryContributionType ||
    (employerContributions.contributionTypes &&
    employerContributions.contributionTypes.length > 0
      ? employerContributions.contributionTypes[0]
      : null);

  // Get contribution data for primary type
  const getContributionData = (type: string) => {
    if (type === "companyMatch") {
      return {
        title: "Company Match",
        formula:
          employerContributions.companyMatch.customFormula ||
          employerContributions.companyMatch.formula ||
          "",
        limit:
          employerContributions.companyMatch.customLimit ||
          employerContributions.companyMatch.limit ||
          "",
        vesting:
          employerContributions.companyMatch.customVesting ||
          employerContributions.companyMatch.vesting ||
          "",
      };
    } else if (type === "safeHarbor") {
      return {
        title: "Safe Harbor",
        formula:
          employerContributions.safeHarbor.customFormula ||
          employerContributions.safeHarbor.formula ||
          "",
        limit:
          employerContributions.safeHarbor.customLimit ||
          employerContributions.safeHarbor.limit ||
          "",
        vesting:
          employerContributions.safeHarbor.customVesting ||
          employerContributions.safeHarbor.vesting ||
          "",
      };
    } else if (type === "fixedAmount") {
      return {
        title: "Fixed Amount",
        formula:
          employerContributions.fixedAmount.customAmount ||
          employerContributions.fixedAmount.amount ||
          "",
        limit:
          employerContributions.fixedAmount.customDetails ||
          employerContributions.fixedAmount.details ||
          "",
        vesting:
          employerContributions.fixedAmount.customVesting ||
          employerContributions.fixedAmount.vesting ||
          "",
      };
    } else if (type === "profitSharing") {
      return {
        title: "Profit Sharing",
        formula:
          employerContributions.profitSharing.customDetails ||
          employerContributions.profitSharing.details ||
          "",
        limit:
          employerContributions.profitSharing.customConditions ||
          employerContributions.profitSharing.conditions ||
          "",
        vesting:
          employerContributions.profitSharing.customVesting ||
          employerContributions.profitSharing.vesting ||
          "",
      };
    }
    return null;
  };

  const contributionData = primaryType
    ? getContributionData(primaryType)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white font-inter">
          Employer Contributions Preview
        </h2>
        <p className="text-gray-500 mt-1 font-inter">
          Review how your employer contributions will appear
        </p>
      </div>

      {/* 16:9 aspect ratio container */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ paddingBottom: "56.25%" }}
        data-preview-step="3"
      >
        <div className="absolute inset-0 bg-white overflow-hidden">
          {/* Background image overlay with blur */}
          {backgroundImage && (
            <div
              className="absolute inset-0 bg-no-repeat bg-center bg-cover"
              style={{
                backgroundImage: `url(${backgroundImage})`,
                filter: "blur(8px)",
                opacity: 0.3,
              }}
            />
          )}

          {/* Text container - positioned center-right */}
          <div className="absolute inset-0 flex flex-col justify-center items-end pr-10 pb-4 z-10">
            {contributionData ? (
              <div className="flex flex-col gap-2 text-right max-w-[55%]">
                {/* Title */}
                <h3 className="text-5xl md:text-6xl font-bold text-black tracking-tight mb-2 font-inter">
                  {contributionData.title}
                </h3>

                {/* Formula */}
                {contributionData.formula && (
                  <p className="text-xl md:text-2xl text-black font-normal font-inter">
                    {contributionData.formula}
                  </p>
                )}

                {/* Limit */}
                {contributionData.limit && (
                  <p className="text-xl md:text-2xl text-black font-normal font-inter">
                    {contributionData.limit}
                  </p>
                )}

                {/* Vesting */}
                {contributionData.vesting && (
                  <p className="text-xl md:text-2xl text-black font-normal font-inter">
                    Vesting: {contributionData.vesting}
                  </p>
                )}

                {/* Service requirement condition */}
                {serviceRequirementText && (
                  <p className="text-xl md:text-2xl text-black font-normal mt-2 font-inter">
                    {serviceRequirementText}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-5xl font-bold text-black tracking-tight pr-10 font-inter">
                Employer Contributions
              </div>
            )}
          </div>

          {/* Avatar - positioned bottom-left */}
          {avatarChoice && (
            <div
              className="absolute bottom-4 left-4 md:left-6 z-30 flex items-end"
              data-preview-avatar="true"
            >
              <div className="relative w-24 h-24 md:w-32 md:h-32">
                <div className="absolute inset-0 rounded-full bg-white p-1 shadow-sm">
                  <img
                    src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
            </div>
          )}

          {/* HeyGen Avatar — RIGHT SIDE */}
          <div
            className="absolute left-[50px] bottom-[50px] flex items-end z-20"
            data-preview-avatar="true"
          >
            <div
              className="relative overflow-hidden rounded-full"
              style={{
                width: 270,
                height: 270,
                minWidth: 120,
                minHeight: 120,
              }}
            >
              <img
                src="/HeyGen-AI.png"
                alt="HeyGen Avatar"
                className="object-cover w-full h-full pointer-events-none select-none"
              />
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="absolute bottom-0 left-0 right-0 z-10"
            style={{ background: brandColor, height: `${barHeight}%` }}
          />
        </div>
      </div>
    </div>
  );
}
