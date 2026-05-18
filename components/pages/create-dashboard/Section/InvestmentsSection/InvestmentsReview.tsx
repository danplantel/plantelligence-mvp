import { Button } from "@/components/ui/button";
import { IPlanFormData, SectionPreview } from "../..";
import { listAdditionalFeatures } from "./index";
import { forwardRef } from "react";

interface InvestmentsReviewProps {
  formData: IPlanFormData;
  prevSection: () => void;
  scrollToTop: () => void;
  nextSection: () => void;
  markSectionAsTouched: (section: string) => void;
  validateInvestments: () => boolean;
  setSectionReview: React.Dispatch<React.SetStateAction<SectionPreview>>;
  backgroundImage: string;
  brandColor: string;
  avatarChoice: string;
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

const InvestmentsReview = forwardRef<HTMLDivElement, InvestmentsReviewProps>(
  (props, ref) => {
    const {
      formData,
      prevSection,
      scrollToTop,
      markSectionAsTouched,
      validateInvestments,
      setSectionReview,
      nextSection,
      backgroundImage,
      brandColor,
      avatarChoice,
    } = props;

    return (
      <div className="space-y-6" ref={ref}>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Investments & Features Preview
          </h2>
          <p className="text-gray-500 mt-1">
            Review how your investments and plan features will appear
          </p>
        </div>

        {/* Target Date Funds Chip */}
        {formData.investments.investmentOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.investments.investmentOptions.map((item) => (
              <div
                key={item}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#005F73] text-white"
              >
                {item}
              </div>
            ))}
          </div>
        )}

        {/* 16:9 aspect ratio container */}
        <div
          className="relative w-full rounded-lg overflow-hidden border border-gray-200"
          style={{ paddingBottom: "56.25%" }}
        >
          <div className="absolute inset-0 bg-white overflow-hidden">
            {/* Removed background image overlay - keeping only white background */}

            {/* Text container */}
            <div className="absolute h-[80%] w-full flex flex-col items-start text-3xl text-black tracking-tight p-10 gap-2 overflow-y-auto">
              <strong className="mb-4">Plan Features</strong>

              {/* Static features - always displayed */}
              <p className="text-xl text-black tracking-tight break-words w-full max-w-1/2">
                - Simplified Enrollment
              </p>
              <p className="text-xl text-black tracking-tight break-words w-full max-w-1/2">
                - Diversified Investment Options
              </p>
              <p className="text-xl text-black tracking-tight break-words w-full max-w-1/2">
                - Benefits Website with Online Access
              </p>
              <p className="text-xl text-black tracking-tight break-words w-full max-w-1/2">
                - Dedicated Support Team
              </p>

              {/* Selected features with dashes */}
              {formData?.resources?.planFeatures
                ?.filter((item) => item !== "none")
                .map((currentItem, index) => {
                  const currentFeature = listAdditionalFeatures.find(
                    (feature) => feature.value === currentItem,
                  );

                  const displayValue =
                    currentFeature?.value === "custom"
                      ? formData?.resources?.customFeature
                      : currentFeature?.label;

                  return displayValue ? (
                    <p
                      className="text-xl text-black tracking-tight break-words w-full max-w-1/2"
                      key={currentItem}
                    >
                      - {displayValue}
                    </p>
                  ) : null;
                })}
            </div>

            {/* Color bar at the bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[20%]"
              style={{ backgroundColor: brandColor }}
            />

            {/* Avatar */}
            {avatarChoice && (
              <div className="absolute w-[40%] h-[40%] right-2 top-2 text-right rounded-full">
                <img
                  src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                  alt="Avatar"
                  className="h-full w-auto object-contain object-bottom rounded-full"
                />
              </div>
            )}
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
            onClick={() => {
              scrollToTop();
              markSectionAsTouched("investments");
              if (validateInvestments()) {
                setSectionReview((prev) => ({ ...prev, investments: true }));
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

InvestmentsReview.displayName = "InvestmentsReview";

export default InvestmentsReview;
