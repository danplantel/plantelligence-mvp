import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IPlanFormData, SectionPreview } from "../..";

interface PlanDetailsReviewProps {
  formData: IPlanFormData;
  prevSection: () => void;
  scrollToTop: () => void;
  nextSection: () => void;
  markSectionAsTouched: (section: string) => void;
  validatePlanDetails: (newFormData?: IPlanFormData) => boolean;
  setSectionReview: React.Dispatch<React.SetStateAction<SectionPreview>>;
}

const PlanDetailsReview = (props: PlanDetailsReviewProps) => {
  const {
    formData,
    prevSection,
    scrollToTop,
    markSectionAsTouched,
    validatePlanDetails,
    setSectionReview,
    nextSection,
  } = props;
  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Plan Type</Label>
          <div className="text-lg">{formData.planDetails.planType}</div>
        </div>

        <div className="space-y-2">
          <Label>Eligibility</Label>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">Age Requirement</span>
              <p className="text-lg">
                {formData.planDetails.eligibility.ageRequirement}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Service Requirement</span>
              <p className="text-lg">
                {formData.planDetails.eligibility.serviceRequirement}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Entry Date</span>
              <p className="text-lg">
                {formData.planDetails.eligibility.entryDate}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Employee Deferrals</Label>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">Auto Enrollment</span>
              <p className="text-lg">
                {formData.planDetails.employeeDeferrals.autoEnrollment
                  ? "Yes"
                  : "No"}
              </p>
            </div>
            {formData.planDetails.employeeDeferrals.autoEnrollment && (
              <>
                <div>
                  <span className="text-sm text-gray-500">Enrollment Rate</span>
                  <p className="text-lg">
                    {formData.planDetails.employeeDeferrals.enrollmentRate}%
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Auto Escalation</span>
                  <p className="text-lg">
                    {formData.planDetails.employeeDeferrals.autoEscalation}
                  </p>
                </div>
              </>
            )}
            <div>
              <span className="text-sm text-gray-500">Escalation Cap</span>
              <p className="text-lg">
                {formData.planDetails.employeeDeferrals.deferralCap}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Roth Option</Label>
          <div className="text-lg">
            {formData.planDetails.rothOption ? "Yes" : "No"}
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
          onClick={() => {
            scrollToTop();
            markSectionAsTouched("planDetails");
            if (validatePlanDetails()) {
              setSectionReview((prev) => ({ ...prev, planDetails: true }));
              setTimeout(() => {
                nextSection();
              }, 500);
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

export default PlanDetailsReview;
