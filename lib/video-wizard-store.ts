import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface VideoWizardState {
  currentStep: number;
  totalSteps: number;
  steps: WizardStep[];
  isCompleted: boolean;
  stepData: {
    selectedPlanId?: string;
    selectedPlan?: any;
    selectedAvatar?: string; // HeyGen avatar ID for API
    avatarValue?: string; // Avatar value for UI comparison
    avatarId?: string; // HeyGen avatar ID (alias for selectedAvatar)
    selectedVoice?: string; // HeyGen voice ID for API
    voiceId?: string; // HeyGen voice ID (alias for selectedVoice)
    script?: string;
    videoId?: string;
    videoStatus?: string;
    videoUrl?: string;
    // Template mode fields
    useTemplate?: boolean;
    templateId?: string;
    // Support old format for backward compatibility
    step1?: any;
    step2?: any;
    step3?: any;
    step4?: any;
    step5?: any;
  };
  errorFields: string[];
  nextStep: () => Promise<{ isValid: boolean; errors: any[] }>;
  previousStep: () => void;
  goToStep: (step: number) => void;
  completeStep: (stepId: number) => void;
  completeWizard: () => Promise<void>;
  saveAsDraft: () => Promise<void>;
  saveStepData: (stepType: string, data: any) => Promise<void>;
  saveStepDataLocally: (stepType: string, data: any) => void;
  resetWizard: () => void;
  setErrorFields: (fields: string[]) => void;
  clearErrorFields: () => void;
}

export const videoWizardSteps: WizardStep[] = [
  {
    id: 1,
    title: "Select Plan",
    description: "Choose the plan for video generation",
    completed: false,
  },
  {
    id: 2,
    title: "Choose Avatar",
    description: "Pick an avatar from available options",
    completed: false,
  },
  {
    id: 3,
    title: "Verify Plan Info",
    description: "Confirm the script and plan details",
    completed: false,
  },
  {
    id: 4,
    title: "Generate Video",
    description: "Video generation in progress",
    completed: false,
  },
  {
    id: 5,
    title: "Result",
    description: "Generated video with actions",
    completed: false,
  },
];

export const useVideoWizardStore = create<VideoWizardState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      totalSteps: 5,
      steps: videoWizardSteps,
      isCompleted: false,
      stepData: {},
      errorFields: [],

      nextStep: async () => {
        const { currentStep, totalSteps, stepData } = get();
        
        // Validate current step before moving forward
        // Support both new format (direct) and old format (nested)
        let isValid = true;
        const errors: any[] = [];

        if (currentStep === 1) {
          // Validate step 1 fields (Select Plan)
          const selectedPlanId = stepData.selectedPlanId || stepData.step1?.selectedPlanId;
          if (!selectedPlanId) {
            isValid = false;
            errors.push({ message: "Please select a plan" });
          }
          // Validate plan type
          const planType = stepData.step1?.planType || (stepData.step1 as any)?.selectedPlan?.planDetails?.planType;
          if (!planType) {
            isValid = false;
            errors.push({ message: "Please select a plan type" });
          }
        } else if (currentStep === 2) {
          // Check which sub-step we're on
          const step2SubStep = (stepData as any).step2SubStep?.step2SubStep || (stepData as any).step2SubStep;
          if (step2SubStep === "preview" || step2SubStep === "employeeDeferrals" || step2SubStep === "employeeDeferralsPreview") {
            // On preview, employeeDeferrals, or employeeDeferralsPreview, validation already passed for previous sub-steps
            // Validate current sub-step if needed
            if (step2SubStep === "employeeDeferrals") {
              const step2cData = (stepData as any).step2c || {};
              
              if (step2cData.autoEnrollment === null || step2cData.autoEnrollment === undefined) {
                isValid = false;
                errors.push({ message: "Please select an auto enrollment option" });
              }
              
              if (step2cData.autoEnrollment === true) {
                if (!step2cData.enrollmentRate && !step2cData.customEnrollmentRate?.trim()) {
                  isValid = false;
                  errors.push({ message: "Please enter an enrollment rate" });
                }
              }
              
              if (step2cData.autoEnrollment === false) {
                if (!step2cData.enrollmentMethods || step2cData.enrollmentMethods.length === 0) {
                  isValid = false;
                  errors.push({ message: "Please select at least one enrollment method" });
                } else if (step2cData.enrollmentMethods.includes("custom") && !step2cData.customEnrollmentMethod?.trim()) {
                  isValid = false;
                  errors.push({ message: "Please enter a custom enrollment method" });
                }
              }
              
              if (step2cData.rothOption === null || step2cData.rothOption === undefined) {
                isValid = false;
                errors.push({ message: "Please select a Roth option" });
              }
            } else {
              // On preview or employeeDeferralsPreview, validation already passed
              isValid = true;
            }
          } else {
            // Validate step 2a fields (Plan Eligibility Details)
            const step2aData = (stepData as any).step2a || {};
            
            if (!step2aData.planType) {
              isValid = false;
              errors.push({ message: "Please select a plan type" });
            }
            
            if (!step2aData.ageRequirement) {
              isValid = false;
              errors.push({ message: "Please select an age requirement" });
            } else if (step2aData.ageRequirement === "custom" && !step2aData.customAgeRequirement?.trim()) {
              isValid = false;
              errors.push({ message: "Please enter a custom age requirement" });
            }
            
            if (!step2aData.serviceRequirement) {
              isValid = false;
              errors.push({ message: "Please select a service requirement" });
            } else if (step2aData.serviceRequirement === "custom" && !step2aData.customServiceRequirement?.trim()) {
              isValid = false;
              errors.push({ message: "Please enter a custom service requirement" });
            }
            
            if (!step2aData.entryDate) {
              isValid = false;
              errors.push({ message: "Please select an entry date" });
            } else if (step2aData.entryDate === "custom" && !step2aData.customEntryDate?.trim()) {
              isValid = false;
              errors.push({ message: "Please enter a custom entry date" });
            }
          }
        } else if (currentStep === 3) {
          // Check which sub-step we're on
          const step3SubStep = (stepData as any).step3SubStep?.step3SubStep || (stepData as any).step3SubStep;
          if (step3SubStep === "preview") {
            // On preview, validation already passed
            isValid = true;
          } else {
            // Validate step 3a fields (Employer Contributions)
            const step3aData = (stepData as any).step3a || {};
            
            if (step3aData.hasContributions === null || step3aData.hasContributions === undefined) {
              isValid = false;
              errors.push({ message: "Please select if the company makes contributions" });
            }
            
            if (step3aData.hasContributions === true) {
              if (!step3aData.primaryContributionType) {
                isValid = false;
                errors.push({ message: "Please select a primary contribution type" });
              }
            }
          }
        } else if (currentStep === 4) {
          // Check which sub-step we're on
          const step4SubStep = (stepData as any).step4SubStep?.step4SubStep || (stepData as any).step4SubStep;
          if (step4SubStep === "preview") {
            // On preview, validation already passed
            isValid = true;
          } else {
            // Validate step 4a fields (Investments)
            const step4aData = (stepData as any).step4a || {};
            
            if (!step4aData.investmentOptions || step4aData.investmentOptions.length === 0) {
              isValid = false;
              errors.push({ message: "Please select a QDIA option" });
            }
          }
        } else if (currentStep === 5) {
          // Check which sub-step we're on
          const step5SubStep = (stepData as any).step5SubStep?.step5SubStep || (stepData as any).step5SubStep || "form";
          
          if (step5SubStep === "preview") {
            // On preview, validation already passed
            isValid = true;
          } else {
            // Validate step 5a fields (Resources)
            const step5aData = (stepData as any).step5a || {};
            
            // Validate financial planning
            if (step5aData.financialPlanning === null || step5aData.financialPlanning === undefined) {
              isValid = false;
              errors.push({ message: "Please select if you offer financial planning" });
            }
            
            // Validate primary contact
            if (!step5aData.contactInformation?.primaryType || step5aData.contactInformation.primaryType === "None") {
              isValid = false;
              errors.push({ message: "Primary contact type is required" });
            } else {
              if (step5aData.contactInformation.primaryType === "Custom" && !step5aData.contactInformation.primaryTypeCustom) {
                isValid = false;
                errors.push({ message: "Custom primary contact type is required" });
              }
              if (!step5aData.contactInformation.primaryName) {
                isValid = false;
                errors.push({ message: "Primary contact name is required" });
              }
              if (!step5aData.contactInformation.primaryEmail) {
                isValid = false;
                errors.push({ message: "Primary contact email is required" });
              }
              if (!step5aData.contactInformation.primaryPhone) {
                isValid = false;
                errors.push({ message: "Primary contact phone is required" });
              }
            }
          }
        }

        // Step 1 is now unified, no sub-step handling needed

        // Special handling for step 2 sub-steps
        if (currentStep === 2 && isValid) {
          const step2SubStep = (stepData as any).step2SubStep?.step2SubStep || (stepData as any).step2SubStep;
          if (step2SubStep === "form") {
            // On form, move to preview instead of next step
            set({
              stepData: {
                ...stepData,
                step2SubStep: { step2SubStep: "preview" },
              } as any,
            });
            return { isValid: true, errors: [] };
          } else if (step2SubStep === "preview") {
            // On preview, move to employeeDeferrals
            set({
              stepData: {
                ...stepData,
                step2SubStep: { step2SubStep: "employeeDeferrals" },
              } as any,
            });
            return { isValid: true, errors: [] };
          } else if (step2SubStep === "employeeDeferrals") {
            // On employeeDeferrals, move to employeeDeferralsPreview
            set({
              stepData: {
                ...stepData,
                step2SubStep: { step2SubStep: "employeeDeferralsPreview" },
              } as any,
            });
            return { isValid: true, errors: [] };
          } else if (step2SubStep === "employeeDeferralsPreview") {
            // On employeeDeferralsPreview, proceed to next step
            if (currentStep < totalSteps) {
              set({ currentStep: currentStep + 1 });
            }
            return { isValid: true, errors: [] };
          }
        }

        // Special handling for step 3 sub-steps
        if (currentStep === 3 && isValid) {
          const step3SubStep = (stepData as any).step3SubStep?.step3SubStep || (stepData as any).step3SubStep;
          if (step3SubStep === "form") {
            // On form, move to preview instead of next step
            set({
              stepData: {
                ...stepData,
                step3SubStep: { step3SubStep: "preview" },
              } as any,
            });
            return { isValid: true, errors: [] };
          } else if (step3SubStep === "preview") {
            // On preview, proceed to next step
            if (currentStep < totalSteps) {
              set({ currentStep: currentStep + 1 });
            }
            return { isValid: true, errors: [] };
          }
        }

        // Special handling for step 4 sub-steps
        if (currentStep === 4 && isValid) {
          const step4SubStep = (stepData as any).step4SubStep?.step4SubStep || (stepData as any).step4SubStep;
          if (step4SubStep === "form") {
            // On form, move to preview instead of next step
            set({
              stepData: {
                ...stepData,
                step4SubStep: { step4SubStep: "preview" },
              } as any,
            });
            return { isValid: true, errors: [] };
          } else if (step4SubStep === "preview") {
            // On preview, proceed to next step
            if (currentStep < totalSteps) {
              set({ currentStep: currentStep + 1 });
            }
            return { isValid: true, errors: [] };
          }
        }

        // Special handling for step 5 sub-steps
        if (currentStep === 5 && isValid) {
          const step5SubStep = (stepData as any).step5SubStep?.step5SubStep || (stepData as any).step5SubStep || "form";
          
          if (step5SubStep === "form" || !step5SubStep) {
            // On form (or undefined), move to preview instead of next step
            set({
              stepData: {
                ...stepData,
                step5SubStep: { step5SubStep: "preview" },
              } as any,
            });
            return { isValid: true, errors: [] };
          } else if (step5SubStep === "preview") {
            // On preview, move to disclaimer sub-step
            set({
              stepData: {
                ...stepData,
                step5SubStep: { step5SubStep: "disclaimer" },
              } as any,
            });
            return { isValid: true, errors: [] };
          } else if (step5SubStep === "disclaimer") {
            // On disclaimer preview, proceed to next step (no-op if already final)
            if (currentStep < totalSteps) {
              set({ currentStep: currentStep + 1 });
            }
            return { isValid: true, errors: [] };
          }
        }

        if (isValid && currentStep < totalSteps) {
          set({ currentStep: currentStep + 1 });
        }
        
        return { isValid, errors };
      },

      previousStep: () => {
        const { currentStep, stepData } = get();
        // Step 1 is now unified, no sub-step handling needed
        // Special handling for step 2 sub-steps
        if (currentStep === 2) {
          const step2SubStep = (stepData as any).step2SubStep?.step2SubStep || (stepData as any).step2SubStep;
          if (step2SubStep === "employeeDeferralsPreview") {
            // On employeeDeferralsPreview, go back to employeeDeferrals
            set({
              stepData: {
                ...stepData,
                step2SubStep: { step2SubStep: "employeeDeferrals" },
              } as any,
            });
            return;
          } else if (step2SubStep === "employeeDeferrals") {
            // On employeeDeferrals, go back to preview
            set({
              stepData: {
                ...stepData,
                step2SubStep: { step2SubStep: "preview" },
              } as any,
            });
            return;
          } else if (step2SubStep === "preview") {
            // On preview, go back to form
            set({
              stepData: {
                ...stepData,
                step2SubStep: { step2SubStep: "form" },
              } as any,
            });
            return;
          }
        }
        // Special handling for step 3 sub-steps
        if (currentStep === 3) {
          const step3SubStep = (stepData as any).step3SubStep?.step3SubStep || (stepData as any).step3SubStep;
          if (step3SubStep === "preview") {
            // On preview, go back to form
            set({
              stepData: {
                ...stepData,
                step3SubStep: { step3SubStep: "form" },
              } as any,
            });
            return;
          }
        }
        // Special handling for step 4 sub-steps
        if (currentStep === 4) {
          const step4SubStep = (stepData as any).step4SubStep?.step4SubStep || (stepData as any).step4SubStep;
          if (step4SubStep === "preview") {
            // On preview, go back to form
            set({
              stepData: {
                ...stepData,
                step4SubStep: { step4SubStep: "form" },
              } as any,
            });
            return;
          }
        }
        // Special handling for step 5 sub-steps
        if (currentStep === 5) {
          const step5SubStep = (stepData as any).step5SubStep?.step5SubStep || (stepData as any).step5SubStep;
          if (step5SubStep === "disclaimer") {
            // On disclaimer preview, go back to resources preview
            set({
              stepData: {
                ...stepData,
                step5SubStep: { step5SubStep: "preview" },
              } as any,
            });
            return;
          }
          if (step5SubStep === "preview") {
            // On preview, go back to form
            set({
              stepData: {
                ...stepData,
                step5SubStep: { step5SubStep: "form" },
              } as any,
            });
            return;
          }
        }
        // Normal previous step
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

      completeStep: (stepId: number) => {
        set((state) => ({
          steps: state.steps.map((step) =>
            step.id === stepId ? { ...step, completed: true } : step,
          ),
        }));
      },

      completeWizard: async () => {
        set({ isCompleted: true });
      },

      saveAsDraft: async () => {
        // Save draft logic here
        const { stepData } = get();
        // You can add API call here to save draft
      },

      saveStepData: async (stepType: string, data: any) => {
        set((state) => ({
          stepData: {
            ...state.stepData,
            [stepType]: data,
          },
        }));
      },

      saveStepDataLocally: (stepType: string, data: any) => {
        set((state) => {
          // If stepType is provided and is a step key (step1, step2, step2a, etc.), nest the data
          if (stepType && (stepType.startsWith("step") || stepType === "step2a")) {
            return {
              stepData: {
                ...state.stepData,
                [stepType]: data,
              },
            };
          }
          // Otherwise, merge data directly into stepData
          return {
            stepData: {
              ...state.stepData,
              ...data,
            },
          };
        });
      },

      resetWizard: () => {
        set({
          currentStep: 1,
          isCompleted: false,
          stepData: {},
          errorFields: [],
          steps: videoWizardSteps.map((step) => ({ ...step, completed: false })),
        });
      },

      setErrorFields: (fields: string[]) => {
        set({ errorFields: fields });
      },

      clearErrorFields: () => {
        set({ errorFields: [] });
      },
    }),
    {
      name: "video-wizard-storage",
      // ✅ Handle localStorage quota errors gracefully
      storage: {
        getItem: (name: string) => {
          if (typeof window === "undefined") return null;
          try {
            return localStorage.getItem(name);
          } catch (error) {
            console.warn("⚠️ Failed to read from localStorage:", error);
            return null;
          }
        },
        setItem: (name: string, value: any): void => {
          if (typeof window === "undefined") return;
          try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(name, stringValue);
          } catch (error: any) {
            // If quota exceeded, try to clear old data and retry
            if (error?.name === "QuotaExceededError") {
              console.warn("⚠️ localStorage quota exceeded. Clearing old data...");
              try {
                // Clear old video wizard storage
                localStorage.removeItem("video-wizard-storage");
                // Try again
                const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
                localStorage.setItem(name, stringValue);
              } catch (retryError) {
                console.error("❌ Failed to save after clearing:", retryError);
                // If still fails, try to save a minimal version
                try {
                  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                  // Remove large data fields that might cause issues
                  const minimalData = {
                    ...parsed,
                    state: {
                      ...parsed.state,
                      stepData: removeLargeData(parsed.state?.stepData || {}),
                    },
                  };
                  localStorage.setItem(name, JSON.stringify(minimalData));
                } catch (minimalError) {
                  console.error("❌ Failed to save even minimal version:", minimalError);
                }
              }
            } else {
              console.error("❌ localStorage error:", error);
            }
          }
        },
        removeItem: (name: string): void => {
          if (typeof window === "undefined") return;
          try {
            localStorage.removeItem(name);
          } catch (error) {
            console.warn("⚠️ Failed to remove from localStorage:", error);
          }
        },
      } as any,
      // ✅ Only persist essential data, exclude large fields
      partialize: (state: VideoWizardState) => {
        return {
          currentStep: state.currentStep,
          totalSteps: state.totalSteps,
          isCompleted: state.isCompleted,
          stepData: removeLargeData(state.stepData),
          errorFields: state.errorFields,
          steps: state.steps,
        };
      },
    },
  ),
);

// ✅ Helper function to remove large data from stepData
function removeLargeData(stepData: any): any {
  if (!stepData || typeof stepData !== "object") {
    return stepData;
  }

  const cleaned: any = {};

  for (const [key, value] of Object.entries(stepData)) {
    // Skip base64 images and large data URLs
    if (
      typeof value === "string" &&
      (value.startsWith("data:image/") ||
        value.startsWith("data:video/") ||
        value.length > 100000) // Skip strings longer than 100KB
    ) {
      continue;
    }

    // Recursively clean nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      cleaned[key] = removeLargeData(value);
    } else if (Array.isArray(value)) {
      // Clean array items
      cleaned[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? removeLargeData(item)
          : item,
      );
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

