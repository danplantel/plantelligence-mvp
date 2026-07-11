import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CompanyBasicsData,
  WelcomeStatementData,
  KeyContactsData,
  ComplianceDocumentsData,
  EmployeePortalPreviewData,
  ContactBuilderData,
  NewClientWizardStep,
  KeyContact,
  DisclaimersData,
} from "@/types/new-client-wizard";
import { validateNewClientCurrentStepV2 } from "./new-client-wizard-validation-v2";
import { normalizeCleanDomain } from "./url-utils";
import { findFirstIncompleteWizardStepNumber } from "./wizard-progress";
import { mergeAdvisorProfileIntoWizardStepData } from "./wizard-advisor-prefill";
import {
  DuplicatePlanNameError,
  DUPLICATE_PLAN_NAME_CODE,
  isDuplicatePlanNameError,
} from "./duplicate-plan-name-error";

type CompanyBasicsSubStep = "branding" | "welcomeMission";

/** Options for save-draft (e.g. avoid duplicate-name modal during step 1 logo upload). */
export type SaveDraftOptions = {
  /**
   * When false, duplicate plan name (API returns success:false + DUPLICATE_PLAN_NAME) does not open the dialog — keeps working locally
   * (e.g. base64 logo until user clicks Next). Default true.
   */
  showDuplicatePlanDialog?: boolean;
};

export const getCompanyBasicsSubStep = (
  stepData: any,
): CompanyBasicsSubStep => {
  const raw =
    stepData?.companyBasicsSubStep?.current ?? stepData?.companyBasicsSubStep;
  if (raw === "welcomeMission" || raw === "branding") {
    return raw;
  }
  return "branding";
};

// Function to focus on first invalid field and scroll to it
export const focusFirstInvalidField = (errorFields: string[]) => {
  if (!errorFields || errorFields.length === 0) return;

  const firstErrorField = errorFields[0];

  // Helper function to check if a string contains special CSS selector characters
  const hasInvalidSelectorChars = (str: string): boolean => {
    // Check for characters that are invalid in CSS selectors without escaping
    // These include: . # : [ ] ( ) space and other special chars
    return /[.#:\[\]()\s]/.test(str);
  };

  // Try different selectors for the field
  const selectors = [
    `[data-field="${firstErrorField}"]`,
    `input[name="${firstErrorField}"]`,
    `select[name="${firstErrorField}"]`,
    `textarea[name="${firstErrorField}"]`,
    // Use attribute selector instead of ID selector if field contains special characters
    hasInvalidSelectorChars(firstErrorField)
      ? `[id="${firstErrorField}"]`
      : `#${firstErrorField}`,
    `[id*="${firstErrorField}"]`,
  ];

  let element: HTMLElement | null = null;

  for (const selector of selectors) {
    try {
      element = document.querySelector(selector) as HTMLElement;
      if (element) {
        break;
      }
    } catch (error) {
      // Skip invalid selectors (e.g., if selector has syntax errors)
      console.warn(`Invalid selector: ${selector}`, error);
      continue;
    }
  }

  if (element) {
    // Scroll to element
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // Focus on element
    setTimeout(() => {
      if (element && typeof element.focus === "function") {
        element.focus();
      } else if (element && element.querySelector) {
        // Try to find focusable element inside
        const focusableElement = element.querySelector(
          "input, select, textarea, button",
        ) as HTMLElement;
        if (focusableElement && typeof focusableElement.focus === "function") {
          focusableElement.focus();
        }
      }
    }, 300);
  } else {
  }
};

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface NewClientWizardState {
  currentStep: number;
  totalSteps: number;
  steps: WizardStep[];
  isCompleted: boolean;
  stepData: {
    companyBasics?: CompanyBasicsData;
    welcomeStatement?: WelcomeStatementData;
    keyContacts?: KeyContactsData;
    complianceDocuments?: ComplianceDocumentsData;
    employeePortalPreview?: EmployeePortalPreviewData;
    disclaimers?: DisclaimersData;
    optionalDocuments?: any; // Keep for backward compatibility
    clientInfo?: any; // Keep for backward compatibility
    documentData?: any; // Keep for backward compatibility
    contactBuilder?: ContactBuilderData;
  };
  sessionId?: string;
  draftClientId?: string; // ID of the draft client being edited (if loaded from draft)
  errorFields: string[];
  nextStep: () => Promise<{ isValid: boolean; errors: any[] }>;
  previousStep: () => void;
  goToStep: (step: number) => void;
  completeStep: (stepId: number) => void;
  completeWizard: () => Promise<void>;
  saveAsDraft: (options?: SaveDraftOptions) => Promise<unknown>;
  saveStepData: (
    stepType: string,
    data: any,
    saveToServer?: boolean,
  ) => Promise<void>;
  saveStepDataLocally: (stepType: string, data: any) => Promise<void>;
  saveStepDataToServer: (stepType: string, data: any) => Promise<boolean>;
  loadStepData: (stepType: string, force?: boolean) => Promise<any>;
  loadAllWizardData: () => Promise<any>;
  loadDraft: () => Promise<any>;
  loadDraftById: (clientId: string) => Promise<any>;
  loadOnboardingData: () => Promise<any>;
  updateCurrentStep: (step: number) => Promise<void>;
  createNewSession: () => Promise<void>;
  /** After a new session, merge advisor profile into empty step 1 fields (logo, site, colors). */
  seedAdvisorDefaultsFromProfile: () => Promise<void>;
  /** Jump to the first step (1–4) that fails validation; no-op if all pass or step unchanged. */
  syncCurrentStepToFirstIncomplete: () => Promise<void>;
  resetWizard: () => void;
  setErrorFields: (fields: string[]) => void;
  clearErrorFields: () => void;
  validateCurrentStepFields: () => Promise<void>;
  compareContactFields: (contact1: KeyContact, contact2: any) => number;
  saveFutureContactToUser: (contact: KeyContact) => Promise<any>;
  selectedCategoryStep3a: string | null;
  setSelectedCategoryStep3a: (category: string | null) => void;
  /** Current slide index within Step 3 (0=first contact, 1=form, 2=categories, 3=preview). Replaces legacy step3SubStep routing. */
  step3SlideIndex: number;
  setStep3SlideIndex: (index: number) => void;
  advisorProfile: any;
  setAdvisorProfile: (profile: any) => void;
  /** Set when save-draft reports duplicate plan name — drives duplicate-name dialog */
  duplicatePlanNameConflict: {
    existingClientId: string;
    companyName: string;
  } | null;
  clearDuplicatePlanNameConflict: () => void;
  /** After user confirms overwrite in duplicate-name dialog */
  resolveDuplicatePlanOverwrite: () => Promise<void>;
  /** After user enters a new unique plan name */
  resolveDuplicatePlanSaveAsNew: (newCompanyName: string) => Promise<void>;
}

export const newClientWizardSteps: WizardStep[] = [
  {
    id: 1,
    title: "Company Basics & Branding",
    description: "Set up company identity and branding",
    completed: false,
  },
  {
    id: 2,
    title: "Plan Branding & Messaging Preview",
    description: "Create welcome message for employee portal",
    completed: false,
  },
  {
    id: 3,
    title: "Key Contacts",
    description: "Add contacts for employee support",
    completed: false,
  },
  {
    id: 4,
    title: "Plan Documents",
    description: "Upload plan documents and forms (optional)",
    completed: false,
  },
  {
    id: 5,
    title: "Employee Portal Preview",
    description: "Review your branded benefits hub",
    completed: false,
  },
];

// Helper function to recursively remove base64 data from objects
const removeBase64Data = (obj: any): any => {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeBase64Data(item));
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip base64 images and large data URLs
    if (
      typeof value === "string" &&
      (value.startsWith("data:image/") ||
        value.startsWith("data:video/") ||
        value.length > 100000) // Skip strings longer than 100KB
    ) {
      // Keep the key but set to empty string to preserve structure
      cleaned[key] = "";
      continue;
    }

    // Recursively clean nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      cleaned[key] = removeBase64Data(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? removeBase64Data(item)
          : item,
      );
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
};

// Helper function to remove base64 data specifically for API calls to avoid 413 errors
// Unlike removeBase64Data, this omits the keys entirely so the server knows not to update them
const removeBase64ForApi = (obj: any): any => {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeBase64ForApi(item));
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip base64 images and large data URLs, BUT KEEP branding keys for plan persistence
    if (
      typeof value === "string" &&
      (value.startsWith("data:image/") ||
        value.startsWith("data:video/") ||
        value.length > 50000) // Skip strings longer than 50KB for API
    ) {
      const isBrandingKey = [
        "companyLogo",
        "logoUrl",
        "url",
        "originalImage",
        "brandImages",
        "thumbnailImg",
        "headerImg",
      ].includes(key);
      if (!isBrandingKey) {
        // Omit the key entirely
        continue;
      }
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      cleaned[key] = removeBase64ForApi(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? removeBase64ForApi(item)
          : item,
      );
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
};

// Keep only small data URLs in localStorage to avoid quota issues.
// For images, we prefer persisting the CROPPED preview (usually much smaller) and avoid persisting originals.
const keepSmallDataUrl = (value: unknown, maxChars: number): string => {
  if (typeof value !== "string") return "";
  if (!value.startsWith("data:image/")) return value; // already a URL
  return value.length <= maxChars ? value : "";
};

// Remove originalImage from cropData (it can be a large base64 string).
const stripOriginalFromCropData = (cropData: any): any => {
  if (!cropData || typeof cropData !== "object") return cropData;
  const { originalImage, ...rest } = cropData as any;
  return rest;
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
        // Track when the wizard data was last saved so the page can show a
        // "Resuming draft saved …" toast after rehydration.  Zustand v4 stores
        // { state, version } — there is no _persist.time like v5, so we keep
        // a companion timestamp.
        if (name === "new-client-wizard") {
          localStorage.setItem(
            "new-client-wizard-saved-at",
            JSON.stringify(Date.now()),
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === "QuotaExceededError") {
          try {
            // Clear the specific item and try again
            localStorage.removeItem(name);
            // Try with cleaned data
            const stringValue =
              typeof value === "string" ? value : JSON.stringify(value);
            localStorage.setItem(name, stringValue);
            if (name === "new-client-wizard") {
              localStorage.setItem(
                "new-client-wizard-saved-at",
                JSON.stringify(Date.now()),
              );
            }
          } catch (retryError) {
            // If still failing, try to remove base64 data and save minimal version
            try {
              const parsed =
                typeof value === "string" ? JSON.parse(value) : value;
              const cleaned = removeBase64Data(parsed);
              const cleanedString = JSON.stringify(cleaned);
              localStorage.setItem(name, cleanedString);
              if (name === "new-client-wizard") {
                localStorage.setItem(
                  "new-client-wizard-saved-at",
                  JSON.stringify(Date.now()),
                );
              }
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
      } catch (error) {}
    },
  };
};

// ==================== Step 3 Slide-Based Next Handler ====================

async function handleStep3NextBySlide(
  set: (partial: Partial<NewClientWizardState>) => void,
  get: () => NewClientWizardState,
): Promise<{ isValid: boolean; errors: any[] }> {
  const { step3SlideIndex, stepData } = get();
  const keyContactsData = stepData.keyContacts || { contacts: [] };
  const contacts = keyContactsData.contacts || [];

  switch (step3SlideIndex) {
    case 0: {
      // Slide 0 (First Contact Prompt) → Slide 1 (Contact Form)
      set({
        step3SlideIndex: 1,
        stepData: {
          ...stepData,
          step3SubStep: { step3SubStep: "step3b" },
        },
      } as any);
      return { isValid: true, errors: [] };
    }

    case 1: {
      // Slide 1 (Contact Form) → Slide 2 (Category Explorer)
      // Validation is handled by validateNewClientCurrentStepV2
      if (contacts.length >= 5) {
        // Jump to preview if 5+ valid contacts
        set({
          step3SlideIndex: 3,
          stepData: {
            ...stepData,
            step3SubStep: { step3SubStep: "step3d" },
          },
        } as any);
      } else {
        set({
          step3SlideIndex: 2,
          stepData: {
            ...stepData,
            step3SubStep: { step3SubStep: "step3c" },
          },
        } as any);
      }
      return { isValid: true, errors: [] };
    }

    case 2: {
      // Slide 2 (Category Explorer) → Slide 3 (Preview)
      set({
        step3SlideIndex: 3,
        stepData: {
          ...stepData,
          step3SubStep: { step3SubStep: "step3d" },
        },
      } as any);
      return { isValid: true, errors: [] };
    }

    case 3: {
      // Slide 3 (Preview) → Step 4
      if (keyContactsData) {
        try {
          await get().saveStepDataToServer("keyContacts", keyContactsData);
          await get().saveAsDraft();
        } catch (error) {
          if (isDuplicatePlanNameError(error)) {
            throw error;
          }
          console.error("Failed to save draft when leaving step3d:", error);
        }
      }
      if (get().currentStep < get().totalSteps) {
        set({ currentStep: get().currentStep + 1 });
      }
      return { isValid: true, errors: [] };
    }

    default:
      return { isValid: true, errors: [] };
  }
}

export const useNewClientWizardStore = create<NewClientWizardState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      totalSteps: 5,
      steps: newClientWizardSteps,
      isCompleted: false,
      stepData: {},
      errorFields: [],
      advisorProfile: null,
      setAdvisorProfile: (profile: any) => set({ advisorProfile: profile }),
      duplicatePlanNameConflict: null,
      clearDuplicatePlanNameConflict: () =>
        set({ duplicatePlanNameConflict: null }),
      resolveDuplicatePlanOverwrite: async () => {
        const c = get().duplicatePlanNameConflict;
        if (!c) return;
        set({
          draftClientId: c.existingClientId,
          duplicatePlanNameConflict: null,
        });
        await get().saveAsDraft();
        // User already passed Step 1 validation to hit duplicate; after they choose Overwrite,
        // continue to Step 2 instead of requiring another Next click.
        if (get().currentStep === 1) {
          get().completeStep(1);
          set({ currentStep: 2, errorFields: [] });
          await get().updateCurrentStep(2);
        }
      },
      resolveDuplicatePlanSaveAsNew: async (newCompanyName: string) => {
        const t = (newCompanyName || "").trim();
        if (!t) return;
        set((s) => ({
          duplicatePlanNameConflict: null,
          stepData: {
            ...s.stepData,
            companyBasics: {
              ...(s.stepData.companyBasics || {}),
              companyName: t,
            } as CompanyBasicsData,
          },
        }));
        await get().saveAsDraft();
        if (get().currentStep === 1) {
          get().completeStep(1);
          set({ currentStep: 2, errorFields: [] });
          await get().updateCurrentStep(2);
        }
      },
      selectedCategoryStep3a: null,
      setSelectedCategoryStep3a: (category: string | null) =>
        set({ selectedCategoryStep3a: category }),

      step3SlideIndex: 0,
      setStep3SlideIndex: (index: number) => set({ step3SlideIndex: index }),

      nextStep: async () => {
        const { currentStep, totalSteps, stepData, step3SlideIndex } = get();
        const validationResult = await validateNewClientCurrentStepV2(
          currentStep,
          stepData,
        );

        if (!validationResult.isValid) {
          if (validationResult.errorFields) {
            set({ errorFields: validationResult.errorFields });
          }

          return { isValid: false, errors: validationResult.errors };
        }

        set({ errorFields: [] });

        // Step 1 is a single branding screen (welcome/mission live on step 2). Do not return early
        // on a legacy "welcomeMission" substep — that skipped save-draft and blocked the duplicate
        // plan name modal until a second Next click.

        if (currentStep === 3 && validationResult.isValid) {
          // Try new slide-based routing first, fall back to legacy step3SubStep
          if (typeof step3SlideIndex === "number") {
            return handleStep3NextBySlide(set, get as any);
          }

          // Legacy flow (backward compatibility)
          const step3SubStep =
            (stepData as any)?.step3SubStep?.step3SubStep ||
            (stepData as any)?.step3SubStep ||
            "step3a";

          if (step3SubStep === "step3a") {
            const { selectedCategoryStep3a, stepData } = get();
            const contacts = stepData.keyContacts?.contacts || [];

            // If we have 2+ contacts and NO category selected, and user clicks Next (which is labeled "Continue")
            if (contacts.length >= 2 && !selectedCategoryStep3a) {
              set((state) => ({
                stepData: {
                  ...state.stepData,
                  step3SubStep: { step3SubStep: "step3d" },
                },
              }));
              return { isValid: true, errors: [] };
            }

            // Create contact from selected category before transitioning
            const createContact = (window as any).__step3aCreateContact;
            if (createContact) {
              createContact();
            }

            set((state) => ({
              stepData: {
                ...state.stepData,
                step3SubStep: {
                  step3SubStep: "step3b",
                  openContactsTab: true,
                },
              },
            }));
            return { isValid: true, errors: [] };
          } else if (step3SubStep === "step3b") {
            // Check if at least one contact exists
            const keyContactsData = stepData.keyContacts || { contacts: [] };
            const contacts = keyContactsData.contacts || [];
            const hasContacts = contacts.length > 0;

            // Save to server and draft before proceeding
            if (keyContactsData && hasContacts) {
              try {
                await get().saveStepDataToServer(
                  "keyContacts",
                  keyContactsData,
                );
                await get().saveAsDraft();
              } catch (error) {
                if (isDuplicatePlanNameError(error)) {
                  throw error;
                }
                console.error(
                  "Failed to save draft when going to next step from step3b:",
                  error,
                );
              }
            }

            if (hasContacts) {
              // Count contacts with minimum required data (email or phone)
              const validContacts = contacts.filter((contact: any) => {
                const hasMinimumData =
                  (contact.email && contact.email.trim() !== "") ||
                  (contact.phone && contact.phone.trim() !== "");
                return hasMinimumData;
              });

              // If there are 5 or more contacts, skip step3c and go to step3d
              if (validContacts.length >= 5) {
                set((state) => ({
                  stepData: {
                    ...state.stepData,
                    step3SubStep: { step3SubStep: "step3d" },
                  },
                }));
                return { isValid: true, errors: [] };
              }

              // Otherwise, navigate to step3c (Save & Add Contact or Next page)
              set((state) => ({
                stepData: {
                  ...state.stepData,
                  step3SubStep: { step3SubStep: "step3c" },
                },
              }));
              return { isValid: true, errors: [] };
            } else {
              // No contacts yet, navigate back to step3a
              set((state) => ({
                stepData: {
                  ...state.stepData,
                  step3SubStep: { step3SubStep: "step3a", fromStep3b: true },
                },
              }));
              return { isValid: true, errors: [] };
            }
          } else if (step3SubStep === "step3c") {
            // Create contact from selected category before transitioning
            const createContact = (window as any).__step3cCreateContact;
            if (createContact) {
              createContact();
            }
            // Navigate to step3b to fill in contact details
            set((state) => ({
              stepData: {
                ...state.stepData,
                step3SubStep: {
                  step3SubStep: "step3b",
                  openContactsTab: true,
                },
              },
            }));
            return { isValid: true, errors: [] };
          } else if (step3SubStep === "step3d") {
            // Save to server and draft before moving to next main step (step 4)
            const keyContactsData = stepData.keyContacts || { contacts: [] };
            if (keyContactsData) {
              try {
                await get().saveStepDataToServer(
                  "keyContacts",
                  keyContactsData,
                );
                await get().saveAsDraft();
              } catch (error) {
                if (isDuplicatePlanNameError(error)) {
                  throw error;
                }
                console.error(
                  "Failed to save draft when going to next step from step3d:",
                  error,
                );
              }
            }

            // Move to next main step (step 4)
            if (currentStep < totalSteps) {
              set({ currentStep: currentStep + 1 });
            }
            return { isValid: true, errors: [] };
          }
        }

        if (currentStep === 5) {
          const step5SubStep =
            stepData.employeePortalPreview?.step5SubStep || "disclaimers";

          if (step5SubStep === "disclaimers") {
            // Save the disclaimer data before completion
            try {
              const disclaimersData = stepData.disclaimers;
              if (disclaimersData) {
                await get().saveStepDataToServer(
                  "disclaimers",
                  disclaimersData,
                );
              }
              const previewData = stepData.employeePortalPreview;
              if (previewData) {
                await get().saveStepDataToServer(
                  "employeePortalPreview",
                  previewData,
                );
              }
              await get().saveAsDraft();
            } catch (saveError) {
              if (isDuplicatePlanNameError(saveError)) {
                throw saveError;
              }
              // Non-blocking: continue even if save fails
            }

            // Do NOT transition to benefits-team — the wizard will treat
            // this as the final step and the "Complete Setup" button will
            // trigger completeWizard() which validates & publishes the plan.
            return { isValid: true, errors: [] };
          }
          // If on benefits-team/step5d, proceed to completion (handled below or by completeWizard)
        }

        // Save current step data to server before proceeding
        try {
          const stepType =
            currentStep === 1
              ? "companyBasics"
              : currentStep === 2
              ? "welcomeStatement"
              : currentStep === 3
              ? "keyContacts"
              : currentStep === 4
              ? "complianceDocuments"
              : "employeePortalPreview";

          if (stepData[stepType]) {
            await get().saveStepDataToServer(stepType, stepData[stepType]);
          }

          // Save complete draft after saving step data
          try {
            await get().saveAsDraft();
          } catch (draftError) {
            if (isDuplicatePlanNameError(draftError)) {
              throw draftError;
            }
          }

          // Save contacts to cards when moving to step 4 (after step 3)
          if (currentStep === 3) {
            const { saveFutureContactToUser, compareContactFields } = get();
            const contacts = stepData.keyContacts?.contacts || [];

            // Fetch existing saved contacts to compare
            let savedContacts: any[] = [];
            try {
              const sessionRes = await fetch("/api/auth/session");
              const sessionData = await sessionRes.json();
              const userId = sessionData.user?.id;
              if (userId) {
                const response = await fetch(
                  `/api/user/${userId}/save-future-contact`,
                );
                if (response.ok) {
                  savedContacts = await response.json();
                }
              }
            } catch (error) {}

            for (const contact of contacts) {
              const contactName =
                contact?.email ||
                `${contact?.firstName || ""} ${
                  contact?.lastName || ""
                }`.trim() ||
                "Unknown";
              if (
                !contact?.email ||
                (!contact?.firstName && !contact?.lastName)
              ) {
                continue;
              }

              let shouldSave = true;

              if (savedContacts.length > 0) {
                const isSimilarToAny = savedContacts.some((saved) => {
                  const diffCount = compareContactFields(contact, saved);
                  const savedName =
                    saved?.email ||
                    `${saved?.firstName || ""} ${
                      saved?.lastName || ""
                    }`.trim() ||
                    "Unknown";
                  return diffCount < 4;
                });

                shouldSave = !isSimilarToAny;
              }

              if (shouldSave) {
                try {
                  const contactToSave: KeyContact = {
                    ...contact,
                    displayScope: "futureUse" as const,
                  };
                  await saveFutureContactToUser(contactToSave);
                } catch (error: any) {
                  // Ignore duplicate errors (409) - that's expected
                  if (
                    error?.message?.includes("409") ||
                    error?.status === 409
                  ) {
                  } else {
                  }
                }
              } else {
              }
            }
          }
        } catch (error) {
          if (isDuplicatePlanNameError(error)) {
            throw error;
          }
          // Other save failures: don't block wizard progress
        }

        if (currentStep < totalSteps) {
          set({ currentStep: currentStep + 1, errorFields: [] });
        }
        return { isValid: true, errors: [] };
      },

      previousStep: () => {
        const { currentStep, stepData } = get();

        if (currentStep === 3) {
          const step3SubStep =
            (stepData as any)?.step3SubStep?.step3SubStep ||
            (stepData as any)?.step3SubStep;

          if (step3SubStep === "step3d") {
            set((state) => ({
              stepData: {
                ...state.stepData,
                step3SubStep: {
                  step3SubStep: "step3c",
                  selectedContactId: undefined,
                },
              },
            }));
            return;
          } else if (step3SubStep === "step3c") {
            set((state) => ({
              stepData: {
                ...state.stepData,
                step3SubStep: { step3SubStep: "step3b" },
              },
            }));
            return;
          } else if (step3SubStep === "step3b") {
            // When Add New Card flow (isCreatingNew): remove the new contact when going back, even if all fields filled
            // When editing existing: just go back, don't remove
            const keyContactsData = stepData.keyContacts || { contacts: [] };
            const contacts = keyContactsData.contacts || [];
            const step3SubStepData = (stepData as any).step3SubStep || {};
            const isCreatingNew = step3SubStepData.isCreatingNew === true;
            const selectedId = step3SubStepData.selectedContactId;

            let cleanedContacts = contacts;
            if (isCreatingNew && selectedId) {
              cleanedContacts = contacts.filter(
                (c: any) => c.id !== selectedId,
              );
            } else if (isCreatingNew && contacts.length > 0) {
              // No selectedId but creating new - remove last added (the one in form)
              cleanedContacts = contacts.slice(0, -1);
            } else if (!isCreatingNew) {
              // Editing existing - remove only incomplete contacts
              cleanedContacts = contacts.filter((contact: any) => {
                const hasFirstName =
                  contact.firstName && String(contact.firstName).trim() !== "";
                const hasLastName =
                  contact.lastName && String(contact.lastName).trim() !== "";
                const hasEmail =
                  contact.email && String(contact.email).trim() !== "";
                const hasPhone =
                  contact.phone && String(contact.phone).trim() !== "";
                return hasFirstName && hasLastName && (hasEmail || hasPhone);
              });
            }

            const cleanedKeyContacts = {
              ...keyContactsData,
              contacts: cleanedContacts,
            };

            set((state) => ({
              stepData: {
                ...state.stepData,
                keyContacts: cleanedKeyContacts,
                step3SubStep: { step3SubStep: "step3a" },
              },
            }));
            return;
          }
        }

        if (currentStep === 1) {
          const companyBasicsSubStep = getCompanyBasicsSubStep(stepData);
          if (companyBasicsSubStep === "welcomeMission") {
            set((state) => ({
              stepData: {
                ...state.stepData,
                companyBasicsSubStep: { current: "branding" },
              },
              errorFields: [],
            }));
            return;
          }
        }

        if (currentStep === 5) {
          const step5SubStep =
            stepData.employeePortalPreview?.step5SubStep || "disclaimers";

          // If on step-5d (benefits-team or step5d), go back to disclaimers
          if (step5SubStep === "benefits-team" || step5SubStep === "step5d") {
            set((state) => ({
              stepData: {
                ...state.stepData,
                employeePortalPreview: {
                  ...state.stepData.employeePortalPreview,
                  previewData:
                    state.stepData.employeePortalPreview?.previewData || {},
                  step5SubStep: "disclaimers",
                },
              },
            }));
            return;
          }
        }

        if (currentStep > 1) {
          set({ currentStep: currentStep - 1, errorFields: [] });
        }
      },

      goToStep: (step: number) => {
        const { totalSteps, currentStep } = get();
        if (step >= 1 && step <= totalSteps) {
          set({ currentStep: step, errorFields: [] });
        }
      },

      completeStep: (stepId: number) => {
        set((state) => ({
          steps: state.steps.map((step) =>
            step.id === stepId ? { ...step, completed: true } : step,
          ),
        }));
      },

      compareContactFields: (contact1: KeyContact, contact2: any): number => {
        const COMPARISON_FIELDS = [
          "email",
          "phone",
          "firstName",
          "lastName",
          "companyName",
          "title",
          "benefitsCategory",
          "role",
        ] as const;

        let differences = 0;
        for (const field of COMPARISON_FIELDS) {
          const val1 = contact1[field]?.toString().toLowerCase().trim() || "";
          let val2 = contact2[field]?.toString().toLowerCase().trim() || "";

          if (field === "role") {
            const normalizeRole = (role: string) => {
              if (!role) return "";
              const normalized = role.toLowerCase().trim();
              if (
                normalized === "advisor" ||
                normalized === "advisor/specialist"
              )
                return "advisor/specialist";
              if (normalized === "hr" || normalized === "hr/generalist")
                return "hr/generalist";
              if (
                normalized === "recordkeeper" ||
                normalized === "vendor/provider"
              )
                return "vendor/provider";
              return normalized;
            };
            val2 = normalizeRole(val2);
            const normalizedVal1 = normalizeRole(val1);
            if (normalizedVal1 !== val2) {
              differences++;
            }
          } else {
            if (val1 !== val2) {
              differences++;
            }
          }
        }
        return differences;
      },

      saveFutureContactToUser: async (contact: KeyContact) => {
        try {
          const user = await fetch("/api/auth/session");
          const userData = await user.json();
          const userId = userData.user.id;

          const { id, ...contactWithoutId } = contact;

          const legacyRole =
            contact.role === "Advisor / Specialist"
              ? "advisor"
              : contact.role === "HR Generalist"
              ? "hr"
              : contact.role === "Vendor / Provider"
              ? "recordkeeper"
              : contact.role === "Recordkeeper"
              ? "recordkeeper"
              : contact.role === "Insurance Carrier"
              ? "recordkeeper"
              : contact.role === "Support Team"
              ? "other"
              : "other";

          const payload = {
            ...contactWithoutId,
            role: legacyRole,
            name:
              contact.name ||
              `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
              contact.email ||
              "",
          };

          const response = await fetch(
            `/api/user/${userId}/save-future-contact`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            },
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 409) {
              return { duplicate: true };
            }
            throw new Error(`Failed to save contact: ${response.statusText}`);
          }

          const data = await response.json();
          return data;
        } catch (error) {
          throw error;
        }
      },

      completeWizard: async () => {
        const { stepData, draftClientId } = get();

        for (let step = 1; step <= 5; step++) {
          const validationResult = await validateNewClientCurrentStepV2(
            step,
            stepData,
          );
          if (!validationResult.isValid) {
            throw new Error(
              `Step ${step} is not complete: ${validationResult.errors
                .map((e: any) => e.message)
                .join(", ")}`,
            );
          }
        }

        try {
          const stepSaveOrder: Array<keyof typeof stepData> = [
            "companyBasics",
            "welcomeStatement",
            "keyContacts",
            "contactBuilder",
            "complianceDocuments",
            "disclaimers",
            "employeePortalPreview",
          ];

          for (const stepType of stepSaveOrder) {
            const data = stepData[stepType];
            if (!data) continue;
            if (
              stepType === "contactBuilder" &&
              (!(data as any).fullName ||
                !(data as any).title ||
                !(data as any).companyName ||
                !(data as any).orgType)
            ) {
              continue;
            }
            const saved = await get().saveStepDataToServer(
              stepType,
              data,
            );
            if (!saved) {
              throw new Error(
                `Failed to save latest ${String(stepType)} data before publishing`,
              );
            }
          }

          const response = await fetch("/api/new-client-wizard/complete-v2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              draftClientId: draftClientId, // Pass draft client ID for cleanup
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || "Failed to complete wizard");
          }

          const result = await response.json();

          if (result.success && result.clientId) {
            set({ sessionId: result.clientId });
            window.location.href = "/new/clients";
          }
          set((state) => ({
            ...state,
            isCompleted: true,
            currentStep: 1,
            stepData: {},
            draftClientId: undefined, // Clear draft client ID after completion
            steps: newClientWizardSteps.map((step) => ({
              ...step,
              completed: false,
            })),
          }));

          localStorage.removeItem("new-client-wizard-store");
        } catch (error) {
          throw error;
        }
      },

      saveAsDraft: async (options?: SaveDraftOptions) => {
        const showDuplicatePlanDialog =
          options?.showDuplicatePlanDialog !== false;
        try {
          // Get fresh data from store
          const { stepData, currentStep } = get();

          // Log what we're saving for debugging
          const complianceDocs = stepData.complianceDocuments;
          const companyBasics = stepData.companyBasics as any;

          // Prepare detailed logging for mission/hero fields
          const missionHeadline = companyBasics?.missionHeadline || null;
          const missionBody = companyBasics?.missionBody || null;
          const heroTitle = companyBasics?.heroTitle || null;
          const heroDescription = companyBasics?.heroDescription || null;
          const brandImagesMeta = companyBasics?.brandImages?._meta || {};

          // Prepare cleaned step data for API to avoid 413 errors
          // We keep full data for the current step, but strip large base64 from other steps
          const currentStepType =
            currentStep === 1
              ? "companyBasics"
              : currentStep === 2
              ? "welcomeStatement"
              : currentStep === 3
              ? "keyContacts"
              : currentStep === 4
              ? "complianceDocuments"
              : "employeePortalPreview";

          const cleanedStepData: any = {};
          Object.keys(stepData).forEach((key) => {
            if (
              key === currentStepType ||
              key === "step3SubStep" ||
              key === "companyBasicsSubStep" ||
              key === "companyBasics" ||
              key === "brandImages"
            ) {
              // Keep current step data or branding data intact so it can be processed
              cleanedStepData[key] = stepData[key as keyof typeof stepData];
            } else {
              // Strip large data from other steps that are already saved
              cleanedStepData[key] = removeBase64ForApi(
                stepData[key as keyof typeof stepData],
              );
            }
          });

          // Save all current step data to server as draft using the new API
          const response = await fetch("/api/new-client-wizard/save-draft", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              stepData: cleanedStepData,
              currentStep,
              clientId: (get() as any).draftClientId,
            }),
          });

          const errorData = (await response.json().catch(() => ({}))) as {
            success?: boolean;
            code?: string;
            existingClientId?: string;
            companyName?: string;
            error?: string;
            clientId?: string;
            message?: string;
            sessionId?: string;
          };

          const isDuplicatePlanName =
            errorData.code === DUPLICATE_PLAN_NAME_CODE &&
            !!errorData.existingClientId &&
            !!errorData.companyName &&
            (response.status === 409 ||
              (response.ok && errorData.success === false));

          if (isDuplicatePlanName) {
            if (
              showDuplicatePlanDialog &&
              errorData.existingClientId &&
              errorData.companyName
            ) {
              set({
                duplicatePlanNameConflict: {
                  existingClientId: errorData.existingClientId,
                  companyName: errorData.companyName,
                },
              });
              throw new DuplicatePlanNameError(
                errorData.existingClientId,
                errorData.companyName,
              );
            }
            return null;
          }

          if (!response.ok) {
            throw new Error(errorData.error || "Failed to save draft");
          }

          if (errorData.success !== true) {
            throw new Error(errorData.error || "Failed to save draft");
          }

          const result = errorData;
          set({ duplicatePlanNameConflict: null });
          if (result.clientId && !(get() as any).draftClientId) {
            set({ draftClientId: result.clientId });
          }
          return result;
        } catch (error) {
          throw error;
        }
      },

      saveStepData: async (
        stepType: string,
        data: any,
        saveToServer: boolean = true,
      ) => {
        // Normalize website URL if present
        let normalizedData = { ...data };
        if (data.companyData?.companyWebsite) {
          normalizedData.companyData = {
            ...data.companyData,
            companyWebsite: normalizeCleanDomain(
              data.companyData.companyWebsite,
            ),
          };
        }

        // For document data, don't save file content to localStorage to avoid quota issues
        let dataToStore = normalizedData;

        if (stepType === "documentData" && data.sbcFiles) {
          // Store only metadata for files, not the actual file content
          dataToStore = {
            ...data,
            sbcFiles: data.sbcFiles.map((file: any) => ({
              fileName: file.fileName,
              fileType: file.fileName?.split(".").pop() || "",
              // Don't store the actual file content in localStorage
              fileData: "", // Remove large base64 content
              fileObj: null, // Remove file object
            })),
          };
        }

        if (stepType === "documentData" && data.spdFile) {
          // Store only metadata for SPD file
          dataToStore = {
            ...dataToStore,
            spdFile: "", // Remove large base64 content
            spdFileObj: null, // Remove file object
          };
        }

        // For complianceDocuments, don't save file content to localStorage
        if (stepType === "complianceDocuments") {
          dataToStore = {
            ...data,
            // Store only metadata for SPD file, not the actual file content
            spdFile: data.spdFile
              ? {
                  ...data.spdFile,
                  file: "", // Remove large base64 content
                }
              : null,
            // Store only metadata for retirement plan documents, not the actual file content
            retirementPlanDocuments:
              data.retirementPlanDocuments?.map((doc: any) => ({
                ...doc,
                file: "", // Remove large base64 content
              })) || [],
            // Store only metadata for other documents, not the actual file content
            otherDocuments:
              data.otherDocuments?.map((doc: any) => ({
                ...doc,
                file: "", // Remove large base64 content
              })) || [],
          };
        }

        if (stepType === "companyBasics") {
          dataToStore = {
            ...data,
            companyLogo: data.companyLogo
              ? {
                  ...data.companyLogo,
                  // Keep small CROPPED preview locally (helps reopen modal after refresh),
                  // but don't store large base64 blobs in localStorage.
                  url: keepSmallDataUrl(data.companyLogo.url, 120_000),
                  cropData: stripOriginalFromCropData(
                    data.companyLogo.cropData,
                  ),
                  normalizedData: data.companyLogo.normalizedData
                    ? {
                        ...data.companyLogo.normalizedData,
                        horizontal: "", // Remove base64 content
                        square: "", // Remove base64 content
                      }
                    : undefined,
                }
              : null,
            // Remove brandImages base64 URLs
            brandImages: data.brandImages
              ? {
                  ...data.brandImages,
                  // Store only metadata for brand images, not the actual base64 URLs
                  header: data.brandImages.header
                    ? {
                        ...data.brandImages.header,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                  thumbnail: data.brandImages.thumbnail
                    ? {
                        ...data.brandImages.thumbnail,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                  secondaryBanner: data.brandImages.secondaryBanner
                    ? {
                        ...data.brandImages.secondaryBanner,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                  favicon: data.brandImages.favicon
                    ? {
                        ...data.brandImages.favicon,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                  logo: data.brandImages.logo
                    ? {
                        ...data.brandImages.logo,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                }
              : undefined,
          };
        }

        // Save locally first (without large file content)
        try {
          set((state) => ({
            stepData: {
              ...state.stepData,
              [stepType]: dataToStore,
            },
          }));
        } catch (error) {
          // If quota exceeded, try to clear old data and retry
          if (error instanceof Error && error.name === "QuotaExceededError") {
            try {
              localStorage.removeItem("new-client-wizard");

              // Retry saving with minimal data
              set((state) => ({
                stepData: {
                  ...state.stepData,
                  [stepType]: dataToStore,
                },
              }));
            } catch (retryError) {}
          }
        }

        // Only save to server if explicitly requested
        // IMPORTANT: Use original normalizedData (with base64) for server, not dataToStore (without base64)
        if (saveToServer) {
          try {
            await get().saveStepDataToServer(stepType, normalizedData);
          } catch (error) {}
        }
      },

      // Save data only locally (no server call)
      // IMPORTANT: Keep base64 data in state for server saves, but partialize will remove it for localStorage
      saveStepDataLocally: async (stepType: string, data: any) => {
        // Save to stepData with full data (including base64) for server saves
        // The partialize function in persist middleware will remove base64 before saving to localStorage

        // Create a sanitized version of data for logging (truncate base64 images)
        // Use deep clone to avoid modifying original data
        const sanitizeForLogging = (obj: any): any => {
          if (!obj) return null;
          if (typeof obj === "string" && obj.startsWith("data:image")) {
            return `[BASE64_IMAGE: ${obj.length} chars]`;
          }
          if (Array.isArray(obj)) {
            return obj.map((item) => sanitizeForLogging(item));
          }
          if (typeof obj === "object" && obj !== null) {
            const sanitized: any = {};
            Object.keys(obj).forEach((key) => {
              const value = obj[key];
              if (typeof value === "string" && value.startsWith("data:image")) {
                sanitized[key] = `[BASE64_IMAGE: ${value.length} chars]`;
              } else if (typeof value === "object" && value !== null) {
                if (
                  value.url &&
                  typeof value.url === "string" &&
                  value.url.startsWith("data:image")
                ) {
                  sanitized[key] = {
                    ...value,
                    url: `[BASE64_IMAGE: ${value.url.length} chars]`,
                  };
                } else {
                  sanitized[key] = sanitizeForLogging(value);
                }
              } else {
                sanitized[key] = value;
              }
            });
            return sanitized;
          }
          return obj;
        };
        const sanitizedData = sanitizeForLogging(data);

        try {
          set((state) => {
            const newStepData = {
              ...state.stepData,
              [stepType]: data,
            };
            return {
              stepData: newStepData,
            };
          });
        } catch (error) {
          // If quota exceeded, try to clear old data and retry
          if (error instanceof Error && error.name === "QuotaExceededError") {
            try {
              localStorage.removeItem("new-client-wizard");

              // Retry saving
              set((state) => {
                const newStepData = {
                  ...state.stepData,
                  [stepType]: data,
                };
                return {
                  stepData: newStepData,
                };
              });
            } catch (retryError) {}
          }
        }
      },

      saveStepDataToServer: async (stepType: string, data: any) => {
        try {
          // Convert camelCase to kebab-case for API endpoints
          const apiEndpoint = stepType.replace(/([A-Z])/g, "-$1").toLowerCase();

          // Create a sanitized version of data for logging (truncate base64 images)
          // Use deep clone to avoid modifying original data
          const sanitizeForLogging = (obj: any): any => {
            if (!obj) return null;
            if (typeof obj === "string" && obj.startsWith("data:image")) {
              return `[BASE64_IMAGE: ${obj.length} chars]`;
            }
            if (Array.isArray(obj)) {
              return obj.map((item) => sanitizeForLogging(item));
            }
            if (typeof obj === "object" && obj !== null) {
              const sanitized: any = {};
              Object.keys(obj).forEach((key) => {
                const value = obj[key];
                if (
                  typeof value === "string" &&
                  value.startsWith("data:image")
                ) {
                  sanitized[key] = `[BASE64_IMAGE: ${value.length} chars]`;
                } else if (typeof value === "object" && value !== null) {
                  if (
                    value.url &&
                    typeof value.url === "string" &&
                    value.url.startsWith("data:image")
                  ) {
                    sanitized[key] = {
                      ...value,
                      url: `[BASE64_IMAGE: ${value.url.length} chars]`,
                    };
                  } else {
                    sanitized[key] = sanitizeForLogging(value);
                  }
                } else {
                  sanitized[key] = value;
                }
              });
              return sanitized;
            }
            return obj;
          };
          const sanitizedData = sanitizeForLogging(data);

          // Log overlay settings specifically for companyBasics
          if (stepType === "companyBasics" && data) {
            const overlaySettings = {
              heroContainerOpacity: (data as any)?.heroContainerOpacity,
              heroInverted: (data as any)?.heroInverted,
              heroUseGradient: (data as any)?.heroUseGradient,
              heroOverlayOpacity: (data as any)?.heroOverlayOpacity,
              heroBackgroundOpacity: (data as any)?.heroBackgroundOpacity,
              heroCompanyNameColor: (data as any)?.heroCompanyNameColor,
            };
          }

          const response = await fetch(
            `/api/new-client-wizard/${apiEndpoint}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(data),
            },
          );

          if (response.ok) {
            const responseData = await response.json().catch(() => ({}));
            return true;
          } else {
            const errorText = await response.text();
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
          const apiEndpoint = stepType.replace(/([A-Z])/g, "-$1").toLowerCase();
          const response = await fetch(`/api/new-client-wizard/${apiEndpoint}`);
          if (response.ok) {
            const result = await response.json();
            const data = result.data || result[stepType];

            if (data) {
              // Extract the actual JSON data if it's nested in a database record
              let finalData = data;
              if (
                stepType === "keyContacts" &&
                data.contacts &&
                !Array.isArray(data.contacts)
              ) {
                // data is the DB record, data.contacts is the JSON { contacts: [...], displayStyle: ..., cardBackgroundColor: ... }
                finalData = data.contacts;
              } else if (
                stepType === "employeePortalPreview" &&
                data.previewData
              ) {
                finalData = data.previewData;
              }

              set((state) => ({
                stepData: {
                  ...state.stepData,
                  [stepType]: finalData,
                },
              }));
              return finalData;
            }
          }
        } catch (error) {
          // Silent error
        }
        return null;
      },

      loadAllWizardData: async () => {
        try {
          const stepTypes = [
            "clientInfo",
            "documentData",
            "optionalDocuments",
            "contactBuilder",
            "disclaimers",
          ];

          const loadedData: any = {};
          let hasData = false;

          const loadPromises = stepTypes.map(async (stepType) => {
            try {
              const apiEndpoint = stepType
                .replace(/([A-Z])/g, "-$1")
                .toLowerCase();
              const response = await fetch(
                `/api/new-client-wizard/${apiEndpoint}`,
              );
              if (response.ok) {
                const result = await response.json();
                const data = result[stepType];
                if (data) {
                  loadedData[stepType] = data;
                  hasData = true;
                }
              }
            } catch (error) {}
          });

          await Promise.all(loadPromises);

          if (hasData) {
            set((state) => ({
              stepData: {
                ...state.stepData,
                ...loadedData,
              },
            }));
          }

          return { ...loadedData, hasSession: true };
        } catch (error) {
          return {};
        }
      },

      loadDraft: async () => {
        try {
          const response = await fetch("/api/new-client-wizard/load-draft");
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const stepData = result.data.stepData;

              // Set default heroTitle if empty
              if (stepData?.companyBasics) {
                const companyName =
                  stepData.companyBasics.companyName || "Company Name";
                const defaultHeroTitle = `Welcome to the ${companyName} Benefits Hub!`;

                // Get heroTitle from various sources
                const heroTitle =
                  (stepData.companyBasics as any)?.heroTitle ||
                  stepData.companyBasics?.brandImages?._meta?.heroTitle ||
                  stepData.welcomeStatement?.headline ||
                  "";

                // If heroTitle is empty, set default value
                if (!heroTitle || !heroTitle.trim()) {
                  stepData.companyBasics = {
                    ...stepData.companyBasics,
                    heroTitle: defaultHeroTitle,
                  };

                  // Also update brandImages._meta if it exists
                  if (stepData.companyBasics.brandImages) {
                    stepData.companyBasics.brandImages = {
                      ...stepData.companyBasics.brandImages,
                      _meta: {
                        ...stepData.companyBasics.brandImages._meta,
                        heroTitle: defaultHeroTitle,
                      },
                    };
                  }
                }
              }

              // Load the draft data into the store
              set({
                stepData,
                currentStep: result.data.currentStep,
              });
              return result.data;
            }
          }
          return null;
        } catch (error) {
          return null;
        }
      },

      loadDraftById: async (clientId: string) => {
        try {
          const response = await fetch(`/api/clients/${clientId}`);
          if (!response.ok) {
            throw new Error("Failed to load draft");
          }

          const clientResponse = await response.json();
          const client = clientResponse?.data || clientResponse;

          if (!client || !client.companyName) {
            throw new Error("Draft data is missing required fields");
          }

          // Transform Client data to wizard stepData format
          const stepData: any = {};

          // Company Basics
          if (client.companyName) {
            // Keep base64 URLs for images - they will be removed by partialize when saving to localStorage
            // This allows images to display correctly when loading from draft
            const companyLogo = client.companyLogo
              ? {
                  url: client.companyLogo || "",
                  fileName: client.logoFileName || "logo",
                  cropData: (client as any).companyLogoCropData || undefined,
                  originalUrl:
                    (client as any).companyLogoCropData?.originalImage ||
                    undefined,
                }
              : null;

            // Get mission/hero fields from client or brandImages._meta
            const brandImagesMeta = (client as any)?.brandImages?._meta || {};
            const missionHeadline =
              client.missionHeadline || brandImagesMeta.missionHeadline || "";
            const missionBody =
              client.missionBody || brandImagesMeta.missionBody || "";
            let heroTitle =
              (client as any).heroTitle || brandImagesMeta.heroTitle || "";
            const heroDescription =
              (client as any).heroDescription ||
              brandImagesMeta.heroDescription ||
              "";

            // Set default heroTitle if empty (should default to company name format)
            if (!heroTitle || !heroTitle.trim()) {
              const companyName = client.companyName || "Company Name";
              heroTitle = `Welcome to the ${companyName} Benefits Hub!`;
            }

            stepData.companyBasics = {
              companyName: client.companyName,
              companyWebsite: client.companyWebsite || "",
              companyLogo,
              primaryColor: client.brandColor || "#1F3A60",
              secondaryColor: client.secondaryColor || "#6B7280",
              brandImages: {
                header: client.backgroundImg
                  ? {
                      url: client.backgroundImg || "",
                      fileName: client.backgroundImgName || "header",
                      cropData:
                        (client as any)?.brandImagesCropData?.header ||
                        undefined,
                    }
                  : null,
                thumbnail: client.thumbnailImg
                  ? {
                      url: client.thumbnailImg || "",
                      fileName: client.thumbnailImgName || "thumbnail",
                      cropData:
                        (client as any)?.brandImagesCropData?.thumbnail ||
                        undefined,
                    }
                  : null,
                secondaryBanner: client.secondaryBannerImg
                  ? {
                      url: client.secondaryBannerImg || "",
                      fileName: client.secondaryBannerImgName || "banner",
                      cropData:
                        (client as any)?.brandImagesCropData?.secondaryBanner ||
                        undefined,
                    }
                  : null,
                favicon: client.faviconImg
                  ? {
                      url: client.faviconImg || "",
                      fileName: client.faviconImgName || "favicon",
                      cropData:
                        (client as any)?.brandImagesCropData?.favicon ||
                        undefined,
                    }
                  : null,
                _meta: {
                  missionHeadline,
                  missionBody,
                  heroTitle,
                  heroDescription,
                },
              },
              planType: client.type || "client",
              organizationType:
                (client as any).organizationType || "Advisor Firm",
              missionHeadline,
              missionBody,
              heroTitle,
              heroDescription,
              // Banner Overlay Settings
              heroContainerOpacity:
                (client as any).heroContainerOpacity ?? undefined,
              heroCompanyNameColor:
                (client as any).heroCompanyNameColor || undefined,
              heroInverted: (client as any).heroInverted ?? undefined,
              heroUseGradient: (client as any).heroUseGradient ?? undefined,
              heroOverlayOpacity:
                (client as any).heroOverlayOpacity ?? undefined,
              heroBackgroundOpacity:
                (client as any).heroBackgroundOpacity ?? undefined,
            };
          }

          // Welcome Statement (Banner Title / Welcome Message)
          // Must reflect HERO fields (heroTitle/heroDescription), not Mission Statement.
          const heroTitleFromStep = stepData.companyBasics?.heroTitle || "";
          const heroDescriptionFromStep =
            stepData.companyBasics?.heroDescription || "";
          if (heroTitleFromStep || heroDescriptionFromStep) {
            stepData.welcomeStatement = {
              headline: heroTitleFromStep || "",
              bodyText: heroDescriptionFromStep || "",
              isAIGenerated: false,
            };
          }

          // Key Contacts
          if (client.keyContacts) {
            // Handle both old format (array) and new format (object with contacts and displayStyle)
            let contactsArray: any[] = [];
            let displayStyle: number | null = null;
            let step3SubStep: string | null = null;

            if (Array.isArray(client.keyContacts)) {
              // Old format: just an array
              contactsArray = client.keyContacts;
            } else if (
              typeof client.keyContacts === "object" &&
              client.keyContacts !== null
            ) {
              // New format: { contacts: [...], displayStyle: ..., step3SubStep: ... }
              // step3SubStep is at the top level of keyContacts, not inside contacts
              contactsArray = Array.isArray(client.keyContacts.contacts)
                ? client.keyContacts.contacts
                : [];

              displayStyle = client.keyContacts.displayStyle ?? null;

              // Extract step3SubStep from the top level of keyContacts
              step3SubStep = client.keyContacts.step3SubStep || null;
            } else {
              contactsArray = [];
            }

            stepData.keyContacts = {
              ...(typeof client.keyContacts === "object" &&
              client.keyContacts !== null
                ? client.keyContacts
                : {}),
              contacts: contactsArray,
              displayStyle: displayStyle,
            };

            // Set step3SubStep if found
            if (step3SubStep) {
              stepData.step3SubStep = { step3SubStep };
            }
          }

          // Compliance Documents
          if (
            client.documents &&
            Array.isArray(client.documents) &&
            client.documents.length > 0
          ) {
            const { convertToDocumentFormat } = await import(
              "@/lib/compliance-document-utils"
            );

            // Separate documents by type
            const spdDocuments = client.documents.filter(
              (doc: any) => doc.type === "SPD",
            );
            const retirementPlanDocuments = client.documents.filter(
              (doc: any) => doc.type === "Document",
            );
            const otherDocuments = client.documents.filter(
              (doc: any) => doc.type === "SBC",
            );

            // Convert to Document format - remove base64 from file URLs
            const convertDbDocument = (dbDoc: any): any => {
              const fileUrl = dbDoc.fileUrl || "";
              // If fileUrl is base64, store empty string to avoid localStorage quota issues
              const cleanedFileUrl = fileUrl.startsWith("data:") ? "" : fileUrl;

              return {
                id: dbDoc.id,
                name: dbDoc.title || dbDoc.fileName,
                file: cleanedFileUrl,
                type: dbDoc.type === "SPD" ? "spd" : "other",
                size: 0, // Size not stored in DB
                status: "success" as const,
                shortDescription: dbDoc.shortDescription || null,
                originalFileName: dbDoc.fileName,
                language: dbDoc.language || "EN",
              };
            };

            stepData.complianceDocuments = {
              spdFile:
                spdDocuments.length > 0
                  ? convertDbDocument(spdDocuments[0])
                  : null,
              retirementPlanDocuments:
                retirementPlanDocuments.map(convertDbDocument),
              otherDocuments: otherDocuments.map(convertDbDocument),
              recordkeeper: client.recordkeeper || undefined,
            };
          }

          // Disclaimers
          if (client.disclaimers) {
            try {
              // Parse disclaimers from JSON string
              const disclaimersArray =
                typeof client.disclaimers === "string"
                  ? JSON.parse(client.disclaimers)
                  : client.disclaimers;

              if (
                Array.isArray(disclaimersArray) &&
                disclaimersArray.length > 0
              ) {
                stepData.disclaimers = {
                  disclaimers: disclaimersArray,
                };
              }
            } catch (error) {
              console.error("Error parsing disclaimers from draft:", error);
            }
          }

          // Load into store
          // Use currentStep from draft if available, otherwise default to step 1
          const savedCurrentStep = (client as any)?.currentStep || 1;
          set({
            stepData,
            currentStep: savedCurrentStep, // Use saved step from draft
            draftClientId: clientId, // Store the draft client ID for cleanup later
            duplicatePlanNameConflict: null,
          });

          return { success: true, stepData };
        } catch (error) {
          throw error;
        }
      },

      // Load onboarding data to determine service type
      loadOnboardingData: async () => {
        try {
          const response = await fetch("/api/onboarding-wizard/services");

          if (response.ok) {
            const data = await response.json();

            // Check if services exist and have data
            if (
              data.services &&
              data.services.services &&
              data.services.services.length > 0
            ) {
              // Return the first service for backward compatibility, but also return full services data
              const service = data.services.services[0];
              return {
                service,
                services: data.services, // Include full services data with customService
              };
            } else {
              return null;
            }
          } else {
            return null;
          }
        } catch (error) {
          return null;
        }
      },

      updateCurrentStep: async (step: number) => {
        try {
          // First check if we have a session
          const sessionResponse = await fetch("/api/new-client-wizard/session");
          const sessionData = await sessionResponse.json();

          if (!sessionData.session) {
            return;
          }

          // Now update the current step
          const response = await fetch("/api/new-client-wizard/session", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ currentStep: step }),
          });

          if (!response.ok) {
          }
        } catch (error) {}
      },

      createNewSession: async () => {
        try {
          const response = await fetch("/api/new-client-wizard/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const sessionData = await response.json();
            if (sessionData.session) {
              set({
                currentStep: 1, // Always start from step 1 for new client
                isCompleted: false,
                stepData: {}, // Always start with empty data
                draftClientId: undefined, // Clear draft client ID for new session
                duplicatePlanNameConflict: null,
                steps: newClientWizardSteps.map((step) => ({
                  ...step,
                  completed: false,
                })),
              });
            }
          }
        } catch (error) {}
      },

      seedAdvisorDefaultsFromProfile: async () => {
        try {
          const response = await fetch("/api/profile");
          if (!response.ok) return;
          const profile = await response.json();
          set((state) => ({
            stepData: mergeAdvisorProfileIntoWizardStepData(
              state.stepData as unknown as Record<string, unknown>,
              profile,
            ) as NewClientWizardState["stepData"],
          }));
        } catch {
          // non-blocking
        }
      },

      syncCurrentStepToFirstIncomplete: async () => {
        const { stepData, currentStep, updateCurrentStep } = get();
        const first = await findFirstIncompleteWizardStepNumber(
          stepData as unknown as Record<string, unknown>,
        );
        if (first == null || first === currentStep) return;
        set({ currentStep: first, errorFields: [] });
        await updateCurrentStep(first);
      },

      resetWizard: () => {
        // Clear localStorage to ensure no previous data persists
        if (typeof window !== "undefined") {
          localStorage.removeItem("new-client-wizard");
          localStorage.removeItem("new-client-wizard-saved-at");
        }

        set({
          currentStep: 1,
          steps: newClientWizardSteps.map((step) => ({
            ...step,
            completed: false,
          })),
          isCompleted: false,
          stepData: {},
          draftClientId: undefined, // Clear draft client ID when resetting
          sessionId: undefined,
          selectedCategoryStep3a: null,
          step3SlideIndex: 0,
          duplicatePlanNameConflict: null,
          errorFields: [],
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
          const validationResult = await validateNewClientCurrentStepV2(
            currentStep,
            stepData,
          );

          if (!validationResult.isValid && validationResult.errorFields) {
            set({ errorFields: validationResult.errorFields });
          } else {
            set({ errorFields: [] });
          }
        } catch (error) {}
      },
    }),
    {
      name: "new-client-wizard",
      skipHydration: true,
      storage: createSafeStorage(),
      onRehydrateStorage: () => () => {},
      partialize: (state) => {
        // Only persist essential data, exclude large file content
        const cleanedStepData: any = { ...state.stepData };

        // Remove file content from complianceDocuments
        if (cleanedStepData.complianceDocuments) {
          cleanedStepData.complianceDocuments = {
            ...cleanedStepData.complianceDocuments,
            spdFile: cleanedStepData.complianceDocuments.spdFile
              ? {
                  ...cleanedStepData.complianceDocuments.spdFile,
                  file: "", // Remove base64 content
                }
              : null,
            retirementPlanDocuments:
              cleanedStepData.complianceDocuments.retirementPlanDocuments?.map(
                (doc: any) => ({
                  ...doc,
                  file: "", // Remove base64 content
                }),
              ) || [],
            otherDocuments:
              cleanedStepData.complianceDocuments.otherDocuments?.map(
                (doc: any) => ({
                  ...doc,
                  file: "", // Remove base64 content
                }),
              ) || [],
          };
        }

        // Remove base64 URLs from companyBasics (companyLogo and brandImages)
        if (cleanedStepData.companyBasics) {
          cleanedStepData.companyBasics = {
            ...cleanedStepData.companyBasics,
            // Remove companyLogo base64 URL
            companyLogo: cleanedStepData.companyBasics.companyLogo
              ? {
                  ...cleanedStepData.companyBasics.companyLogo,
                  // Keep small CROPPED preview locally (helps reopen modal after refresh),
                  // but don't store large base64 blobs in localStorage.
                  url: keepSmallDataUrl(
                    cleanedStepData.companyBasics.companyLogo.url,
                    120_000,
                  ),
                  cropData: stripOriginalFromCropData(
                    cleanedStepData.companyBasics.companyLogo.cropData,
                  ),
                  normalizedData: cleanedStepData.companyBasics.companyLogo
                    .normalizedData
                    ? {
                        ...cleanedStepData.companyBasics.companyLogo
                          .normalizedData,
                        horizontal: "", // Remove base64 content
                        square: "", // Remove base64 content
                      }
                    : undefined,
                }
              : null,
            // Remove brandImages base64 URLs
            brandImages: cleanedStepData.companyBasics.brandImages
              ? {
                  ...cleanedStepData.companyBasics.brandImages,
                  // Store only metadata for brand images, not the actual base64 URLs
                  header: cleanedStepData.companyBasics.brandImages.header
                    ? {
                        ...cleanedStepData.companyBasics.brandImages.header,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                  thumbnail: cleanedStepData.companyBasics.brandImages.thumbnail
                    ? {
                        ...cleanedStepData.companyBasics.brandImages.thumbnail,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                  secondaryBanner: cleanedStepData.companyBasics.brandImages
                    .secondaryBanner
                    ? {
                        ...cleanedStepData.companyBasics.brandImages
                          .secondaryBanner,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                  favicon: cleanedStepData.companyBasics.brandImages.favicon
                    ? {
                        ...cleanedStepData.companyBasics.brandImages.favicon,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                  logo: cleanedStepData.companyBasics.brandImages.logo
                    ? {
                        ...cleanedStepData.companyBasics.brandImages.logo,
                        url: "", // Remove large base64 content
                      }
                    : undefined,
                }
              : undefined,
          };
        }

        // Remove file content from documentData
        if (cleanedStepData.documentData) {
          cleanedStepData.documentData = {
            ...cleanedStepData.documentData,
            sbcFiles:
              cleanedStepData.documentData.sbcFiles?.map((file: any) => ({
                fileName: file.fileName,
                fileType: file.fileName?.split(".").pop() || "",
                fileData: "", // Remove large base64 content
                fileObj: null,
              })) || [],
            spdFile: "", // Remove large base64 content
            spdFileObj: null,
          };
        }

        // Strip base64 data URLs from keyContacts headshot/teamImage (keep R2 keys, which are small strings).
        const isBase64 = (v: string) =>
          typeof v === "string" && v.startsWith("data:image");
        if (cleanedStepData.keyContacts) {
          cleanedStepData.keyContacts = {
            ...cleanedStepData.keyContacts,
            contacts:
              cleanedStepData.keyContacts.contacts?.map((contact: any) => ({
                ...contact,
                headshot: isBase64(contact.headshot) ? "" : contact.headshot,
                teamImage: isBase64(contact.teamImage) ? "" : contact.teamImage,
              })) || [],
          };
        }

        return {
          ...state,
          stepData: cleanedStepData,
          duplicatePlanNameConflict: null,
        } as Partial<NewClientWizardState>;
      },
    },
  ),
);
