
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ClientProfileFormData,
  TeamSizeFormData,
  ServicesFormData,
  InsuranceLicensingFormData,
  TeamMembersFormData,
  BrandingFormData,
  EmployerScopeFormData,
  UserSetupFormData,
  DisclaimersFormData
} from "@/types/wizard";
import { normalizeCleanDomain } from "./url-utils";
import { step2ServicesToCategories } from "./service-categories";

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface OnboardingWizardState {
  currentStep: number;
  totalSteps: number;
  steps: WizardStep[];
  isCompleted: boolean;
  stepData: {
    clientProfile?: ClientProfileFormData;
    teamSize?: TeamSizeFormData;
    services?: ServicesFormData;
    insuranceLicensing?: InsuranceLicensingFormData;
    teamMembers?: TeamMembersFormData;
    branding?: BrandingFormData;
    userSetup?: UserSetupFormData;
    disclaimers?: DisclaimersFormData;
    employerScope?: EmployerScopeFormData;
  };
  errorFields: string[];
  isLoading: boolean;
  loadingPromise: Promise<any> | null;
  showNextSteps: boolean;
  setShowNextSteps: (show: boolean) => void;
  showStep5ConfirmModal: boolean;
  setShowStep5ConfirmModal: (show: boolean) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  completeStep: (stepId: number) => void;
  saveStepData: (stepType: string, data: any, saveToServer?: boolean) => Promise<void>;
  saveStepDataLocally: (stepType: string, data: any) => Promise<void>;
  saveStepDataToServer: (stepType: string, data: any) => Promise<boolean>;
  loadStepData: (stepType: string, force?: boolean) => Promise<any>;
  loadAllWizardData: (force?: boolean) => Promise<any>;
  completeWizard: () => void;
  resetWizard: () => void;
  setErrorFields: (fields: string[]) => void;
  clearErrorFields: () => void;
  validateCurrentStepFields: () => Promise<void>;
  saveSummaryData: (summaryData: any) => Promise<any>;

  autosaveToServer?: boolean;
  setAutosaveToServer?: (enabled: boolean) => void;
}

const initialSteps: WizardStep[] = [
  {
    id: 1,
    title: "New User Setup",
    description: "Organization type and team size",
    completed: false,
  },
  {
    id: 2,
    title: "Services",
    description: "Which services do you offer?",
    completed: false,
  },
  {
    id: 3,
    title: "Organization Branding Setup",
    description: "Upload logo and select colors",
    completed: false,
  },
  {
    id: 4,
    title: "User Setup",
    description: "Complete your profile information",
    completed: false,
  },
  {
    id: 5,
    title: "Summary",
    description: "Review your onboarding details",
    completed: false,
  },
];

// Helper function to recursively remove base64 data from objects
const removeBase64Data = (obj: any): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeBase64Data(item));
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip base64 images and large data URLs
    if (
      typeof value === 'string' &&
      (value.startsWith('data:image/') ||
        value.startsWith('data:video/') ||
        value.length > 100000) // Skip strings longer than 100KB
    ) {
      // Keep the key but set to empty string to preserve structure
      cleaned[key] = '';
      continue;
    }

    // Recursively clean nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = removeBase64Data(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? removeBase64Data(item)
          : item
      );
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
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
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(name, stringValue);
      } catch (error) {
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          try {
            // Clear the specific item and try again
            localStorage.removeItem(name);
            // Try with cleaned data
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(name, stringValue);
          } catch (retryError) {
            // If still failing, try to remove base64 data and save minimal version
            try {
              const parsed = typeof value === 'string' ? JSON.parse(value) : value;
              const cleaned = removeBase64Data(parsed);
              const cleanedString = JSON.stringify(cleaned);
              localStorage.setItem(name, cleanedString);
            } catch (minimalError) {
              // Don't throw - just log the error to prevent app crash
            }
          }
        } else {
          // Don't throw - just log the error
        }
      }
    },
    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(name);
      } catch (error) {
      }
    },
  };
};

export const useOnboardingWizardStore = create<OnboardingWizardState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      totalSteps: 5,
      steps: initialSteps,
      isCompleted: false,
      stepData: {},
      errorFields: [],
      isLoading: false,
      loadingPromise: null,
      autosaveToServer: false,
      setAutosaveToServer: (enabled: boolean) => set({ autosaveToServer: enabled }),
      showNextSteps: false,
      setShowNextSteps: (show: boolean) => set({ showNextSteps: show }),
      showStep5ConfirmModal: false,
      setShowStep5ConfirmModal: (show: boolean) => set({ showStep5ConfirmModal: show }),

      nextStep: async () => {
        const { currentStep, totalSteps, showNextSteps, setShowNextSteps, setShowStep5ConfirmModal } = get();

        // Special handling for step 5 - first show confirmation modal, then Next Steps
        if (currentStep === 5 && !showNextSteps) {
          // Show confirmation modal instead of going to next steps directly
          setShowStep5ConfirmModal(true);
          return;
        }

        if (currentStep < totalSteps) {
          set({ currentStep: currentStep + 1 });
          // Reset showNextSteps when moving away from step 5
          if (currentStep === 5) {
            setShowNextSteps(false);
          }
        }
      },

      previousStep: () => {
        const { currentStep, stepData, showNextSteps, setShowNextSteps } = get();

        // Special handling for step 5 - if showing Next Steps, go back to Setup Complete
        if (currentStep === 5 && showNextSteps) {
          setShowNextSteps(false);
          return;
        }

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
            step.id === stepId ? { ...step, completed: true } : step
          ),
        }));
      },

      saveStepData: async (stepType: string, data: any, saveToServer: boolean = true) => {

        // Normalize website URL if present
        let normalizedData = { ...data };
        if (data.website) {
          normalizedData.website = normalizeCleanDomain(data.website);
        }

        // When saving Step 2 services, always sync to userSetup.primaryServiceCategories and persist (so autofill works without Settings)
        if (stepType === "services") {
          const servicesArray = Array.isArray(data.services) ? data.services : [];
          const uniqueCategories = servicesArray.length ? step2ServicesToCategories(servicesArray) : [];
          normalizedData = { ...normalizedData };
          
          // Get current userSetup before updating state
          const currentUserSetup = get().stepData.userSetup || {};
          const userSetupPayload = {
            ...currentUserSetup,
            primaryServiceCategories: uniqueCategories,
          };
          
          set((state) => {
            return {
              stepData: {
                ...state.stepData,
                [stepType]: normalizedData,
                userSetup: userSetupPayload,
              },
            } as unknown as Partial<OnboardingWizardState>;
          });
          if (saveToServer) {
            try {
              await get().saveStepDataToServer("userSetup", userSetupPayload);
              await get().saveStepDataToServer(stepType, normalizedData);
            } catch (error) {
              throw error;
            }
          }
        } else {
          // Save locally first
          set((state) => {
            const newState = {
              stepData: {
                ...state.stepData,
                [stepType]: normalizedData,
              },
            };
            return newState;
          });

          // If saveToServer is explicitly true, always send to server (don't check autosaveToServer flag)
          // This allows sections to save data immediately without waiting for the wizard's autosaveToServer flag
          if (saveToServer) {
            try {
              await get().saveStepDataToServer(stepType, normalizedData);
            } catch (error) {
              throw error;
            }
          }
        }
      },

      // Save data only locally (no server call)
      saveStepDataLocally: async (stepType: string, data: any) => {
        return get().saveStepData(stepType, data, false);
      },

      saveStepDataToServer: async (stepType: string, data: any) => {
        try {
          // Don't create new sessions during saving - this causes data loss!
          // The session should already exist from when the user started the wizard

          // Convert camelCase to kebab-case for API endpoints
          const apiEndpoint = stepType.replace(/([A-Z])/g, '-$1').toLowerCase();

          const response = await fetch(`/api/onboarding-wizard/${apiEndpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            return true;
          } else {
            return false;
          }
        } catch (error) {
          return false;
        }
      },

      loadStepData: async (stepType: string, force: boolean = false) => {
        const { stepData } = get();

        // If data already exists and not forcing reload, return cached data
        if (!force && stepData[stepType as keyof typeof stepData]) {
          const cachedData = stepData[stepType as keyof typeof stepData] as any;
          return cachedData;
        }

        try {
          // Convert camelCase to kebab-case for API endpoints
          const apiEndpoint = stepType.replace(/([A-Z])/g, '-$1').toLowerCase();
          const response = await fetch(`/api/onboarding-wizard/${apiEndpoint}`);
          if (response.ok) {
            const result = await response.json();
            const data = result[stepType];
            if (data) {
              set((state) => ({
                stepData: {
                  ...state.stepData,
                  [stepType]: data,
                },
              }));
              return data;
            }
          }
        } catch (error) {
          // Silent error
        }
        return null;
      },

      loadAllWizardData: async (force: boolean = false) => {
        const { isLoading, loadingPromise, stepData } = get();

        // If already loading, return the existing promise to avoid duplicate requests
        if (isLoading && loadingPromise) {
          return loadingPromise;
        }

        // If data already exists and not forcing reload, return cached data
        if (!force && Object.keys(stepData).length > 0) {
          return stepData;
        }

        // Create a new loading promise
        const promise = (async () => {
          try {
            set({ isLoading: true });

            // First check if there's an active wizard session
            const sessionResponse = await fetch('/api/onboarding-wizard/new-session');
            const sessionData = await sessionResponse.json();

            if (!sessionData.session) {
              // Don't create a new session during data loading - this causes data loss!
              // The session should be created when the user starts the wizard, not when loading data
            }

            const stepTypes = [
              'clientProfile',
              'teamSize',
              'services',
              'insuranceLicensing',
              'teamMembers',
              'branding',
              'benefitTypes',
              'userSetup',
              'disclaimers',
              'employerScope'
            ];

            const loadedData: any = {};
            let hasData = false;

            const loadPromises = stepTypes.map(async (stepType) => {
              try {
                const apiEndpoint = stepType.replace(/([A-Z])/g, '-$1').toLowerCase();
                const response = await fetch(`/api/onboarding-wizard/${apiEndpoint}`);
                if (response.ok) {
                  const result = await response.json();
                  // The API returns the data directly with the step type name as key
                  const data = result[stepType];
                  if (data) {
                    loadedData[stepType] = data;
                    hasData = true;
                  }
                }
              } catch (error) {
                // Silent error
              }
            });

            await Promise.all(loadPromises);

            // Always sync Step 2 services -> userSetup.primaryServiceCategories so Settings/autofill get categories
            const servicesArray = Array.isArray(loadedData.services?.services) ? loadedData.services.services : [];
            const categoriesFromServices = servicesArray.length ? step2ServicesToCategories(servicesArray) : [];
            const userSetup = loadedData.userSetup || {};
            const existingCategories = Array.isArray(userSetup.primaryServiceCategories) ? userSetup.primaryServiceCategories : [];
            const primaryServiceCategories =
              existingCategories.length > 0 ? existingCategories : categoriesFromServices;
            if (primaryServiceCategories.length > 0 || categoriesFromServices.length > 0) {
              loadedData.userSetup = { ...userSetup, primaryServiceCategories };
            }

            if (hasData) {
              set((state) => ({
                stepData: {
                  ...state.stepData,
                  ...loadedData,
                },
              }));
            }

            return loadedData;
          } catch (error) {
            return {};
          } finally {
            set({ isLoading: false, loadingPromise: null });
          }
        })();

        // Store the promise
        set({ loadingPromise: promise });

        return promise;
      },

      completeWizard: () => {
        set({
          currentStep: 5,
          isCompleted: true,
          steps: initialSteps.map((step) => ({ ...step, completed: true })),
        });

        // Call the complete API endpoint
        fetch('/api/onboarding-wizard/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ finalData: true }),
        }).then(response => {
          if (response.ok) {
            // Redirect to new dashboard after completion
            window.location.href = '/new/dashboard';
          }
        }).catch(() => {
          // Silent error
        });
      },

      resetWizard: () => {
        set({
          currentStep: 1,
          steps: initialSteps.map((step) => ({ ...step, completed: false })),
          isCompleted: false,
          stepData: {},
          errorFields: [],
          isLoading: false,
          loadingPromise: null,
        });
      },

      setErrorFields: (fields: string[]) => {
        set({ errorFields: fields });
      },

      clearErrorFields: () => {
        set({ errorFields: [] });
      },

      validateCurrentStepFields: async () => {
        const { currentStep, stepData } = get();
        try {
          const { validateCurrentStep } = await import("./wizard-validation");
          const validationResult = await validateCurrentStep(currentStep, stepData);

          if (!validationResult.isValid && validationResult.errorFields) {
            set({ errorFields: validationResult.errorFields });
          } else {
            set({ errorFields: [] });
          }
        } catch (error) {
          // Silent error
        }
      },

      saveSummaryData: async (summaryData: any) => {
        try {
          const results: any = {};

          // Save each section using existing API endpoints
          if (summaryData.clientProfile) {
            const response = await fetch('/api/onboarding-wizard/client-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(summaryData.clientProfile),
            });
            if (response.ok) {
              results.clientProfile = await response.json();
            }
          }

          if (summaryData.teamSize) {
            const response = await fetch('/api/onboarding-wizard/team-size', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(summaryData.teamSize),
            });
            if (response.ok) {
              results.teamSize = await response.json();
            }
          }

          if (summaryData.services) {
            const response = await fetch('/api/onboarding-wizard/services', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(summaryData.services),
            });
            if (response.ok) {
              results.services = await response.json();
            }
          }

          if (summaryData.branding) {
            const response = await fetch('/api/onboarding-wizard/branding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(summaryData.branding),
            });
            if (response.ok) {
              results.branding = await response.json();
            }
          }

          if (summaryData.userSetup) {
            const response = await fetch('/api/onboarding-wizard/user-setup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(summaryData.userSetup),
            });
            if (response.ok) {
              results.userSetup = await response.json();
            }
          }


          // Update local store with saved data
          set((state) => ({
            stepData: {
              ...state.stepData,
              ...summaryData,
            },
          }));

          return results;
        } catch (error) {
          throw error;
        }
      },
    }),
    {
      name: "onboarding-wizard-store",
      storage: createSafeStorage(),
      skipHydration: true,
      partialize: (state) => ({
        ...state,
        stepData: removeBase64Data(state.stepData),
      }),
    }
  )
);
