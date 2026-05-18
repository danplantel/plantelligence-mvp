"use client";

import { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Plus, ChevronDown } from "lucide-react";
import CompanyMatch from "@/components/pages/create-dashboard/Section/EmployerContributionsSection/CompanyMatch";
import HarborDetails from "@/components/pages/create-dashboard/Section/EmployerContributionsSection/HarborDetails";
import FixedAmount from "@/components/pages/create-dashboard/Section/EmployerContributionsSection/FixedAmount";
import ProfitSharing from "@/components/pages/create-dashboard/Section/EmployerContributionsSection/ProfitSharing";

type ContributionType =
  | "companyMatch"
  | "safeHarbor"
  | "profitSharing"
  | "fixedAmount";

interface VideoStep3aProps {
  errorFields?: string[];
}

function ErrorMessage({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <p className="text-sm text-red-500 mt-1">{error}</p>;
}

export function VideoStep3a({ errorFields = [] }: VideoStep3aProps) {
  const { stepData, saveStepDataLocally } = useVideoWizardStore();

  // Get saved data or initialize
  const step3aData = (stepData as any).step3a || {};
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;

  // Initialize state from saved data or plan data
  const [hasContributions, setHasContributions] = useState<boolean | null>(
    step3aData.hasContributions !== undefined
      ? step3aData.hasContributions
      : selectedPlan?.employerContributions?.hasContributions !== undefined
      ? selectedPlan.employerContributions.hasContributions
      : null,
  );

  const [primaryContributionType, setPrimaryContributionType] =
    useState<ContributionType | null>(
      step3aData.primaryContributionType || null,
    );

  const [hasAdditionalContributions, setHasAdditionalContributions] = useState<
    boolean | null
  >(
    step3aData.hasAdditionalContributions !== undefined
      ? step3aData.hasAdditionalContributions
      : null,
  );

  const [contributionTypes, setContributionTypes] = useState<
    ContributionType[]
  >(step3aData.contributionTypes || []);

  // Initialize contribution details from saved data or defaults
  const [companyMatch, setCompanyMatch] = useState({
    isPrimary: step3aData.companyMatch?.isPrimary || false,
    formula: step3aData.companyMatch?.formula || "",
    customFormula: step3aData.companyMatch?.customFormula || "",
    limit: step3aData.companyMatch?.limit || "",
    customLimit: step3aData.companyMatch?.customLimit || "",
    vesting: step3aData.companyMatch?.vesting || "",
    customVesting: step3aData.companyMatch?.customVesting || "",
  });

  const [safeHarbor, setSafeHarbor] = useState({
    isPrimary: step3aData.safeHarbor?.isPrimary || false,
    type: step3aData.safeHarbor?.type || "",
    customType: step3aData.safeHarbor?.customType || "",
    formula: step3aData.safeHarbor?.formula || "",
    customFormula: step3aData.safeHarbor?.customFormula || "",
    limit: step3aData.safeHarbor?.limit || "",
    customLimit: step3aData.safeHarbor?.customLimit || "",
    vesting: step3aData.safeHarbor?.vesting || "",
    customVesting: step3aData.safeHarbor?.customVesting || "",
  });

  const [fixedAmount, setFixedAmount] = useState({
    isPrimary: step3aData.fixedAmount?.isPrimary || false,
    amount: step3aData.fixedAmount?.amount || "",
    customAmount: step3aData.fixedAmount?.customAmount || "",
    percentageAmount: step3aData.fixedAmount?.percentageAmount || "",
    details: step3aData.fixedAmount?.details || "",
    customDetails: step3aData.fixedAmount?.customDetails || "",
    vesting: step3aData.fixedAmount?.vesting || "",
    customVesting: step3aData.fixedAmount?.customVesting || "",
  });

  const [profitSharing, setProfitSharing] = useState({
    isPrimary: step3aData.profitSharing?.isPrimary || false,
    details: step3aData.profitSharing?.details || "",
    customDetails: step3aData.profitSharing?.customDetails || "",
    conditions: step3aData.profitSharing?.conditions || "",
    customConditions: step3aData.profitSharing?.customConditions || "",
    vesting: step3aData.profitSharing?.vesting || "",
    customVesting: step3aData.profitSharing?.customVesting || "",
  });

  const [maxTypeError, setMaxTypeError] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Track which types are opened (independent of selection)
  const [openedTypes, setOpenedTypes] = useState<Set<ContributionType>>(
    new Set(),
  );

  // Default initial selection (No) when nothing chosen
  useEffect(() => {
    setHasContributions((current) => (current === null ? false : current));
  }, []);

  // Load plan data if available
  useEffect(() => {
    const loadPlanData = async () => {
      const selectedPlanId =
        stepData.selectedPlanId || (stepData as any).step1?.selectedPlanId;
      const selectedPlan =
        stepData.selectedPlan || (stepData as any).step1?.selectedPlan;

      if (selectedPlan?.employerContributions) {
        const ec = selectedPlan.employerContributions;
        if (hasContributions === null && ec.hasContributions !== undefined) {
          setHasContributions(ec.hasContributions);
        }
      }

      // If we have a plan ID but no plan data, fetch from API
      if (selectedPlanId && !selectedPlan) {
        try {
          const response = await fetch(
            `/api/plans/get-detail-plan?id=${selectedPlanId}`,
          );
          const planData = await response.json();
          const plan = planData.data;

          if (plan?.employerContributions) {
            const ec = plan.employerContributions;
            if (
              hasContributions === null &&
              ec.hasContributions !== undefined
            ) {
              setHasContributions(ec.hasContributions);
            }
          }
        } catch (error) {
          console.error("Error loading plan data:", error);
        }
      }
    };

    loadPlanData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepData.selectedPlanId, stepData.selectedPlan]);

  // Save data to store
  useEffect(() => {
    saveStepDataLocally("step3a", {
      hasContributions,
      primaryContributionType,
      hasAdditionalContributions,
      contributionTypes,
      companyMatch,
      safeHarbor,
      fixedAmount,
      profitSharing,
    });
  }, [
    hasContributions,
    primaryContributionType,
    hasAdditionalContributions,
    contributionTypes,
    companyMatch,
    safeHarbor,
    fixedAmount,
    profitSharing,
    saveStepDataLocally,
  ]);

  // Mark fields as touched when errorFields change
  useEffect(() => {
    if (errorFields.length > 0) {
      setTouched((prev) => ({
        ...prev,
        hasContributions: true,
        primaryContributionType: true,
      }));
    }
  }, [errorFields]);

  const handleContributionTypeChange = (type: ContributionType) => {
    const currentTypes = [...contributionTypes];
    const isPrimaryType = primaryContributionType === type;
    const isAdditionalType =
      primaryContributionType && primaryContributionType !== type;

    // Remove type if already selected
    if (currentTypes.includes(type)) {
      const updatedTypes = currentTypes.filter((item) => item !== type);

      setContributionTypes(updatedTypes);

      if (isPrimaryType) {
        setPrimaryContributionType(
          updatedTypes.length > 0 ? updatedTypes[0] : null,
        );
      }
      // Close when deselected
      setOpenedTypes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(type);
        return newSet;
      });
      setMaxTypeError(false);
    } else {
      // Add type
      // Check if this is an additional type (primary already selected and this is not primary)
      if (primaryContributionType && primaryContributionType !== type) {
        // If selecting additional type - remove all other additional types first
        const otherAdditionalTypes = currentTypes.filter(
          (item) => item !== primaryContributionType,
        );

        // Remove all other additional types from openedTypes
        setOpenedTypes((prev) => {
          const newSet = new Set(prev);
          otherAdditionalTypes.forEach((t) => newSet.delete(t));
          return newSet;
        });

        // Keep only primary + new additional type
        const updatedTypes = [primaryContributionType, type];
        setContributionTypes(updatedTypes);

        // Automatically open when selected
        setOpenedTypes((prev) => {
          const newSet = new Set(prev);
          newSet.add(type);
          return newSet;
        });

        // Set default values for new additional type
        if (type === "companyMatch" && !companyMatch.formula) {
          setCompanyMatch({
            ...companyMatch,
            formula: "100% of employee contributions",
            limit: "Up to 3% of compensation",
            vesting: "Immediate",
            isPrimary: false,
          });
        } else if (type === "safeHarbor" && !safeHarbor.type) {
          setSafeHarbor({
            ...safeHarbor,
            type: "Basic Match",
            formula: "100% of first 3% + 50% of next 2%",
            limit: "up to 4% of compensation",
            vesting: "Immediate",
            isPrimary: false,
          });
        } else if (type === "fixedAmount" && !fixedAmount.amount) {
          setFixedAmount({
            ...fixedAmount,
            amount: "3% of compensation",
            details: "Contributed annually",
            vesting: "Immediate",
            isPrimary: false,
          });
        } else if (type === "profitSharing" && !profitSharing.details) {
          setProfitSharing({
            ...profitSharing,
            details: "Pro-rata allocation",
            conditions: "Based on company profitability",
            vesting: "Immediate",
            isPrimary: false,
          });
        }
      } else {
        // If selecting primary type - remove all other primary types first
        // Remove all other types (both primary and additional) except the new one
        const otherTypes = currentTypes.filter((item) => item !== type);

        // Remove all other types from openedTypes
        setOpenedTypes((prev) => {
          const newSet = new Set(prev);
          otherTypes.forEach((t) => newSet.delete(t));
          return newSet;
        });

        // Set new primary type
        setPrimaryContributionType(type);

        // Keep only the new primary type (remove all additional types)
        const updatedTypes = [type];
        setContributionTypes(updatedTypes);

        // Automatically open when selected
        setOpenedTypes((prev) => {
          const newSet = new Set(prev);
          newSet.add(type);
          return newSet;
        });

        // Set default values for new type
        if (type === "companyMatch" && !companyMatch.formula) {
          setCompanyMatch({
            ...companyMatch,
            formula: "100% of employee contributions",
            limit: "Up to 3% of compensation",
            vesting: "Immediate",
            isPrimary: true,
          });
        } else if (type === "safeHarbor" && !safeHarbor.type) {
          setSafeHarbor({
            ...safeHarbor,
            type: "Basic Match",
            formula: "100% of first 3% + 50% of next 2%",
            limit: "up to 4% of compensation",
            vesting: "Immediate",
            isPrimary: true,
          });
        } else if (type === "fixedAmount" && !fixedAmount.amount) {
          setFixedAmount({
            ...fixedAmount,
            amount: "3% of compensation",
            details: "Contributed annually",
            vesting: "Immediate",
            isPrimary: true,
          });
        } else if (type === "profitSharing" && !profitSharing.details) {
          setProfitSharing({
            ...profitSharing,
            details: "Pro-rata allocation",
            conditions: "Based on company profitability",
            vesting: "Immediate",
            isPrimary: true,
          });
        }

        setMaxTypeError(false);
      }
    }

    setTouched((prev) => ({ ...prev, primaryContributionType: true }));
  };

  const handleContributionInputChange = (
    contributionType: ContributionType,
    field: string,
    value: string,
  ) => {
    switch (contributionType) {
      case "companyMatch":
        setCompanyMatch((prev) => ({ ...prev, [field]: value }));
        break;
      case "safeHarbor":
        setSafeHarbor((prev) => ({ ...prev, [field]: value }));
        break;
      case "fixedAmount":
        setFixedAmount((prev) => ({ ...prev, [field]: value }));
        break;
      case "profitSharing":
        setProfitSharing((prev) => ({ ...prev, [field]: value }));
        break;
    }
  };

  // Create formData structure for contribution components
  const formData = {
    employerContributions: {
      hasContributions,
      hasAdditionalContributions,
      contributionTypes,
      primaryContributionType,
      companyMatch,
      safeHarbor,
      fixedAmount,
      profitSharing,
    },
  };

  const contributionErrors = {
    employerContributions: {},
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employer Contributions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Does the company make contributions?</Label>
          <div className="flex space-x-4">
            <Button
              type="button"
              variant={hasContributions === true ? "default" : "outline"}
              onClick={() => {
                setHasContributions(true);
                setTouched((prev) => ({ ...prev, hasContributions: true }));
              }}
              className="flex-1"
            >
              Yes
            </Button>
            <Button
              type="button"
              variant={hasContributions === false ? "default" : "outline"}
              onClick={() => {
                setHasContributions(false);
                setContributionTypes([]);
                setPrimaryContributionType(null);
                setTouched((prev) => ({ ...prev, hasContributions: true }));
              }}
              className="flex-1"
            >
              No
            </Button>
          </div>
          {touched.hasContributions && (
            <ErrorMessage
              error={
                hasContributions === null
                  ? "Please select an option"
                  : undefined
              }
            />
          )}
        </div>

        {hasContributions && (
          <div className="space-y-4">
            {maxTypeError && (
              <div className="p-3 mb-2 text-sm text-red-700 bg-red-50 rounded border border-red-200">
                Select your two primary contribution types. You&apos;ll be able
                to customize the final screen text before submission. Need more
                than 2?{" "}
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

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>What is the primary contribution form?</Label>
                <div className="space-y-3">
                  {(
                    [
                      "safeHarbor",
                      "companyMatch",
                      "profitSharing",
                      "fixedAmount",
                    ] as ContributionType[]
                  ).map((type) => {
                    const isSelected = primaryContributionType === type;
                    const typeName =
                      type === "companyMatch"
                        ? "Company Match"
                        : type === "safeHarbor"
                        ? "Safe Harbor"
                        : type === "fixedAmount"
                        ? "Fixed Amount"
                        : "Profit Sharing";

                    return (
                      <div
                        key={type}
                        className={`rounded-lg border-[1.5px] overflow-hidden ${
                          isSelected
                            ? "border-teal-700 bg-teal50 dark:bg-[#0e0e0e]"
                            : "border-gray-200"
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-4">
                          <div className="flex items-center gap-3 flex-1">
                            {/* Plus/Check - for selection */}
                            <div
                              className="cursor-pointer"
                              onClick={() => handleContributionTypeChange(type)}
                            >
                              {!isSelected ? (
                                <Plus className="h-5 w-5 text-gray-400 hover:text-teal-700 transition-colors" />
                              ) : (
                                <span className="flex justify-center items-center w-5 h-5 bg-teal-700 rounded-full shrink-0">
                                  <Check className="w-3 h-3 text-white" />
                                </span>
                              )}
                            </div>
                            <span className="font-medium">{typeName}</span>
                          </div>
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenedTypes((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(type)) {
                                  newSet.delete(type);
                                } else {
                                  newSet.add(type);
                                }
                                return newSet;
                              });
                            }}
                          >
                            <ChevronDown
                              className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                                openedTypes.has(type) ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Content - shows when opened */}
                        {openedTypes.has(type) && (
                          <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                            {type === "companyMatch" && (
                              <CompanyMatch
                                formData={formData as any}
                                errors={contributionErrors as any}
                                handleContributionInputChange={
                                  handleContributionInputChange
                                }
                              />
                            )}
                            {type === "safeHarbor" && (
                              <HarborDetails
                                formData={formData as any}
                                errors={contributionErrors as any}
                                handleContributionInputChange={
                                  handleContributionInputChange
                                }
                              />
                            )}
                            {type === "fixedAmount" && (
                              <FixedAmount
                                formData={formData as any}
                                errors={contributionErrors as any}
                                handleContributionInputChange={
                                  handleContributionInputChange
                                }
                              />
                            )}
                            {type === "profitSharing" && (
                              <ProfitSharing
                                formData={formData as any}
                                errors={contributionErrors as any}
                                handleContributionInputChange={
                                  handleContributionInputChange
                                }
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {touched.primaryContributionType &&
                  !primaryContributionType && (
                    <ErrorMessage error="Please select a primary contribution type" />
                  )}
              </div>
            </div>

            {/* Additional contributions */}
            {primaryContributionType && (
              <div className="space-y-2">
                <Label>
                  Does the company make any additional contributions beyond the
                  primary contribution?
                </Label>
                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant={
                      hasAdditionalContributions === true
                        ? "default"
                        : "outline"
                    }
                    onClick={() => setHasAdditionalContributions(true)}
                    className="flex-1"
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={
                      hasAdditionalContributions === false
                        ? "default"
                        : "outline"
                    }
                    onClick={() => {
                      setHasAdditionalContributions(false);
                      // Remove additional types
                      setContributionTypes([primaryContributionType]);
                    }}
                    className="flex-1"
                  >
                    No
                  </Button>
                </div>
              </div>
            )}

            {/* Show additional contribution selection */}
            {hasAdditionalContributions === true && primaryContributionType && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>What is the additional contribution form?</Label>
                  <div className="space-y-3">
                    {(
                      [
                        "safeHarbor",
                        "companyMatch",
                        "profitSharing",
                        "fixedAmount",
                      ] as ContributionType[]
                    )
                      .filter((type) => type !== primaryContributionType)
                      .map((type) => {
                        const isSelected =
                          contributionTypes.includes(type) &&
                          primaryContributionType !== type;
                        const typeName =
                          type === "companyMatch"
                            ? "Company Match"
                            : type === "safeHarbor"
                            ? "Safe Harbor"
                            : type === "fixedAmount"
                            ? "Fixed Amount"
                            : "Profit Sharing";

                        return (
                          <div
                            key={type}
                            className={`rounded-lg border-[1.5px] overflow-hidden ${
                              isSelected
                                ? "border-teal-700 bg-teal50 dark:bg-[#0e0e0e]"
                                : "border-gray-200"
                            }`}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-4">
                              <div className="flex items-center gap-3 flex-1">
                                {/* Plus/Check - for selection */}
                                <div
                                  className="cursor-pointer"
                                  onClick={() =>
                                    handleContributionTypeChange(type)
                                  }
                                >
                                  {!isSelected ? (
                                    <Plus className="h-5 w-5 text-gray-400 hover:text-teal-700 transition-colors" />
                                  ) : (
                                    <span className="flex justify-center items-center w-5 h-5 bg-teal-700 rounded-full shrink-0">
                                      <Check className="w-3 h-3 text-white" />
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium">{typeName}</span>
                              </div>
                              <div
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenedTypes((prev) => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(type)) {
                                      newSet.delete(type);
                                    } else {
                                      newSet.add(type);
                                    }
                                    return newSet;
                                  });
                                }}
                              >
                                <ChevronDown
                                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                                    openedTypes.has(type) ? "rotate-180" : ""
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Content - shows when opened */}
                            {openedTypes.has(type) && (
                              <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                                {type === "companyMatch" && (
                                  <CompanyMatch
                                    formData={formData as any}
                                    errors={contributionErrors as any}
                                    handleContributionInputChange={
                                      handleContributionInputChange
                                    }
                                  />
                                )}
                                {type === "safeHarbor" && (
                                  <HarborDetails
                                    formData={formData as any}
                                    errors={contributionErrors as any}
                                    handleContributionInputChange={
                                      handleContributionInputChange
                                    }
                                  />
                                )}
                                {type === "fixedAmount" && (
                                  <FixedAmount
                                    formData={formData as any}
                                    errors={contributionErrors as any}
                                    handleContributionInputChange={
                                      handleContributionInputChange
                                    }
                                  />
                                )}
                                {type === "profitSharing" && (
                                  <ProfitSharing
                                    formData={formData as any}
                                    errors={contributionErrors as any}
                                    handleContributionInputChange={
                                      handleContributionInputChange
                                    }
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
