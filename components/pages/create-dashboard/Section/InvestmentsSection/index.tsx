import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "../../shared";

interface InvestmentsSectionProps {
  formData: IPlanFormData;
  errors: Errors;
  touched: TouchedFields;
  scrollToTop: () => void;
  markSectionAsTouched: (section: string) => void;
  handleInputChange: (section: string, field: string, value: any) => void;
  validateInvestments: () => boolean;
  setSectionReview: React.Dispatch<React.SetStateAction<SectionPreview>>;
  prevSection: () => void;
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
  handleBlur: any;
}

export const listQDIAOptions = [
  {
    label: "Target Date Funds",
    value: "Target Date Funds",
  },
  {
    label: "Target Date Funds as QDIA + Professionally Managed Portfolios",
    value: "Target Date Funds as QDIA + Professionally Managed Portfolios",
  },
  {
    label: "Professionally Managed Portfolios",
    value: "Professionally Managed Portfolios",
  },
  {
    label: "Balanced Funds",
    value: "Balanced Funds",
  },
  {
    label: "Custom Structure",
    value: "Custom Structure",
  },
];

export const listAdditionalFeatures = [
  {
    label: "Self-Directed Brokerage Account",
    value: "selfDirectedBrokerage",
  },
  {
    label: "Plan Loans",
    value: "planLoans",
  },
  {
    label: "Hardship Withdrawals",
    value: "hardshipWithdrawals",
  },
  {
    label: "After-Tax Contributions (non-Roth)",
    value: "afterTaxContributions",
  },
  {
    label: "In-Service Distributions (after age 59 ½ or other)",
    value: "inServiceDistributions",
  },
  {
    label: "Custom",
    value: "custom",
  },
];

const InvestmentsSection = (props: InvestmentsSectionProps) => {
  const {
    formData,
    errors,
    touched,
    handleBlur,
    handleInputChange,
    handleCheckboxChange,
    setSectionReview,
    openDialog,
    prevSection,
    markSectionAsTouched,
    validateInvestments,
    scrollToTop,
  } = props;
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>QDIA (Choose One)</Label>
          <Select
            value={formData.investments.investmentOptions.join(", ")}
            onValueChange={(value) =>
              handleInputChange(
                "investments",
                "investmentOptions",
                value.split(", "),
              )
            }
            onOpenChange={() => handleBlur("investments", "investmentOptions")}
          >
            <SelectTrigger
              className={
                touched.investments.investmentOptions &&
                errors.investments.investmentOptions
                  ? "border-red-500"
                  : ""
              }
            >
              <SelectValue placeholder="Select QDIA option" />
            </SelectTrigger>
            <SelectContent>
              {listQDIAOptions.map((item) => (
                <SelectItem value={item.value} key={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {touched.investments.investmentOptions && (
            <ErrorMessage error={errors.investments.investmentOptions} />
          )}
        </div>

        <div className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Additional Features</Label>
            <p className="text-sm text-gray-500">
              Are there any additional plan features that you would like to
              mention in the plan video (check all that apply)
            </p>
            <div className="space-y-2 mt-2">
              {listAdditionalFeatures.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`feature-${item.value}`}
                    checked={formData.resources.planFeatures.includes(
                      item.value as any,
                    )}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(
                        "resources",
                        "planFeatures",
                        item.value,
                        checked as boolean,
                      )
                    }
                  />
                  <Label htmlFor={`feature-${item.value}`}>{item.label}</Label>
                </div>
              ))}
              {formData.resources.planFeatures.includes("custom") && (
                <div className="mt-2">
                  <Input
                    type="text"
                    placeholder="Enter custom vesting schedule"
                    maxLength={50}
                    value={formData.resources.customFeature || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "resources",
                        "customFeature",
                        e.target.value,
                      )
                    }
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {formData.resources.customFeature?.length || 0}/50
                    characters
                  </p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="feature-none"
                  checked={formData.resources.planFeatures.includes("none")}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(
                      "resources",
                      "planFeatures",
                      "none",
                      checked as boolean,
                    )
                  }
                />
                <Label htmlFor="feature-none">None</Label>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              NOTE: These are optional and would display on a summary screen
              towards the end of video, we will always refer participants to
              Summary Plan Description regardless.
            </p>
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
            markSectionAsTouched("investments");
            if (validateInvestments()) {
              setSectionReview((prev) => ({ ...prev, investments: true }));
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

export default InvestmentsSection;
