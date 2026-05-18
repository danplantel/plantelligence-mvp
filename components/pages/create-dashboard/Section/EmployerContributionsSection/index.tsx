import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check } from "lucide-react";
import {
  ContributionType,
  Errors,
  IPlanFormData,
  SectionPreview,
  TouchedFields,
} from "../..";
import React, { useState } from "react";
import CompanyMatch from "./CompanyMatch";
import HarborDetails from "./HarborDetails";
import FixedAmount from "./FixedAmount";
import ProfitSharing from "./ProfitSharing";

export interface ContributionProps {
  formData: IPlanFormData;
  errors: Errors;
  handleContributionInputChange: (
    contributionType: ContributionType,
    field: string,
    value: string,
  ) => void;
}

interface EmployerContributionsSectionProps {
  formData: any;
  handleInputChange: any;
  errors: Errors;
  setTouched: React.Dispatch<React.SetStateAction<TouchedFields>>;
  setFormData: React.Dispatch<React.SetStateAction<IPlanFormData>>;
  validateEmployerContributions: () => boolean;
  prevSection: () => void;
  markSectionAsTouched: (section: string) => void;
  handleContributionInputChange: (
    contributionType: ContributionType,
    field: string,
    value: string,
  ) => void;
  setSectionReview: React.Dispatch<React.SetStateAction<SectionPreview>>;
  scrollToTop: () => void;
}

const EmployerContributionsSection = (
  props: EmployerContributionsSectionProps,
) => {
  const {
    formData,
    handleInputChange,
    errors,
    setFormData,
    setTouched,
    validateEmployerContributions,
    handleContributionInputChange,
    markSectionAsTouched,
    prevSection,
    scrollToTop,
    setSectionReview,
  } = props;
  const [activeEmployerTab, setActiveEmployerTab] = useState("");
  const [maxTypeError, setMaxTypeError] = useState(false);

  function handleAdditionalContributionsChange(hasAdditional: boolean) {
    setFormData((prev) => ({
      ...prev,
      employerContributions: {
        ...prev.employerContributions,
        hasAdditionalContributions: hasAdditional,
        // If No is selected, remove any additional contribution types
        contributionTypes: hasAdditional 
          ? prev.employerContributions.contributionTypes 
          : prev.employerContributions.contributionTypes.slice(0, 1),
      },
    }));
  }

  function handleContributionTypeChange(type: ContributionType) {
    const currentTypes = [...formData.employerContributions.contributionTypes];
  
     // --- REMOVE TYPE SECTION ---
    if (currentTypes.includes(type)) {
      const isPrimary = (formData.employerContributions as any)[type].isPrimary;
      const updatedTypes = currentTypes.filter((item) => item !== type);
  
      // Create updated employerContributions object
      const updatedEmployerContributions = {
        ...formData.employerContributions,
        contributionTypes: updatedTypes,
        [type]: {
          ...(formData.employerContributions as any)[type],
          isPrimary: false, // Ensure the removed type is no longer primary
        },
      };
  
      // If removing primary type and other types remain, make first remaining type primary
      if (isPrimary && updatedTypes.length > 0) {
        const newPrimaryType = updatedTypes[0];
        updatedEmployerContributions.primaryContributionType = newPrimaryType;
        updatedEmployerContributions[newPrimaryType] = {
          ...(formData.employerContributions as any)[newPrimaryType],
          isPrimary: true, // Set remaining type as primary
        };
      } else if (updatedTypes.length === 0) {
        updatedEmployerContributions.primaryContributionType = null; // No types left
      }
  
      // Update state in a single operation
      setFormData((prev) => ({
        ...prev,
        employerContributions: updatedEmployerContributions,
      }));
  
      setMaxTypeError(false);
    } 
    // --- ADD TYPE SECTION ---
    else {
      // Check maximum type limit
      if (currentTypes.length >= 2) {
        setMaxTypeError(true);
        return;
      }
  
      // If this is the first type or no primary exists, make it primary
      const isPrimary = 
        currentTypes.length === 0 || 
        !formData.employerContributions.primaryContributionType;
  
      // If making new type primary, unset primary from current primary type (if exists)
      const currentPrimary = formData.employerContributions.primaryContributionType;
      const updatedEmployerContributions = {
        ...formData.employerContributions,
        contributionTypes: [...currentTypes, type],
        primaryContributionType: isPrimary ? type : currentPrimary,
        [type]: {
          // Default values for each type
          ...(type === "companyMatch"
            ? {
                formula: "100% of employee contributions",
                limit: "Up to 3% of compensation",
                vesting: "Immediate",
              }
            : type === "safeHarbor"
            ? {
                type: "Basic Match",
                formula: "100% of first 3% + 50% of next 2%",
                limit: "up to 4% of compensation",
                vesting: "Immediate",
              }
            : type === "fixedAmount"
            ? {
                amount: "3% of compensation",
                details: "Contributed annually",
                vesting: "Immediate",
              }
            : {
                details: "Pro-rata allocation",
                conditions: "Based on company profitability",
                vesting: "Immediate",
              }),
          isPrimary, // Apply primary status
        },
      };
  
      // Unset primary from old type if needed
      if (isPrimary && currentPrimary) {
        updatedEmployerContributions[currentPrimary] = {
          ...(formData.employerContributions as any)[currentPrimary],
          isPrimary: false,
        };
      }
  
      setFormData((prev) => ({
        ...prev,
        employerContributions: updatedEmployerContributions,
      }));
      setMaxTypeError(false);
    }

    // Mark field as touched
    setTouched((prev) => ({
      ...prev,
      employerContributions: {
        ...prev.employerContributions,
        contributionTypes: true,
      },
    }));

    // Validate employer contributions
    validateEmployerContributions();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Does the company make contributions?</Label>
          <div className="flex space-x-4">
            <Button
              type="button"
              variant={
                formData.employerContributions.hasContributions === true
                  ? "default"
                  : "outline"
              }
              onClick={() =>
                handleInputChange(
                  "employerContributions",
                  "hasContributions",
                  true,
                )
              }
              className="flex-1"
            >
              Yes
            </Button>
            <Button
              type="button"
              variant={
                formData.employerContributions.hasContributions === false
                  ? "default"
                  : "outline"
              }
              onClick={() =>
                handleInputChange(
                  "employerContributions",
                  "hasContributions",
                  false,
                )
              }
              className="flex-1"
            >
              No
            </Button>
          </div>
        </div>

        {formData.employerContributions.hasContributions && (
          <div className="space-y-4">
            <div className="space-y-2">
              {/* Error message for selecting more than 2 contribution types */}
              {maxTypeError && (
                <div className="p-3 mb-2 text-sm text-red-700 bg-red-50 rounded border border-red-200">
                  Select your two primary contribution types. You&apos;ll be
                  able to customize the final screen text before submission.
                  Need more than 2?{" "}
                  <a
                    href="mailto:support@plantelligence.ai"
                    className="text-blue-700 underline hover:text-blue-900"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Contact our support team
                  </a>
                  .
                </div>
              )}
              <Label>What is the primary contribution form?</Label>
              <div className="space-y-3">
                {[
                  "safeHarbor",
                  "companyMatch",
                  "profitSharing",
                  "fixedAmount",
                ].map((type) => (
                  <div
                    key={type}
                    className={`relative cursor-pointer rounded-lg border-[1.5px] p-4 ${
                      formData.employerContributions.primaryContributionType === type
                        ? "border-teal-700 bg-teal50 dark:bg-[#0e0e0e]"
                        : "border-gray-200"
                    }`}
                    onClick={() => {
                      // Allow selection/deselection of primary contribution type
                      handleContributionTypeChange(type as ContributionType);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {type === "companyMatch"
                          ? "Company Match"
                          : type === "safeHarbor"
                          ? "Safe Harbor"
                          : type === "fixedAmount"
                          ? "Fixed Amount"
                          : "Profit Sharing"}
                      </span>
                      {formData.employerContributions.primaryContributionType === type && (
                        <span className="flex justify-center items-center w-5 h-5 bg-teal-700 rounded-full">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Show tabs for primary contribution details immediately after selection */}
            {formData.employerContributions.primaryContributionType && (
              <div className="space-y-4">
                {[formData.employerContributions.primaryContributionType].map(
                  (type: ContributionType) => {
                    if (type === "companyMatch") {
                      return (
                        <CompanyMatch
                          key={type}
                          formData={formData}
                          errors={errors}
                          handleContributionInputChange={
                            handleContributionInputChange
                          }
                        />
                      );
                    } else if (type === "safeHarbor") {
                      return (
                        <HarborDetails
                          key={type}
                          formData={formData}
                          errors={errors}
                          handleContributionInputChange={
                            handleContributionInputChange
                          }
                        />
                      );
                    } else if (type === "fixedAmount") {
                      return (
                        <FixedAmount
                          key={type}
                          formData={formData}
                          errors={errors}
                          handleContributionInputChange={
                            handleContributionInputChange
                          }
                        />
                      );
                    } else if (type === "profitSharing") {
                      return (
                        <ProfitSharing
                          key={type}
                          formData={formData}
                          errors={errors}
                          handleContributionInputChange={
                            handleContributionInputChange
                          }
                        />
                      );
                    }
                    return null;
                  }
                )}
              </div>
            )}

            {/* Show additional contributions question only after primary is selected */}
            {formData.employerContributions.primaryContributionType && (
              <div className="space-y-2">
                <Label>Does the company make any additional contributions beyond the primary contribution?</Label>
                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant={
                      formData.employerContributions.hasAdditionalContributions === true
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleAdditionalContributionsChange(true)}
                    className="flex-1"
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={
                      formData.employerContributions.hasAdditionalContributions === false
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleAdditionalContributionsChange(false)}
                    className="flex-1"
                  >
                    No
                  </Button>
                </div>
              </div>
            )}

            {/* Show additional contribution selection if Yes is selected */}
            {formData.employerContributions.hasAdditionalContributions === true && (
              <div className="space-y-2">
                <Label>What is the additional contribution form?</Label>
                <div className="space-y-3">
                  {[
                    "safeHarbor",
                    "companyMatch",
                    "profitSharing",
                    "fixedAmount",
                  ]
                    .filter((type) => type !== formData.employerContributions.primaryContributionType)
                    .map((type) => {
                    return (
                      <div
                        key={type}
                        className={`relative cursor-pointer rounded-lg border-[1.5px] p-4 ${
                          formData.employerContributions.contributionTypes.includes(type as ContributionType) && 
                          formData.employerContributions.primaryContributionType !== type
                            ? "border-teal-700 bg-teal50 dark:bg-[#0e0e0e]"
                            : "border-gray-200"
                        }`}
                        onClick={() =>
                          handleContributionTypeChange(type as ContributionType)
                        }
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            {type === "companyMatch"
                              ? "Company Match"
                              : type === "safeHarbor"
                              ? "Safe Harbor"
                              : type === "fixedAmount"
                              ? "Fixed Amount"
                              : "Profit Sharing"}
                          </span>
                          {formData.employerContributions.contributionTypes.includes(type as ContributionType) && 
                           formData.employerContributions.primaryContributionType !== type && (
                            <span className="flex justify-center items-center w-5 h-5 bg-teal-700 rounded-full">
                              <Check className="w-3 h-3 text-white" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Show tabs for additional contribution details immediately after selection */}
            {formData.employerContributions.contributionTypes.length > 1 && formData.employerContributions.primaryContributionType && (
              <div className="space-y-4">
                {formData.employerContributions.contributionTypes
                  .filter((type: ContributionType) => type !== formData.employerContributions.primaryContributionType)
                  .map(
                  (type: ContributionType) => {
                    if (type === "companyMatch") {
                      return (
                        <CompanyMatch
                          key={type}
                          formData={formData}
                          errors={errors}
                          handleContributionInputChange={
                            handleContributionInputChange
                          }
                        />
                      );
                    } else if (type === "safeHarbor") {
                      return (
                        <HarborDetails
                          key={type}
                          formData={formData}
                          errors={errors}
                          handleContributionInputChange={
                            handleContributionInputChange
                          }
                        />
                      );
                    } else if (type === "fixedAmount") {
                      return (
                        <FixedAmount
                          key={type}
                          formData={formData}
                          errors={errors}
                          handleContributionInputChange={
                            handleContributionInputChange
                          }
                        />
                      );
                    } else if (type === "profitSharing") {
                      return (
                        <ProfitSharing
                          key={type}
                          formData={formData}
                          errors={errors}
                          handleContributionInputChange={
                            handleContributionInputChange
                          }
                        />
                      );
                    }
                    return null;
                  }
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          className="border-2 border-gray-300 transition-colors hover:border-gray-400"
          onClick={prevSection}
        >
          Back
        </Button>
        <Button
          onClick={() => {
            scrollToTop();
            markSectionAsTouched("employerContributions");
            if (validateEmployerContributions()) {
              setSectionReview((prev) => ({
                ...prev,
                employerContributions: true,
              }));
            }
          }}
          className="transition-all duration-200 hover:scale-105 bg-[#005F73] hover:bg-[#004D5E]"
        >
          Review
        </Button>
      </div>
    </div>
  );
};

export default EmployerContributionsSection;
