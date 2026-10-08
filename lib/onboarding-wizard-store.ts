
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
  DisclaimersFormData,
  TeamInvite
} from "@/types/wizard";
import { normalizeCleanDomain } from "./url-utils";
import { normalizeOrganizationType } from "@/config/onboarding/organization-types";
import { normalizeTeamSize } from "@/config/onboarding/team-sizes";
import { step2ServicesToCategories } from "./service-categories";
import { getSession } from "next-auth/react";
import { toast } from "sonner";

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

/**
 * The three sub-screens of Onboarding Step 5 (see `step-5-onboarding.tsx`).
 *
 *   "review"      -> 5a Review Your Information
 *   "disclosures" -> 5b Compliance Disclosures
 *   "team"        -> 5c Invite Your Team (only above a "Just me" team size)
 */
export type Step5SubStep = "review" | "disclosures" | "team";

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
  /**
   * What produced the current `errorFields` — `"next"` (the wizard's Next
   * validation) or `"blur"` (a single field validated as the user left it).
   * Consumed by `useScrollToErrorField` so blur-triggered errors paint in place
   * without scrolling/stealing focus back to the field the user just left.
   */
  errorFieldsSource: "next" | "blur" | null;
  isLoading: boolean;
  loadingPromise: Promise<any> | null;
  stepLoadingPromises: Record<string, Promise<any>>;
  /**
   * The active sub-screen of Onboarding Step 5. Step 5 is a self-contained
   * sub-stepper: 5a Review -> 5b Disclosures -> [5c Team] -> finish.
   */
  step5SubStep: Step5SubStep;
  setStep5SubStep: (sub: Step5SubStep) => void;
  /**
   * True while a Review (5a) "Edit" link has opened one of Steps 1-4. In this
   * mode the step's primary action ("Save & Return to Review") saves and then
   * returns straight to Review, and Previous returns to Review WITHOUT saving —
   * the user never walks through the in-between steps.
   */
  editFromReview: boolean;
  /** Open one of Steps 1-4 from Review (5a) in edit-from-review mode. */
  startEditingFromReview: (step: number) => void;
  /** Leave edit-from-review mode, returning to 5a Review (no save). */
  returnToReview: () => void;
  /**
   * Onboarding Step 5c invite rows. Held in the store (not component-local) so
   * the wizard footer's "Send Invites & Finish" can read them when it turns the
   * filled rows into pending Team Members and sends their invite emails. Rows
   * that are entirely blank are ignored on send.
   */
  teamInvites: TeamInvite[];
  setTeamInvites: (invites: TeamInvite[]) => void;
  showStep5ConfirmModal: boolean;
  setShowStep5ConfirmModal: (show: boolean) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  persistCurrentStep: (step: number) => Promise<void>;
  completeStep: (stepId: number) => void;
  saveStepData: (stepType: string, data: any, saveToServer?: boolean) => Promise<void>;
  saveStepDataLocally: (stepType: string, data: any) => Promise<void>;
  saveStepDataToServer: (stepType: string, data: any) => Promise<boolean>;
  loadStepData: (stepType: string, force?: boolean) => Promise<any>;
  loadAllWizardData: (force?: boolean) => Promise<any>;
  completeWizard: () => void;
  resetWizard: () => void;
  setErrorFields: (fields: string[], source?: "next" | "blur" | null) => void;
  clearErrorFields: () => void;
  /**
   * Remove ONE field from `errorFields` — used when the user satisfies that
   * field (e.g. selecting an option) so a stale message cannot linger. Clear
   * only: it never adds an error, so it cannot surface one on selection.
   */
  clearFieldError: (field: string) => void;
  validateCurrentStepFields: (step?: number) => Promise<void>;
  /**
   * Validate a SINGLE field after the user leaves it (blur) and surface only the
   * errors belonging to that field. This is the "leaves a field" half of the
   * validation-timing rule; the "clicks Next" half stays in the wizard.
   */
  validateFieldOnBlur: (step: number, field: string, data?: any) => Promise<void>;
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
      errorFieldsSource: null,
      isLoading: false,
      loadingPromise: null,
      stepLoadingPromises: {},
      autosaveToServer: false,
      setAutosaveToServer: (enabled: boolean) => set({ autosaveToServer: enabled }),
      step5SubStep: "review",
      setStep5SubStep: (sub: Step5SubStep) =>
        set({ step5SubStep: sub, errorFields: [], errorFieldsSource: null }),
      editFromReview: false,
      startEditingFromReview: (step: number) => {
        // Only Steps 1-4 have a Review "Edit" affordance.
        if (step < 1 || step > 4) return;
        set({
          currentStep: step,
          editFromReview: true,
          errorFields: [],
          errorFieldsSource: null,
        });
      },
      returnToReview: () => {
        set({
          currentStep: 5,
          step5SubStep: "review",
          editFromReview: false,
          errorFields: [],
          errorFieldsSource: null,
        });
      },
      showStep5ConfirmModal: false,
      setShowStep5ConfirmModal: (show: boolean) => set({ showStep5ConfirmModal: show }),
      teamInvites: [],
      setTeamInvites: (invites: TeamInvite[]) => set({ teamInvites: invites }),

      // Helper to persist currentStep to the server so returning users
      // resume at the exact step they were last on.
      persistCurrentStep: async (step: number) => {
        try {
          await fetch('/api/onboarding-wizard/session', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentStep: step }),
          });
        } catch (error) {
          // Silent — persistence is best-effort; the user can still navigate
        }
      },

      nextStep: async () => {
        const { currentStep, totalSteps, persistCurrentStep } = get();

        if (currentStep < totalSteps) {
          const next = currentStep + 1;
          set({
            currentStep: next,
            errorFields: [],
            errorFieldsSource: null,
            editFromReview: false,
            // Entering Step 5 always starts at 5a.
            ...(next === 5 ? { step5SubStep: "review" as Step5SubStep } : {}),
          });
          persistCurrentStep(next);
        }
      },

      previousStep: () => {
        const { currentStep, step5SubStep, setStep5SubStep, persistCurrentStep } = get();

        // Step 5 walks its sub-screens backwards (5c -> 5b -> 5a) before
        // leaving the step for Step 4.
        if (currentStep === 5) {
          if (step5SubStep === "team") {
            setStep5SubStep("disclosures");
            return;
          }
          if (step5SubStep === "disclosures") {
            setStep5SubStep("review");
            return;
          }
        }

        if (currentStep > 1) {
          const prev = currentStep - 1;
          set({
            currentStep: prev,
            errorFields: [],
            errorFieldsSource: null,
            editFromReview: false,
          });
          persistCurrentStep(prev);
        }
      },

      goToStep: (step: number) => {
        const { totalSteps, persistCurrentStep } = get();
        if (step >= 1 && step <= totalSteps) {
          set({
            currentStep: step,
            errorFields: [],
            errorFieldsSource: null,
            editFromReview: false,
            // Jumping to Step 5 always starts at 5a.
            ...(step === 5 ? { step5SubStep: "review" as Step5SubStep } : {}),
          });
          persistCurrentStep(step);
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
        // Debug: log branding data being saved
        if (stepType === "branding") {
          console.log(`[saveStepData] Saving branding data:`, {
            hasPrimaryColor: !!(data as any)?.primaryColor,
            hasSecondaryColor: !!(data as any)?.secondaryColor,
            primaryColor: (data as any)?.primaryColor,
            secondaryColor: (data as any)?.secondaryColor,
            allKeys: Object.keys(data),
          });
        }

        // Normalize website URL if present
        let normalizedData = { ...data };
        if (data.website) {
          normalizedData.website = normalizeCleanDomain(data.website);
        }

        // When saving Step 2 services, sync to userSetup.primaryServiceCategories in-memory (for UI/Settings)
        // but no longer persist to server since WizardUserSetup.primaryServiceCategories has been removed from the model.
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
              // Only persist services to server; userSetup categories are in-memory only
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
        const { stepData, stepLoadingPromises } = get();

        // If data already exists and not forcing reload, return cached data
        if (!force && stepData[stepType as keyof typeof stepData]) {
          const cachedData = stepData[stepType as keyof typeof stepData] as any;
          console.log(`[loadStepData] Returning CACHED data for "${stepType}":`, {
            hasPrimaryColor: !!(cachedData as any)?.primaryColor,
            hasSecondaryColor: !!(cachedData as any)?.secondaryColor,
            primaryColor: (cachedData as any)?.primaryColor,
            secondaryColor: (cachedData as any)?.secondaryColor,
          });
          return cachedData;
        }

        // If an in-flight request for this step already exists, share it so
        // multiple mount effects don't fire duplicate network requests.
        const existingPromise = stepLoadingPromises[stepType];
        if (existingPromise) {
          return existingPromise;
        }

        console.log(`[loadStepData] FETCHING from server for "${stepType}" (cached: ${!!stepData[stepType as keyof typeof stepData]})`);

        const promise = (async () => {
          try {
            // Convert camelCase to kebab-case for API endpoints
            const apiEndpoint = stepType.replace(/([A-Z])/g, '-$1').toLowerCase();
            const response = await fetch(`/api/onboarding-wizard/${apiEndpoint}`);
            if (response.ok) {
              const result = await response.json();
              const data = result[stepType];
              console.log(`[loadStepData] Server returned for "${stepType}":`, {
                hasData: !!data,
                hasPrimaryColor: !!(data as any)?.primaryColor,
                hasSecondaryColor: !!(data as any)?.secondaryColor,
                primaryColor: (data as any)?.primaryColor,
                secondaryColor: (data as any)?.secondaryColor,
              });
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
        })();

        set((state) => ({
          stepLoadingPromises: {
            ...state.stepLoadingPromises,
            [stepType]: promise,
          },
        }));

        try {
          return await promise;
        } finally {
          // Clear the in-flight entry once the request settles.
          set((state) => {
            const next = { ...state.stepLoadingPromises };
            delete next[stepType];
            return { stepLoadingPromises: next };
          });
        }
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

            // Eagerly create a wizard session if one doesn't exist yet.
            // This prevents race conditions where multiple auto-save calls
            // (e.g., onTypeSelect + teamSize useEffect) both try to create
            // their own session simultaneously.
            if (!sessionData.session) {
              const createResponse = await fetch('/api/onboarding-wizard/new-session', {
                method: 'POST',
              });
              if (createResponse.ok) {
                const createData = await createResponse.json();
                console.log("📥 [loadAllWizardData] Created new wizard session:", createData.sessionId);
              }
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

            // Fold retired ids from pre-migration rows into the current
            // vocabulary, so the forms, summaries and nativeEnum validation all
            // see a current id rather than a legacy one.
            if (loadedData.clientProfile?.organizationType) {
              loadedData.clientProfile = {
                ...loadedData.clientProfile,
                organizationType: normalizeOrganizationType(
                  loadedData.clientProfile.organizationType,
                ),
              };
            }
            if (loadedData.teamSize?.teamSize) {
              loadedData.teamSize = {
                ...loadedData.teamSize,
                teamSize: normalizeTeamSize(loadedData.teamSize.teamSize),
              };
            }

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
              // Determine the highest completed step from loaded data
              // so we can mark steps as completed in the stepper UI.
              const stepDataMap: Record<string, number> = {
                clientProfile: 1,
                teamSize: 1,
                services: 2,
                insuranceLicensing: 2,
                branding: 3,
                userSetup: 4,
                disclaimers: 5,
              };

              let highestStepWithData = 0;
              for (const [key, stepNum] of Object.entries(stepDataMap)) {
                if (loadedData[key]) {
                  highestStepWithData = Math.max(highestStepWithData, stepNum);
                }
              }

              // Mark steps as completed based on loaded data
              const updatedSteps = initialSteps.map((step) => ({
                ...step,
                completed: step.id <= highestStepWithData,
              }));

              // Restore currentStep from the server session so returning users
              // resume at the exact step they were last on (not inferred from data).
              let serverStep = 1;
              try {
                const sessionRes = await fetch('/api/onboarding-wizard/session');
                if (sessionRes.ok) {
                  const sessionJson = await sessionRes.json();
                  if (sessionJson?.session?.currentStep) {
                    serverStep = sessionJson.session.currentStep;
                  }
                }
              } catch {
                // Fall back to step 1 if the session fetch fails
              }

              set((state) => ({
                stepData: {
                  ...state.stepData,
                  ...loadedData,
                },
                steps: updatedSteps,
                currentStep: serverStep,
                // A fresh load always lands on Review, never mid-edit.
                step5SubStep: "review" as Step5SubStep,
                editFromReview: false,
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
        }).then(async response => {
          if (response.ok) {
            // Refresh the NextAuth JWT so the middleware onboarding gate sees
            // onboardingComplete=true before the redirect to /dashboard
            // (otherwise the user would be bounced straight back to onboarding).
            try {
              await getSession();
            } catch {
              // Best-effort; the jwt callback re-checks on the next session fetch.
            }
            // Redirect to new dashboard after completion
            window.location.href = '/dashboard';
          } else {
            // Handle error response
            const errorData = await response.json();
            console.error("Failed to complete wizard:", errorData);
            toast.error(`Error completing onboarding: ${errorData.error || 'Unknown error'}`);
          }
        }).catch((error) => {
          console.error("Error calling complete endpoint:", error);
          toast.error(`Error completing onboarding: ${error.message || 'Network error'}`);
        });
      },

      resetWizard: () => {
        set({
          currentStep: 1,
          steps: initialSteps.map((step) => ({ ...step, completed: false })),
          isCompleted: false,
          stepData: {},
          errorFields: [],
          errorFieldsSource: null,
          step5SubStep: "review",
          editFromReview: false,
          teamInvites: [],
          isLoading: false,
          loadingPromise: null,
        });
      },

      setErrorFields: (
        fields: string[],
        source: "next" | "blur" | null = null,
      ) => {
        set({ errorFields: fields, errorFieldsSource: source });
      },

      clearErrorFields: () => {
        set({ errorFields: [], errorFieldsSource: null });
      },

      clearFieldError: (field: string) => {
        set((state) => ({
          errorFields: state.errorFields.filter((f) => f !== field),
        }));
      },

      // Per-field blur validation ("leaves a field"). Validates the step against
      // the supplied snapshot (or the current store data) and surfaces ONLY the
      // errors belonging to `field`, so blurring one field never paints another
      // untouched field red. Source is "blur" so the scroll hook leaves focus
      // where the user put it.
      validateFieldOnBlur: async (step: number, field: string, data?: any) => {
        const snapshot = data ?? get().stepData;
        try {
          const { validateCurrentStep } = await import("./wizard-validation");
          const result = await validateCurrentStep(step, snapshot);
          const scoped = result.isValid
            ? []
            : (result.errorFields || []).filter((f) => f === field);
          set({ errorFields: scoped, errorFieldsSource: "blur" });
        } catch {
          // Silent — blur validation is best-effort.
        }
      },

      validateCurrentStepFields: async (step?: number) => {
        const { currentStep, stepData } = get();

        // Validate an explicit step when provided (callers pass the step they
        // belong to). This prevents a delayed `setTimeout(...)` validation from
        // a previous step (e.g. Step 2) from running after the user has already
        // navigated to the next step — which would otherwise validate the NEW
        // step against empty data and stamp red borders on untouched fields
        // (e.g. Step 3 branding fields on initial navigation).
        const stepToValidate = step ?? currentStep;
        try {
          const { validateCurrentStep } = await import("./wizard-validation");
          const validationResult = await validateCurrentStep(stepToValidate, stepData);

          if (!validationResult.isValid && validationResult.errorFields) {
            set({
              errorFields: validationResult.errorFields,
              errorFieldsSource: "next",
            });
          } else {
            set({ errorFields: [], errorFieldsSource: null });
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
      partialize: (state) => {
        const { stepLoadingPromises: _stepLoadingPromises, ...rest } = state;
        return {
          ...rest,
          errorFields: [],
          stepData: removeBase64Data(state.stepData),
        };
      },
    }
  )
);
