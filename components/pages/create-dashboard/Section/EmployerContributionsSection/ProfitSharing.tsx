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

const ProfitSharing = (props: ContributionProps) => {
  const {
    formData,
    errors,
    handleContributionInputChange,
  } = props;

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="space-y-4">
        <div>
          <Label>Profit Sharing Details</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profit-details">Contribution Details</Label>
          <Select
            value={formData.employerContributions.profitSharing.details || ""}
            onValueChange={(value) =>
              handleContributionInputChange("profitSharing", "details", value)
            }
          >
            <SelectTrigger id="profit-details">
              <SelectValue placeholder="Select details..." />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="select">Select details...</SelectItem> */}
              <SelectItem value="Pro-rata allocation">
                Pro-rata allocation
              </SelectItem>
              <SelectItem value="New comparability">
                New comparability
              </SelectItem>
              <SelectItem value="Age-weighted">Age-weighted</SelectItem>
              <SelectItem value="Integrated with Social Security">
                Integrated with Social Security
              </SelectItem>
              <SelectItem value="custom">Custom details...</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.profitSharing.details ===
            "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom profit sharing details"
                maxLength={50}
                value={
                  formData.employerContributions.profitSharing.customDetails ||
                  ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "profitSharing",
                    "customDetails",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.profitSharing.customDetails
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
          <ErrorMessage
            error={errors.employerContributions.profitSharingDetails}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profit-conditions">Contribution Conditions</Label>
          <Select
            value={
              formData.employerContributions.profitSharing.conditions || ""
            }
            onValueChange={(value) =>
              handleContributionInputChange(
                "profitSharing",
                "conditions",
                value,
              )
            }
          >
            <SelectTrigger id="profit-conditions">
              <SelectValue placeholder="Select conditions..." />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="select">Select conditions...</SelectItem> */}
              <SelectItem value="Based on company profitability">
                Based on company profitability
              </SelectItem>
              <SelectItem value="Discretionary amount determined annually">
                Discretionary amount determined annually
              </SelectItem>
              <SelectItem value="Fixed percentage of eligible compensation">
                Fixed percentage of eligible compensation
              </SelectItem>
              <SelectItem value="custom">Custom conditions...</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.profitSharing.conditions ===
            "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom profit sharing conditions"
                maxLength={50}
                value={
                  formData.employerContributions.profitSharing
                    .customConditions || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "profitSharing",
                    "customConditions",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.profitSharing.customConditions
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
          <ErrorMessage
            error={errors.employerContributions.profitSharingConditions}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profit-vesting">Vesting Schedule</Label>
          <Select
            value={formData.employerContributions.profitSharing.vesting}
            onValueChange={(value) =>
              handleContributionInputChange("profitSharing", "vesting", value)
            }
          >
            <SelectTrigger id="profit-vesting">
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
          {formData.employerContributions.profitSharing.vesting ===
            "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom profit sharing vesting"
                maxLength={50}
                value={
                  formData.employerContributions.profitSharing.customVesting ||
                  ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "profitSharing",
                    "customVesting",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.profitSharing.customVesting
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

export default ProfitSharing;
