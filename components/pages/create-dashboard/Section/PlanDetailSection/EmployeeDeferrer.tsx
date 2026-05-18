import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import React, { FC } from "react";
import {
  ErrorMessage,
  Errors,
  IPlanFormData,
  SectionPreview,
  TouchedFields,
} from "../..";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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

interface EmployeeDeferrerProps {
  formData: IPlanFormData;
  touched: TouchedFields;
  errors: Errors;
  handleInputChange: (section: string, field: string, value: any) => void;
  handleSelectChange: (
    section: keyof IPlanFormData,
    nestedSection: string | null,
    field: string,
    value: string | "Email" | "Phone" | "Custom" | "None",
  ) => void;
  handleNestedInputChange: (
    section: string,
    nestedSection: string,
    field: string,
    value: any,
  ) => void;
  handleCheckboxChange: (
    section: string,
    field: string,
    value: string,
    checked: boolean,
  ) => void;
  openDialog: (
    section: string,
    nestedSection: string | null,
    field: string,
  ) => void;
  handleRadioInputChange: (section: string, field: string, value: any) => void;
  prevSection: () => void;
  markSectionAsTouched: (section: string) => void;
  scrollToTop: () => void;
  handleBlur: (section: string, field: string) => void;
  validatePlanDetails: (newFormData?: IPlanFormData) => boolean;
  setSectionReview: React.Dispatch<React.SetStateAction<SectionPreview>>;
}

const EmployeeDeferrer: FC<EmployeeDeferrerProps> = (props) => {
  const {
    formData,
    touched,
    errors,
    handleNestedInputChange,
    handleSelectChange,
    handleCheckboxChange,
    openDialog,
    handleRadioInputChange,
    prevSection,
    markSectionAsTouched,
    scrollToTop,
    validatePlanDetails,
    setSectionReview,
  } = props;
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">Employee Deferrals</h3>

      <div className="space-y-2">
        <Label>Auto Enrollment</Label>
        <RadioGroup
          value={
            formData.planDetails.employeeDeferrals.autoEnrollment === null
              ? ""
              : formData.planDetails.employeeDeferrals.autoEnrollment
              ? "yes"
              : "no"
          }
          onValueChange={(value) =>
            handleNestedInputChange(
              "planDetails",
              "employeeDeferrals",
              "autoEnrollment",
              value === "yes",
            )
          }
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
        {touched.planDetails.autoEnrollment && (
          <ErrorMessage error={errors.planDetails.autoEnrollment} />
        )}
      </div>

      {formData.planDetails.employeeDeferrals.autoEnrollment && (
        <>
          <div className="space-y-2">
            <Label htmlFor="enrollment-rate">Enrollment Rate</Label>
            <Select
              value={formData.planDetails.employeeDeferrals.enrollmentRate}
              onValueChange={(value) => {
                if (value !== "custom") {
                  handleSelectChange(
                    "planDetails",
                    "employeeDeferrals",
                    "customEnrollmentRate",
                    "",
                  );
                }
                handleSelectChange(
                  "planDetails",
                  "employeeDeferrals",
                  "enrollmentRate",
                  value,
                );
              }}
            >
              <SelectTrigger id="enrollment-rate">
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
            {formData.planDetails.employeeDeferrals.enrollmentRate ===
              "custom" && (
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="Enter custom enrollment rate"
                  maxLength={50}
                  value={
                    formData.planDetails.employeeDeferrals
                      .customEnrollmentRate || ""
                  }
                  onChange={(e) =>
                    handleNestedInputChange(
                      "planDetails",
                      "employeeDeferrals",
                      "customEnrollmentRate",
                      e.target.value,
                    )
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.planDetails.employeeDeferrals.customEnrollmentRate
                    ?.length || 0}
                  /50 characters
                </p>
              </div>
            )}
            {touched.planDetails.enrollmentRate && (
              <ErrorMessage error={errors.planDetails.enrollmentRate} />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-escalation">Auto Escalation</Label>
            <Select
              value={
                formData.planDetails.employeeDeferrals.autoEscalation || "1"
              }
              onValueChange={(value) => {
                if (value !== "custom") {
                  handleSelectChange(
                    "planDetails",
                    "employeeDeferrals",
                    "customAutoEscalation",
                    "",
                  );
                }
                handleSelectChange(
                  "planDetails",
                  "employeeDeferrals",
                  "autoEscalation",
                  value,
                );
              }}
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
            {formData.planDetails.employeeDeferrals.autoEscalation ===
              "custom" && (
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="Enter custom auto escalation"
                  maxLength={50}
                  value={
                    formData.planDetails.employeeDeferrals
                      .customAutoEscalation || ""
                  }
                  onChange={(e) =>
                    handleNestedInputChange(
                      "planDetails",
                      "employeeDeferrals",
                      "customAutoEscalation",
                      e.target.value,
                    )
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.planDetails.employeeDeferrals.customAutoEscalation
                    ?.length || 0}
                  /50 characters
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deferral-cap">Escalation Cap</Label>
            <Select
              value={formData.planDetails.employeeDeferrals.deferralCap || "10"}
              onValueChange={(value) =>
                handleSelectChange(
                  "planDetails",
                  "employeeDeferrals",
                  "deferralCap",
                  value,
                )
              }
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
            {formData.planDetails.employeeDeferrals.deferralCap ===
              "custom" && (
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="Enter custom escalation cap"
                  maxLength={50}
                  value={
                    formData.planDetails.employeeDeferrals.customDeferralCap ||
                    ""
                  }
                  onChange={(e) =>
                    handleNestedInputChange(
                      "planDetails",
                      "employeeDeferrals",
                      "customDeferralCap",
                      e.target.value,
                    )
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.planDetails.employeeDeferrals.customDeferralCap
                    ?.length || 0}
                  /50 characters
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {formData.planDetails.employeeDeferrals.autoEnrollment === false && (
        <div className="space-y-2">
          <Label>Enrollment Method (check all that apply)</Label>
          <div className="space-y-2">
            {listEnrollmentMethod?.map((item) => (
              <div key={item.value} className="flex items-center space-x-2">
                <Checkbox
                  id={item.value}
                  checked={formData.planDetails.employeeDeferrals.enrollmentMethods.includes(
                    item.value as any,
                  )}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(
                      "planDetails",
                      "employeeDeferrals.enrollmentMethods",
                      item.value,
                      checked as boolean,
                    )
                  }
                />
                <Label htmlFor={item.value}>{item.label}</Label>
              </div>
            ))}
            {formData.planDetails.employeeDeferrals.enrollmentMethods.includes(
              "custom",
            ) && (
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="Enter custom vesting schedule"
                  maxLength={50}
                  value={
                    formData.planDetails.employeeDeferrals
                      .customEnrollmentMethod || ""
                  }
                  onChange={(e) =>
                    handleNestedInputChange(
                      "planDetails",
                      "employeeDeferrals",
                      "customEnrollmentMethod",
                      e.target.value,
                    )
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.planDetails.employeeDeferrals.customEnrollmentMethod
                    ?.length || 0}
                  /50 characters
                </p>
              </div>
            )}
            {touched.planDetails.enrollmentMethods && (
              <ErrorMessage error={errors.planDetails.enrollmentMethods} />
            )}
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <Label>Roth Option</Label>
        <RadioGroup
          value={
            formData.planDetails.rothOption === null
              ? ""
              : formData.planDetails.rothOption
              ? "yes"
              : "no"
          }
          onValueChange={(value) =>
            handleRadioInputChange("planDetails", "rothOption", value === "yes")
          }
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
        {touched.planDetails.rothOption && (
          <ErrorMessage error={errors.planDetails.rothOption} />
        )}
      </div>

      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          className="border-2 border-gray-300 hover:border-gray-400 transition-colors"
          onClick={prevSection}
        >
          Back
        </Button>
        <Button
          onClick={() => {
            scrollToTop();
            markSectionAsTouched("planDetails");
            if (validatePlanDetails()) {
              setSectionReview((prev) => ({
                ...prev,
                employeeDeferrals: true,
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

export default EmployeeDeferrer;
