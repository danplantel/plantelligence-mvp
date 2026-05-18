import { BenefitType } from "@/types/wizard";

export interface BenefitTypesState {
  selectedBenefits: BenefitType[];
  customBenefitType: string;
}

export interface BenefitTypesActions {
  onBenefitToggle: (benefit: BenefitType) => void;
  onCustomBenefitChange: (value: string) => void;
}

export const benefitOptions = [
  {
    value: BenefitType.RETIREMENT_401K,
    label: "401(k), 403(b), 457(b), 401(a), SIMPLE IRA, etc",
    description: "Retirement savings plans",
  },
  {
    value: BenefitType.GROUP_HEALTH,
    label: "Group Health",
    description: "Medical, dental, vision, HSA, and FSA plans offered to employees.",
  },
  {
    value: BenefitType.GROUP_LIFE,
    label: "Group Life & Disability",
    description: "Employer-sponsored life insurance and income protection coverage.",
  },
  {
    value: BenefitType.VOLUNTARY,
    label: "Supplemental Health",
    description: "Additional coverage such as critical illness, accident, and hospital indemnity.",
  },
  {
    value: BenefitType.OTHER,
    label: "Other Benefits (Custom Input)",
    description: "Wellness programs, voluntary benefits, or niche offerings defined by you",
  },
];
