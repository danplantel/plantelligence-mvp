"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { SlideContainer, SlideDirection } from "./slides/slide-container";
import { FirstContactPrompt } from "./slides/first-contact-prompt";
import { ContactFormSlide } from "./slides/contact-form-slide";
import { CategoryExplorer } from "./slides/category-explorer";
import { NewClientStep3d } from "./step-3d";
import { IncompleteCategoriesModal } from "./components/incomplete-categories-modal";
import { BenefitsCategory } from "@/types/new-client-wizard";
import { mergeOnboardingAdvisorContactsIntoKeyContacts } from "@/lib/seed-onboarding-advisor-contacts";

// ==================== Types ====================

interface NewClientStep3Props {
  errorFields?: string[];
}

type SlideId =
  | "first-contact-prompt"     // 0
  | "contact-form"             // 1
  | "category-explorer"        // 2
  | "preview-layout";          // 3

interface SlideDef {
  id: SlideId;
  label: string;
}

const SLIDES: SlideDef[] = [
  { id: "first-contact-prompt", label: "Main Contact" },
  { id: "contact-form", label: "Details" },
  { id: "category-explorer", label: "Categories" },
  { id: "preview-layout", label: "Preview" },
];

// ==================== Helpers ====================

function computeInitialSlide(contacts: any[]): number {
  if (contacts.length === 0) return 0;

  const hasPlanSponsor = contacts.some((c) => {
    const cats = c.benefitsCategories || (c.benefitsCategory ? [c.benefitsCategory] : []);
    return cats.includes("Company / Plan Sponsor");
  });

  if (!hasPlanSponsor) return 0;

  const completeContacts = contacts.filter((c) => {
    const hasFirstName = c.firstName && String(c.firstName).trim() !== "";
    const hasLastName = c.lastName && String(c.lastName).trim() !== "";
    const hasEmail = c.email && String(c.email).trim() !== "";
    const hasPhone = c.phone && String(c.phone).trim() !== "";
    return hasFirstName && hasLastName && (hasEmail || hasPhone);
  });

  if (completeContacts.length >= 1) return 2;
  return 2;
}

// ==================== Component ====================

export function NewClientStep3({ errorFields = [] }: NewClientStep3Props) {
  const {
    stepData,
    saveStepDataLocally,
    clearErrorFields,
    setSelectedCategoryStep3a,
    currentStep,
    step3SlideIndex,
    setStep3SlideIndex,
  } = useNewClientWizardStore();

  // Get contacts
  const keyContactsData = stepData.keyContacts || { contacts: [] };
  const contacts = keyContactsData.contacts || [];

  // Initialize slide from store or compute initial
  const initialSlide = useMemo(() => {
    // If store has a valid slide index, use it
    if (typeof step3SlideIndex === "number" && step3SlideIndex >= 0 && step3SlideIndex <= 3) {
      return step3SlideIndex;
    }
    return computeInitialSlide(contacts);
  }, []);

  // Track whether the initial advisor seed has been attempted (prevents re-seeding after manual deletion)
  const hasSeededAdvisorContacts = useRef(false);

  // Local slide state (synced with store)
  const [slideIndex, setSlideIndexLocal] = useState(initialSlide);
  const prevSlideIndexRef = useRef(slideIndex);
  const [direction, setDirection] = useState<SlideDirection>(1);

  // Category for the contact form
  const [contactFormCategory, setContactFormCategory] =
    useState<BenefitsCategory>("Company / Plan Sponsor");
  const [isGuidedForm, setIsGuidedForm] = useState(true);

  // Modal state
  const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);
  const [missingCategories, setMissingCategories] = useState<BenefitsCategory[]>([]);

  // Sync slide changes to store
  const goToSlide = useCallback(
    (target: number) => {
      const prev = prevSlideIndexRef.current;
      setDirection(target > prev ? 1 : -1);
      prevSlideIndexRef.current = target;
      setSlideIndexLocal(target);
      setStep3SlideIndex(target);

      // Keep legacy step3SubStep for backward compatibility
      const legacyMap: Record<number, string> = {
        0: "step3a",
        1: "step3b",
        2: "step3c",
        3: "step3d",
      };
      saveStepDataLocally("step3SubStep", {
        step3SubStep: legacyMap[target] || "step3a",
      });
    },
    [setStep3SlideIndex, saveStepDataLocally],
  );

  // Sync from store (e.g., when wizard Next button changes step3SlideIndex)
  useEffect(() => {
    if (
      typeof step3SlideIndex === "number" &&
      step3SlideIndex !== slideIndex &&
      step3SlideIndex >= 0 &&
      step3SlideIndex <= 3
    ) {
      const prev = prevSlideIndexRef.current;
      setDirection(step3SlideIndex > prev ? 1 : -1);
      prevSlideIndexRef.current = step3SlideIndex;
      setSlideIndexLocal(step3SlideIndex);
    }
  }, [step3SlideIndex, slideIndex]);

  // Fallback: seed advisor contacts from profile
  // Seed advisor contacts only once on initial mount — never re-run after manual deletion
  useEffect(() => {
    if (currentStep !== 3) return;
    if (hasSeededAdvisorContacts.current) return;
    if (contacts.length > 0) return;

    hasSeededAdvisorContacts.current = true;

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
          saveStepDataToServer: saveServer,
          saveAsDraft: draft,
        } = useNewClientWizardStore.getState();
        saveLocal("keyContacts", newKc);
        await saveServer("keyContacts", newKc);
        await draft();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, contacts.length]);

  // ==================== Slide Handlers ====================

  // Slide 0 → Slide 1
  const handleFirstContactContinue = useCallback(() => {
    saveStepDataLocally("step3b", {});
    setContactFormCategory("Company / Plan Sponsor");
    setIsGuidedForm(true);
    goToSlide(1);
  }, [goToSlide, saveStepDataLocally]);

  // Slide 1 → Slide 2 (contact saved)
  const handleContactFormContinue = useCallback(() => {
    setSelectedCategoryStep3a(null);
    saveStepDataLocally("step3a", {
      benefitsCategory: null,
      otherBenefitsText: "",
    });
    goToSlide(2);
  }, [goToSlide, setSelectedCategoryStep3a, saveStepDataLocally]);

  // Slide 1 → Slide 0 (Back)
  const handleContactFormBack = useCallback(() => {
    goToSlide(0);
  }, [goToSlide]);

  // Slide 2 → Slide 1 (category selected)
  const handleCategorySelect = useCallback(
    (category: BenefitsCategory) => {
      // Clear previously saved step3b form data so the form starts fresh
      saveStepDataLocally("step3b", {});
      setContactFormCategory(category);
      setIsGuidedForm(false);
      goToSlide(1);
    },
    [goToSlide, saveStepDataLocally],
  );

  // Slide 2 → Slide 3 (Continue to preview)
  const handleCategoryContinue = useCallback(() => {
    goToSlide(3);
  }, [goToSlide]);

  // Slide 2 → Back: skip Slide 0 (creation prompt) if main contact exists, go to edit mode instead
  const handleCategoryBack = useCallback(() => {
    const existingMainContact = contacts.find((c: any) => {
      const cats = c.benefitsCategories || (c.benefitsCategory ? [c.benefitsCategory] : []);
      return cats.includes("Company / Plan Sponsor");
    });
    if (existingMainContact) {
      // Main contact already exists: pre-populate step3b with its data and go to edit mode
      saveStepDataLocally("step3b", {
        editingContactId: existingMainContact.id,
        contactType: existingMainContact.contactType || "individual",
        firstName: existingMainContact.firstName || "",
        lastName: existingMainContact.lastName || "",
        title: existingMainContact.title || "",
        displayName: existingMainContact.displayName || "",
        email: existingMainContact.email || "",
        phone: existingMainContact.phone || "",
        companyName: existingMainContact.companyName || "",
        isPrimaryOverall: existingMainContact.isPrimaryOverall ?? true,
      });
      setContactFormCategory("Company / Plan Sponsor");
      setIsGuidedForm(false);
      goToSlide(1);
    } else {
      goToSlide(0);
    }
  }, [goToSlide, contacts, saveStepDataLocally]);

  // Slide 1 → Slide 2 (Back from category form)
  const handleContactFormCategoryBack = useCallback(() => {
    goToSlide(2);
  }, [goToSlide]);

  // Check missing categories
  const checkMissingCategories = useCallback((): BenefitsCategory[] => {
    const requiredCategories: BenefitsCategory[] = [
      "Retirement",
      "Group Health",
      "Group Life",
      "Other Benefits",
    ];
    const filledCategories = new Set<BenefitsCategory>();

    contacts.forEach((contact: any) => {
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
  }, [contacts]);

  const handleAddContactForCategory = useCallback(
    (category: BenefitsCategory) => {
      saveStepDataLocally("step3b", {});
      setContactFormCategory(category);
      setIsGuidedForm(false);
      setIsIncompleteModalOpen(false);
      goToSlide(1);
    },
    [goToSlide, saveStepDataLocally],
  );

  const handleSkip = useCallback(() => {
    setIsIncompleteModalOpen(false);
    goToSlide(3);
  }, [goToSlide]);

  // ==================== Render ====================

  const defaultCompanyName = stepData?.companyBasics?.companyName || "";
  const defaultCompanyLogo = stepData?.companyBasics?.companyLogo?.url || "";

  const slideContent = useMemo(() => {
    switch (slideIndex) {
      case 0:
        return <FirstContactPrompt onContinue={handleFirstContactContinue} />;
      case 1:
        return (
          <ContactFormSlide
            key={`form-${contactFormCategory}-${isGuidedForm ? "guided" : "free"}`}
            category={contactFormCategory}
            defaultCompanyName={defaultCompanyName}
            defaultCompanyLogo={defaultCompanyLogo}
            defaultIsPrimary={contactFormCategory === "Company / Plan Sponsor"}
            onBack={
              isGuidedForm
                ? handleContactFormBack
                : handleContactFormCategoryBack
            }
            onContinue={handleContactFormContinue}
            isGuided={isGuidedForm}
            errorFields={errorFields}
          />
        );
      case 2:
        return (
          <CategoryExplorer
            onCategorySelect={handleCategorySelect}
            onBack={handleCategoryBack}
            onContinue={handleCategoryContinue}
            onEditContact={(category, contact) => {
              // Pre-populate step3b with the existing contact's data so the form
              // initialises with its values, and include editingContactId so
              // saveContact knows to update rather than create a duplicate.
              saveStepDataLocally("step3b", {
                editingContactId: contact?.id || null,
                contactType: contact?.contactType || "individual",
                firstName: contact?.firstName || "",
                lastName: contact?.lastName || "",
                title: contact?.title || "",
                displayName: contact?.displayName || "",
                email: contact?.email || "",
                phone: contact?.phone || "",
                phoneExtension: contact?.phoneExtension || "",
                companyName: contact?.companyName || "",
                isPrimaryOverall: contact?.isPrimaryOverall ?? false,
              });
              setContactFormCategory(category);
              setIsGuidedForm(false);
              goToSlide(1);
            }}
            onEditMainContact={() => {
              const existingMainContact = contacts.find((c: any) => {
                const cats = c.benefitsCategories || (c.benefitsCategory ? [c.benefitsCategory] : []);
                return cats.includes("Company / Plan Sponsor");
              });
              saveStepDataLocally("step3b", {
                editingContactId: existingMainContact?.id || null,
                contactType: existingMainContact?.contactType || "individual",
                firstName: existingMainContact?.firstName || "",
                lastName: existingMainContact?.lastName || "",
                title: existingMainContact?.title || "",
                displayName: existingMainContact?.displayName || "",
                email: existingMainContact?.email || "",
                phone: existingMainContact?.phone || "",
                phoneExtension: existingMainContact?.phoneExtension || "",
                companyName: existingMainContact?.companyName || "",
                isPrimaryOverall: existingMainContact?.isPrimaryOverall ?? true,
              });
              setContactFormCategory("Company / Plan Sponsor");
              setIsGuidedForm(false);
              goToSlide(1);
            }}
          />
        );
      case 3:
        return <NewClientStep3d errorFields={errorFields} onBack={() => goToSlide(2)} />;
      default:
        return null;
    }
  }, [
    slideIndex,
    contactFormCategory,
    isGuidedForm,
    defaultCompanyName,
    defaultCompanyLogo,
    handleFirstContactContinue,
    handleContactFormContinue,
    handleContactFormBack,
    handleContactFormCategoryBack,
    handleCategorySelect,
    handleCategoryContinue,
    handleCategoryBack,
    errorFields,
  ]);

  return (
    <div className="space-y-3 max-w-4xl mx-auto dark:text-gray-100 pb-8">

      <SlideContainer
        currentIndex={slideIndex}
        totalSlides={4}
        direction={direction}
        slides={SLIDES}
        onDotClick={(index) => {
          if (index < slideIndex) {
            goToSlide(index);
          }
        }}
      >
        {slideContent}
      </SlideContainer>

      <IncompleteCategoriesModal
        open={isIncompleteModalOpen}
        onOpenChange={setIsIncompleteModalOpen}
        onFillCategories={() => {
          setIsIncompleteModalOpen(false);
          goToSlide(2);
        }}
        onSkip={handleSkip}
        missingCategories={missingCategories}
        onAddContactForCategory={handleAddContactForCategory}
        contacts={contacts}
      />
    </div>
  );
}
