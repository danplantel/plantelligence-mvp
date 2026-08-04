"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { SlideContainer, SlideDirection } from "./slides/slide-container";
import { FirstContactPrompt, SomeoneElseOption } from "./slides/first-contact-prompt";
import { ContactFormSlide } from "./slides/contact-form-slide";
import { CategoryExplorer } from "./slides/category-explorer";
import { NewClientStep3d } from "./step-3d";
import { IncompleteCategoriesModal } from "./components/incomplete-categories-modal";
import { cn } from "@/lib/utils";
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

  // Accept either Plan Sponsor or Third Party Contact as a valid main contact
  const hasMainContact = contacts.some((c) => {
    const cats = c.benefitsCategories || (c.benefitsCategory ? [c.benefitsCategory] : []);
    return cats.includes("Company / Plan Sponsor") || cats.includes("Third Party Contact");
  });

  if (!hasMainContact) return 0;

  if (contacts.length >= 1) return 2;
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
    advisorProfile,
  } = useNewClientWizardStore();

  // Get contacts
  const keyContactsData = stepData.keyContacts || { contacts: [] };
  const contacts = keyContactsData.contacts || [];

  // Track whether the initial advisor seed has been attempted (prevents re-seeding after manual deletion)
  const hasSeededAdvisorContacts = useRef(false);

  // Local slide state — start at slide 0, then sync from store/contacts on mount
  const [slideIndex, setSlideIndexLocal] = useState(0);
  const [initialSlideSynced, setInitialSlideSynced] = useState(false);

  // Sync the initial slide after mount once contacts and step3SlideIndex are settled.
  // When no contacts exist (brand-new plan), always start at slide 0 (FirstContactPrompt)
  // regardless of any persisted step3SlideIndex from a previous plan session.
  useEffect(() => {
    if (initialSlideSynced) return;
    let targetSlide = 0;
    if (contacts.length === 0) {
      // Brand new plan — force slide 0, clear any stale store index
      targetSlide = 0;
    } else if (typeof step3SlideIndex === "number" && step3SlideIndex >= 0 && step3SlideIndex <= 3) {
      targetSlide = step3SlideIndex;
    } else {
      targetSlide = computeInitialSlide(contacts);
    }
    setSlideIndexLocal(targetSlide);
    setInitialSlideSynced(true);
  }, [contacts.length, step3SlideIndex, initialSlideSynced]);
  const prevSlideIndexRef = useRef(slideIndex);
  const [direction, setDirection] = useState<SlideDirection>(1);

  // Category for the contact form
  const [contactFormCategory, setContactFormCategory] =
    useState<BenefitsCategory>("Company / Plan Sponsor");
  const [isGuidedForm, setIsGuidedForm] = useState(true);

  // Tracks whether the contact form was opened via "Someone Else" selection
  const [isFromSomeoneElse, setIsFromSomeoneElse] = useState(false);

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

  // Sync from store (e.g., when wizard Next button changes step3SlideIndex).
  // Only sync when contacts exist; without contacts a stale persisted index
  // from a previous plan session would override the initial slide 0.
  useEffect(() => {
    if (
      contacts.length === 0 ||
      typeof step3SlideIndex !== "number" ||
      step3SlideIndex === slideIndex ||
      step3SlideIndex < 0 ||
      step3SlideIndex > 3
    ) {
      return;
    }
    const prev = prevSlideIndexRef.current;
    setDirection(step3SlideIndex > prev ? 1 : -1);
    prevSlideIndexRef.current = step3SlideIndex;
    setSlideIndexLocal(step3SlideIndex);
  }, [step3SlideIndex, slideIndex, contacts.length]);

  // Scroll to the top of the page whenever the active slide changes, so each
  // new slide (e.g. the category explorer after the contact form) starts from
  // the top instead of retaining the previous slide's scroll position.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const wizardContent = Array.from(document.querySelectorAll("div")).find(
      (el) => {
        const htmlEl = el as HTMLElement;
        return (
          htmlEl.scrollHeight > htmlEl.clientHeight &&
          (htmlEl.className.includes("mb-12") ||
            htmlEl.className.includes("mb-20"))
        );
      },
    ) as HTMLElement | undefined;
    if (wizardContent) {
      wizardContent.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [slideIndex]);

  // Seed advisor contacts from profile for their primary service categories.
  // Only runs once the user has saved at least one main contact (slide 1 → slide 2
  // transition) so the category explorer never shows surprise pre-seeded contacts
  // before the user has chosen Company / Plan Sponsor or Someone Else.
  useEffect(() => {
    if (currentStep !== 3) return;
    if (contacts.length === 0) return; // wait for user to add their main contact first
    if (hasSeededAdvisorContacts.current) return;

    hasSeededAdvisorContacts.current = true;

    let cancelled = false;
    (async () => {
      try {
        // Use advisorProfile from store if already available (set by step-3a or step-3b),
        // otherwise fall back to fetching it.
        let profile = advisorProfile;
        if (!profile) {
          const res = await fetch("/api/profile");
          if (!res.ok || cancelled) return;
          profile = await res.json();
        }
        if (!profile || cancelled) return;

        // Grab the latest contacts from the store (includes the user's just-saved
        // main contact) so mergeOnboardingAdvisorContactsIntoKeyContacts can
        // skip categories that already have a complete contact.
        const currentKc =
          useNewClientWizardStore.getState().stepData.keyContacts || {
            contacts: [],
          };
        const currentContacts = currentKc.contacts || [];

        const next = mergeOnboardingAdvisorContactsIntoKeyContacts(
          currentContacts,
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
        // No new contacts were added — nothing to save
        if (next.length <= currentContacts.length || cancelled) return;

        const newKc = { contacts: next };
        const {
          saveStepDataLocally: saveLocal,
          saveStepDataToServer: saveServer,
          saveAsDraft: draft,
        } = useNewClientWizardStore.getState();
        // Immediately update the store so the UI shows seeded contacts without
        // waiting for the server round-trip (which can take many seconds).
        saveLocal("keyContacts", newKc);
        // Fire-and-forget the server save — the UI already has the contacts.
        saveServer("keyContacts", newKc).catch(() => {});
        draft().catch(() => {});
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, contacts.length, advisorProfile]);

  // ==================== Helpers ====================

  /** Map a "Someone Else" option to the Third Party Contact category */
  function mapSomeoneElseOptionToCategory(
    option: SomeoneElseOption,
  ): BenefitsCategory {
    return "Third Party Contact";
  }

  // ==================== Slide Handlers ====================

  // Slide 0 → Slide 1
  const handleFirstContactContinue = useCallback(() => {
    saveStepDataLocally("step3b", {});
    setContactFormCategory("Company / Plan Sponsor");
    setIsGuidedForm(true);
    setIsFromSomeoneElse(false);
    goToSlide(1);
  }, [goToSlide, saveStepDataLocally]);

  // Slide 0 → Someone Else selected → navigate to slide 1 (ContactFormSlide)
  const handleSomeoneElseSelect = useCallback(
    (option: SomeoneElseOption) => {
      const category = mapSomeoneElseOptionToCategory(option);
      // Clear previous form data and set "Someone Else" context
      saveStepDataLocally("step3b", {
        isFromSomeoneElse: true,
        someoneElseOption: option,
      });
      setContactFormCategory(category);
      setIsGuidedForm(false);
      setIsFromSomeoneElse(true);
      goToSlide(1);
    },
    [goToSlide, saveStepDataLocally],
  );

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
        phoneExtension: existingMainContact.phoneExtension || "",
        headshot: existingMainContact.headshot || "",
        headshotFileName: existingMainContact.headshotFileName || "",
        companyName: existingMainContact.companyName || "",
        isPrimaryOverall: existingMainContact.isPrimaryOverall ?? true,
        enableContactButton: existingMainContact.enableContactButton ?? existingMainContact.displayScheduleAppointment === true,
        ctaType: existingMainContact.contactButtonType === "calendar" ? "schedule" as const
          : existingMainContact.contactButtonType === "phone" ? "call" as const
          : existingMainContact.contactButtonType === "email" ? "email" as const
          : existingMainContact.contactButtonType === "url" ? "contact" as const
          : (existingMainContact.displayScheduleAppointment ? "schedule" as const
            : existingMainContact.displayPhone && !existingMainContact.displayEmail ? "call" as const
            : existingMainContact.displayEmail && !existingMainContact.displayPhone ? "email" as const
            : existingMainContact.displayUrl ? "contact" as const
            : "schedule" as const),
        schedulingUrl: existingMainContact.schedulingUrl || "",
        websiteUrl: existingMainContact.websiteUrl || "",
        displayEmail: existingMainContact.displayEmail,
        displayPhone: existingMainContact.displayPhone,
        displayUrl: existingMainContact.displayUrl,
        displayScheduleAppointment: existingMainContact.displayScheduleAppointment,
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
        return (
          <FirstContactPrompt
            onContinue={handleFirstContactContinue}
            onSomeoneElseSelect={handleSomeoneElseSelect}
          />
        );
      case 1:
        return (
          <ContactFormSlide
            key={`form-${contactFormCategory}-${isGuidedForm ? "guided" : "free"}-${isFromSomeoneElse ? "someone-else" : "standard"}`}
            category={contactFormCategory}
            defaultCompanyName={defaultCompanyName}
            defaultCompanyLogo={defaultCompanyLogo}
            defaultIsPrimary={contactFormCategory === "Company / Plan Sponsor"}
            onBack={
              isGuidedForm || isFromSomeoneElse
                ? handleContactFormBack
                : handleContactFormCategoryBack
            }
            onContinue={handleContactFormContinue}
            isGuided={isGuidedForm}
            isFromSomeoneElse={isFromSomeoneElse}
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
                headshot: contact?.headshot || "",
                headshotFileName: contact?.headshotFileName || "",
                companyName: contact?.companyName || "",
                isPrimaryOverall: contact?.isPrimaryOverall ?? false,
                enableContactButton: contact?.enableContactButton ?? contact?.displayScheduleAppointment === true,
                ctaType: contact?.contactButtonType === "calendar" ? "schedule" as const
                  : contact?.contactButtonType === "phone" ? "call" as const
                  : contact?.contactButtonType === "email" ? "email" as const
                  : contact?.contactButtonType === "url" ? "contact" as const
                  : (contact?.displayScheduleAppointment ? "schedule" as const
                    : contact?.displayPhone && !contact?.displayEmail ? "call" as const
                    : contact?.displayEmail && !contact?.displayPhone ? "email" as const
                    : contact?.displayUrl ? "contact" as const
                    : "schedule" as const),
                schedulingUrl: contact?.schedulingUrl || "",
                websiteUrl: contact?.websiteUrl || "",
                displayEmail: contact?.displayEmail,
                displayPhone: contact?.displayPhone,
                displayUrl: contact?.displayUrl,
                displayScheduleAppointment: contact?.displayScheduleAppointment,
              });
              setContactFormCategory(category);
              setIsGuidedForm(false);
              setIsFromSomeoneElse(category === "Third Party Contact");
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
                headshot: existingMainContact?.headshot || "",
                headshotFileName: existingMainContact?.headshotFileName || "",
                companyName: existingMainContact?.companyName || "",
                isPrimaryOverall: existingMainContact?.isPrimaryOverall ?? true,
                enableContactButton: existingMainContact?.enableContactButton ?? existingMainContact?.displayScheduleAppointment === true,
                ctaType: existingMainContact?.contactButtonType === "calendar" ? "schedule" as const
                  : existingMainContact?.contactButtonType === "phone" ? "call" as const
                  : existingMainContact?.contactButtonType === "email" ? "email" as const
                  : existingMainContact?.contactButtonType === "url" ? "contact" as const
                  : (existingMainContact?.displayScheduleAppointment ? "schedule" as const
                    : existingMainContact?.displayPhone && !existingMainContact?.displayEmail ? "call" as const
                    : existingMainContact?.displayEmail && !existingMainContact?.displayPhone ? "email" as const
                    : existingMainContact?.displayUrl ? "contact" as const
                    : "schedule" as const),
                schedulingUrl: existingMainContact?.schedulingUrl || "",
                websiteUrl: existingMainContact?.websiteUrl || "",
                displayEmail: existingMainContact?.displayEmail,
                displayPhone: existingMainContact?.displayPhone,
                displayUrl: existingMainContact?.displayUrl,
                displayScheduleAppointment: existingMainContact?.displayScheduleAppointment,
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
    <div
      className={cn(
        "space-y-3 mx-auto dark:text-gray-100 pb-8",
        slideIndex === 3 ? "max-w-6xl" : "max-w-4xl",
      )}
    >

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
