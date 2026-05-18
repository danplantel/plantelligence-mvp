"use client";

import { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoStep2b } from "./step-2b";
import { VideoStep2c } from "./step-2c";
import { VideoStep2d } from "./step-2d";

interface VideoStep2Props {
  errorFields?: string[];
}

export const listAgeRequirement = [
  {
    label: "No age requirement",
    value: "none",
  },
  {
    label: "18 years",
    value: "18",
  },
  {
    label: "21 years",
    value: "21",
  },
  {
    label: "Custom",
    value: "custom",
  },
];

export const listServiceRequirement = [
  {
    label: "No service requirement",
    value: "none",
  },
  {
    label: "1 month of service",
    value: "1month",
  },
  {
    label: "3 months of service",
    value: "3months",
  },
  {
    label: "6 months of service",
    value: "6months",
  },
  {
    label: "1 year of service",
    value: "1year",
  },
  {
    label: "Custom",
    value: "custom",
  },
];

export const listEntryDate = [
  {
    label: "Immediate",
    value: "immediate",
  },
  {
    label: "First of the month",
    value: "firstOfMonth",
  },
  {
    label: "First of the quarter",
    value: "firstOfQuarter",
  },
  {
    label: "First of the year",
    value: "firstOfYear",
  },
  {
    label: "Custom",
    value: "custom",
  },
];

function ErrorMessage({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <p className="text-sm text-red-500 mt-1">{error}</p>;
}

export function VideoStep2({ errorFields = [] }: VideoStep2Props) {
  const { stepData, saveStepDataLocally, previousStep, nextStep } =
    useVideoWizardStore();

  // Sub-step state: 'form' (2a), 'preview' (2b), 'employeeDeferrals' (2c), or 'employeeDeferralsPreview' (2d)
  // Initialize from saved state or default to 'form'
  const savedSubStep =
    (stepData as any).step2SubStep?.step2SubStep ||
    (stepData as any).step2SubStep;
  const [currentSubStep, setCurrentSubStep] = useState<
    "form" | "preview" | "employeeDeferrals" | "employeeDeferralsPreview"
  >(savedSubStep || "form");

  // Save sub-step state
  useEffect(() => {
    saveStepDataLocally("step2SubStep", { step2SubStep: currentSubStep });
  }, [currentSubStep, saveStepDataLocally]);

  // Local state for form fields
  const step2aData = (stepData as any).step2a || {};
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;

  // Initialize with saved data, then fallback to plan data
  const [planType, setPlanType] = useState<string>(
    step2aData.planType || selectedPlan?.planType || "",
  );
  const [ageRequirement, setAgeRequirement] = useState<string>(
    step2aData.ageRequirement || selectedPlan?.ageRequirement || "",
  );
  const [customAgeRequirement, setCustomAgeRequirement] = useState<string>(
    step2aData.customAgeRequirement || "",
  );
  const [serviceRequirement, setServiceRequirement] = useState<string>(
    step2aData.serviceRequirement || selectedPlan?.waitingPeriodDuration || "",
  );
  const [customServiceRequirement, setCustomServiceRequirement] =
    useState<string>(step2aData.customServiceRequirement || "");
  const [entryDate, setEntryDate] = useState<string>(
    step2aData.entryDate || selectedPlan?.entryDates || "",
  );
  const [customEntryDate, setCustomEntryDate] = useState<string>(
    step2aData.customEntryDate || "",
  );

  // Default each select to its first option when no value is prefilled
  useEffect(() => {
    setPlanType((current) => current || "401k");
    setAgeRequirement(
      (current) => current || listAgeRequirement[0]?.value || "",
    );
    setServiceRequirement(
      (current) => current || listServiceRequirement[0]?.value || "",
    );
    setEntryDate((current) => current || listEntryDate[0]?.value || "");
  }, []);

  // Local state for touched fields and errors
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load plan data if available - auto-fill fields
  useEffect(() => {
    const loadPlanData = async () => {
      const selectedPlanId =
        stepData.selectedPlanId || (stepData as any).step1?.selectedPlanId;
      const selectedPlan =
        stepData.selectedPlan || (stepData as any).step1?.selectedPlan;
      const currentStep2aData = (stepData as any).step2a || {};

      // Use functional updates to check current state
      setPlanType((current) => {
        if (!current && selectedPlan?.planType) {
          return selectedPlan.planType;
        }
        if (!current && currentStep2aData.planType) {
          return currentStep2aData.planType;
        }
        return current;
      });

      setAgeRequirement((current) => {
        if (!current && selectedPlan?.ageRequirement) {
          return selectedPlan.ageRequirement;
        }
        if (!current && currentStep2aData.ageRequirement) {
          return currentStep2aData.ageRequirement;
        }
        return current;
      });

      setServiceRequirement((current) => {
        if (!current && selectedPlan?.waitingPeriodDuration) {
          return selectedPlan.waitingPeriodDuration;
        }
        if (!current && currentStep2aData.serviceRequirement) {
          return currentStep2aData.serviceRequirement;
        }
        return current;
      });

      setEntryDate((current) => {
        if (!current && selectedPlan?.entryDates) {
          return selectedPlan.entryDates;
        }
        if (!current && currentStep2aData.entryDate) {
          return currentStep2aData.entryDate;
        }
        return current;
      });

      // If we have a plan ID but no plan data, fetch from API
      if (selectedPlanId && !selectedPlan) {
        try {
          const response = await fetch(
            `/api/plans/get-detail-plan?id=${selectedPlanId}`,
          );
          const planData = await response.json();
          const plan = planData.data;

          if (plan) {
            // Only set fields that are empty (don't overwrite user input)
            setPlanType((current) => current || plan.planType || "");
            setAgeRequirement(
              (current) => current || plan.ageRequirement || "",
            );
            setServiceRequirement(
              (current) => current || plan.waitingPeriodDuration || "",
            );
            setEntryDate((current) => current || plan.entryDates || "");
          }
        } catch (error) {
          console.error("Error loading plan data:", error);
        }
      }
    };

    loadPlanData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepData.selectedPlanId, stepData.selectedPlan]);

  // Sync with step2aData when it changes externally
  useEffect(() => {
    const currentStep2aData = (stepData as any).step2a || {};
    if (currentStep2aData.planType && !planType) {
      setPlanType(currentStep2aData.planType);
    }
    if (currentStep2aData.ageRequirement && !ageRequirement) {
      setAgeRequirement(currentStep2aData.ageRequirement);
    }
    if (currentStep2aData.serviceRequirement && !serviceRequirement) {
      setServiceRequirement(currentStep2aData.serviceRequirement);
    }
    if (currentStep2aData.entryDate && !entryDate) {
      setEntryDate(currentStep2aData.entryDate);
    }
    if (currentStep2aData.customAgeRequirement && !customAgeRequirement) {
      setCustomAgeRequirement(currentStep2aData.customAgeRequirement);
    }
    if (
      currentStep2aData.customServiceRequirement &&
      !customServiceRequirement
    ) {
      setCustomServiceRequirement(currentStep2aData.customServiceRequirement);
    }
    if (currentStep2aData.customEntryDate && !customEntryDate) {
      setCustomEntryDate(currentStep2aData.customEntryDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(stepData as any).step2a]);

  // Save data to store whenever fields change
  useEffect(() => {
    saveStepDataLocally("step2a", {
      planType,
      ageRequirement,
      customAgeRequirement,
      serviceRequirement,
      customServiceRequirement,
      entryDate,
      customEntryDate,
    });
  }, [
    planType,
    ageRequirement,
    customAgeRequirement,
    serviceRequirement,
    customServiceRequirement,
    entryDate,
    customEntryDate,
    saveStepDataLocally,
  ]);

  // Mark all fields as touched when errorFields change (validation failed)
  useEffect(() => {
    if (errorFields.length > 0) {
      setTouched((prev) => ({
        ...prev,
        planType: true,
        ageRequirement: true,
        serviceRequirement: true,
        entryDate: true,
      }));
      // Validate all fields to show errors
      validateField("planType");
      validateField("ageRequirement");
      validateField("serviceRequirement");
      validateField("entryDate");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorFields]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    let error = "";

    switch (field) {
      case "planType":
        if (!planType) {
          error = "Please select a plan type";
        }
        break;
      case "ageRequirement":
        if (!ageRequirement) {
          error = "Please select an age requirement";
        } else if (
          ageRequirement === "custom" &&
          !customAgeRequirement.trim()
        ) {
          error = "Please enter a custom age requirement";
        }
        break;
      case "serviceRequirement":
        if (!serviceRequirement) {
          error = "Please select a service requirement";
        } else if (
          serviceRequirement === "custom" &&
          !customServiceRequirement.trim()
        ) {
          error = "Please enter a custom service requirement";
        }
        break;
      case "entryDate":
        if (!entryDate) {
          error = "Please select an entry date";
        } else if (entryDate === "custom" && !customEntryDate.trim()) {
          error = "Please enter a custom entry date";
        }
        break;
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  };

  const validateAll = () => {
    const fields = [
      "planType",
      "ageRequirement",
      "serviceRequirement",
      "entryDate",
    ];
    let isValid = true;

    fields.forEach((field) => {
      if (!validateField(field)) {
        isValid = false;
      }
    });

    return isValid;
  };

  const handleAgeRequirementChange = (value: string) => {
    setAgeRequirement(value);
    if (value !== "custom") {
      setCustomAgeRequirement("");
    }
    if (touched.ageRequirement) {
      validateField("ageRequirement");
    }
  };

  const handleServiceRequirementChange = (value: string) => {
    setServiceRequirement(value);
    if (value !== "custom") {
      setCustomServiceRequirement("");
    }
    if (touched.serviceRequirement) {
      validateField("serviceRequirement");
    }
  };

  const handleEntryDateChange = (value: string) => {
    setEntryDate(value);
    if (value !== "custom") {
      setCustomEntryDate("");
    }
    if (touched.entryDate) {
      validateField("entryDate");
    }
  };

  // Sync currentSubStep with store state
  useEffect(() => {
    const step2SubStep =
      (stepData as any).step2SubStep?.step2SubStep ||
      (stepData as any).step2SubStep;
    if (step2SubStep && step2SubStep !== currentSubStep) {
      setCurrentSubStep(step2SubStep);
    }
  }, [(stepData as any).step2SubStep]);

  // Show preview step (2b)
  if (currentSubStep === "preview") {
    return <VideoStep2b />;
  }

  // Show employee deferrals step (2c)
  if (currentSubStep === "employeeDeferrals") {
    return <VideoStep2c errorFields={errorFields} />;
  }

  // Show employee deferrals preview step (2d)
  if (currentSubStep === "employeeDeferralsPreview") {
    return <VideoStep2d />;
  }

  // Show form step (2a)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Eligibility Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Eligibility</h3>
            <div className="space-y-2">
              <Label htmlFor="age-requirement">Age Requirement</Label>
              <Select
                value={ageRequirement}
                onValueChange={handleAgeRequirementChange}
                onOpenChange={() => handleBlur("ageRequirement")}
              >
                <SelectTrigger
                  id="age-requirement"
                  className={
                    (touched.ageRequirement && errors.ageRequirement) ||
                    errorFields.includes("ageRequirement")
                      ? "border-red-500 focus:ring-0 focus:ring-offset-0"
                      : "focus:ring-0 focus:ring-offset-0"
                  }
                >
                  <SelectValue placeholder="Select age requirement" />
                </SelectTrigger>
                <SelectContent>
                  {listAgeRequirement.map((item) => (
                    <SelectItem value={item.value} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ageRequirement === "custom" && (
                <div className="mt-2">
                  <Input
                    type="text"
                    placeholder="Enter custom age requirement"
                    maxLength={50}
                    value={customAgeRequirement}
                    onChange={(e) => {
                      setCustomAgeRequirement(e.target.value);
                      if (touched.ageRequirement) {
                        validateField("ageRequirement");
                      }
                    }}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {customAgeRequirement.length}/50 characters
                  </p>
                </div>
              )}
              {touched.ageRequirement && (
                <ErrorMessage error={errors.ageRequirement} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-requirement">Service Requirement</Label>
              <Select
                value={serviceRequirement}
                onValueChange={handleServiceRequirementChange}
                onOpenChange={() => handleBlur("serviceRequirement")}
              >
                <SelectTrigger
                  id="service-requirement"
                  className={
                    (touched.serviceRequirement && errors.serviceRequirement) ||
                    errorFields.includes("serviceRequirement")
                      ? "border-red-500 focus:ring-0 focus:ring-offset-0"
                      : "focus:ring-0 focus:ring-offset-0"
                  }
                >
                  <SelectValue placeholder="Select service requirement" />
                </SelectTrigger>
                <SelectContent>
                  {listServiceRequirement.map((item) => (
                    <SelectItem value={item.value} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {serviceRequirement === "custom" && (
                <div className="mt-2">
                  <Input
                    type="text"
                    placeholder="Enter custom service requirement"
                    maxLength={50}
                    value={customServiceRequirement}
                    onChange={(e) => {
                      setCustomServiceRequirement(e.target.value);
                      if (touched.serviceRequirement) {
                        validateField("serviceRequirement");
                      }
                    }}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {customServiceRequirement.length}/50 characters
                  </p>
                </div>
              )}
              {touched.serviceRequirement && (
                <ErrorMessage error={errors.serviceRequirement} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-date">Entry Date</Label>
              <Select
                value={entryDate}
                onValueChange={handleEntryDateChange}
                onOpenChange={() => handleBlur("entryDate")}
              >
                <SelectTrigger
                  id="entry-date"
                  className={
                    (touched.entryDate && errors.entryDate) ||
                    errorFields.includes("entryDate")
                      ? "border-red-500 focus:ring-0 focus:ring-offset-0"
                      : "focus:ring-0 focus:ring-offset-0"
                  }
                >
                  <SelectValue placeholder="Select entry date" />
                </SelectTrigger>
                <SelectContent>
                  {listEntryDate.map((item) => (
                    <SelectItem value={item.value} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {entryDate === "custom" && (
                <div className="mt-2">
                  <Input
                    type="text"
                    placeholder="Enter custom entry date"
                    maxLength={50}
                    value={customEntryDate}
                    onChange={(e) => {
                      setCustomEntryDate(e.target.value);
                      if (touched.entryDate) {
                        validateField("entryDate");
                      }
                    }}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {customEntryDate.length}/50 characters
                  </p>
                </div>
              )}
              {touched.entryDate && <ErrorMessage error={errors.entryDate} />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
