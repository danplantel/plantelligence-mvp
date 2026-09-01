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

const CompanyMatch = (props: ContributionProps) => {
  const {
    formData,
    errors,
    handleContributionInputChange,
  } = props;
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="space-y-4">
        <div>
          <Label>Match Formula</Label>
          <Select
            value={formData.employerContributions.companyMatch.formula}
            onValueChange={(value) =>
              handleContributionInputChange("companyMatch", "formula", value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a match formula.." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100% of employee contributions">
                100% of employee contributions
              </SelectItem>
              <SelectItem value="50% of employee contributions">
                50% of employee contributions
              </SelectItem>
              <SelectItem value="25% of employee contributions">
                25% of employee contributions
              </SelectItem>
              <SelectItem value="100% on first 3%, 50% on next 2%">
                100% on first 3%, 50% on next 2%
              </SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.companyMatch.formula === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom match formula"
                maxLength={50}
                value={
                  formData.employerContributions.companyMatch.customFormula ||
                  ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "companyMatch",
                    "customFormula",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.companyMatch.customFormula
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
          <ErrorMessage
            error={errors.employerContributions.companyMatchFormula}
          />
        </div>
        <div>
          <Label>Match Limit</Label>
          <Select
            value={formData.employerContributions.companyMatch.limit}
            onValueChange={(value) =>
              handleContributionInputChange("companyMatch", "limit", value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a match limit.." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Up to 3% of compensation">
                Up to 3% of compensation
              </SelectItem>
              <SelectItem value="Up to 4% of compensation">
                Up to 4% of compensation
              </SelectItem>
              <SelectItem value="Up to 5% of compensation">
                Up to 5% of compensation
              </SelectItem>
              <SelectItem value="Up to 6% of compensation">
                Up to 6% of compensation
              </SelectItem>
              <SelectItem value="Up to 7% of compensation">
                Up to 7% of compensation
              </SelectItem>
              <SelectItem value="Up to $3,000 per year">
                Up to $3,000 per year
              </SelectItem>
              <SelectItem value="Up to $5,000 per year">
                Up to $5,000 per year
              </SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.companyMatch.limit === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom match limit"
                maxLength={50}
                value={
                  formData.employerContributions.companyMatch.customLimit || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "companyMatch",
                    "customLimit",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.companyMatch.customLimit
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
          <ErrorMessage
            error={errors.employerContributions.companyMatchLimit}
          />
        </div>
        <div>
          <Label>Vesting Schedule</Label>
          <Select
            value={formData.employerContributions.companyMatch.vesting}
            onValueChange={(value) =>
              handleContributionInputChange("companyMatch", "vesting", value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a vesting schedule.." />
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
              <SelectItem value="6-year graded (~16.7% per year)">
                6-year graded (~16.7% per year)
              </SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.companyMatch.vesting === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom vesting schedule"
                maxLength={50}
                value={
                  formData.employerContributions.companyMatch.customVesting ||
                  ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "companyMatch",
                    "customVesting",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.companyMatch.customVesting
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

export default CompanyMatch;
