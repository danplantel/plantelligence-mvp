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
import {
  ErrorMessage,
  Errors,
  IPlanFormData,
  SectionPreview,
  TouchedFields,
} from "../..";

interface EligibilityProps {
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
const Eligibility = (props: EligibilityProps) => {
  const {
    formData,
    touched,
    errors,
    openDialog,
    handleInputChange,
    handleCheckboxChange,
    handleSelectChange,
    handleNestedInputChange,
    handleRadioInputChange,
    scrollToTop,
    markSectionAsTouched,
    handleBlur,
    validatePlanDetails,
    setSectionReview,
    prevSection,
  } = props;

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Plan Type</h3>
          <Select
            value={formData.planDetails.planType}
            onValueChange={(value) =>
              handleInputChange("planDetails", "planType", value)
            }
            onOpenChange={() => handleBlur("planDetails", "planType")}
          >
            <SelectTrigger
              className={
                touched.planDetails.planType && errors.planDetails.planType
                  ? "border-red-500 focus:ring-0 focus:ring-offset-0"
                  : "focus:ring-0 focus:ring-offset-0"
              }
            >
              <SelectValue placeholder="Select a plan type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="401k">401(k)</SelectItem>
              <SelectItem value="403b">403(b)</SelectItem>
              <SelectItem value="401a">401(a)</SelectItem>
              <SelectItem value="simpleIRA">Simple IRA</SelectItem>
              <SelectItem value="457">457</SelectItem>
            </SelectContent>
          </Select>
          {touched.planDetails.planType && (
            <ErrorMessage error={errors.planDetails.planType} />
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-medium">Eligibility</h3>
          <div className="space-y-2">
            <Label htmlFor="age-requirement">Age Requirement</Label>
            <Select
              value={formData.planDetails.eligibility.ageRequirement}
              onValueChange={(value) => {
                if (value !== "custom") {
                  handleNestedInputChange(
                    "planDetails",
                    "eligibility",
                    "customAgeRequirement",
                    "",
                  );
                }
                handleSelectChange(
                  "planDetails",
                  "eligibility",
                  "ageRequirement",
                  value,
                );
              }}
              onOpenChange={() => handleBlur("planDetails", "ageRequirement")}
            >
              <SelectTrigger
                id="age-requirement"
                className={
                  touched.planDetails.ageRequirement &&
                  errors.planDetails.ageRequirement
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
            {formData.planDetails.eligibility.ageRequirement === "custom" && (
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="Enter custom age requirement"
                  maxLength={50}
                  value={
                    formData.planDetails.eligibility.customAgeRequirement || ""
                  }
                  onChange={(e) => {
                    handleNestedInputChange(
                      "planDetails",
                      "eligibility",
                      "customAgeRequirement",
                      e.target.value,
                    );
                  }}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.planDetails.eligibility.customAgeRequirement
                    ?.length || 0}
                  /50 characters
                </p>
              </div>
            )}
            {touched.planDetails.ageRequirement && (
              <ErrorMessage error={errors.planDetails.ageRequirement} />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-requirement">Service Requirement</Label>
            <Select
              value={formData.planDetails.eligibility.serviceRequirement}
              onValueChange={(value) => {
                if (value !== "custom") {
                  handleSelectChange(
                    "planDetails",
                    "eligibility",
                    "customServiceRequirement",
                    "",
                  );
                }
                handleSelectChange(
                  "planDetails",
                  "eligibility",
                  "serviceRequirement",
                  value,
                );
              }}
              onOpenChange={() =>
                handleBlur("planDetails", "serviceRequirement")
              }
            >
              <SelectTrigger
                id="service-requirement"
                className={
                  touched.planDetails.serviceRequirement &&
                  errors.planDetails.serviceRequirement
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
            {formData.planDetails.eligibility.serviceRequirement ===
              "custom" && (
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="Enter custom service requirement"
                  maxLength={50}
                  value={
                    formData.planDetails.eligibility.customServiceRequirement ||
                    ""
                  }
                  onChange={(e) =>
                    handleNestedInputChange(
                      "planDetails",
                      "eligibility",
                      "customServiceRequirement",
                      e.target.value,
                    )
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.planDetails.eligibility.customServiceRequirement
                    ?.length || 0}
                  /50 characters
                </p>
              </div>
            )}
            {touched.planDetails.serviceRequirement && (
              <ErrorMessage error={errors.planDetails.serviceRequirement} />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-date">Entry Date</Label>
            <Select
              value={formData.planDetails.eligibility.entryDate}
              onValueChange={(value) => {
                if (value !== "custom") {
                  handleSelectChange(
                    "planDetails",
                    "eligibility",
                    "customEntryDate",
                    "",
                  );
                }
                handleSelectChange(
                  "planDetails",
                  "eligibility",
                  "entryDate",
                  value,
                );
              }}
              onOpenChange={() => handleBlur("planDetails", "entryDate")}
            >
              <SelectTrigger
                id="entry-date"
                className="focus:ring-0 focus:ring-offset-0"
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
            {formData.planDetails.eligibility.entryDate === "custom" && (
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="Enter custom entry date"
                  maxLength={50}
                  value={formData.planDetails.eligibility.customEntryDate || ""}
                  onChange={(e) =>
                    handleNestedInputChange(
                      "planDetails",
                      "eligibility",
                      "customEntryDate",
                      e.target.value,
                    )
                  }
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.planDetails.eligibility.customEntryDate?.length ||
                    0}
                  /50 characters
                </p>
              </div>
            )}
            {touched.planDetails.entryDate && (
              <ErrorMessage error={errors.planDetails.entryDate} />
            )}
          </div>
        </div>
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
              setSectionReview((prev) => ({ ...prev, eligibility: true }));
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

export default Eligibility;
