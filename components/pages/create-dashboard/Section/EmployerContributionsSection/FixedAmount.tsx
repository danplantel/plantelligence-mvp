import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContributionProps, ErrorMessage } from "../../shared";

const FixedAmount = (props: ContributionProps) => {
  const {
    formData,
    errors,
    handleContributionInputChange,
  } = props;
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="space-y-4">
        <div>
          <Label>Fixed Amount</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fixed-amount">Contribution Amount</Label>
          <Select
            value={formData.employerContributions.fixedAmount.amount || ""}
            onValueChange={(value) =>
              handleContributionInputChange("fixedAmount", "amount", value)
            }
          >
            <SelectTrigger id="fixed-amount">
              <SelectValue placeholder="Select an amount..." />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="select">Select an amount...</SelectItem> */}
              <SelectItem value="3% of compensation">
                3% of compensation
              </SelectItem>
              <SelectItem value="4% of compensation">
                4% of compensation
              </SelectItem>
              <SelectItem value="5% of compensation">
                5% of compensation
              </SelectItem>
              <SelectItem value="$1,000 per year">$1,000 per year</SelectItem>
              <SelectItem value="$2,000 per year">$2,000 per year</SelectItem>
              <SelectItem value="$3,000 per year">$3,000 per year</SelectItem>
              <SelectItem value="custom">Custom amount...</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.fixedAmount.amount === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom fixed amount amount"
                maxLength={50}
                value={
                  formData.employerContributions.fixedAmount.customAmount || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "fixedAmount",
                    "customAmount",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.fixedAmount.customAmount
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
          <ErrorMessage
            error={errors.employerContributions.fixedAmountAmount}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fixed-details">Additional Details</Label>
          <Select
            value={formData.employerContributions.fixedAmount.details || ""}
            onValueChange={(value) =>
              handleContributionInputChange("fixedAmount", "details", value)
            }
          >
            <SelectTrigger id="fixed-details">
              <SelectValue placeholder="Select details..." />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="select">Select details...</SelectItem> */}
              <SelectItem value="Contributed annually">
                Contributed annually
              </SelectItem>
              <SelectItem value="Contributed quarterly">
                Contributed quarterly
              </SelectItem>
              <SelectItem value="Contributed with each payroll">
                Contributed with each payroll
              </SelectItem>
              <SelectItem value="custom">Custom details...</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.fixedAmount.details === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom fixed amount details"
                maxLength={50}
                value={
                  formData.employerContributions.fixedAmount.customDetails || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "fixedAmount",
                    "customDetails",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.fixedAmount.customDetails
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
          <ErrorMessage
            error={errors.employerContributions.fixedAmountDetails}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fixed-vesting">Vesting Schedule</Label>
          <Select
            value={formData.employerContributions.fixedAmount.vesting}
            onValueChange={(value) =>
              handleContributionInputChange("fixedAmount", "vesting", value)
            }
          >
            <SelectTrigger id="fixed-vesting">
              <SelectValue placeholder="Select a vesting schedule" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Immediate">Immediate</SelectItem>
              <SelectItem value="1-year cliff">1-year cliff</SelectItem>
              <SelectItem value="2-year cliff">2-year cliff</SelectItem>
              <SelectItem value="3-year cliff">3-year cliff</SelectItem>
              <SelectItem value="4-year graded (25% per year)">
                4-year graded (25% per year)
              </SelectItem>
              <SelectItem value="5-year graded (20% per year)">
                5-year graded (20% per year)
              </SelectItem>
              <SelectItem value="6-year graded (≈16.7% per year)">
                6-year graded (≈16.7% per year)
              </SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.fixedAmount.vesting === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom fixed amount vesting"
                maxLength={50}
                value={
                  formData.employerContributions.fixedAmount.customVesting || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "fixedAmount",
                    "customVesting",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.fixedAmount.customVesting
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FixedAmount;
