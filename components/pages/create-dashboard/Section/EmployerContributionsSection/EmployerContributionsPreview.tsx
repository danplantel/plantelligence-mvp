"use client";

import React, { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { customValue } from "@/lib/utils";

interface EmployerContributionsPreviewProps {
  employerContributions: {
    hasContributions: boolean | null;
    hasAdditionalContributions: boolean | null;
    contributionTypes: string[];
    primaryContributionType: string | null;
    companyMatch: {
      isPrimary: boolean;
      formula: string;
      customFormula?: string;
      limit: string;
      customLimit?: string;
      vesting: string;
      customVesting?: string;
    };
    safeHarbor: {
      isPrimary: boolean;
      type: string;
      customType?: string;
      formula: string;
      customFormula?: string;
      limit: string;
      customLimit?: string;
      vesting: string;
      customVesting?: string;
    };
    fixedAmount: {
      isPrimary: boolean;
      amount: string;
      customAmount?: string;
      percentageAmount?: string;
      details: string;
      customDetails?: string;
      vesting: string;
      customVesting?: string;
    };
    profitSharing: {
      isPrimary: boolean;
      details: string;
      customDetails?: string;
      conditions: string;
      customConditions?: string;
      vesting: string;
      customVesting?: string;
    };
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

const EmployerContributionsPreview = forwardRef<
  HTMLDivElement,
  EmployerContributionsPreviewProps
>((props, ref) => {
  const {
    brandColor,
    backgroundImage,
    avatarChoice,
    employerContributions,
    onEdit,
    onConfirm,
    imageOnly = false,
  } = props;

  const contributionTypeNames: Record<string, string> = {
    companyMatch: "Company Match",
    safeHarbor: "Safe Harbor",
    fixedAmount: "Fixed Amount",
    profitSharing: "Profit Sharing",
  };

  const renderDetail = (type: string) => {
    switch (type) {
      case "companyMatch":
        return (
          <div>
            <p>
              {employerContributions.companyMatch.customFormula ||
                employerContributions.companyMatch.formula ||
                ""}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-semibold text-gray-700 tracking-wide">
                Limit:
              </span>
              <span className="text-lg text-gray-600 font-medium">
                {employerContributions.companyMatch.customLimit ||
                  employerContributions.companyMatch.limit ||
                  ""}
              </span>
            </div>
          </div>
        );
      case "safeHarbor":
        return (
          <div>
            <p>
              {employerContributions.safeHarbor.customFormula ||
                employerContributions.safeHarbor.formula ||
                ""}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-semibold text-gray-700 tracking-wide">
                Limit:
              </span>
              <span className="text-lg text-gray-600 font-medium">
                {employerContributions.safeHarbor.customLimit ||
                  employerContributions.safeHarbor.limit ||
                  ""}
              </span>
            </div>
          </div>
        );
      case "fixedAmount":
        return (
          <div>
            <p>
              {employerContributions.fixedAmount.customAmount ||
                employerContributions.fixedAmount.amount ||
                ""}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-semibold text-gray-700 tracking-wide">
                Limit:
              </span>
              <span className="text-lg text-gray-600 font-medium">
                {employerContributions.fixedAmount.customDetails ||
                  employerContributions.fixedAmount.details ||
                  ""}
              </span>
            </div>
          </div>
        );
      case "profitSharing":
        return (
          <div>
            <p>
              {employerContributions.profitSharing.customDetails ||
                employerContributions.profitSharing.details ||
                ""}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-semibold text-gray-700 tracking-wide">
                Limit:
              </span>
              <span className="text-lg text-gray-600 font-medium">
                {employerContributions.profitSharing.customConditions ||
                  employerContributions.profitSharing.conditions ||
                  ""}
              </span>
            </div>
          </div>
        );
    }
  };

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
            {employerContributions.hasContributions &&
            employerContributions.contributionTypes &&
            employerContributions.contributionTypes.length > 0 ? (
              employerContributions.contributionTypes.map((type) => {
                return (
                  <div key={type} className="flex text-normal flex-col gap-1">
                    <strong className="text-3xl font-bold text-black tracking-tight">
                      {contributionTypeNames[type]}
                    </strong>
                    <div className="text-2xl text-black tracking-tight">
                      {renderDetail(type)}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xl font-semibold text-gray-700 tracking-wide">
                        Vesting:
                      </span>
                      <span className="text-lg text-gray-600 font-medium">
                        {
                          // TypeScript-safe access to vesting fields
                          type === "companyMatch" ||
                          type === "safeHarbor" ||
                          type === "fixedAmount" ||
                          type === "profitSharing"
                            ? employerContributions[
                                type as
                                  | "companyMatch"
                                  | "safeHarbor"
                                  | "fixedAmount"
                                  | "profitSharing"
                              ]?.customVesting ||
                              employerContributions[
                                type as
                                  | "companyMatch"
                                  | "safeHarbor"
                                  | "fixedAmount"
                                  | "profitSharing"
                              ]?.vesting ||
                              ""
                            : ""
                        }
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-3xl font-bold text-black tracking-tight">
                Employer Contributions
              </div>
            )}
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
          Employer Contributions Preview
        </h2>
        <p className="text-gray-500 mt-1">
          Review how your employer contributions will appear
        </p>
      </div>

      {/* 16:9 aspect ratio container */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ paddingBottom: "56.25%" }}
      >
        <div className="absolute inset-0 bg-white overflow-hidden">
          {/* Text container */}
          <div className="absolute w-full flex flex-col items-start justify-evenly h-[85%] top-0 text-2xl text-black tracking-tight pl-10">
            {employerContributions.hasContributions &&
              employerContributions.contributionTypes &&
              employerContributions.contributionTypes.map((type) => {
                return (
                  <div key={type} className="flex text-normal flex-col gap-1">
                    <strong>{contributionTypeNames[type]}</strong>
                    {renderDetail(type)}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xl font-semibold text-gray-700 tracking-wide">
                        Vesting:
                      </span>
                      <span className="text-lg text-gray-600 font-medium">
                        {type === "companyMatch" ||
                        type === "safeHarbor" ||
                        type === "fixedAmount" ||
                        type === "profitSharing"
                          ? employerContributions[
                              type as
                                | "companyMatch"
                                | "safeHarbor"
                                | "fixedAmount"
                                | "profitSharing"
                            ]?.customVesting ||
                            employerContributions[
                              type as
                                | "companyMatch"
                                | "safeHarbor"
                                | "fixedAmount"
                                | "profitSharing"
                            ]?.vesting ||
                            ""
                          : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Color bar at the bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[15%]"
            style={{ backgroundColor: brandColor }}
          />

          {/* Avatar */}
          {avatarChoice && (
            <div className="absolute w-full h-[90%] bottom-0 right-0 text-right">
              <img
                src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                alt="Avatar"
                className="h-full w-auto object-contain object-bottom"
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
});

EmployerContributionsPreview.displayName = "EmployerContributionsPreview";

export default EmployerContributionsPreview;
