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
import { ContributionProps } from "@/types/plan-builder";
import { ErrorMessage } from "./error-message";

const HarborDetails = (props: ContributionProps) => {
  const {
    formData,
    errors,
    handleContributionInputChange,
  } = props;
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="space-y-4">
        <div>
          <Label>Safe Harbor Type</Label>
          <Select
            value={formData.employerContributions.safeHarbor.type}
            onValueChange={(value) =>
              handleContributionInputChange("safeHarbor", "type", value)
            }
          >
            <SelectTrigger id="safe-harbor-type">
              <SelectValue placeholder="Select a Safe Harbor type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Basic Match">Basic Match</SelectItem>
              <SelectItem value="Enhanced Match">Enhanced Match</SelectItem>
              <SelectItem value="Non-Elective Contribution">
                Non-Elective Contribution
              </SelectItem>
              <SelectItem value="QACA">QACA</SelectItem>
              <SelectItem value="custom">Custom type...</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.safeHarbor.type === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom safe harbor type"
                maxLength={50}
                value={
                  formData.employerContributions.safeHarbor.customType || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "safeHarbor",
                    "customType",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.safeHarbor.customType?.length ||
                  0}
                /50 characters
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="safe-harbor-formula">Formula</Label>
          <Select
            value={formData.employerContributions.safeHarbor.formula || ""}
            onValueChange={(value) =>
              handleContributionInputChange("safeHarbor", "formula", value)
            }
          >
            <SelectTrigger id="safe-harbor-formula">
              <SelectValue placeholder="Select a formula..." />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="select">Select a formula...</SelectItem> */}
              <SelectItem value="100% of first 3% + 50% of next 2%">
                100% of first 3% + 50% of next 2%
              </SelectItem>
              <SelectItem value="100% of first 4%">100% of first 4%</SelectItem>
              <SelectItem value="3% of compensation for all eligible employees">
                3% of compensation for all eligible employees
              </SelectItem>
              <SelectItem value="custom">Custom formula...</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.safeHarbor.formula === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom safe harbor formula"
                maxLength={50}
                value={
                  formData.employerContributions.safeHarbor.customFormula || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "safeHarbor",
                    "customFormula",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.safeHarbor.customFormula
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
          <ErrorMessage
            error={errors.employerContributions.safeHarborFormula}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="safe-harbor-limit">Contribution Limit</Label>
          <Select
            value={formData.employerContributions.safeHarbor.limit || ""}
            onValueChange={(value) =>
              handleContributionInputChange("safeHarbor", "limit", value)
            }
          >
            <SelectTrigger id="safe-harbor-limit">
              <SelectValue placeholder="Select a limit..." />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="select">Select a limit...</SelectItem> */}
              <SelectItem value="up to 4% of compensation">
                up to 4% of compensation
              </SelectItem>
              <SelectItem value="up to 5% of compensation">
                up to 5% of compensation
              </SelectItem>
              <SelectItem value="up to 6% of compensation">
                up to 6% of compensation
              </SelectItem>
              <SelectItem value="3% of compensation for all eligible employees">
                3% of compensation for all eligible employees
              </SelectItem>
              <SelectItem value="custom">Custom limit...</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.safeHarbor.limit === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom safe harbor limit"
                maxLength={50}
                value={
                  formData.employerContributions.safeHarbor.customLimit || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "safeHarbor",
                    "customLimit",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.safeHarbor.customLimit
                  ?.length || 0}
                /50 characters
              </p>
            </div>
          )}
          <ErrorMessage error={errors.employerContributions.safeHarborLimit} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="safe-harbor-vesting">Vesting Schedule</Label>
          <Select
            value={formData.employerContributions.safeHarbor.vesting}
            onValueChange={(value) =>
              handleContributionInputChange("safeHarbor", "vesting", value)
            }
          >
            <SelectTrigger id="safe-harbor-vesting">
              <SelectValue placeholder="Select a vesting schedule" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Immediate">Immediate</SelectItem>
              <SelectItem value="1-year cliff">1-year cliff</SelectItem>
              <SelectItem value="2-year cliff">2-year cliff</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {formData.employerContributions.safeHarbor.vesting === "custom" && (
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Enter custom safe harbor vesting"
                maxLength={50}
                value={
                  formData.employerContributions.safeHarbor.customVesting || ""
                }
                onChange={(e) =>
                  handleContributionInputChange(
                    "safeHarbor",
                    "customVesting",
                    e.target.value,
                  )
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.employerContributions.safeHarbor.customVesting
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

export default HarborDetails;
