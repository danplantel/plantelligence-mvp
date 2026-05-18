import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";
import { QRCodeSVG } from "qrcode.react";
import { IPlanFormData, SectionPreview } from "../..";
import { forwardRef } from "react";

interface ResourcesReviewProps {
  formData: IPlanFormData;
  isLoading?: boolean;
  avatarChoice: string;
  backgroundImage: string;
  prevSection: () => void;
  scrollToTop: () => void;
  nextSection: () => void;
  validateResources: () => boolean;
  setIsDisclaimersStep: React.Dispatch<React.SetStateAction<boolean>>;
  markSectionAsTouched: (section: string) => void;
  setSectionReview: React.Dispatch<React.SetStateAction<SectionPreview>>;
}

const avatarImagePaths: Record<string, string> = {
  alison: "/images/alison-trans.png",
  chad: "/images/chad-trans.png",
  leah: "/images/leah-trans.png",
  alicia: "/images/alicia-trans.png",
  paul: "/images/paul-trans.png",
  helena: "/images/helena-trans.png",
  maria: "/images/maria-trans.png",
  scott: "/images/scott-trans.png",
  custom: "/images/custom-trans.png",
};

const ResourcesReview = forwardRef<HTMLDivElement, ResourcesReviewProps>(
  (props, ref) => {
    const {
      formData,
      avatarChoice,
      isLoading,
      backgroundImage,
      prevSection,
      setIsDisclaimersStep,
      scrollToTop,
      validateResources,
      markSectionAsTouched,
      setSectionReview,
      nextSection,
    } = props;

    return (
      <div className="space-y-6" ref={ref}>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Resources Preview
          </h2>
          <p className="text-gray-500 mt-1">
            Review how your resources will appear
          </p>
        </div>

        {/* 16:9 aspect ratio container */}
        <div
          className="relative w-full rounded-lg overflow-hidden border border-gray-200"
          style={{ paddingBottom: "56.25%" }}
        >
          <div className="absolute inset-0 bg-white overflow-hidden flex  px-8 py-6">
            <div className="w-full flex flex-col items-start pl-4 gap-1.5 text-lg text-black tracking-tight">
              <img
                src="/pt_web_light.png"
                className="object-contain h-[80px] -ml-8 -mb-2 "
                alt="PlanTelligence"
              />

              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-700 tracking-wide">
                  Plan ID:
                </span>
                <span className="text-lg text-gray-600 font-medium">
                  {formData.resources.contactInformation.planId}
                </span>
              </div>

              {/* Primary Contact - only show if any field has content */}
              {(formData.resources.contactInformation.primaryTypeCustom ||
                formData.resources.contactInformation.primaryType ||
                formData.resources.contactInformation.primaryName ||
                formData.resources.contactInformation.primaryEmail ||
                formData.resources.contactInformation.primaryPhone) && (
                <div>
                  {(formData.resources.contactInformation.primaryTypeCustom ||
                    formData.resources.contactInformation.primaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Primary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {formData.resources.contactInformation
                          .primaryTypeCustom ||
                          formData.resources.contactInformation.primaryType}
                      </strong>
                    </div>
                  )}
                  {formData.resources.contactInformation.primaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.primaryName}
                      </span>
                    </div>
                  )}
                  {formData.resources.contactInformation.primaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.primaryEmail}
                      </span>
                    </div>
                  )}
                  {formData.resources.contactInformation.primaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.primaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Secondary Contact - only show if any field has content */}
              {(formData.resources.contactInformation.secondaryTypeCustom ||
                formData.resources.contactInformation.secondaryType ||
                formData.resources.contactInformation.secondaryName ||
                formData.resources.contactInformation.secondaryEmail ||
                formData.resources.contactInformation.secondaryPhone) && (
                <div>
                  {(formData.resources.contactInformation.secondaryTypeCustom ||
                    formData.resources.contactInformation.secondaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Secondary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {formData.resources.contactInformation
                          .secondaryTypeCustom ||
                          formData.resources.contactInformation.secondaryType}
                      </strong>
                    </div>
                  )}
                  {formData.resources.contactInformation.secondaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.secondaryName}
                      </span>
                    </div>
                  )}
                  {formData.resources.contactInformation.secondaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.secondaryEmail}
                      </span>
                    </div>
                  )}
                  {formData.resources.contactInformation.secondaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.secondaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tertiary Contact - only show if any field has content */}
              {(formData.resources.contactInformation.tertiaryTypeCustom ||
                formData.resources.contactInformation.tertiaryType ||
                formData.resources.contactInformation.tertiaryName ||
                formData.resources.contactInformation.tertiaryEmail ||
                formData.resources.contactInformation.tertiaryPhone) && (
                <div>
                  {(formData.resources.contactInformation.tertiaryTypeCustom ||
                    formData.resources.contactInformation.tertiaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Tertiary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {formData.resources.contactInformation
                          .tertiaryTypeCustom ||
                          formData.resources.contactInformation.tertiaryType}
                      </strong>
                    </div>
                  )}
                  {formData.resources.contactInformation.tertiaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.tertiaryName}
                      </span>
                    </div>
                  )}
                  {formData.resources.contactInformation.tertiaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.tertiaryEmail}
                      </span>
                    </div>
                  )}
                  {formData.resources.contactInformation.tertiaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {formData.resources.contactInformation.tertiaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="size-full ">
              <div className="h-1/3 flex items-center gap-4 overflow-hidden">
                {/* Avatar */}
                {avatarChoice && (
                  <img
                    src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                    alt="Avatar"
                    className="h-full w-auto object-contain object-bottom rounded-full size-[100px]"
                  />
                )}
                {/* Company logo */}
                {formData.branding.companyLogo && (
                  <div className="size-full flex items-center justify-center ">
                    <BrandingImage
                      src={formData.branding.companyLogo || "/placeholder.svg"}
                      alt={`${formData.branding.companyName} Company Logo`}
                      className="object-contain"
                    />
                  </div>
                )}
              </div>
              <div className="h-2/3 flex flex-col items-end justify-end gap-2">
                <p>visit site/ schedule an appointment</p>
                <QRCodeSVG
                  value={formData.resources.qrUrl}
                  size={120}
                  className="mr-2"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={prevSection}
            className="border-2 border-gray-300 hover:border-gray-400 transition-colors"
          >
            Back
          </Button>
          <Button
            disabled={isLoading}
            onClick={() => {
              scrollToTop();
              markSectionAsTouched("investments");
              if (validateResources()) {
                setSectionReview((prev) => ({ ...prev, investments: true }));
                setIsDisclaimersStep(true);
                setTimeout(() => {
                  nextSection();
                }, 500);
              }
            }}
            className="transition-all duration-200 hover:scale-105 bg-[#005F73] hover:bg-[#004D5E]"
          >
            Confirm & Continue
          </Button>
        </div>
      </div>
    );
  },
);

ResourcesReview.displayName = "ResourcesReview";

export default ResourcesReview;
