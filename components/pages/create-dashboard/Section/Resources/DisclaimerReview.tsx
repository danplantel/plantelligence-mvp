import { Button } from "@/components/ui/button";
import React from "react";
import { IPlanFormData } from "../..";

interface DisclaimerReviewProps {
  isLoading: boolean;
  disclaimers: string[];
  scrollToTop: () => void;
  nextSection: () => void;
  setIsDisclaimersStep: React.Dispatch<React.SetStateAction<boolean>>;
}

const DisclaimerReview = (props: DisclaimerReviewProps) => {
  const {
    isLoading,
    disclaimers,
    scrollToTop,
    setIsDisclaimersStep,
    nextSection,
  } = props;

  return (
    <div className="space-y-6 flex flex-col items-center">
      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
        Disclaimer:
      </p>
      <div className="flex flex-col gap-1">
        {[...Array(25)].map((_, index) => (
          <div key={index} className="text-center text-xs">
            {disclaimers?.[index] || ""}
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">
        powered by PlanTelligence | Branded Benefits Technology
      </p>
      <div className="flex justify-between mt-8 w-full">
        <Button
          variant="outline"
          onClick={() => setIsDisclaimersStep(false)}
          className="border-2 border-gray-300 hover:border-gray-400 transition-colors"
        >
          Back
        </Button>
        <Button
          disabled={isLoading}
          onClick={() => {
            scrollToTop();
            setTimeout(() => {
              nextSection();
            }, 500);
          }}
          className="transition-all duration-200 hover:scale-105 bg-[#005F73] hover:bg-[#004D5E]"
        >
          Confirm & Continue
        </Button>
      </div>
    </div>
  );
};

export default DisclaimerReview;
