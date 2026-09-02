"use client";

import React from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { listAdditionalFeatures } from "@/components/plan-builder/constants";

interface VideoStep4bProps {}

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

export function VideoStep4b({}: VideoStep4bProps) {
  const { stepData } = useVideoWizardStore();

  // Get investments data from step4a
  const step4aData = (stepData as any).step4a || {};
  const investments = {
    investmentOptions: step4aData.investmentOptions || [],
  };
  const resources = {
    planFeatures: step4aData.planFeatures || [],
    customFeature: step4aData.customFeature || "",
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
  const avatarChoice =
    stepData.avatarValue ||
    stepData.selectedAvatar ||
    selectedPlan?.videoAvatar ||
    "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white font-inter">
          Investments & Features Preview
        </h2>
        <p className="text-gray-500 mt-1 font-inter">
          Review how your investments and plan features will appear
        </p>
      </div>

      {/* 16:9 aspect ratio container */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ paddingBottom: "56.25%" }}
        data-preview-step="4"
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

          {/* Text container - positioned center-left */}
          <div className="absolute inset-0 flex flex-col justify-center items-end pr-10 z-10">
            <div className="flex flex-col gap-2 text-center max-w-[60%]">
              {/* Title */}
              <h3 className="text-center text-5xl md:text-6xl font-bold text-black tracking-tight mb-3 font-inter">
                Plan Features:
              </h3>

              {/* Selected features with dashes - only show features from step4a data */}
              {resources?.planFeatures &&
                resources.planFeatures.length > 0 &&
                resources.planFeatures
                  .filter((item: string) => item !== "none")
                  .map((currentItem: string) => {
                    const currentFeature = listAdditionalFeatures.find(
                      (feature) => feature.value === currentItem,
                    );

                    const displayValue =
                      currentFeature?.value === "custom"
                        ? resources?.customFeature
                        : currentFeature?.label;

                    return displayValue ? (
                      <p
                        key={currentItem}
                        className="text-xl md:text-2xl text-black font-normal font-inter"
                      >
                        -{displayValue}
                      </p>
                    ) : null;
                  })}
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
}
