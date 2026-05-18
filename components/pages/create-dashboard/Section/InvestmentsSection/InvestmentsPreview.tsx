"use client";

import React, { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { listAdditionalFeatures } from "./index";

interface InvestmentsPreviewProps {
  investments: {
    investmentOptions: string[];
  };
  resources: {
    planFeatures: string[];
    customFeature?: string;
  };
  brandColor: string;
  backgroundImage: string;
  avatarChoice: string;
  onEdit: () => void;
  onConfirm: () => void;
  imageOnly?: boolean;
}

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

const InvestmentsPreview = forwardRef<HTMLDivElement, InvestmentsPreviewProps>(
  (props, ref) => {
    const {
      brandColor,
      backgroundImage,
      avatarChoice,
      investments,
      resources,
      onEdit,
      onConfirm,
      imageOnly = false,
    } = props;

    // If imageOnly is true, render just the content without header, avatar, and bottom bar
    if (imageOnly) {
      return (
        <div className="space-y-4">
          <div
            className="relative w-full h-full bg-transparent"
            ref={ref}
            style={{
              background: "transparent",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-end",
              minHeight: "400px",
            }}
          >
            <div className="text-right space-y-4 pr-8">
              <strong className="text-3xl font-bold text-black tracking-tight mb-4">
                Plan Features
              </strong>

              {/* Static features - always displayed */}
              <p className="text-2xl text-black tracking-tight">
                - Simplified Enrollment
              </p>
              <p className="text-2xl text-black tracking-tight">
                - Diversified Investment Options
              </p>
              <p className="text-2xl text-black tracking-tight">
                - Benefits Website with Online Access
              </p>
              <p className="text-2xl text-black tracking-tight">
                - Dedicated Support Team
              </p>

              {/* Selected features with dashes */}
              {resources?.planFeatures && resources.planFeatures.length > 0
                ? resources.planFeatures
                    .filter((item) => item !== "none")
                    .map((currentItem, index) => {
                      const currentFeature = listAdditionalFeatures.find(
                        (feature) => feature.value === currentItem,
                      );

                      const displayValue =
                        currentFeature?.value === "custom"
                          ? resources?.customFeature
                          : currentFeature?.label;

                      return displayValue ? (
                        <p
                          className="text-2xl text-black tracking-tight"
                          key={currentItem}
                        >
                          - {displayValue}
                        </p>
                      ) : null;
                    })
                : null}
            </div>
          </div>
        </div>
      );
    }

    // Original full preview component
    return (
      <div className="space-y-6" ref={ref}>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Investments & Features Preview
          </h2>
          <p className="text-gray-500 mt-1">
            Review how your investments and plan features will appear
          </p>
        </div>

        {/* Target Date Funds Chip */}
        {investments.investmentOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {investments.investmentOptions.map((item) => (
              <div
                key={item}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#005F73] text-white"
              >
                {item}
              </div>
            ))}
          </div>
        )}

        {/* 16:9 aspect ratio container */}
        <div
          className="relative w-full rounded-lg overflow-hidden border border-gray-200"
          style={{ paddingBottom: "56.25%" }}
        >
          <div className="absolute inset-0 bg-white overflow-hidden">
            {/* Text container */}
            <div className="absolute h-[80%] w-full flex flex-col items-start text-3xl text-black tracking-tight p-10 gap-2 overflow-y-auto">
              <strong className="mb-4">Plan Features</strong>

              {/* Static features - always displayed */}
              <p className="text-xl text-black tracking-tight break-words w-full max-w-1/2">
                - Simplified Enrollment
              </p>
              <p className="text-xl text-black tracking-tight break-words w-full max-w-1/2">
                - Diversified Investment Options
              </p>
              <p className="text-xl text-black tracking-tight break-words w-full max-w-1/2">
                - Benefits Website with Online Access
              </p>
              <p className="text-xl text-black tracking-tight break-words w-full max-w-1/2">
                - Dedicated Support Team
              </p>

              {/* Selected features with dashes */}
              {resources?.planFeatures
                ?.filter((item) => item !== "none")
                .map((currentItem, index) => {
                  const currentFeature = listAdditionalFeatures.find(
                    (feature) => feature.value === currentItem,
                  );

                  const displayValue =
                    currentFeature?.value === "custom"
                      ? resources?.customFeature
                      : currentFeature?.label;

                  return displayValue ? (
                    <p
                      className="text-xl text-black tracking-tight break-words w-full max-w-1/2"
                      key={currentItem}
                    >
                      - {displayValue}
                    </p>
                  ) : null;
                })}
            </div>

            {/* Color bar at the bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[20%]"
              style={{ backgroundColor: brandColor }}
            />

            {/* Avatar */}
            {avatarChoice && (
              <div className="absolute w-[40%] h-[40%] right-2 top-2 text-right rounded-full">
                <img
                  src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                  alt="Avatar"
                  className="h-full w-auto object-contain object-bottom rounded-full"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <Button
            onClick={onEdit}
            variant="outline"
            className="border-2 border-gray-300 hover:border-gray-400 transition-colors"
          >
            Edit
          </Button>
          <Button
            onClick={onConfirm}
            className="!bg-[#005F73] hover:!bg-[#004D5D] text-white"
          >
            Confirm & Continue
          </Button>
        </div>
      </div>
    );
  },
);

InvestmentsPreview.displayName = "InvestmentsPreview";

export default InvestmentsPreview;
