/* eslint-disable react/jsx-no-comment-textnodes */
// braceseslintreact/jsx-no-comment-textnodes
"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePreviewImages } from "@/hooks/usePreviewImages";
import EmployerContributionsReview from "./Section/EmployerContributionsSection/EmployerContributionsReview";
import InvestmentsReview from "./Section/InvestmentsSection/InvestmentsReview";
import PlanDetailsReview from "./Section/PlanDetailSection/PlanDetailsReview";
import ResourcesReview from "./Section/Resources/ResourcesReview";
import BrandingSection from "./Section/BrandingSection";
import EmployerContributionsSection from "./Section/EmployerContributionsSection";
import InvestmentsSection from "./Section/InvestmentsSection";
import PlanDetailSection from "./Section/PlanDetailSection";
import ResourcesSection from "./Section/Resources";
import { BrandingPreview } from "./branding-preview";
import { LogoResizePreview } from "./logo-resize-preview";
import CustomAvatarModal from "./modal/CustomAvatarModal";
import { CompletionAnimation } from "./section-animation";
import EligibilityPreview from "./Section/PlanDetailSection/EligibilityPreview";
import EmployeeDeferrerPreview from "./Section/PlanDetailSection/EmployeeDeferrerPreview";
import EmployerContributionsPreview from "./Section/EmployerContributionsSection/EmployerContributionsPreview";
import InvestmentsPreview from "./Section/InvestmentsSection/InvestmentsPreview";
import ResourcesPreview from "./Section/Resources/ResourcesPreview";
import DisclaimerReview from "./Section/Resources/DisclaimerReview";
import { ProfileData } from "../my-profile";
import {
  generateEligibilityImage,
  generateEligibilityImageFromElement,
  generateEmployeeDeferralsImage,
  generateEmployerContributionsImage,
  generateInvestmentsImage,
  generateResourcesImage,
} from "@/lib/generateEligibilityImage";

const formSteps = [
  { id: "branding", name: "Branding" },
  { id: "planDetails", name: "Plan Details" },
  { id: "employerContributions", name: "Employer Contributions" },
  { id: "investments", name: "Investments & Features" },
  { id: "resources", name: "Resources" },
];
const avatarOptions = [
  {
    value: "alison",
    label: "Alison",
    img: "/images/alison.png",
    avatarId: "440548a8-4701-402f-afdb-6d32a851a3a6",
  },
  {
    value: "chad",
    label: "Chad",
    img: "/images/chad.png",
    avatarId: "86dabc70-a825-465e-9b24-d4317beb73b1",
  },
  {
    value: "leah",
    label: "Leah",
    img: "/images/leah.png",
    avatarId: "eb09cd93-8159-424b-828d-6fed0a7b0945",
  },
  {
    value: "alicia",
    label: "Alicia",
    img: "/images/alicia.png",
    avatarId: "2f17a7d7-bba5-4cc8-9c4e-c9e91c81dad5",
  },
  {
    value: "paul",
    label: "Paul",
    img: "/images/paul.png",
    avatarId: "ce225670-f6fa-4a71-940a-4ac7b766ab4d",
  },
  {
    value: "helena",
    label: "Helena",
    img: "/images/helena.png",
    avatarId: "2046205b-19d0-499f-bb4a-6631bfd30c4d",
  },
  {
    value: "maria",
    label: "Maria",
    img: "/images/maria.png",
    avatarId: "e5e8c04f-da63-4365-bf21-2eb313258309",
  },
  {
    value: "scott",
    label: "Scott",
    img: "/images/scott.png",
    avatarId: "67200982-810c-4955-b39a-0d1de7d107d2",
  },
  {
    value: "custom",
    label: "Custom",
    img: "/images/custom.png",
    avatarId: "",
  },
];

// Add these CSS keyframes to the top of the file, right after the imports
const fadeInKeyframes = `
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.5s ease-in-out;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slideIn {
  animation: slideIn 0.3s ease-out forwards;
}

/* Add these styles to the fadeInKeyframes constant */
`;

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-20 bg-gray-100 animate-pulse rounded-md" />
  ),
});

// Animation data
const progressAnimation = {
  v: "5.7.1",
  fr: 30,
  ip: 0,
  op: 60,
  w: 800,
  h: 100,
  nm: "Progress Bar Animation",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Progress Bar",
      sr: 1,
      ks: {
        o: { a: 0, k: 100, ix: 11 },
        r: { a: 0, k: 0, ix: 10 },
        p: { a: 0, k: [400, 50, 0], ix: 2, l: 2 },
        a: { a: 0, k: [0, 0, 0], ix: 1, l: 2 },
        s: { a: 0, k: [100, 100, 100], ix: 6, l: 2 },
      },
      ao: 0,
      shapes: [
        {
          ty: "rc",
          d: 1,
          s: { a: 0, k: [700, 20], ix: 2 },
          p: { a: 0, k: [0, 0], ix: 3 },
          r: { a: 0, k: 10, ix: 4 },
          nm: "Rectangle Path",
          mn: "ADBE Vector Shape - Rect",
          hd: false,
        },
        {
          ty: "fl",
          c: { a: 0, k: [0.125, 0.396, 0.439, 1], ix: 4 },
          o: { a: 0, k: 100, ix: 5 },
          r: 1,
          bm: 0,
          nm: "Fill",
          mn: "ADBE Vector Graphic - Fill",
          hd: false,
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0,
    },
  ],
  markers: [],
};

const checkmarkAnimation = {
  v: "5.7.1",
  fr: 30,
  ip: 0,
  op: 60,
  w: 100,
  h: 100,
  nm: "Checkmark Animation",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Checkmark",
      sr: 1,
      ks: {
        o: { a: 0, k: 100, ix: 11 },
        r: { a: 0, k: 0, ix: 10 },
        p: { a: 0, k: [50, 50, 0], ix: 2, l: 2 },
        a: { a: 0, k: [0, 0, 0], ix: 1, l: 2 },
        s: { a: 0, k: [100, 100, 100], ix: 6, l: 2 },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ind: 0,
              ty: "sh",
              ix: 1,
              ks: {
                a: 0,
                k: {
                  i: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                  ],
                  o: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                  ],
                  v: [
                    [-20, 0],
                    [-5, 15],
                    [20, -20],
                  ],
                  c: false,
                },
                ix: 2,
              },
              nm: "Path 1",
              mn: "ADBE Vector Shape - Group",
              hd: false,
            },
            {
              ty: "st",
              c: { a: 0, k: [0.125, 0.396, 0.439, 1], ix: 3 },
              o: { a: 0, k: 100, ix: 4 },
              w: { a: 0, k: 8, ix: 5 },
              lc: 2,
              lj: 2,
              bm: 0,
              nm: "Stroke",
              mn: "ADBE Vector Graphic - Stroke",
              hd: false,
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0], ix: 2 },
              a: { a: 0, k: [0, 0], ix: 1 },
              s: { a: 0, k: [100, 100], ix: 3 },
              r: { a: 0, k: 0, ix: 6 },
              o: { a: 0, k: 100, ix: 7 },
              sk: { a: 0, k: 0, ix: 4 },
              sa: { a: 0, k: 0, ix: 5 },
              nm: "Transform",
            },
          ],
          nm: "Group 1",
          np: 2,
          cix: 2,
          bm: 0,
          ix: 1,
          mn: "ADBE Vector Group",
          hd: false,
        },
        {
          ty: "tm",
          s: {
            a: 1,
            k: [
              { t: 0, s: [100], h: 0 },
              { t: 30, s: [0], h: 0 },
            ],
            ix: 1,
          },
          e: { a: 0, k: 100, ix: 2 },
          o: { a: 0, k: 0, ix: 3 },
          m: 1,
          ix: 2,
          nm: "Trim Paths 1",
          mn: "ADBE Vector Filter - Trim",
          hd: false,
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0,
    },
  ],
  markers: [],
};

// Define types for form data
export type ContributionType =
  | "companyMatch"
  | "safeHarbor"
  | "fixedAmount"
  | "profitSharing";
type PlanType = "401k" | "403b" | "401a" | "simpleIRA" | "457";
type EnrollmentMethod = "online" | "phone" | "paperForm" | "custom";
type PlanFeature =
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

export default function RetirementPlanForm({
  scrollToTop,
}: {
  scrollToTop: () => void;
}) {
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const customAvatarFileInputRef = useRef<HTMLInputElement>(null);

  // Preview image generation hook
  const {
    previewImages,
    previewRefs,
    isGenerating: isGeneratingImagesFromHook,
    generationProgress: imageGenerationProgress,
    error: imageError,
    generateImages,
    generateImagesFromDataUrls,
    clearImages,
    hasImages,
  } = usePreviewImages();

  const [formData, setFormData] = useState<IPlanFormData>({
    branding: {
      companyName: "",
      planName: "",
      companyLogo: "",
      accentColor: "",
      backgroundImage: "",
      avatarChoice: "",
      avatarId: "",
    },
    planDetails: {
      planType: "401k",
      eligibility: {
        ageRequirement: "21",
        customAgeRequirement: "",
        serviceRequirement: "3months",
        customServiceRequirement: "",
        entryDate: "firstOfMonth",
        customEntryDate: "",
      },
      employeeDeferrals: {
        autoEnrollment: true,
        enrollmentRate: "3",
        autoEscalation: "1",
        deferralCap: "10",
        enrollmentMethods: [] as EnrollmentMethod[],
        customEnrollmentMethod: "",
      },
      rothOption: true,
    },
    employerContributions: {
      hasContributions: true,
      hasAdditionalContributions: null,
      contributionTypes: [],
      primaryContributionType: null,
      companyMatch: {
        isPrimary: true,
        formula: "",
        customFormula: "",
        limit: "",
        customLimit: "",
        vesting: "Immediate",
        customVesting: "",
      },
      safeHarbor: {
        isPrimary: false,
        type: "Basic Match",
        customType: "",
        formula: "",
        customFormula: "",
        limit: "",
        customLimit: "",
        vesting: "Immediate",
        customVesting: "",
      },
      fixedAmount: {
        isPrimary: false,
        amount: "",
        customAmount: "",
        percentageAmount: "",
        details: "",
        customDetails: "",
        vesting: "Immediate",
        customVesting: "",
      },
      profitSharing: {
        isPrimary: false,
        details: "",
        customDetails: "",
        conditions: "",
        customConditions: "",
        vesting: "Immediate",
        customVesting: "",
      },
    },
    investments: {
      investmentOptions: ["Target Date Funds"],
    },
    resources: {
      planFeatures: [],
      customFeature: "",
      contactInformation: {
        primaryType: "None",
        primaryTypeCustom: "",
        primaryName: "",
        primaryEmail: "",
        primaryPhone: "",
        secondaryType: "None",
        secondaryTypeCustom: "",
        secondaryName: "",
        secondaryEmail: "",
        secondaryPhone: "",
        tertiaryType: "None",
        tertiaryName: "",
        tertiaryEmail: "",
        tertiaryPhone: "",
        planId: "",
        tertiaryTypeCustom: "",
      },
      qrLinkGenerated: false,
      qrUrl: "",
      financialPlanning: false,
      disclaimer: [],
    },
  });

  const [errors, setErrors] = useState<Errors>({
    branding: {},
    planDetails: {},
    employerContributions: {},
    investments: {},
    resources: {},
  });

  const [touched, setTouched] = useState<TouchedFields>({
    branding: {},
    planDetails: {},
    employerContributions: {},
    investments: {},
    resources: {},
  });

  const [currentSection, setCurrentSection] = useState(1);
  const [isEmployeeDeferralsSection, setIsEmployeeDeferralsSection] =
    useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{
    section: string;
    nestedSection: string | null;
    field: string;
    value: string;
  }>({
    section: "",
    nestedSection: null,
    field: "",
    value: "",
  });
  const [isContributionDialogOpen, setIsContributionDialogOpen] =
    useState(false);
  const [contributionDialogData, setContributionDialogData] = useState<{
    type: string;
    field: string;
    value: string;
  }>({
    type: "",
    field: "",
    value: "",
  });

  const [showDialog, setShowDialog] = useState(false);
  const [dialogField, setDialogField] = useState("");
  const [dialogValue, setDialogValue] = useState("");
  const [dialogType, setDialogType] = useState<string>("");
  const [isComplete, setIsComplete] = useState(false);
  const [activeTab, setActiveTab] = useState("branding");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLogoUploadDialog, setShowLogoUploadDialog] = useState(false);
  const [showBackgroundUploadDialog, setShowBackgroundUploadDialog] =
    useState(false);
  const [animating, setAnimating] = useState(false);
  // Find the state variable for showPreview and add a new state variable for previewMode
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [disclaimers, setDisclaimers] = useState([""]);
  const [isDisclaimersStep, setIsDisclaimersStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filesUpload, setFilesUpload] = useState({
    companyLogo: null as any,
    backgroundImage: null as any,
  });

  // Add new state variable to track if we're in review mode for each section
  const [sectionReview, setSectionReview] = useState<SectionPreview>({
    branding: false,
    eligibility: false,
    employeeDeferrals: false,
    employerContributions: false,
    investments: false,
    resources: false,
  });
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  const [showCustomAvatarModal, setShowCustomAvatarModal] = useState(false);
  const [customAvatarData, setCustomAvatarData] = useState<CustomAvatarFields>({
    name: "",
    video: null as File | null,
  });
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [showLogoResizePreview, setShowLogoResizePreview] = useState(false);
  const [logoSize, setLogoSize] = useState({ width: 200, height: 120 });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await axios.get("/api/profile");
        const profileData: ProfileData = response.data;
        const disclaimers = profileData?.disclaimer
          .split(" ")
          .map((str) => str.trim())
          .filter((str) => str !== "");
        setDisclaimers(disclaimers);
      } catch (error) {
        console.error("Failed to fetch profile data", error);
      }
    }
    fetchProfile();
  }, []);

  function handleInputChange(section: string, field: string, value: any) {
    // if (section === "branding" && field === "avatarChoice") {
    //   const selectedAvatar = avatarOptions.find(
    //     (avatar) => avatar.value === value,
    //   );
    //   setFormData((prev: IPlanFormData) => {
    //     const updatedBranding = {
    //       ...prev.branding,
    //       avatarChoice: value,
    //       avatarId: selectedAvatar?.avatarId || "",
    //     };
    //     return {
    //       ...prev,
    //       branding: updatedBranding,
    //     };
    //   });
    // } else
    if (section === "branding" && field === "avatarChoice") {
      if (value === "custom") {
        setShowCustomAvatarModal(true);
        return;
      }
      const selectedAvatar = avatarOptions.find(
        (avatar) => avatar.value === value,
      );
      setFormData((prev: IPlanFormData) => {
        const updatedBranding = {
          ...prev.branding,
          avatarChoice: value,
          avatarId: selectedAvatar?.avatarId || "",
        };
        return {
          ...prev,
          branding: updatedBranding,
        };
      });
    } else {
      setFormData((prev: IPlanFormData) => ({
        ...prev,
        [section]: {
          ...prev[section as keyof IPlanFormData],
          [field]: value,
        },
      }));
    }
  }

  function handleNestedInputChange(
    section: string,
    nestedSection: string,
    field: string,
    value: any,
  ) {
    setErrors((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: "",
      },
    }));
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof IPlanFormData],
        [nestedSection]: {
          ...(prev[section as keyof IPlanFormData] as any)[
            nestedSection as keyof IPlanFormData
          ],
          [field]: value,
        },
      },
    }));
  }

  function handleRadioInputChange(section: string, field: string, value: any) {
    setFormData((prev: IPlanFormData) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof IPlanFormData],
        [field]: value,
      },
    }));
    setErrors((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: "",
      },
    }));
  }

  // Fix the enrollment methods checkbox handling issue
  // Replace the handleCheckboxChange function with this improved version that correctly handles nested fields
  function handleCheckboxChange(
    section: string,
    field: string,
    value: string,
    checked: boolean,
  ) {
    let newValues: string[];
    // Handle nested fields (e.g., "employeeDeferrals.enrollmentMethods")
    if (field.includes(".")) {
      const [parentField, childField] = field.split(".");
      const currentValues =
        (formData[section as keyof IPlanFormData] as any)[
          parentField as keyof IPlanFormData
        ][childField as any] || [];
      if (checked) {
        newValues = [...currentValues, value];
      } else {
        newValues = currentValues.filter((item: string) => item !== value);
      }

      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section as keyof IPlanFormData],
          [parentField]: {
            ...(prev[section as keyof IPlanFormData] as any)[
              parentField as keyof IPlanFormData
            ],
            [childField]: newValues,
          },
        },
      }));

      if (section === "planDetails") {
        validatePlanDetails({
          ...formData,
          [section as string]: {
            ...formData[section as keyof IPlanFormData],
            [parentField]: {
              ...(formData[section as keyof IPlanFormData] as any)[
                parentField as keyof IPlanFormData
              ],
              [childField]: newValues,
            },
          },
        });
      } else if (section === "investments") {
        validateInvestments();
      } else if (section === "resources") {
        validateResources();
      }
    } else {
      // Handle regular fields (not nested)
      const currentValues =
        (formData[section as keyof IPlanFormData] as any)[
          field as keyof IPlanFormData
        ] || [];

      // Special handling for planFeatures to handle mutual exclusivity with "none"
      if (section === "resources" && field === "planFeatures") {
        if (checked) {
          if (value === "none") {
            // If "none" is selected, clear all other features
            newValues = ["none"];
          } else {
            // If another feature is selected, remove "none" and add the new feature
            newValues = currentValues.filter((item: string) => item !== "none");
            if (!newValues.includes(value)) {
              newValues.push(value);
            }
          }
        } else {
          // If unchecking, just remove the value
          newValues = currentValues.filter((item: string) => item !== value);
        }
      } else {
        // Standard checkbox behavior for other fields
        if (checked) {
          if (!currentValues.includes(value)) {
            newValues = [...currentValues, value];
          } else {
            newValues = currentValues;
          }
        } else {
          newValues = currentValues.filter((item: string) => item !== value);
        }
      }

      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section as keyof IPlanFormData],
          [field]: newValues,
        },
      }));

      if (section === "planDetails") {
        validatePlanDetails({
          ...formData,
          [section as string]: {
            ...formData[section as keyof IPlanFormData],
            [field]: newValues,
          },
        });
      } else if (section === "investments") {
        validateInvestments();
      } else if (section === "resources") {
        validateResources();
      }
    }

    // Mark field as touched
    const fieldName = field.includes(".") ? field.split(".")[1] : field;
    setTouched((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [fieldName]: true,
      },
    }));
  }

  // Function to handle employer contribution input changes
  function handleContributionInputChange(
    contributionType: ContributionType,
    field: string,
    value: string,
  ) {
    const section = "employerContributions" as const;
    const contribution = formData[section][contributionType] as {
      [key: string]: any;
    };
    let obj = {
      [contributionType]: {},
    } as any;

    // Handle custom fields
    if (field === "formula" && (value === "Custom" || value === "custom")) {
      obj[contributionType].customFormula = "";
      // handleInputChange(section, `${contributionType}.customFormula`, "");
    } else if (field === "type" && (value === "Custom" || value === "custom")) {
      obj[contributionType].customType = "";
      // handleInputChange(section, `${contributionType}.customType`, "");
    } else if (
      field === "limit" &&
      (value === "Custom" || value === "custom")
    ) {
      obj[contributionType].customLimit = "";
      // handleInputChange(section, `${contributionType}.customLimit`, "");
    } else if (
      field === "amount" &&
      (value === "Custom" || value === "custom")
    ) {
      obj[contributionType].customAmount = "";
      // handleInputChange(section, `${contributionType}.customAmount`, "");
    } else if (
      field === "details" &&
      (value === "Custom" || value === "custom")
    ) {
      obj[contributionType].customDetails = "";
      // handleInputChange(section, `${contributionType}.customDetails`, "");
    } else if (
      field === "vesting" &&
      (value === "Custom" || value === "custom")
    ) {
      obj[contributionType].customVesting = "";
      // handleInputChange(section, `${contributionType}.customVesting`, "");
    } else if (
      field === "conditions" &&
      (value === "Custom" || value === "custom")
    ) {
      obj[contributionType].customConditions = "";
      // handleInputChange(section, `${contributionType}.customConditions`, "");
    }
    obj[contributionType][field] = value;
    setFormData((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof IPlanFormData],
        [contributionType]: {
          ...prev[section as keyof IPlanFormData][contributionType],
          ...obj[contributionType],
        },
      },
    }));
    // handleInputChange(section, `${contributionType}.${field}`, value);
  }

  // Function to handle select change with custom option
  function handleSelectChange(
    section: keyof IPlanFormData,
    nestedSection: string | null,
    field: string,
    value: string | "Email" | "Phone" | "Custom" | "None",
  ) {
    if (nestedSection) {
      handleNestedInputChange(section, nestedSection, field, value);
    } else {
      handleInputChange(section, field, value);
    }
  }

  // Function to handle contribution select change
  function handleContributionSelectChange(
    type: string,
    field: string,
    value: string,
  ) {
    if (value === "custom") {
      // Get current value to pre-populate the dialog
      const currentValue =
        (formData.employerContributions as any)[
          type as keyof typeof formData.employerContributions
        ][
          field as keyof (typeof formData.employerContributions)[keyof typeof formData.employerContributions]
        ] || "";

      setDialogType(`employerContributions.${type}`);
      setDialogField(field);
      setDialogValue(currentValue.toString());
      setShowDialog(true);
    } else {
      handleContributionInputChange(type as ContributionType, field, value);
    }
  }

  // Custom dialog functions
  function openDialog(
    section: string,
    nestedSection: string | null,
    field: string,
  ) {
    setDialogType(section);
    setDialogField(field);

    if (nestedSection) {
      setDialogValue(
        formData[section as keyof IPlanFormData][
          nestedSection as keyof (typeof formData)[keyof IPlanFormData]
        ][
          field as keyof (typeof formData)[keyof IPlanFormData][keyof (typeof formData)[keyof IPlanFormData]]
        ] || "",
      );
    } else {
      setDialogValue(
        formData[section as keyof IPlanFormData][
          field as keyof (typeof formData)[keyof IPlanFormData]
        ] || "",
      );
    }

    setShowDialog(true);
  }

  function openContributionDialog(type: string, field: string) {
    setDialogType(`employerContributions.${type}`);
    setDialogField(field);
    setDialogValue(
      (formData.employerContributions as any)[
        type as keyof typeof formData.employerContributions
      ][
        field as keyof (typeof formData.employerContributions)[keyof typeof formData.employerContributions]
      ] || "",
    );
    setShowDialog(true);
  }

  function saveDialog() {
    if (dialogType.includes(".")) {
      const [section, subsection] = dialogType.split(".");
      handleContributionInputChange(
        subsection as ContributionType,
        dialogField,
        dialogValue,
      );
    } else if (
      dialogType === "planDetails" &&
      dialogField === "customEnrollmentMethod"
    ) {
      handleNestedInputChange(
        dialogType,
        "employeeDeferrals",
        dialogField,
        dialogValue,
      );
    } else if (
      dialogType === "planDetails" &&
      dialogField.includes("eligibility")
    ) {
      handleNestedInputChange(
        dialogType,
        "eligibility",
        dialogField.replace("eligibility.", ""),
        dialogValue,
      );
    } else if (
      dialogType === "planDetails" &&
      dialogField.includes("employeeDeferrals")
    ) {
      handleNestedInputChange(
        dialogType,
        "employeeDeferrals",
        dialogField.replace("employeeDeferrals.", ""),
        dialogValue,
      );
    } else if (dialogType === "resources" && dialogField === "customFeature") {
      handleInputChange(dialogType, dialogField, dialogValue);
    } else if (
      dialogType === "resources" &&
      dialogField.includes("contactInformation")
    ) {
      handleNestedInputChange(
        dialogType,
        "contactInformation",
        dialogField.replace("contactInformation.", ""),
        dialogValue,
      );
    } else {
      // Handle other dialog saves
      handleInputChange(dialogType, dialogField, dialogValue);
    }

    setShowDialog(false);
  }
  async function handleSaveData() {
    setLoading(true);
    let generatedImagesResult: any = null;
    try {
      // Generate preview images first
      if (!hasImages()) {
        toast({
          description: "Generating preview images...",
        });
        setIsGeneratingImages(true);
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          // Generate all images using the new functions
          const imageDataUrls = await Promise.all([
            handleGenerateEligibilityImage(),
            handleGenerateEmployeeDeferralsImage(),
            handleGenerateEmployerContributionsImage(),
            handleGenerateInvestmentsImage(),
            handleGenerateResourcesImage(),
          ]);

          // Create an array of objects with keys and data URLs
          const imageDataArray = [
            { key: "eligibility", dataUrl: imageDataUrls[0] },
            { key: "employeeDeferrals", dataUrl: imageDataUrls[1] },
            { key: "employerContributions", dataUrl: imageDataUrls[2] },
            { key: "investments", dataUrl: imageDataUrls[3] },
            { key: "resources", dataUrl: imageDataUrls[4] },
          ];

          generatedImagesResult = await generateImagesFromDataUrls(
            imageDataArray,
            {
              width: 800,
              height: 600,
              quality: 0.9,
              format: "png",
            },
          );
        } catch (error) {
          let errorMessage = "Failed to generate preview images";
          if (error instanceof Error) {
            if (error.message.includes("No preview elements")) {
              errorMessage =
                "Preview sections are not ready. Please try again.";
            } else if (error.message.includes("upload")) {
              errorMessage = "Failed to upload images to server";
            } else if (error.message.includes("html2canvas")) {
              errorMessage = "Failed to capture preview sections";
            } else if (error.message.includes("dimensions")) {
              errorMessage =
                "Preview sections have no content. Please fill in some data first.";
            }
          }
          const shouldContinue = window.confirm(
            `${errorMessage}\n\nWould you like to continue without preview images?`,
          );
          if (!shouldContinue) {
            toast({
              variant: "destructive",
              description: errorMessage,
            });
            setLoading(false);
            setIsGeneratingImages(false);
            return false;
          }
          toast({
            description: "Continuing without preview images...",
          });
        } finally {
          setIsGeneratingImages(false);
        }
      }
      // Ensure we have a valid previewImages object even if generation failed
      let finalPreviewImages = generatedImagesResult || previewImages;
      if (
        !finalPreviewImages ||
        Object.values(finalPreviewImages).every((img) => img === null)
      ) {
        finalPreviewImages = {
          branding: null,
          eligibility: null,
          employeeDeferrals: null,
          employerContributions: null,
          investments: null,
          resources: null,
        };
      }
      // Use the new image-based API
      const payload = {
        companyName: formData.branding.companyName,
        planName: formData.branding.planName,
        planType: formData.planDetails.planType,
        accentColor: formData.branding.accentColor,
        accentColorImage: formData.branding.accentColorImage,
        avatarId: formData.branding.avatarId,
        previewImages: finalPreviewImages,
        planId: formData.resources.contactInformation.planId,
        qrUrl: formData.resources.qrUrl,
        disclaimer: disclaimers,
      };
      if (filesUpload?.companyLogo instanceof File) {
        try {
          const uploadRes = await axios.postForm(`/api/files/upload`, {
            file: filesUpload?.companyLogo,
          });
          // @ts-expect-error: companyLogo is added dynamically to payload
          payload.companyLogo = uploadRes?.data?.url;
        } catch (error) {
          console.error("Error uploading company logo:", error);
          // Continue with the process even if logo upload fails
        }
      }

      if (filesUpload?.backgroundImage instanceof File) {
        try {
          const uploadRes = await axios.postForm(`/api/files/upload`, {
            file: filesUpload?.backgroundImage,
          });
          // @ts-expect-error: backgroundImage is added dynamically to payload
          payload.backgroundImage = uploadRes?.data?.url;
        } catch (error) {
          console.error("Error uploading background image:", error);
          // Continue with the process even if background image upload fails
        }
      }
      try {
        const response = await axios.post(
          `/api/plans/create-plan-with-images`,
          payload,
        );
        setIsComplete(true);
        router.push(
          `/loading-plan${
            formData.branding.avatarChoice === "custom"
              ? "?customAvatar=true"
              : ""
          }`,
        );
        return true;
      } catch (error) {
        toast({
          variant: "destructive",
          description: "Failed to create plan",
        });
        return false;
      }
    } catch (error) {
      console.error("handleSaveData.create", error);
      toast({
        variant: "destructive",
        description: "Failed to create plan",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Navigation functions
  // Fix the employer contributions navigation issue
  // Find the nextSection function and update it to properly handle tab navigation
  // Replace the nextSection function with this improved version:

  async function nextSection() {
    let isValid = false;
    if (currentSection === 1) {
      markSectionAsTouched("branding");
      isValid = validateBranding();
    } else if (currentSection === 2) {
      markSectionAsTouched("planDetails");
      isValid = validatePlanDetails();
    } else if (currentSection === 3) {
      markSectionAsTouched("employerContributions");
      isValid = validateEmployerContributions();

      // If we have multiple contribution types, make sure we've set the active tab
      if (
        isValid &&
        formData.employerContributions.hasContributions &&
        formData.employerContributions.contributionTypes.length > 1
      ) {
        // Find the primary contribution type
        const primaryType =
          formData.employerContributions.contributionTypes.find(
            (type) =>
              (formData.employerContributions as any)[
                type as keyof typeof formData.employerContributions
              ].isPrimary,
          );

        // Set the active tab to the primary contribution type
        if (primaryType) {
          setActiveTab(primaryType);
        } else if (
          formData.employerContributions.contributionTypes.length > 0
        ) {
          setActiveTab(formData.employerContributions.contributionTypes[0]);
        }
      }
    } else if (currentSection === 4) {
      markSectionAsTouched("investments");
      isValid = validateInvestments();
    } else if (currentSection === 5) {
      markSectionAsTouched("resources");
      isValid = validateResources();
      if (isValid && isDisclaimersStep) {
        const created = await handleSaveData();
        if (!created) {
          return;
        }
      }
    }

    if (isValid || currentSection === 5) {
      // Scroll to top immediately
      scrollToTop();

      // Then start the animation
      setAnimating(true);
      setTimeout(() => {
        if (currentSection < 5) {
          if (currentSection === 2 && !isEmployeeDeferralsSection) {
            setIsEmployeeDeferralsSection(true);
          } else {
            setCurrentSection(currentSection + 1);
            updateActiveTab(currentSection + 1);
          }
        }
        setAnimating(false);
      }, 300);
    }
  }

  // Update the prevSection function to set previewMode to true when going back to step 1
  function prevSection() {
    if (currentSection >= 1) {
      // Scroll to top immediately
      scrollToTop();

      // Then start the animation
      setAnimating(true);
      setTimeout(() => {
        if (currentSection === 2 && isEmployeeDeferralsSection) {
          setSectionReview((prev) => ({
            ...prev,
            employeeDeferrals: false,
          }));
          setIsEmployeeDeferralsSection(false);
          return;
        }
        // Reset the section review state for the current section
        if ((sectionReview as any)[formSteps[currentSection - 1].id]) {
          setSectionReview((prev) => ({
            ...prev,
            [formSteps[currentSection - 1].id]: false,
          }));
        } else {
          setSectionReview((prev) => ({
            ...prev,
            [formSteps[currentSection - 1].id]: false,
          }));
          setCurrentSection(currentSection - 1);
          updateActiveTab(currentSection - 1);
        }
        setAnimating(false);
      }, 300);
    }
  }

  function updateActiveTab(section: number) {
    switch (section) {
      case 1:
        setActiveTab("branding");
        break;
      case 2:
        setActiveTab("planDetails");
        break;
      case 3:
        setActiveTab("employerContributions");
        break;
      case 4:
        setActiveTab("investments");
        break;
      case 5:
        setActiveTab("resources");
        break;
      default:
        setActiveTab("branding");
    }
  }

  function resetForm() {
    setFormData({
      branding: {
        companyName: "",
        planName: "",
        companyLogo: "",
        accentColor: "",
        backgroundImage: "",
        avatarChoice: "",
        avatarId: "",
      },
      planDetails: {
        planType: "401k",
        eligibility: {
          ageRequirement: "21",
          serviceRequirement: "3months",
          entryDate: "firstOfMonth",
        },
        employeeDeferrals: {
          autoEnrollment: null,
          enrollmentRate: "",
          autoEscalation: "",
          deferralCap: "",
          enrollmentMethods: [],
          customEnrollmentMethod: "",
        },
        rothOption: null,
      },
      employerContributions: {
        hasContributions: null,
        hasAdditionalContributions: null,
        contributionTypes: [],
        primaryContributionType: null,
        companyMatch: {
          isPrimary: true,
          formula: "",
          customFormula: "",
          limit: "",
          customLimit: "",
          vesting: "Immediate",
          customVesting: "",
        },
        safeHarbor: {
          isPrimary: false,
          type: "Basic Match",
          customType: "",
          formula: "",
          customFormula: "",
          limit: "",
          customLimit: "",
          vesting: "Immediate",
        },
        fixedAmount: {
          isPrimary: false,
          amount: "",
          customAmount: "",
          percentageAmount: "",
          details: "",
          customDetails: "",
          vesting: "Immediate",
          customVesting: "",
        },
        profitSharing: {
          isPrimary: false,
          details: "",
          customDetails: "",
          conditions: "",
          customConditions: "",
          vesting: "Immediate",
          customVesting: "",
        },
      },
      investments: {
        investmentOptions: ["Target Date Funds"],
      },
      resources: {
        planFeatures: [],
        customFeature: "",
        contactInformation: {
          primaryType: "None",
          primaryTypeCustom: "",
          primaryName: "",
          primaryEmail: "",
          primaryPhone: "",
          secondaryType: "None",
          secondaryTypeCustom: "",
          secondaryName: "",
          secondaryEmail: "",
          secondaryPhone: "",
          tertiaryType: "None",
          tertiaryName: "",
          tertiaryEmail: "",
          tertiaryPhone: "",
          planId: "",
          tertiaryTypeCustom: "",
        },
        qrLinkGenerated: false,
        qrUrl: "",
        financialPlanning: false,
        disclaimer: [],
      },
    });
    setCurrentSection(1);
    setActiveTab("branding");
    setIsComplete(false);
  }

  // Validation functions
  function validateBranding() {
    const newErrors: Record<string, string> = {};

    if (!formData.branding.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }

    if (!formData.branding.companyLogo) {
      newErrors.companyLogo = "Company logo is required";
    }

    // Brand color validation (optional)
    if (
      formData.branding.accentColor &&
      !/^#([0-9A-F]{3}){1,2}$/i.test(formData.branding.accentColor)
    ) {
      newErrors.accentColor = "Please select a valid accent color.";
    }

    setErrors((prev) => ({ ...prev, branding: newErrors }));
    return Object.keys(newErrors).length === 0;
  }

  function validatePlanDetails(newFormData?: IPlanFormData) {
    const formDataToValidate = newFormData || formData;
    const newErrors: Record<string, string> = {};

    if (!isEmployeeDeferralsSection) {
      if (!formDataToValidate.planDetails.planType) {
        newErrors.planType = "Plan type is required";
      }

      if (!formDataToValidate.planDetails.eligibility.ageRequirement) {
        newErrors.ageRequirement = "Age requirement is required";
      }

      if (!formDataToValidate.planDetails.eligibility.serviceRequirement) {
        newErrors.serviceRequirement = "Service requirement is required";
      }

      if (!formDataToValidate.planDetails.eligibility.entryDate) {
        newErrors.entryDate = "Entry date is required";
      }
    } else {
      if (
        formDataToValidate.planDetails.employeeDeferrals.autoEnrollment === null
      ) {
        newErrors.autoEnrollment = "Auto enrollment selection is required";
      } else if (
        formDataToValidate.planDetails.employeeDeferrals.autoEnrollment === true
      ) {
        if (!formDataToValidate.planDetails.employeeDeferrals.enrollmentRate) {
          newErrors.enrollmentRate = "Enrollment rate is required";
        }
      } else {
        const enrollmentMethods =
          formDataToValidate.planDetails.employeeDeferrals.enrollmentMethods;
        if (!enrollmentMethods || enrollmentMethods.length === 0) {
          newErrors.enrollmentMethods =
            "At least one enrollment method is required";
        }

        if (
          enrollmentMethods?.includes("custom") &&
          !formDataToValidate.planDetails.employeeDeferrals
            .customEnrollmentMethod
        ) {
          newErrors.customEnrollmentMethod =
            "Custom enrollment method description is required";
        }
      }
      if (formDataToValidate.planDetails.rothOption === null) {
        newErrors.rothOption = "Roth option selection is required";
      }
    }
    setErrors((prev) => ({ ...prev, planDetails: newErrors }));
    return Object.keys(newErrors).length === 0;
  }

  function validateEmployerContributions() {
    const newErrors: Record<string, string> = {};

    if (formData.employerContributions.hasContributions === null) {
      newErrors.hasContributions =
        "Please indicate if the company makes contributions";
    } else if (formData.employerContributions.hasContributions === true) {
      if (formData.employerContributions.contributionTypes.length === 0) {
        newErrors.contributionTypes =
          "At least one contribution type is required";
      }

      // Validate hasAdditionalContributions if primary contribution is selected
      if (
        formData.employerContributions.contributionTypes.length === 1 &&
        formData.employerContributions.hasAdditionalContributions === null
      ) {
        newErrors.hasAdditionalContributions =
          "Please indicate if there are additional contributions beyond the primary contribution";
      }

      // Validate each selected contribution type
      formData.employerContributions.contributionTypes.forEach((type) => {
        if (type === "companyMatch") {
          if (!formData.employerContributions.companyMatch.formula) {
            newErrors.companyMatchFormula = "Match formula is required";
          }
          if (!formData.employerContributions.companyMatch.limit) {
            newErrors.companyMatchLimit = "Match limit is required";
          }
        } else if (type === "safeHarbor") {
          if (!formData.employerContributions.safeHarbor.formula) {
            newErrors.safeHarborFormula = "Safe Harbor formula is required";
          }
          if (!formData.employerContributions.safeHarbor.limit) {
            newErrors.safeHarborLimit = "Safe Harbor limit is required";
          }
        } else if (type === "fixedAmount") {
          if (!formData.employerContributions.fixedAmount.amount) {
            newErrors.fixedAmountAmount = "Fixed amount is required";
          }
          if (!formData.employerContributions.fixedAmount.details) {
            newErrors.fixedAmountDetails = "Fixed amount details are required";
          }
        } else if (type === "profitSharing") {
          if (!formData.employerContributions.profitSharing.details) {
            newErrors.profitSharingDetails =
              "Profit sharing details are required";
          }
          if (!formData.employerContributions.profitSharing.conditions) {
            newErrors.profitSharingConditions =
              "Profit sharing conditions are required";
          }
        }
      });
    }

    setErrors((prev) => ({ ...prev, employerContributions: newErrors }));
    return Object.keys(newErrors).length === 0;
  }

  function validateInvestments() {
    const newErrors: Record<string, string> = {};
    if (formData.investments.investmentOptions.length === 0) {
      newErrors.investmentOptions = "Please select an investment option";
    }

    if (
      formData.resources.planFeatures.includes("custom") &&
      !formData.resources.customFeature
    ) {
      newErrors.customFeature = "Custom feature description is required";
    }

    setErrors((prev) => ({ ...prev, investments: newErrors }));
    return Object.keys(newErrors).length === 0;
  }

  function validateResources() {
    const errors = {} as any;

    // Validate financial planning
    if (formData.resources.financialPlanning === null) {
      errors.financialPlanning =
        "Please select if you offer financial planning";
    }

    // Validate primary contact
    if (!formData.resources.contactInformation.primaryType) {
      errors.primaryType = "Primary contact type is required";
    }
    if (
      formData.resources.contactInformation.primaryType === "Custom" &&
      !formData.resources.contactInformation.primaryTypeCustom
    ) {
      errors.primaryTypeCustom = "Custom primary contact type is required";
    }
    if (!formData.resources.contactInformation.primaryName) {
      errors.primaryName = "Primary contact name is required";
    }
    if (!formData.resources.contactInformation.primaryEmail) {
      errors.primaryEmail = "Primary contact email is required";
    }
    if (!formData.resources.contactInformation.primaryPhone) {
      errors.primaryPhone = "Primary contact phone is required";
    }

    // Validate secondary contact if provided
    if (formData.resources.contactInformation.secondaryName) {
      if (!formData.resources.contactInformation.secondaryType) {
        errors.secondaryType = "Secondary contact type is required";
      }
      if (
        formData.resources.contactInformation.secondaryType === "Custom" &&
        !formData.resources.contactInformation.secondaryTypeCustom
      ) {
        errors.secondaryTypeCustom =
          "Custom secondary contact type is required";
      }
      if (
        !formData.resources.contactInformation.secondaryEmail &&
        formData.resources.contactInformation?.secondaryType === "Email"
      ) {
        errors.secondaryEmail = "Secondary contact email is required";
      }
      if (
        !formData.resources.contactInformation.secondaryPhone &&
        formData.resources.contactInformation?.secondaryType === "Phone"
      ) {
        errors.secondaryPhone = "Secondary contact phone is required";
      }
    }

    // Validate tertiary contact if provided
    if (formData.resources.contactInformation.tertiaryName) {
      if (
        formData.resources.contactInformation.tertiaryType === "Custom" &&
        !formData.resources.contactInformation.tertiaryTypeCustom
      ) {
        errors.tertiaryTypeCustom = "Custom tertiary contact type is required";
      }
      if (!formData.resources.contactInformation.tertiaryType) {
        errors.tertiaryType = "Tertiary contact type is required";
      }
      if (
        !formData.resources.contactInformation.tertiaryEmail &&
        formData.resources.contactInformation?.tertiaryType === "Email"
      ) {
        errors.tertiaryEmail = "Tertiary contact email is required";
      }
      if (
        !formData.resources.contactInformation.tertiaryPhone &&
        formData.resources.contactInformation?.tertiaryType === "Phone"
      ) {
        errors.tertiaryPhone = "Tertiary contact phone is required";
      }
    }

    // Validate QR code if generated
    if (formData.resources.qrLinkGenerated && !formData.resources.qrUrl) {
      errors.qrUrl = "QR URL is required when QR code is generated";
    }

    if (!formData.resources.contactInformation.planId) {
      errors.planId = "Plan ID is required when QR code is generated";
    }

    setErrors((prev) => ({ ...prev, resources: errors }));
    return Object.keys(errors).length === 0;
  }

  // Function to mark all fields in a section as touched
  function markSectionAsTouched(section: string) {
    const touchedFields: Record<string, boolean> = {};

    if (section === "branding") {
      touchedFields.companyName = true;
      touchedFields.companyLogo = true;
      touchedFields.accentColor = true;
    } else if (section === "planDetails") {
      touchedFields.planType = true;
      touchedFields.ageRequirement = true;
      touchedFields.serviceRequirement = true;
      touchedFields.entryDate = true;
      touchedFields.autoEnrollment = true;
      touchedFields.enrollmentRate = true;
      touchedFields.enrollmentMethods = true;
      touchedFields.customEnrollmentMethod = true;
      touchedFields.rothOption = true;
    } else if (section === "employerContributions") {
      touchedFields.hasContributions = true;
      touchedFields.hasAdditionalContributions = true;
      touchedFields.contributionTypes = true;
      touchedFields.companyMatchFormula = true;
      touchedFields.companyMatchLimit = true;
      touchedFields.safeHarborFormula = true;
      touchedFields.safeHarborLimit = true;
      touchedFields.fixedAmountAmount = true;
      touchedFields.fixedAmountDetails = true;
      touchedFields.profitSharingDetails = true;
      touchedFields.profitSharingConditions = true;
    } else if (section === "investments") {
      touchedFields.investmentOptions = true;
      touchedFields.customFeature = true;
    } else if (section === "resources") {
      touchedFields.primaryType = true;
      touchedFields.primaryTypeCustom = true;
      touchedFields.primaryName = true;
      touchedFields.primaryEmail = true;
      touchedFields.primaryPhone = true;
      touchedFields.secondaryType = true;
      touchedFields.secondaryTypeCustom = true;
      touchedFields.secondaryName = true;
      touchedFields.secondaryEmail = true;
      touchedFields.secondaryPhone = true;
      touchedFields.tertiaryType = true;
      touchedFields.tertiaryTypeCustom = true;
      touchedFields.tertiaryName = true;
      touchedFields.tertiaryEmail = true;
      touchedFields.tertiaryPhone = true;
    }

    setTouched((prev) => ({ ...prev, [section]: touchedFields }));
  }

  function handleBlur(section: string, field: string) {
    setTouched((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: true,
      },
    }));

    // Validate the specific section when a field is blurred
    if (section === "branding") {
      validateBranding();
    } else if (section === "planDetails") {
      validatePlanDetails();
    } else if (section === "employerContributions") {
      validateEmployerContributions();
    } else if (section === "investments") {
      validateInvestments();
    } else if (section === "resources") {
      validateResources();
    }
  }

  // Handle file upload
  function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>,
    field: string,
  ) {
    const file = event.target.files?.[0];
    if (file) {
      // Check if file is WebP format
      if (file.type === "image/webp") {
        toast({
          variant: "destructive",
          description:
            "WebP format is not supported. Please use PNG or JPG format.",
        });
        return;
      }

      // Check if file is a supported image format
      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          description: "Please select a valid image file (PNG, JPG, JPEG).",
        });
        return;
      }

      // In a real app, you would upload the file to a server and get a URL back
      // For this demo, we'll just use a placeholder
      setFilesUpload({ ...filesUpload, [field]: file });
      handleInputChange("branding", field, URL.createObjectURL(file));
    }
  }

  // Update the handlePreview function
  function handlePreview() {
    if (validateBranding()) {
      scrollToTop();
      setPreviewMode(true);
    } else {
      markSectionAsTouched("branding");
    }
  }

  // Update the renderCurrentSection function to handle the preview mode
  function renderCurrentSection() {
    if (isComplete) {
      return (
        <div className="text-center py-10 animate-celebrate">
          <div className="w-32 h-32 mx-auto mb-4">
            <CompletionAnimation />
          </div>
          <h2 className="text-2xl font-semibold text-teal-700 mb-4">
            Setup Complete!
          </h2>
          <p className="text-gray-600 mb-6">
            Your retirement plan has been successfully configured.
          </p>
          <Button onClick={resetForm}>Create Another Plan</Button>
        </div>
      );
    }

    // Special case: When generating images, render all preview components in a hidden container
    if (isGeneratingImages) {
      return (
        <div className="fixed inset-0 -z-10 opacity-0 pointer-events-none">
          {/* Branding Preview */}
          <BrandingPreview
            ref={previewRefs.branding}
            companyName={formData.branding.companyName}
            planName={formData.branding.planName}
            companyLogo={formData.branding.companyLogo}
            accentColor={formData.branding.accentColor}
            accentColorImage={formData.branding.accentColorImage}
            backgroundImage={formData.branding.backgroundImage}
            avatarChoice={formData.branding.avatarChoice}
            logoSize={logoSize}
            onEdit={() => {}}
            onConfirm={() => {}}
            imageOnly={true}
          />

          {/* Employee Deferrals Preview */}
          <EmployeeDeferrerPreview
            ref={previewRefs.employeeDeferrals}
            employeeDeferrals={formData?.planDetails?.employeeDeferrals}
            brandColor={formData?.branding?.accentColor}
            backgroundImage={formData?.branding?.backgroundImage}
            avatarChoice={formData?.branding?.avatarChoice}
            onEdit={() => {}}
            onConfirm={() => {}}
            imageOnly={true}
          />

          {/* Eligibility Preview */}
          <EligibilityPreview
            ref={previewRefs.eligibility}
            eligibility={formData?.planDetails?.eligibility}
            brandColor={formData?.branding?.accentColor}
            backgroundImage={formData?.branding?.backgroundImage}
            avatarChoice={formData?.branding?.avatarChoice}
            onEdit={() => {}}
            onConfirm={() => {}}
            imageOnly={true}
          />

          {/* Employer Contributions Preview */}
          <EmployerContributionsPreview
            ref={previewRefs.employerContributions}
            employerContributions={formData?.employerContributions}
            brandColor={formData?.branding?.accentColor}
            backgroundImage={formData?.branding?.backgroundImage}
            avatarChoice={formData?.branding?.avatarChoice}
            onEdit={() => {}}
            onConfirm={() => {}}
            imageOnly={true}
          />

          {/* Investments Preview */}
          <InvestmentsPreview
            ref={previewRefs.investments}
            investments={formData?.investments}
            resources={formData?.resources}
            brandColor={formData?.branding?.accentColor}
            backgroundImage={formData?.branding?.backgroundImage}
            avatarChoice={formData?.branding?.avatarChoice}
            onEdit={() => {}}
            onConfirm={() => {}}
            imageOnly={true}
          />

          {/* Resources Preview */}
          <ResourcesPreview
            ref={previewRefs.resources}
            resources={formData?.resources}
            branding={formData?.branding}
            brandColor={formData?.branding?.accentColor}
            backgroundImage={formData?.branding?.backgroundImage}
            avatarChoice={formData?.branding?.avatarChoice}
            onEdit={() => {}}
            onConfirm={() => {}}
            imageOnly={true}
          />
        </div>
      );
    }

    // Add the animate-slideIn class to each section
    const animationClass = "animate-slideIn";

    switch (currentSection) {
      case 1:
        if (previewMode) {
          if (!showLogoResizePreview) {
            return (
              <div className={animationClass}>
                <LogoResizePreview
                  ref={previewRefs.branding}
                  companyName={formData.branding.companyName}
                  planName={formData.branding.planName}
                  companyLogo={formData.branding.companyLogo}
                  accentColor={formData.branding.accentColor}
                  accentColorImage={formData.branding.accentColorImage}
                  backgroundImage={formData.branding.backgroundImage}
                  avatarChoice={formData.branding.avatarChoice}
                  onBack={() => {
                    scrollToTop();
                    setPreviewMode(false);
                    setSectionReview({ ...sectionReview, branding: false });
                  }}
                  onConfirm={(newLogoSize) => {
                    setLogoSize(newLogoSize);
                    setShowLogoResizePreview(true);
                  }}
                />
              </div>
            );
          }
          return (
            <div className={animationClass}>
              <BrandingPreview
                ref={previewRefs.branding}
                companyName={formData.branding.companyName}
                planName={formData.branding.planName}
                companyLogo={formData.branding.companyLogo}
                accentColor={formData.branding.accentColor}
                accentColorImage={formData.branding.accentColorImage}
                backgroundImage={formData.branding.backgroundImage}
                avatarChoice={formData.branding.avatarChoice}
                logoSize={logoSize}
                onEdit={() => {
                  setShowLogoResizePreview(false);
                }}
                onConfirm={() => {
                  scrollToTop();
                  setPreviewMode(false);
                  setSectionReview({ ...sectionReview, branding: true });
                  nextSection();
                }}
              />
            </div>
          );
        }
        return sectionReview.branding ? (
          <div className={animationClass}>
            <BrandingPreview
              ref={previewRefs.branding}
              companyName={formData.branding.companyName}
              planName={formData.branding.planName}
              companyLogo={formData.branding.companyLogo}
              accentColor={formData.branding.accentColor}
              accentColorImage={formData.branding.accentColorImage}
              backgroundImage={formData.branding.backgroundImage}
              avatarChoice={formData.branding.avatarChoice}
              logoSize={logoSize}
              onEdit={() => {
                setShowLogoResizePreview(false);
                setPreviewMode(true);
              }}
              onConfirm={nextSection}
            />
          </div>
        ) : (
          <div className={animationClass}>
            <BrandingSection
              formData={formData}
              handleInputChange={handleInputChange}
              handleBlur={handleBlur}
              handleFileUpload={handleFileUpload}
              handlePreview={handlePreview}
              touched={touched}
              errors={errors}
              fileInputRef={fileInputRef}
              backgroundFileInputRef={backgroundFileInputRef}
              avatarOptions={avatarOptions}
              showAllAvatars={showAllAvatars}
              setShowAllAvatars={setShowAllAvatars}
            />
          </div>
        );
      case 2:
        if (sectionReview.employeeDeferrals) {
          return (
            <div className="space-y-4">
              <EmployeeDeferrerPreview
                ref={previewRefs.employeeDeferrals}
                employeeDeferrals={formData?.planDetails?.employeeDeferrals}
                brandColor={formData?.branding?.accentColor}
                backgroundImage={formData?.branding?.backgroundImage}
                avatarChoice={formData?.branding?.avatarChoice}
                onEdit={() => {
                  scrollToTop();
                  setPreviewMode(false);
                  setSectionReview({
                    ...sectionReview,
                    employeeDeferrals: false,
                  });
                }}
                onConfirm={() => {
                  scrollToTop();
                  setPreviewMode(false);
                  setSectionReview({
                    ...sectionReview,
                    employeeDeferrals: true,
                  });
                  nextSection();
                }}
              />

              {/* Add image generation button */}
              {/* <div className="flex justify-center">
                <Button
                  onClick={handleGenerateEmployeeDeferralsImage}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Generate Employee Deferrals Image (PNG)
                </Button>
              </div> */}
            </div>
          );
        }
        if (sectionReview.eligibility && !isEmployeeDeferralsSection) {
          return (
            <div className="space-y-4">
              <EligibilityPreview
                ref={previewRefs.eligibility}
                eligibility={formData?.planDetails?.eligibility}
                brandColor={formData?.branding?.accentColor}
                backgroundImage={formData?.branding?.backgroundImage}
                avatarChoice={formData?.branding?.avatarChoice}
                onEdit={() => {
                  scrollToTop();
                  setPreviewMode(false);
                  setSectionReview({ ...sectionReview, eligibility: false });
                }}
                onConfirm={() => {
                  scrollToTop();
                  setPreviewMode(false);
                  setSectionReview({ ...sectionReview, eligibility: true });
                  setIsEmployeeDeferralsSection(true);
                  nextSection();
                }}
              />

              {/* Add image generation button */}
              {/* <div className="flex justify-center">
                <Button
                  onClick={handleGenerateEligibilityImage}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Generate Eligibility Image (PNG)
                </Button>
              </div> */}
            </div>
          );
        }

        return (
          <div className={animationClass}>
            <PlanDetailSection
              formData={formData}
              touched={touched}
              errors={errors}
              openDialog={openDialog}
              handleInputChange={handleInputChange}
              handleSelectChange={handleSelectChange}
              handleNestedInputChange={handleNestedInputChange}
              handleCheckboxChange={handleCheckboxChange}
              handleRadioInputChange={handleRadioInputChange}
              scrollToTop={scrollToTop}
              markSectionAsTouched={markSectionAsTouched}
              handleBlur={handleBlur}
              prevSection={prevSection}
              validatePlanDetails={validatePlanDetails}
              setSectionReview={setSectionReview}
              isEmployeeDeferralsSection={isEmployeeDeferralsSection}
            />
          </div>
        );
      case 3:
        return sectionReview.employerContributions ? (
          <div className={animationClass}>
            <EmployerContributionsReview
              ref={previewRefs.employerContributions}
              formData={formData}
              prevSection={prevSection}
              scrollToTop={scrollToTop}
              nextSection={nextSection}
              markSectionAsTouched={markSectionAsTouched}
              validatePlanDetails={validatePlanDetails}
              validateEmployerContributions={validateEmployerContributions}
              setSectionReview={setSectionReview}
              backgroundImage={formData?.branding?.backgroundImage}
              brandColor={formData?.branding?.accentColor}
              avatarChoice={formData?.branding?.avatarChoice}
            />

            {/* Add image generation button */}
            {/* <div className="flex justify-center mt-4">
              <Button
                onClick={handleGenerateEmployerContributionsImage}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Generate Employer Contributions Image (PNG)
              </Button>
            </div> */}
          </div>
        ) : (
          <div className={animationClass}>
            <EmployerContributionsSection
              formData={formData}
              handleInputChange={handleInputChange}
              errors={errors}
              setTouched={setTouched}
              setFormData={setFormData}
              validateEmployerContributions={validateEmployerContributions}
              prevSection={prevSection}
              markSectionAsTouched={markSectionAsTouched}
              handleContributionInputChange={handleContributionInputChange}
              setSectionReview={setSectionReview}
              scrollToTop={scrollToTop}
            />
          </div>
        );
      case 4:
        return sectionReview.investments ? (
          <div className={animationClass}>
            <InvestmentsReview
              ref={previewRefs.investments}
              formData={formData}
              prevSection={prevSection}
              scrollToTop={scrollToTop}
              nextSection={nextSection}
              markSectionAsTouched={markSectionAsTouched}
              validateInvestments={validateInvestments}
              setSectionReview={setSectionReview}
              backgroundImage={formData?.branding?.backgroundImage}
              brandColor={formData?.branding?.accentColor}
              avatarChoice={formData?.branding?.avatarChoice}
            />

            {/* Add image generation button */}
            {/* <div className="flex justify-center mt-4">
              <Button
                onClick={handleGenerateInvestmentsImage}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Generate Investments Image (PNG)
              </Button>
            </div> */}
          </div>
        ) : (
          <div className={animationClass}>
            <InvestmentsSection
              formData={formData}
              errors={errors}
              touched={touched}
              scrollToTop={scrollToTop}
              markSectionAsTouched={markSectionAsTouched}
              handleInputChange={handleInputChange}
              validateInvestments={validateInvestments}
              prevSection={prevSection}
              handleCheckboxChange={handleCheckboxChange}
              openDialog={openDialog}
              handleBlur={handleBlur}
              setSectionReview={setSectionReview}
            />
          </div>
        );
      case 5:
        if (isDisclaimersStep) {
          return (
            <div className={animationClass}>
              <DisclaimerReview
                isLoading={loading}
                disclaimers={disclaimers}
                scrollToTop={scrollToTop}
                nextSection={nextSection}
                setIsDisclaimersStep={setIsDisclaimersStep}
              />
            </div>
          );
        }

        if (sectionReview.resources) {
          return (
            <div className={animationClass}>
              <ResourcesReview
                ref={previewRefs.resources}
                isLoading={loading}
                formData={formData}
                prevSection={prevSection}
                setIsDisclaimersStep={setIsDisclaimersStep}
                scrollToTop={scrollToTop}
                nextSection={nextSection}
                validateResources={validateResources}
                markSectionAsTouched={markSectionAsTouched}
                setSectionReview={setSectionReview}
                backgroundImage={formData?.branding?.backgroundImage}
                avatarChoice={formData?.branding?.avatarChoice}
              />

              {/* Add image generation button */}
              {/* <div className="flex justify-center mt-4">
                <Button
                  onClick={handleGenerateResourcesImage}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Generate Resources Image (PNG)
                </Button>
              </div> */}
            </div>
          );
        }

        return (
          <div className={animationClass}>
            <ResourcesSection
              formData={formData}
              errors={errors}
              touched={touched}
              scrollToTop={scrollToTop}
              validateResources={validateResources}
              handleNestedInputChange={handleNestedInputChange}
              markSectionAsTouched={markSectionAsTouched}
              handleInputChange={handleInputChange}
              handleSelectChange={handleSelectChange}
              setSectionReview={setSectionReview}
              prevSection={prevSection}
              handleBlur={handleBlur}
            />
          </div>
        );

      default:
        return (
          <div className={animationClass}>
            <BrandingSection
              formData={formData}
              handleInputChange={handleInputChange}
              handleBlur={handleBlur}
              handleFileUpload={handleFileUpload}
              handlePreview={handlePreview}
              touched={touched}
              errors={errors}
              fileInputRef={fileInputRef}
              backgroundFileInputRef={backgroundFileInputRef}
              avatarOptions={avatarOptions}
              showAllAvatars={showAllAvatars}
              setShowAllAvatars={setShowAllAvatars}
            />
          </div>
        );
    }
  }

  // Function to generate eligibility image
  const handleGenerateEligibilityImage = async (): Promise<string> => {
    try {
      const eligibilityData = {
        ageRequirement: formData.planDetails.eligibility.ageRequirement,
        customAgeRequirement:
          formData.planDetails.eligibility.customAgeRequirement,
        serviceRequirement: formData.planDetails.eligibility.serviceRequirement,
        customServiceRequirement:
          formData.planDetails.eligibility.customServiceRequirement,
        entryDate: formData.planDetails.eligibility.entryDate,
        customEntryDate: formData.planDetails.eligibility.customEntryDate,
      };

      const imageDataUrl = await generateEligibilityImage(
        eligibilityData,
        formData.branding.accentColor,
      );
      return imageDataUrl;
    } catch (error) {
      console.error("Error generating eligibility image:", error);
      throw error;
    }
  };

  // Function to generate employee deferrals image
  const handleGenerateEmployeeDeferralsImage = async (): Promise<string> => {
    try {
      const deferralsData = {
        autoEnrollment: formData.planDetails.employeeDeferrals.autoEnrollment,
        autoEscalation: formData.planDetails.employeeDeferrals.autoEscalation,
        customEnrollmentMethod:
          formData.planDetails.employeeDeferrals.customEnrollmentMethod,
        deferralCap: formData.planDetails.employeeDeferrals.deferralCap,
        enrollmentRate: formData.planDetails.employeeDeferrals.enrollmentRate,
        enrollmentMethods:
          formData.planDetails.employeeDeferrals.enrollmentMethods,
        customEnrollmentRate:
          formData.planDetails.employeeDeferrals.customEnrollmentRate,
        customAutoEscalation:
          formData.planDetails.employeeDeferrals.customAutoEscalation,
        customDeferralCap:
          formData.planDetails.employeeDeferrals.customDeferralCap,
      };

      const imageDataUrl = await generateEmployeeDeferralsImage(
        deferralsData,
        formData.branding.accentColor,
      );
      return imageDataUrl;
    } catch (error) {
      console.error("Error generating employee deferrals image:", error);
      throw error;
    }
  };

  // Function to generate employer contributions image
  const handleGenerateEmployerContributionsImage =
    async (): Promise<string> => {
      try {
        const contributionsData = formData.employerContributions;

        const imageDataUrl = await generateEmployerContributionsImage(
          contributionsData,
          formData.branding.accentColor,
        );
        return imageDataUrl;
      } catch (error) {
        console.error("Error generating employer contributions image:", error);
        throw error;
      }
    };

  // Function to generate investments image
  const handleGenerateInvestmentsImage = async (): Promise<string> => {
    try {
      const investmentsData = {
        investmentOptions: formData.investments.investmentOptions,
        planFeatures: formData.resources.planFeatures,
        customFeature: formData.resources.customFeature,
      };

      const imageDataUrl = await generateInvestmentsImage(
        investmentsData,
        formData.branding.accentColor,
      );
      return imageDataUrl;
    } catch (error) {
      console.error("Error generating investments image:", error);
      throw error;
    }
  };

  // Function to generate resources image
  const handleGenerateResourcesImage = async (): Promise<string> => {
    try {
      const resourcesData = {
        contactInformation: formData.resources.contactInformation,
        qrUrl: formData.resources.qrUrl,
      };

      const imageDataUrl = await generateResourcesImage(
        resourcesData,
        formData.branding.accentColor,
      );
      return imageDataUrl;
    } catch (error) {
      console.error("Error generating resources image:", error);
      throw error;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <CustomAvatarModal
        showCustomAvatarModal={showCustomAvatarModal}
        customAvatarFileInputRef={customAvatarFileInputRef}
        customAvatarData={customAvatarData}
        setCustomAvatarData={setCustomAvatarData}
        setShowCustomAvatarModal={setShowCustomAvatarModal}
        setFormData={setFormData}
      />
      <div className="max-w-4xl mx-auto w-full px-4 py-8">
        <div className="relative mb-8">
          {/* Progress bar line */}
          <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 dark:bg-[#1c1c1c]">
            <div
              className="absolute top-0 left-0 h-1 bg-[#005F73]"
              style={{ width: `${(currentSection - 1) * 25}%` }}
            ></div>
          </div>

          {/* Image generation progress indicator */}
          {isGeneratingImages && (
            <div className="absolute top-12 left-0 right-0 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">
                  Generating preview images...{" "}
                  {Math.round(imageGenerationProgress)}%
                </span>
                <div className="w-24 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${imageGenerationProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {imageError && (
            <div className="absolute top-12 left-0 right-0 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <span className="text-red-700 dark:text-red-300 text-sm">
                Error generating images: {imageError}
              </span>
            </div>
          )}

          {/* Step circles */}
          <div className="flex justify-between relative">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                    currentSection === step
                      ? "bg-[#005F73] text-white"
                      : currentSection > step
                      ? "bg-[#005F73] text-white"
                      : "bg-gray-200 dark:bg-[#1c1c1c] text-gray-500"
                  }`}
                >
                  {step}
                </div>
                <span
                  className={`mt-2 text-sm ${
                    currentSection === step
                      ? "text-[#005F73] font-medium"
                      : "text-gray-500"
                  }`}
                >
                  {step === 1 && "Branding"}
                  {step === 2 && "Plan Details"}
                  {step === 3 && "Employer Contributions"}
                  {step === 4 && "Investments & Features"}
                  {step === 5 && "Resources"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="">{renderCurrentSection()}</div>
      </div>
    </div>
  );
}

export function ErrorMessage({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <p className="text-sm text-red-500 mt-1">{error}</p>;
}
