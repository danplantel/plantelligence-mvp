import { customValue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IPlanFormData, SectionPreview } from "../..";
import { Check } from "lucide-react";
import { forwardRef } from "react";

interface EmployerContributionsReviewProps {
  formData: IPlanFormData;
  prevSection: () => void;
  scrollToTop: () => void;
  nextSection: () => void;
  markSectionAsTouched: (section: string) => void;
  validatePlanDetails: (newFormData?: IPlanFormData) => boolean;
  validateEmployerContributions: () => boolean;
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

const EmployerContributionsReview = forwardRef<
  HTMLDivElement,
  EmployerContributionsReviewProps
>((props, ref) => {
  const {
    formData,
    prevSection,
    scrollToTop,
    markSectionAsTouched,
    validateEmployerContributions,
    setSectionReview,
    nextSection,
    backgroundImage,
    brandColor,
    avatarChoice,
  } = props;

  const employerContributions = formData?.employerContributions;
  const contributionTypes = employerContributions?.contributionTypes;
  const hasContributions = employerContributions?.hasContributions;
  const contributionTypeNames: Record<string, string> = {
    companyMatch: "Company Match",
    safeHarbor: "Safe Harbor",
    fixedAmount: "Fixed Amount",
    profitSharing: "Profit Sharing",
  };

  const renderDetail = (type: string) => {
    switch (type) {
      case "companyMatch":
        return (
          <div>
            <p>
              {employerContributions.companyMatch.customFormula ||
                employerContributions.companyMatch.formula ||
                ""}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-semibold text-gray-700 tracking-wide">
                Limit:
              </span>
              <span className="text-lg text-gray-600 font-medium">
                {employerContributions.companyMatch.customLimit ||
                  employerContributions.companyMatch.limit ||
                  ""}
              </span>
            </div>
          </div>
        );
      case "safeHarbor":
        return (
          <div>
            <p>
              {employerContributions.safeHarbor.customFormula ||
                employerContributions.safeHarbor.formula ||
                ""}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-semibold text-gray-700 tracking-wide">
                Limit:
              </span>
              <span className="text-lg text-gray-600 font-medium">
                {employerContributions.safeHarbor.customLimit ||
                  employerContributions.safeHarbor.limit ||
                  ""}
              </span>
            </div>
          </div>
        );
      case "fixedAmount":
        return (
          <div>
            <p>
              {employerContributions.fixedAmount.customAmount ||
                employerContributions.fixedAmount.amount ||
                ""}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-semibold text-gray-700 tracking-wide">
                Limit:
              </span>
              <span className="text-lg text-gray-600 font-medium">
                {employerContributions.fixedAmount.customDetails ||
                  employerContributions.fixedAmount.details ||
                  ""}
              </span>
            </div>
          </div>
        );
      case "profitSharing":
        return (
          <div>
            <p>
              {employerContributions.profitSharing.customDetails ||
                employerContributions.profitSharing.details ||
                ""}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-semibold text-gray-700 tracking-wide">
                Limit:
              </span>
              <span className="text-lg text-gray-600 font-medium">
                {employerContributions.profitSharing.customConditions ||
                  employerContributions.profitSharing.conditions ||
                  ""}
              </span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6" ref={ref}>
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Employer Contributions Preview
        </h2>
        <p className="text-gray-500 mt-1">
          Review how your employer contributions will appear
        </p>
      </div>

      {/* 16:9 aspect ratio container */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ paddingBottom: "56.25%" }}
      >
        <div className="absolute inset-0 bg-white overflow-hidden">
          {/* Removed background image overlay - keeping only white background */}

          {/* Text container */}
          <div className="absolute w-full flex flex-col items-start justify-evenly h-[85%] top-0 text-2xl text-black tracking-tight pl-10">
            {hasContributions &&
              contributionTypes &&
              contributionTypes.map((type) => {
                return (
                  <div key={type} className="flex text-normal flex-col gap-1">
                    <strong>{contributionTypeNames[type]}</strong>
                    {renderDetail(type)}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xl font-semibold text-gray-700 tracking-wide">
                        Vesting:
                      </span>
                      <span className="text-lg text-gray-600 font-medium">
                        {employerContributions[type]?.customVesting ||
                          employerContributions[type]?.vesting ||
                          ""}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Color bar at the bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[15%]"
            style={{ backgroundColor: brandColor }}
          />

          {/* Avatar */}
          {avatarChoice && (
            <div className="absolute w-full h-[90%] bottom-0 right-0 text-right">
              <img
                src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                alt="Avatar"
                className="h-full w-auto object-contain object-bottom"
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
            markSectionAsTouched("employerContributions");
            if (validateEmployerContributions()) {
              setSectionReview((prev) => ({
                ...prev,
                employerContributions: true,
              }));
              setTimeout(() => {
                nextSection();
              }, 500);
            }
          }}
          className="transition-all duration-200 hover:scale-105 !bg-[#005F73] hover:!bg-[#004D5E] text-white"
        >
          Confirm & Continue
        </Button>
      </div>
    </div>
  );
});

EmployerContributionsReview.displayName = "EmployerContributionsReview";

export default EmployerContributionsReview;
