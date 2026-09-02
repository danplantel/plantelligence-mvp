// Shared types extracted from the legacy create-dashboard form
// (components/pages/create-dashboard/index.tsx). These are reused by:
//   - the video wizard (/new/video): wizard/video-steps/step-3a.tsx,
//     step-4a.tsx, step-4b.tsx
//   - app/api/plans/create-plan/route.ts (IPlanFormData)
// The legacy 5-step form itself was removed as dead code.

export type ContributionType =
  | "companyMatch"
  | "safeHarbor"
  | "fixedAmount"
  | "profitSharing";

export type PlanType = "401k" | "403b" | "401a" | "simpleIRA" | "457";

export type EnrollmentMethod = "online" | "phone" | "paperForm" | "custom";

export type PlanFeature =
  | "planLoans"
  | "hardshipWithdrawals"
  | "selfDirectedBrokerage"
  | "afterTaxContributions"
  | "inServiceDistributions"
  | "custom"
  | "none";

export interface TouchedFields {
  branding: Record<string, boolean>;
  planDetails: Record<string, boolean>;
  employerContributions: Record<string, boolean>;
  investments: Record<string, boolean>;
  resources: Record<string, boolean>;
}

export interface CustomAvatarFields {
  name: string;
  video: File | null;
}

export interface SectionPreview {
  branding: boolean;
  eligibility: boolean;
  employerContributions: boolean;
  investments: boolean;
  resources: boolean;
  employeeDeferrals: boolean;
}

export interface Errors {
  branding: Record<string, string>;
  planDetails: Record<string, string>;
  employerContributions: Record<string, string>;
  investments: Record<string, string>;
  resources: Record<string, string>;
}

export interface IPlanFormData {
  // Section 1: Branding
  branding: {
    companyName: string;
    planName: string;
    companyLogo: string;
    accentColor: string;
    accentColorImage?: string; // S3 URL of selected color image
    backgroundImage: string;
    avatarChoice: string;
    avatarId: string;
    customAvatarName?: string;
    customAvatarVideo?: string;
  };

  // Section 2: Plan Details
  planDetails: {
    planType: PlanType | "";
    eligibility: {
      ageRequirement: string;
      serviceRequirement: string;
      entryDate: string;
      customEntryDate?: string;
      customAgeRequirement?: string;
      customServiceRequirement?: string;
    };
    employeeDeferrals: {
      autoEnrollment: boolean | null;
      enrollmentRate: string;
      autoEscalation: string;
      customAutoEscalation?: string;
      deferralCap: string;
      enrollmentMethods: EnrollmentMethod[];
      customEnrollmentMethod: string;
      customDeferralCap?: string;
      customEnrollmentRate?: string;
    };
    rothOption: boolean | null;
  };

  // Section 3: Employer Contributions
  employerContributions: {
    hasContributions: boolean | null;
    hasAdditionalContributions: boolean | null;
    contributionTypes: ContributionType[];
    primaryContributionType: ContributionType | null;
    companyMatch: {
      isPrimary: boolean;
      formula: string;
      customFormula?: string;
      limit: string;
      customLimit?: string;
      vesting: string;
      customVesting?: string;
    };
    safeHarbor: {
      isPrimary: boolean;
      type: string;
      customType?: string;
      formula: string;
      customFormula?: string;
      limit: string;
      customLimit?: string;
      vesting: string;
      customVesting?: string;
    };
    fixedAmount: {
      isPrimary: boolean;
      amount: string;
      customAmount?: string;
      percentageAmount?: string;
      details: string;
      customDetails?: string;
      vesting: string;
      customVesting?: string;
    };
    profitSharing: {
      isPrimary: boolean;
      details: string;
      customDetails?: string;
      conditions: string;
      customConditions?: string;
      vesting: string;
      customVesting?: string;
    };
  };

  // Section 4: Investments
  investments: {
    investmentOptions: string[];
  };

  // Section 5: Resources
  resources: {
    planFeatures: PlanFeature[];
    customFeature: string;
    contactInformation: {
      primaryType: "Email" | "Phone" | "Custom" | "None";
      primaryTypeCustom: string;
      primaryName: string;
      primaryEmail: string;
      primaryPhone: string;
      secondaryType: "Email" | "Phone" | "Custom" | "None";
      secondaryTypeCustom: string;
      secondaryName: string;
      secondaryEmail: string;
      secondaryPhone: string;
      tertiaryType: "Email" | "Phone" | "Custom" | "None";
      tertiaryName: string;
      tertiaryEmail: string;
      tertiaryPhone: string;
      tertiaryTypeCustom: string;
      planId: string;
    };
    qrLinkGenerated: boolean;
    qrUrl: string;
    financialPlanning: boolean;
    disclaimer: Array<string>;
  };
}

export interface ContributionProps {
  formData: IPlanFormData;
  errors: Errors;
  handleContributionInputChange: (
    contributionType: ContributionType,
    field: string,
    value: string,
  ) => void;
}
