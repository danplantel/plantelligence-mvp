import type React from "react";

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
import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  ErrorMessage,
  Errors,
  IPlanFormData,
  SectionPreview,
  TouchedFields,
} from "../..";

interface ResourcesSectionProps {
  formData: IPlanFormData;
  errors: Errors;
  touched: TouchedFields;
  validateResources: () => boolean;
  scrollToTop: () => void;
  handleNestedInputChange: (
    section: string,
    nestedSection: string,
    field: string,
    value: any,
  ) => void;
  markSectionAsTouched: (section: string) => void;
  handleInputChange: (section: string, field: string, value: any) => void;
  handleSelectChange: (
    section: keyof IPlanFormData,
    nestedSection: string | null,
    field: string,
    value: string | "Email" | "Phone" | "Custom" | "None",
  ) => void;
  setSectionReview: React.Dispatch<React.SetStateAction<SectionPreview>>;
  prevSection: () => void;
  handleBlur: (section: string, field: string) => void;
}

const ResourcesSection = (props: ResourcesSectionProps) => {
  const {
    formData,
    errors,
    touched,
    scrollToTop,
    markSectionAsTouched,
    handleSelectChange,
    handleInputChange,
    validateResources,
    handleNestedInputChange,
    setSectionReview,
    prevSection,
    handleBlur,
  } = props;
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>We offer financial planning</Label>
          <div className="flex space-x-4">
            <Button
              type="button"
              variant={
                formData.resources.financialPlanning ? "default" : "outline"
              }
              onClick={() =>
                handleInputChange("resources", "financialPlanning", true)
              }
              className="flex-1"
            >
              Yes
            </Button>
            <Button
              type="button"
              variant={
                !formData.resources.financialPlanning ? "default" : "outline"
              }
              onClick={() =>
                handleInputChange("resources", "financialPlanning", false)
              }
              className="flex-1"
            >
              No
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Primary Contact Type</Label>
            <Select
              value={formData.resources.contactInformation.primaryType}
              onValueChange={(value: "Email" | "Phone" | "Custom" | "None") =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "primaryType",
                  value,
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select primary contact type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Phone">Phone</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
                <SelectItem value="None">None</SelectItem>
              </SelectContent>
            </Select>
            {formData.resources.contactInformation.primaryType === "Custom" && (
              <Input
                className="mt-2"
                placeholder="Enter custom contact type"
                value={formData.resources.contactInformation.primaryTypeCustom}
                onChange={(e) =>
                  handleSelectChange(
                    "resources",
                    "contactInformation",
                    "primaryTypeCustom",
                    e.target.value,
                  )
                }
              />
            )}
          </div>

          <div>
            <Label>Primary Contact Name</Label>
            <Input
              value={formData.resources.contactInformation.primaryName}
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "primaryName",
                  e.target.value,
                )
              }
            />
            {touched.resources.primaryName && (
              <ErrorMessage error={errors.resources?.primaryName} />
            )}
          </div>

          <div>
            <Label>Primary Contact Email</Label>
            <Input
              value={formData.resources.contactInformation.primaryEmail}
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "primaryEmail",
                  e.target.value,
                )
              }
            />
            {touched.resources.primaryEmail && (
              <ErrorMessage error={errors.resources?.primaryEmail} />
            )}
          </div>

          <div>
            <Label>Primary Contact Phone</Label>
            <Input
              value={formData.resources.contactInformation.primaryPhone}
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "primaryPhone",
                  e.target.value,
                )
              }
            />
            {touched.resources.primaryPhone && (
              <ErrorMessage error={errors.resources?.primaryPhone} />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Secondary Contact Type</Label>
          <Select
            value={formData.resources.contactInformation.secondaryType}
            onValueChange={(value: "Email" | "Phone" | "Custom" | "None") =>
              handleSelectChange(
                "resources",
                "contactInformation",
                "secondaryType",
                value,
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select secondary contact type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
              <SelectItem value="None">None</SelectItem>
            </SelectContent>
          </Select>
          {touched.resources?.secondaryType && (
            <ErrorMessage error={errors.resources.secondaryType} />
          )}
        </div>

        {formData.resources.contactInformation?.secondaryType === "Custom" && (
          <div className="space-y-2">
            <Label>Custom Secondary Type</Label>
            <Input
              value={formData.resources.contactInformation?.secondaryTypeCustom}
              onChange={(e) =>
                handleNestedInputChange(
                  "resources",
                  "contactInformation",
                  "secondaryTypeCustom",
                  e.target.value,
                )
              }
              onBlur={() =>
                handleBlur(
                  "resources",
                  "contactInformation.secondaryTypeCustom",
                )
              }
              placeholder="Enter custom secondary type"
              className={
                (touched.resources.contactInformation as any)
                  ?.secondaryTypeCustom &&
                (errors.resources.contactInformation as any)
                  ?.secondaryTypeCustom
                  ? "border-red-500"
                  : ""
              }
            />
            {touched.resources?.secondaryTypeCustom && (
              <ErrorMessage error={errors.resources.secondaryTypeCustom} />
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Secondary Name</Label>
          <Input
            value={formData.resources.contactInformation?.secondaryName}
            onChange={(e) =>
              handleSelectChange(
                "resources",
                "contactInformation",
                "secondaryName",
                e.target.value,
              )
            }
            onBlur={() =>
              handleBlur("resources", "contactInformation.secondaryName")
            }
            placeholder="Enter secondary contact name"
            className={
              (touched.resources.contactInformation as any)?.secondaryName &&
              (errors.resources.contactInformation as any).secondaryName
                ? "border-red-500"
                : ""
            }
          />
          {touched.resources.secondaryName && (
            <ErrorMessage error={errors.resources.secondaryName} />
          )}
        </div>

        {formData.resources.contactInformation?.secondaryType === "Email" && (
          <div className="space-y-2">
            <Label>Secondary Email</Label>
            <Input
              value={formData.resources.contactInformation?.secondaryEmail}
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "secondaryEmail",
                  e.target.value,
                )
              }
              onBlur={() =>
                handleBlur("resources", "contactInformation.secondaryEmail")
              }
              placeholder="Enter secondary contact email"
              className={
                (touched.resources.contactInformation as any)?.secondaryEmail &&
                (errors.resources.contactInformation as any).secondaryEmail
                  ? "border-red-500"
                  : ""
              }
            />
            {touched.resources.secondaryEmail && (
              <ErrorMessage error={errors.resources.secondaryEmail} />
            )}
          </div>
        )}

        {formData.resources.contactInformation?.secondaryType === "Phone" && (
          <div className="space-y-2">
            <Label>Secondary Phone</Label>
            <Input
              value={formData.resources.contactInformation?.secondaryPhone}
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "secondaryPhone",
                  e.target.value,
                )
              }
              onBlur={() =>
                handleBlur("resources", "contactInformation.secondaryPhone")
              }
              placeholder="Enter secondary contact phone"
              className={
                (touched.resources.contactInformation as any)?.secondaryPhone &&
                (errors.resources.contactInformation as any).secondaryPhone
                  ? "border-red-500"
                  : ""
              }
            />
            {touched.resources.secondaryPhone && (
              <ErrorMessage error={errors.resources.secondaryPhone} />
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Tertiary Contact Type</Label>
          <Select
            value={formData.resources.contactInformation?.tertiaryType}
            onValueChange={(value: "Email" | "Phone" | "Custom" | "None") =>
              handleSelectChange(
                "resources",
                "contactInformation",
                "tertiaryType",
                value,
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tertiary contact type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
              <SelectItem value="None">None</SelectItem>
            </SelectContent>
          </Select>
          {touched.resources.tertiaryType && (
            <ErrorMessage error={errors.resources.tertiaryType} />
          )}
        </div>

        {formData.resources.contactInformation?.tertiaryType === "Custom" && (
          <div className="space-y-2">
            <Label>Custom Tertiary Type</Label>
            <Input
              value={
                (formData.resources.contactInformation as any)
                  .tertiaryTypeCustom
              }
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "tertiaryTypeCustom",
                  e.target.value,
                )
              }
              onBlur={() =>
                handleBlur("resources", "contactInformation.tertiaryTypeCustom")
              }
              placeholder="Enter custom tertiary type"
              className={
                (touched.resources.contactInformation as any)
                  ?.tertiaryTypeCustom &&
                (errors.resources.contactInformation as any).tertiaryTypeCustom
                  ? "border-red-500"
                  : ""
              }
            />
            {touched.resources.tertiaryTypeCustom && (
              <ErrorMessage error={errors.resources.tertiaryTypeCustom} />
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Tertiary Name</Label>
          <Input
            value={formData.resources.contactInformation?.tertiaryName}
            onChange={(e) =>
              handleSelectChange(
                "resources",
                "contactInformation",
                "tertiaryName",
                e.target.value,
              )
            }
            onBlur={() =>
              handleBlur("resources", "contactInformation.tertiaryName")
            }
            placeholder="Enter tertiary contact name"
            className={
              (touched.resources.contactInformation as any)?.tertiaryName &&
              (errors.resources.contactInformation as any).tertiaryName
                ? "border-red-500"
                : ""
            }
          />
          {touched.resources.tertiaryName && (
            <ErrorMessage error={errors.resources.tertiaryName} />
          )}
        </div>

        {formData.resources.contactInformation?.tertiaryType === "Email" && (
          <div className="space-y-2">
            <Label>Tertiary Email</Label>
            <Input
              value={formData.resources.contactInformation?.tertiaryEmail}
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "tertiaryEmail",
                  e.target.value,
                )
              }
              onBlur={() =>
                handleBlur("resources", "contactInformation.tertiaryEmail")
              }
              placeholder="Enter tertiary contact email"
              className={
                (touched.resources.contactInformation as any)?.tertiaryEmail &&
                (errors.resources.contactInformation as any).tertiaryEmail
                  ? "border-red-500"
                  : ""
              }
            />
            {touched.resources.tertiaryEmail && (
              <ErrorMessage error={errors.resources.tertiaryEmail} />
            )}
          </div>
        )}

        {formData.resources.contactInformation?.tertiaryType === "Phone" && (
          <div className="space-y-2">
            <Label>Tertiary Phone</Label>
            <Input
              value={formData.resources.contactInformation?.tertiaryPhone}
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "tertiaryPhone",
                  e.target.value,
                )
              }
              onBlur={() =>
                handleBlur("resources", "contactInformation.tertiaryPhone")
              }
              placeholder="Enter tertiary contact phone"
              className={
                (touched.resources.contactInformation as any)?.tertiaryPhone &&
                (errors.resources.contactInformation as any).tertiaryPhone
                  ? "border-red-500"
                  : ""
              }
            />
            {touched.resources.tertiaryPhone && (
              <ErrorMessage error={errors.resources.tertiaryPhone} />
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Custom Feature</Label>
          <Input
            value={formData.resources.customFeature}
            onChange={(e) =>
              handleInputChange("resources", "customFeature", e.target.value)
            }
            onBlur={() => handleBlur("resources", "customFeature")}
            placeholder="Enter custom feature"
            className={
              touched.resources.customFeature && errors.resources.customFeature
                ? "border-red-500"
                : ""
            }
          />
          {touched.resources.customFeature && (
            <ErrorMessage error={errors.resources.customFeature} />
          )}
        </div>

        <div className="space-y-2">
          {/* <Label>Plan ID (Optional)</Label> */}
          <Label>Plan ID</Label>
          <Input
            value={formData.resources.contactInformation.planId}
            onChange={(e) =>
              handleSelectChange(
                "resources",
                "contactInformation",
                "planId",
                e.target.value,
              )
            }
            placeholder="Enter plan ID"
          />
          <ErrorMessage error={errors.resources.planId} />
        </div>

        <div className="space-y-2">
          <Label>QR Code</Label>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                if (formData.resources.qrUrl) {
                  handleInputChange("resources", "qrLinkGenerated", true);
                }
              }}
              className="flex items-center border-2 border-gray-300 hover:border-gray-400 transition-colors"
              disabled={!formData.resources.qrUrl}
            >
              <QrCode className="mr-2 h-4 w-4" /> Generate QR Code
            </Button>
          </div>
          {formData.resources.qrLinkGenerated && formData.resources.qrUrl && (
            <div className="flex items-center space-x-2 mt-2">
              <QRCodeSVG value={formData.resources.qrUrl} size={64} />
              <span className="text-sm text-gray-500">
                {formData.resources.qrUrl}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>QR URL</Label>
          <Input
            value={formData.resources.qrUrl}
            onChange={(e) =>
              handleInputChange("resources", "qrUrl", e.target.value)
            }
            onBlur={() => handleBlur("resources", "qrUrl")}
            placeholder="Enter QR URL"
            className={
              touched.resources.qrUrl && errors.resources.qrUrl
                ? "border-red-500"
                : ""
            }
          />
          {touched.resources.qrUrl && (
            <ErrorMessage error={errors.resources.qrUrl} />
          )}
        </div>

        {/* <div className="space-y-4">
          <div>
            <Label>Plan ID (Optional)</Label>
            <Input
              value={formData.resources.contactInformation.planId}
              onChange={(e) =>
                handleSelectChange(
                  "resources",
                  "contactInformation",
                  "planId",
                  e.target.value,
                )
              }
              placeholder="Enter plan ID"
            />
          </div>
        </div> */}
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
            markSectionAsTouched("resources");
            if (validateResources()) {
              setSectionReview((prev) => ({ ...prev, resources: true }));
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

export default ResourcesSection;
