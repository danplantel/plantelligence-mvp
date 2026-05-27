"use client";

import { useState, useEffect, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { NewClientStep3a } from "./step-3a";
import { NewClientStep3b } from "./step-3b";
import { NewClientStep3c } from "./step-3c";
import { NewClientStep3d } from "./step-3d";
import { IncompleteCategoriesModal } from "./components/incomplete-categories-modal";
import { BenefitsCategory } from "@/types/new-client-wizard";
import { mergeOnboardingAdvisorContactsIntoKeyContacts } from "@/lib/seed-onboarding-advisor-contacts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface NewClientStep3Props {
  errorFields?: string[];
}

type Step3SubKey = "step3a" | "step3b" | "step3c" | "step3d";

const STEP3_SUB_KEYS = new Set<string>([
  "step3a",
  "step3b",
  "step3c",
  "step3d",
]);

/** Read a string sub-step from persisted data (never returns objects). */
function extractStep3SubStepLabel(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && !Array.isArray(raw) && "step3SubStep" in raw) {
    const v = (raw as { step3SubStep?: unknown }).step3SubStep;
    return typeof v === "string" ? v : "";
  }
  return "";
}

/** Sub-step for syncing from store (preserves step3c). */
function toSyncSubStep(label: string): Step3SubKey {
  const normalized = label === "step3e" ? "step3d" : label;
  if (STEP3_SUB_KEYS.has(normalized)) return normalized as Step3SubKey;
  return "step3a";
}

/**
 * Initial sub-step when hydrating: map legacy step3c → step3b (same as before).
 * Empty `{}` or garbage in draft must not become a truthy object for useState.
 */
function toInitialSubStep(label: string): Step3SubKey {
  let s = label === "step3e" ? "step3d" : label;
  if (s === "step3c") s = "step3b";
  if (STEP3_SUB_KEYS.has(s)) return s as Step3SubKey;
  return "step3a";
}

export function NewClientStep3({ errorFields = [] }: NewClientStep3Props) {
  const { stepData, saveStepDataLocally, clearErrorFields, setSelectedCategoryStep3a } =
    useNewClientWizardStore();
  const currentStep = useNewClientWizardStore((s) => s.currentStep);

  const keyContactsDataForCheck = stepData.keyContacts || { contacts: [] };
  const contactsForCheck = keyContactsDataForCheck.contacts || [];

  const persistedStep3Label = extractStep3SubStepLabel(
    (stepData as any).step3SubStep,
  );
  const initialSubStep: Step3SubKey =
    contactsForCheck.length === 0
      ? "step3a"
      : toInitialSubStep(persistedStep3Label);

  const [currentSubStep, setCurrentSubStep] =
    useState<Step3SubKey>(initialSubStep);

  const lastPersistedSubStep = useRef<Step3SubKey>(initialSubStep);

  const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);
  const [missingCategories, setMissingCategories] = useState<
    BenefitsCategory[]
  >([]);
  const [step3cMountKey, setStep3cMountKey] = useState(0);

  useEffect(() => {
    const handleShowIncompleteCategoriesModal = (event: CustomEvent) => {
      const missing = event.detail?.missingCategories || [];
      if (missing.length > 0) {
        setMissingCategories(missing);
        setIsIncompleteModalOpen(true);
      }
    };

    const handleNavigateToStep3a = (event: CustomEvent) => {
      const fromStep3b = event.detail?.fromStep3b === true;
      const selectedContactId = event.detail?.selectedContactId || undefined;
      // Clear validation errors when navigating from step-3b to step-3a
      // This allows editing step-3a without being blocked by step-3b validation
      if (fromStep3b) {
        clearErrorFields();
        // Clear category selection so no card shows green border/check after creating a contact
        setSelectedCategoryStep3a(null);
        const step3aData = (stepData as any).step3a || {};
        saveStepDataLocally("step3a", { ...step3aData, benefitsCategory: null });
        const step3cData = (stepData as any).step3c || {};
        saveStepDataLocally("step3c", { ...step3cData, benefitsCategory: null });

        // Remove incomplete contacts (contacts without ALL required fields) to prevent phantom counts
        // A contact is considered complete only if it has: firstName AND lastName AND (email OR phone)
        const keyContactsData = stepData.keyContacts || { contacts: [] };
        const contacts = keyContactsData.contacts || [];
        const completeContacts = contacts.filter((contact: any) => {
          const hasFirstName = contact.firstName && contact.firstName.trim() !== "";
          const hasLastName = contact.lastName && contact.lastName.trim() !== "";
          const hasEmail = contact.email && contact.email.trim() !== "";
          const hasPhone = contact.phone && contact.phone.trim() !== "";

          // Contact must have firstName, lastName, AND at least email or phone
          const isComplete = hasFirstName && hasLastName && (hasEmail || hasPhone);
          return isComplete;
        });


        // If we removed any incomplete contacts, update the store
        if (completeContacts.length !== contacts.length) {
          saveStepDataLocally("keyContacts", {
            ...keyContactsData,
            contacts: completeContacts,
          });
        }

      }
      // Save data first, then update sub-step to ensure data is available when component renders
      saveStepDataLocally("step3SubStep", {
        step3SubStep: "step3a",
        fromStep3b: fromStep3b,
        selectedContactId: selectedContactId,
      });
      // Use setTimeout to ensure store update is processed before component renders
      setTimeout(() => {
        setCurrentSubStep("step3a");
      }, 0);
    };


    window.addEventListener(
      "showIncompleteCategoriesModal",
      handleShowIncompleteCategoriesModal as EventListener,
    );
    window.addEventListener(
      "navigateToStep3a",
      handleNavigateToStep3a as EventListener,
    );

    return () => {
      window.removeEventListener(
        "showIncompleteCategoriesModal",
        handleShowIncompleteCategoriesModal as EventListener,
      );
      window.removeEventListener(
        "navigateToStep3a",
        handleNavigateToStep3a as EventListener,
      );
    };
  }, [
    saveStepDataLocally,
    clearErrorFields,
    setSelectedCategoryStep3a,
    stepData,
  ]);

  // Fallback if draft load hasn’t run yet: persist seeded advisor contacts from /api/profile.
  useEffect(() => {
    if (currentStep !== 3) return;
    if (contactsForCheck.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok || cancelled) return;
        const profile = await res.json();
        const next = mergeOnboardingAdvisorContactsIntoKeyContacts(
          [],
          profile.primaryServiceCategories,
          {
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            phoneExtension: profile.phoneExtension,
            title: profile.title,
            headshot: profile.headshot,
            company: profile.company,
            advisorLogo: profile.advisorLogo,
            advisorLogoUrl: profile.advisorLogoUrl,
            advisorLink: profile.advisorLink,
          },
        );
        if (next.length === 0 || cancelled) return;
        const newKc = { contacts: next };
        const {
          saveStepDataLocally: saveLocal,
          saveStepDataToServer,
          saveAsDraft,
        } = useNewClientWizardStore.getState();
        saveLocal("keyContacts", newKc);
        await saveStepDataToServer("keyContacts", newKc);
        await saveAsDraft();
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentStep, contactsForCheck.length]);

  // Recover from corrupted state (e.g. old bug stored non-string in React state).
  useEffect(() => {
    if (typeof currentSubStep !== "string" || !STEP3_SUB_KEYS.has(currentSubStep)) {
      setCurrentSubStep("step3a");
      lastPersistedSubStep.current = "step3a";
    }
  }, [currentSubStep]);

  useEffect(() => {
    if (lastPersistedSubStep.current === currentSubStep) {
      return;
    }

    lastPersistedSubStep.current = currentSubStep;
    saveStepDataLocally("step3SubStep", { step3SubStep: currentSubStep });
  }, [currentSubStep, saveStepDataLocally]);

  const keyContactsForDeps = stepData.keyContacts || { contacts: [] };
  const contactsCountForSync = keyContactsForDeps.contacts?.length ?? 0;
  const persistedSubStepLabel = extractStep3SubStepLabel(
    (stepData as any).step3SubStep,
  );

  useEffect(() => {
    if (typeof currentSubStep !== "string" || !STEP3_SUB_KEYS.has(currentSubStep)) {
      return;
    }

    const keyContactsDataForSync = stepData.keyContacts || { contacts: [] };
    const contactsForSync = keyContactsDataForSync.contacts || [];

    if (contactsForSync.length === 0) {
      // With 0 contacts, always show step3a (cards) - step3b form has nothing to edit
      if (currentSubStep !== "step3a") {
        setCurrentSubStep("step3a");
      }
      return;
    }

    const newSubStep = toSyncSubStep(persistedSubStepLabel);

    if (newSubStep !== currentSubStep) {
      if (newSubStep === "step3c") {
        // Allow transition to step3c from step3b, step3c (re-sync), or step3d (Previous from Card Layout)
        if (currentSubStep === "step3b" || currentSubStep === "step3c" || currentSubStep === "step3d") {
          setCurrentSubStep(newSubStep);
        }
        return;
      }

      setCurrentSubStep(newSubStep);
    }
    // Intentionally omit `stepData` / keyContacts object identity — they change every save and caused update loops.
  }, [currentSubStep, contactsCountForSync, persistedSubStepLabel]);

  // Required categories for Company/Plan Sponsor
  const requiredCategories: BenefitsCategory[] = [
    "Retirement",
    "Group Health",
    "Group Life",
    "Other Benefits",
  ];

  // Check which categories are missing contacts
  // A contact is considered "filled" if it has at least email or phone
  const checkMissingCategories = (): BenefitsCategory[] => {
    const keyContactsData = stepData.keyContacts || { contacts: [] };
    const contacts = keyContactsData.contacts || [];

    const filledCategories = new Set<BenefitsCategory>();
    contacts.forEach((contact: any) => {
      // Check if contact has minimum required data (email or phone)
      const hasMinimumData =
        (contact.email && contact.email.trim() !== "") ||
        (contact.phone && contact.phone.trim() !== "");

      if (
        hasMinimumData &&
        contact.benefitsCategories &&
        Array.isArray(contact.benefitsCategories)
      ) {
        contact.benefitsCategories.forEach((cat: BenefitsCategory) => {
          if (requiredCategories.includes(cat)) {
            filledCategories.add(cat);
          }
        });
      }
    });

    return requiredCategories.filter((cat) => !filledCategories.has(cat));
  };

  const handleStep3bNext = () => {
    const keyContactsData = stepData.keyContacts || { contacts: [] };
    const contacts = keyContactsData.contacts || [];
    const hasContacts = contacts.length > 0;

    if (hasContacts) {
      // Clear category selection so no card shows green border/check after creating a contact (Add New Card flow)
      setSelectedCategoryStep3a(null);
      const step3aData = (stepData as any).step3a || {};
      saveStepDataLocally("step3a", { ...step3aData, benefitsCategory: null });
      const step3cData = (stepData as any).step3c || {};
      saveStepDataLocally("step3c", { ...step3cData, benefitsCategory: null });
      // Flag so step3c can force-clear selection on mount (avoids timing issues)
      saveStepDataLocally("step3SubStep", { step3SubStep: "step3c", fromStep3bJustNow: true });
      setStep3cMountKey((k) => k + 1); // Remount step3c so it reads cleared store (same as Company flow)
      setCurrentSubStep("step3c");
    } else {
      const missing = checkMissingCategories();
      if (missing.length > 0) {
        setMissingCategories(missing);
        setIsIncompleteModalOpen(true);
      } else {
        setCurrentSubStep("step3d");
      }
    }
  };

  const handleFillCategories = () => {
    setIsIncompleteModalOpen(false);
    if (currentSubStep !== "step3b") {
      saveStepDataLocally("step3SubStep", { step3SubStep: "step3b" });
      setCurrentSubStep("step3b");
    }
  };

  // Handle Skip - proceed anyway
  const handleSkip = () => {
    setIsIncompleteModalOpen(false);
    // Update store to move to step3d
    saveStepDataLocally("step3SubStep", { step3SubStep: "step3d" });
    setCurrentSubStep("step3d");
  };

  const handleAddContactForCategory = (category: BenefitsCategory) => {
    const keyContactsData = stepData.keyContacts || { contacts: [] };
    const savedContacts = keyContactsData.contacts || [];
    const defaultCompanyName = stepData?.companyBasics?.companyName || "";
    const defaultCompanyLogo = stepData?.companyBasics?.companyLogo?.url || "";

    // For Company / Plan Sponsor, get company name and logo from step3c if available
    let contactCompanyName = defaultCompanyName;
    let contactCompanyLogo = defaultCompanyLogo || undefined;

    if (category === "Company / Plan Sponsor") {
      const step3cData = (stepData as any).step3c || {};
      // If user has set custom company name/logo in step3c, use it
      if (step3cData.planSponsorCompanyName) {
        contactCompanyName = step3cData.planSponsorCompanyName;
      }
      if (step3cData.planSponsorCompanyLogo) {
        contactCompanyLogo = step3cData.planSponsorCompanyLogo;
      }
    }

    // Create new contact with the selected category
    const newContact = {
      id: `contact-${Date.now()}-${Math.random()}`,
      contactType: "individual" as const,
      benefitsCategories: [category],
      role: "HR Generalist" as const,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName: contactCompanyName,
      companyLogo: contactCompanyLogo,
      companyLogoAssetId: undefined,
      name: "",
      showOnPortal: true,
      isPrimary: false,
      displayScope: "thisPortal" as const,
      isPrimaryByCategory: undefined,
      isPrimaryOverall: false,
      displayEmail: true,
      displayPhone: true,
      displayUrl: false,
      enableContactButton: true,
      benefitsCategory: category,
    };

    const updatedContacts = [...savedContacts, newContact];
    const updatedKeyContacts = {
      ...keyContactsData,
      contacts: updatedContacts,
    };

    saveStepDataLocally("keyContacts", updatedKeyContacts);

    // Clear category selection so the newly created card is not shown as focused when returning to step3a
    setSelectedCategoryStep3a(null);
    const step3aData = (stepData as any).step3a || {};
    saveStepDataLocally("step3a", { ...step3aData, benefitsCategory: null });
    const step3cData = (stepData as any).step3c || {};
    saveStepDataLocally("step3c", { ...step3cData, benefitsCategory: null });

    setIsIncompleteModalOpen(false);

    if (currentSubStep !== "step3b") {
      saveStepDataLocally("step3SubStep", { step3SubStep: "step3b" });
      setCurrentSubStep("step3b");
    } else {
      window.dispatchEvent(
        new CustomEvent("selectContact", {
          detail: { contactId: newContact.id },
        }),
      );
    }
  };

  const keyContactsData = stepData.keyContacts || { contacts: [] };
  const contacts = keyContactsData.contacts || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {currentSubStep === "step3b" && (
        <NewClientStep3b errorFields={errorFields} onNext={handleStep3bNext} />
      )}

      {currentSubStep === "step3c" && (
        <NewClientStep3c
          key={step3cMountKey}
          clearSelectionOnMount={(stepData as any).step3SubStep?.fromStep3bJustNow === true}
          errorFields={errorFields}
          onNext={async () => {
            // Clear category selection as soon as user leaves for step3b (Add New Card) so when they return no card is focused
            setSelectedCategoryStep3a(null);
            const step3aData = (stepData as any).step3a || {};
            saveStepDataLocally("step3a", { ...step3aData, benefitsCategory: null });
            const step3cData = (stepData as any).step3c || {};
            saveStepDataLocally("step3c", { ...step3cData, benefitsCategory: null });
            await new Promise((resolve) => setTimeout(resolve, 100));
            saveStepDataLocally("step3SubStep", { 
              step3SubStep: "step3b",
              isCreatingNew: true
            });
            setCurrentSubStep("step3b");
          }}
          onSkip={handleSkip}
          onAddContactForCategory={handleAddContactForCategory}
        />
      )}

      {currentSubStep === "step3d" && (
        <NewClientStep3d errorFields={errorFields} onNext={undefined} />
      )}

      {currentSubStep === "step3a" && (
        <NewClientStep3a
          errorFields={errorFields}
          fromStep3b={(stepData as any).step3SubStep?.fromStep3b === true}
          onNext={async () => {
            // Clear category selection as soon as user leaves for step3b (Add New Card) so when they return no card is focused
            setSelectedCategoryStep3a(null);
            const step3aData = (stepData as any).step3a || {};
            saveStepDataLocally("step3a", { ...step3aData, benefitsCategory: null });
            const step3cData = (stepData as any).step3c || {};
            saveStepDataLocally("step3c", { ...step3cData, benefitsCategory: null });
            await new Promise((resolve) => setTimeout(resolve, 100));
            saveStepDataLocally("step3SubStep", {
              step3SubStep: "step3b",
              fromStep3b: false,
              isCreatingNew: true,
            });
            setCurrentSubStep("step3b");
          }}
          onCreateContactBeforeNext={() => { }}
        />
      )}

      <IncompleteCategoriesModal
        open={isIncompleteModalOpen}
        onOpenChange={setIsIncompleteModalOpen}
        onFillCategories={handleFillCategories}
        onSkip={handleSkip}
        missingCategories={missingCategories}
        onAddContactForCategory={handleAddContactForCategory}
        contacts={contacts}
      />
    </div>
  );
}
