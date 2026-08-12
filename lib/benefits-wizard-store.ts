import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CompanyLogoData, BrandImagesData, Document } from "@/types/new-client-wizard";

export interface WizardStep {
    id: number;
    title: string;
    description: string;
    completed: boolean;
}

export interface HelpCardData {
    id: string;
    title: string;
    introBold?: string;
    paragraphs: string[];
    cta: string;
    href?: string;
}

export interface BenefitsStep1Data {
    planId: string;
    benefitCategory: string;
    contactId: string;
    benefitTitle: string;
    shortDescription?: string;
    companyLogo?: CompanyLogoData | null;
    /** Right column image displayed full-height in the hero section (Inner Header Image) */
    innerHeaderImage?: CompanyLogoData | null;
    brandImages?: BrandImagesData;
    // Temporary storage for contact details if changed
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactPhoneExtension?: string;
    selectedPlan?: any | null;
    /** Per-category publish/hide toggle state. Default true (published). */
    benefitVisibility?: Record<string, boolean>;
    /** Customizable "How Can We Help You Today?" cards */
    helpCards?: HelpCardData[];
    /** Plan ID displayed in the Insurance Benefits Access & Materials section */
    insurancePlanId?: string;
    /** URL for the Register or Login Here button in the Insurance Benefits section */
    insuranceLoginUrl?: string;
    /** Background image URL for the Insurance Benefits Access & Materials section */
    insuranceBackgroundImage?: string;
    /** Insurance section overlay darkness (0-1, higher = darker) */
    insuranceContainerBlockOpacity?: number;
    /** Hero overlay opacity for the background image */
    heroOverlayOpacity?: number;
    /** Hero background image opacity */
    heroBackgroundOpacity?: number;
    /** Hero container block opacity */
    heroContainerBlockOpacity?: number;
    /** Invert hero container colors */
    heroContainerInverted?: boolean;
    /** Invert hero background colors */
    heroBackgroundInverted?: boolean;
    heroUseGradient?: boolean;
    /** Closing & Signature mode: "user" = use contact's info, "custom" = custom text */
    signatureMode?: "user" | "custom";
    /** Custom closing text (when signatureMode is "custom") */
    customClosing?: string;
    /** Custom signature name & title (when signatureMode is "custom") */
    customSignatureName?: string;
    /** Custom signature company name (when signatureMode is "custom") */
    customSignatureCompany?: string;
    // Per-line bold/italic toggles (applied in both "user" and "custom" modes)
    customClosingBold?: boolean;
    customClosingItalic?: boolean;
    customSignatureNameBold?: boolean;
    customSignatureNameItalic?: boolean;
    customSignatureCompanyBold?: boolean;
    customSignatureCompanyItalic?: boolean;
    /** Plan Video URL (uploaded in Step 2, Section 3 — replaces the right-column image in RetirementJourneySection) */
    planVideo?: string;
    /** Original file name of the uploaded plan video */
    planVideoFileName?: string;
    /** When true, the user explicitly removed the video — overrides persisted categoryBenefit.planVideo */
    planVideoRemoved?: boolean;
    /** Journey section main header override */
    journeyHeader?: string;
    /** Journey section subtitle override */
    journeySubtitle?: string;
    /** Journey section body text override */
    journeyBodyText?: string;
    /** Categories for which benefit fields (logo, short description) have been loaded from the
     *  persisted benefit on entry, so re-entry doesn't clobber in-session edits. */
    benefitFieldsLoadedCategories?: string[];
}

export interface FAQItem {
    id: string;
    question: string;
    answer: string;
    linkLabel?: string;
    linkHref?: string;
    enabled: boolean;
}

export interface SupportContact {
    contactId: string;
    title: string;
    description: string;
    enabled: boolean;
}

export interface BenefitsStep3Data {
    faqs: FAQItem[];
    supportContacts: SupportContact[];
    currentSubStep?: "a" | "b";
    /** Per-category FAQ storage keyed by benefitCategory (e.g. "Retirement", "Group Health", "Group Life", "Custom").
     *  Persisted across wizard step navigations so manual additions are not lost. */
    faqsByCategory?: Record<string, FAQItem[]>;
    /** Categories for which support contacts have been loaded from the persisted benefit.
     *  Prevents re-loading from clobbering in-session edits/removals on re-render. */
    supportContactsLoadedCategories?: string[];
}

export interface BenefitsStep4Data {
    documents: Document[];
}

export interface BenefitsWizardState {
    currentStep: number;
    totalSteps: number;
    steps: WizardStep[];
    stepData: {
        step1?: BenefitsStep1Data;
        step2?: any;
        step3?: BenefitsStep3Data;
        step4?: BenefitsStep4Data;
        step5?: any;
    };
    nextStep: () => void;
    previousStep: () => void;
    goToStep: (step: number) => void;
    saveStepData: (step: number, data: any) => void;
    saveStepDataLocally: (stepKey: string, data: any) => void;
    completeStep: (stepId: number) => void;
    resetWizard: () => void;
}

// Keep only small data URLs in localStorage to avoid quota issues.
const keepSmallDataUrl = (value: unknown, maxChars: number): string => {
  if (typeof value !== "string") return "";
  if (!value.startsWith("data:image/")) return value; // already a URL or empty
  return value.length <= maxChars ? value : "";
};

// Custom storage with error handling for QuotaExceededError
const createSafeStorage = (): any => {
  return {
    getItem: (name: string) => {
      try {
        const value = localStorage.getItem(name);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        return null;
      }
    },
    setItem: (name: string, value: any): void => {
      try {
        const stringValue =
          typeof value === "string" ? value : JSON.stringify(value);
        localStorage.setItem(name, stringValue);
      } catch (error) {
        if (error instanceof Error && error.name === "QuotaExceededError") {
          try {
            localStorage.removeItem(name);
            const stringValue =
              typeof value === "string" ? value : JSON.stringify(value);
            localStorage.setItem(name, stringValue);
          } catch (retryError) {
            // Silently fail - data will be lost but app won't crash
          }
        }
      }
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // ignore
      }
    },
  };
};

const benefitsWizardSteps: WizardStep[] = [
    {
        id: 1,
        title: "Plan & Benefit Selection",
        description: "Choose a plan and the benefit you want to create",
        completed: false,
    },
    {
        id: 2,
        title: "Preview & Edit",
        description: "Preview the benefit page and edit branding, messaging, FAQs, and contacts",
        completed: false,
    },
    {
        id: 3,
        title: "Step 3",
        description: "Description for Step 3",
        completed: false,
    },
    {
        id: 4,
        title: "Step 4",
        description: "Description for Step 4",
        completed: false,
    },
    {
        id: 5,
        title: "Step 5",
        description: "Description for Step 5",
        completed: false,
    },
];

export const useBenefitsWizardStore = create<BenefitsWizardState>()(
    persist(
        (set, get) => ({
            currentStep: 1,
            totalSteps: 5,
            steps: benefitsWizardSteps,
            stepData: {},

            nextStep: () => {
                const { currentStep, totalSteps } = get();
                if (currentStep < totalSteps) {
                    set({ currentStep: currentStep + 1 });
                }
            },

            previousStep: () => {
                const { currentStep } = get();
                if (currentStep > 1) {
                    set({ currentStep: currentStep - 1 });
                }
            },

            goToStep: (step: number) => {
                const { totalSteps } = get();
                if (step >= 1 && step <= totalSteps) {
                    set({ currentStep: step });
                }
            },

            saveStepData: (step: number, data: any) => {
                set((state) => ({
                    stepData: {
                        ...state.stepData,
                        [`step${step}`]: data,
                    },
                }));
            },
            saveStepDataLocally: (stepKey: string, data: any) => {
                set((state) => ({
                    stepData: {
                        ...state.stepData,
                        [stepKey]: data,
                    },
                }));
            },

            completeStep: (stepId: number) => {
                set((state) => ({
                    steps: state.steps.map((step) =>
                        step.id === stepId ? { ...step, completed: true } : step
                    ),
                }));
            },

            resetWizard: () => {
                set({
                    currentStep: 1,
                    stepData: {},
                    steps: benefitsWizardSteps.map((s) => ({ ...s, completed: false })),
                });
            },
        }),
        {
            name: "benefits-wizard",
            skipHydration: true,
            storage: createSafeStorage(),
            partialize: (state) => {
                // Strip large/base64 data and reset tracking fields that should
                // be re-evaluated on rehydration so effects re-run correctly.
                const cleaned: any = { ...state };
                if (cleaned.stepData) {
                    const sd = { ...cleaned.stepData };

                    if (sd.step1) {
                        const s1 = { ...sd.step1 };
                        // Don't persist selectedPlan — will be re-fetched from API on rehydration
                        delete s1.selectedPlan;
                        // Reset loaded-categories tracking so effects re-run on rehydration
                        // and re-load partnerLogo / shortDescription from the API
                        s1.benefitFieldsLoadedCategories = [];

                        // Preserve companyLogo URL as-is — logos are small and must
                        // survive refresh so the auto-save (which fires on rehydration)
                        // doesn't overwrite the API's saved partnerLogo with null.
                        // Unlike brandImages, logos are rarely large enough to cause
                        // localStorage quota issues.

                        // Preserve brandImages.header.url (hero background) — same
                        // rationale as companyLogo: must survive refresh so the
                        // auto-save doesn't overwrite the API value with null.
                        // Strip other brandImages slots which hold large uploads.
                        if (s1.brandImages) {
                            s1.brandImages = { ...s1.brandImages };
                            for (const key of ["thumbnail", "secondaryBanner", "favicon"] as const) {
                                if (s1.brandImages[key]?.url) {
                                    s1.brandImages[key] = {
                                        ...s1.brandImages[key]!,
                                        url: keepSmallDataUrl(s1.brandImages[key]!.url, 50_000),
                                    };
                                }
                            }
                        }

                        sd.step1 = s1;
                    }

                    if (sd.step3) {
                        const s3 = { ...sd.step3 };
                        // Reset loaded-categories tracking so support contacts are re-loaded on rehydration
                        s3.supportContactsLoadedCategories = [];
                        sd.step3 = s3;
                    }

                    cleaned.stepData = sd;
                }
                return cleaned;
            },
        }
    )
);
