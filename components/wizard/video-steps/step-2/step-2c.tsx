"use client";

import { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";

interface VideoStep2cProps {
  errorFields?: string[];
}

export const listEnrollmentRate = [
  {
    label: "3%",
    value: "3",
  },
  {
    label: "4%",
    value: "4",
  },
  {
    label: "5%",
    value: "5",
  },
  {
    label: "6%",
    value: "6",
  },
  {
    label: "Custom",
    value: "custom",
  },
];

export const listEnrollmentMethod = [
  {
    label: "Online",
    value: "online",
  },
  {
    label: "Phone",
    value: "phone",
  },
  {
    label: "Paper Form",
    value: "paperForm",
  },
  {
    label: "Custom",
    value: "custom",
  },
];

export const listAutoEscalation = [
  {
    label: "None",
    value: "none",
  },
  {
    label: "1% annually",
    value: "1",
  },
  {
    label: "2% annually",
    value: "2",
  },
  {
    label: "Custom",
    value: "custom",
  },
];

export const listDeferralCap = [
  {
    label: "10%",
    value: "10",
  },
  {
    label: "15%",
    value: "15",
  },
  {
    label: "Maximum allowed by law",
    value: "max",
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

export function VideoStep2c({ errorFields = [] }: VideoStep2cProps) {
  const { stepData, saveStepDataLocally } = useVideoWizardStore();

  // Local state for form fields
  const step2cData = (stepData as any).step2c || {};
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;

  // Get brand color from plan (like in other previews)
  const planBrandColor =
    selectedPlan?.brandColor || selectedPlan?.videoThemeColor || "#005F73";

  // Initialize with saved data, then fallback to plan data
  const [autoEnrollment, setAutoEnrollment] = useState<boolean | null>(
    step2cData.autoEnrollment !== undefined
      ? step2cData.autoEnrollment
      : selectedPlan?.automaticEnrollment !== undefined
      ? selectedPlan.automaticEnrollment
      : null,
  );
  const [enrollmentRate, setEnrollmentRate] = useState<string>(
    step2cData.enrollmentRate ||
      selectedPlan?.automaticEnrollmentPercentage ||
      "",
  );
  const [customEnrollmentRate, setCustomEnrollmentRate] = useState<string>(
    step2cData.customEnrollmentRate || "",
  );
  const [autoEscalation, setAutoEscalation] = useState<string>(
    step2cData.autoEscalation ||
      selectedPlan?.automaticIncreasePercentage ||
      "1",
  );
  const [customAutoEscalation, setCustomAutoEscalation] = useState<string>(
    step2cData.customAutoEscalation || "",
  );
  const [deferralCap, setDeferralCap] = useState<string>(
    step2cData.deferralCap || selectedPlan?.deferrals?.[0] || "10",
  );
  const [customDeferralCap, setCustomDeferralCap] = useState<string>(
    step2cData.customDeferralCap || "",
  );
  const [enrollmentMethods, setEnrollmentMethods] = useState<string[]>(
    step2cData.enrollmentMethods || [],
  );
  const [customEnrollmentMethod, setCustomEnrollmentMethod] = useState<string>(
    step2cData.customEnrollmentMethod || "",
  );
  const [rothOption, setRothOption] = useState<boolean | null>(
    step2cData.rothOption !== undefined ? step2cData.rothOption : null,
  );
  const [brandColor, setBrandColor] = useState<string>(
    step2cData.brandColor || planBrandColor,
  );
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // Local state for touched fields and errors
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Save data to store whenever fields change
  useEffect(() => {
    saveStepDataLocally("step2c", {
      autoEnrollment,
      enrollmentRate,
      customEnrollmentRate,
      autoEscalation,
      customAutoEscalation,
      deferralCap,
      customDeferralCap,
      enrollmentMethods,
      customEnrollmentMethod,
      rothOption,
      brandColor,
    });
  }, [
    autoEnrollment,
    enrollmentRate,
    customEnrollmentRate,
    autoEscalation,
    customAutoEscalation,
    deferralCap,
    customDeferralCap,
    enrollmentMethods,
    customEnrollmentMethod,
    rothOption,
    brandColor,
    saveStepDataLocally,
  ]);

  // Mark all fields as touched when errorFields change (validation failed)
  useEffect(() => {
    if (errorFields.length > 0) {
      setTouched((prev) => ({
        ...prev,
        autoEnrollment: true,
        enrollmentRate: true,
        enrollmentMethods: true,
        rothOption: true,
      }));
    }
  }, [errorFields]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    let error = "";

    switch (field) {
      case "autoEnrollment":
        if (autoEnrollment === null) {
          error = "Please select an auto enrollment option";
        }
        break;
      case "enrollmentRate":
        if (autoEnrollment === true && !enrollmentRate) {
          error = "Please select an enrollment rate";
        } else if (
          autoEnrollment === true &&
          enrollmentRate === "custom" &&
          !customEnrollmentRate.trim()
        ) {
          error = "Please enter a custom enrollment rate";
        }
        break;
      case "enrollmentMethods":
        if (autoEnrollment === false && enrollmentMethods.length === 0) {
          error = "Please select at least one enrollment method";
        } else if (
          autoEnrollment === false &&
          enrollmentMethods.includes("custom") &&
          !customEnrollmentMethod.trim()
        ) {
          error = "Please enter a custom enrollment method";
        }
        break;
      case "rothOption":
        if (rothOption === null) {
          error = "Please select a Roth option";
        }
        break;
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  };

  const validateAll = () => {
    const fields = ["autoEnrollment", "rothOption"];
    let isValid = true;

    fields.forEach((field) => {
      if (!validateField(field)) {
        isValid = false;
      }
    });

    if (autoEnrollment === true) {
      if (!validateField("enrollmentRate")) {
        isValid = false;
      }
    }

    if (autoEnrollment === false) {
      if (!validateField("enrollmentMethods")) {
        isValid = false;
      }
    }

    return isValid;
  };

  const handleEnrollmentRateChange = (value: string) => {
    setEnrollmentRate(value);
    if (value !== "custom") {
      setCustomEnrollmentRate("");
    }
    if (touched.enrollmentRate) {
      validateField("enrollmentRate");
    }
  };

  const handleAutoEscalationChange = (value: string) => {
    setAutoEscalation(value);
    if (value !== "custom") {
      setCustomAutoEscalation("");
    }
  };

  const handleDeferralCapChange = (value: string) => {
    setDeferralCap(value);
    if (value !== "custom") {
      setCustomDeferralCap("");
    }
  };

  const handleEnrollmentMethodChange = (value: string, checked: boolean) => {
    if (checked) {
      setEnrollmentMethods([...enrollmentMethods, value]);
    } else {
      setEnrollmentMethods(enrollmentMethods.filter((m) => m !== value));
    }
    if (touched.enrollmentMethods) {
      validateField("enrollmentMethods");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Deferrals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Employee Deferrals</h3>

            <div className="space-y-2">
              <Label>Auto Enrollment</Label>
              <RadioGroup
                value={
                  autoEnrollment === null ? "" : autoEnrollment ? "yes" : "no"
                }
                onValueChange={(value) => {
                  const newValue = value === "yes";
                  setAutoEnrollment(newValue);
                  if (touched.autoEnrollment) {
                    validateField("autoEnrollment");
                  }
                }}
                onBlur={() => handleBlur("autoEnrollment")}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="auto-yes" />
                  <Label htmlFor="auto-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="auto-no" />
                  <Label htmlFor="auto-no">No</Label>
                </div>
              </RadioGroup>
              {touched.autoEnrollment && (
                <ErrorMessage error={errors.autoEnrollment} />
              )}
            </div>

            {autoEnrollment === true && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="enrollment-rate">Enrollment Rate</Label>
                  <Select
                    value={enrollmentRate}
                    onValueChange={handleEnrollmentRateChange}
                    onOpenChange={() => handleBlur("enrollmentRate")}
                  >
                    <SelectTrigger
                      id="enrollment-rate"
                      className={
                        (touched.enrollmentRate && errors.enrollmentRate) ||
                        errorFields.includes("enrollmentRate")
                          ? "border-red-500 focus:ring-0 focus:ring-offset-0"
                          : "focus:ring-0 focus:ring-offset-0"
                      }
                    >
                      <SelectValue placeholder="Select enrollment rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {listEnrollmentRate.map((item) => (
                        <SelectItem value={item.value} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {enrollmentRate === "custom" && (
                    <div className="mt-2">
                      <Input
                        type="text"
                        placeholder="Enter custom enrollment rate"
                        maxLength={50}
                        value={customEnrollmentRate}
                        onChange={(e) => {
                          setCustomEnrollmentRate(e.target.value);
                          if (touched.enrollmentRate) {
                            validateField("enrollmentRate");
                          }
                        }}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {customEnrollmentRate.length}/50 characters
                      </p>
                    </div>
                  )}
                  {touched.enrollmentRate && (
                    <ErrorMessage error={errors.enrollmentRate} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-escalation">Auto Escalation</Label>
                  <Select
                    value={autoEscalation}
                    onValueChange={handleAutoEscalationChange}
                  >
                    <SelectTrigger id="auto-escalation">
                      <SelectValue placeholder="Select auto escalation" />
                    </SelectTrigger>
                    <SelectContent>
                      {listAutoEscalation.map((item) => (
                        <SelectItem value={item.value} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {autoEscalation === "custom" && (
                    <div className="mt-2">
                      <Input
                        type="text"
                        placeholder="Enter custom auto escalation"
                        maxLength={50}
                        value={customAutoEscalation}
                        onChange={(e) =>
                          setCustomAutoEscalation(e.target.value)
                        }
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {customAutoEscalation.length}/50 characters
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deferral-cap">Escalation Cap</Label>
                  <Select
                    value={deferralCap}
                    onValueChange={handleDeferralCapChange}
                  >
                    <SelectTrigger id="deferral-cap">
                      <SelectValue placeholder="Select escalation cap" />
                    </SelectTrigger>
                    <SelectContent>
                      {listDeferralCap.map((item) => (
                        <SelectItem value={item.value} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {deferralCap === "custom" && (
                    <div className="mt-2">
                      <Input
                        type="text"
                        placeholder="Enter custom escalation cap"
                        maxLength={50}
                        value={customDeferralCap}
                        onChange={(e) => setCustomDeferralCap(e.target.value)}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {customDeferralCap.length}/50 characters
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Enrollment Method (check all that apply)</Label>
              <div className="space-y-2">
                {listEnrollmentMethod?.map((item) => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={item.value}
                      checked={enrollmentMethods.includes(item.value)}
                      onCheckedChange={(checked) =>
                        handleEnrollmentMethodChange(
                          item.value,
                          checked as boolean,
                        )
                      }
                    />
                    <Label htmlFor={item.value}>{item.label}</Label>
                  </div>
                ))}
                {enrollmentMethods.includes("custom") && (
                  <div className="mt-2">
                    <Input
                      type="text"
                      placeholder="Enter custom enrollment method"
                      maxLength={50}
                      value={customEnrollmentMethod}
                      onChange={(e) =>
                        setCustomEnrollmentMethod(e.target.value)
                      }
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {customEnrollmentMethod.length}/50 characters
                    </p>
                  </div>
                )}
                {touched.enrollmentMethods && (
                  <ErrorMessage error={errors.enrollmentMethods} />
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Roth Option</Label>
              <RadioGroup
                value={rothOption === null ? "" : rothOption ? "yes" : "no"}
                onValueChange={(value) => {
                  const newValue = value === "yes";
                  setRothOption(newValue);
                  if (touched.rothOption) {
                    validateField("rothOption");
                  }
                }}
                onBlur={() => handleBlur("rothOption")}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="roth-yes" />
                  <Label htmlFor="roth-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="roth-no" />
                  <Label htmlFor="roth-no">No</Label>
                </div>
              </RadioGroup>
              {touched.rothOption && <ErrorMessage error={errors.rothOption} />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
