"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Shield, Heart, Gift, Check } from "lucide-react";
import { BenefitsCategory } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";
import { BrandingImage } from "@/components/ui/branding-image";
interface NewClientStep3aProps {
  errorFields?: string[];
  onNext?: () => void;
  onCreateContactBeforeNext?: (category: BenefitsCategory | null) => void;
  fromStep3b?: boolean;
}

export function NewClientStep3a({
  errorFields = [],
  onNext,
  onCreateContactBeforeNext,
  fromStep3b = false,
}: NewClientStep3aProps) {
  const {
    stepData,
    saveStepDataLocally,
    loadOnboardingData,
    selectedCategoryStep3a,
    setSelectedCategoryStep3a,
  } = useNewClientWizardStore();

  // Read fromStep3b from store using selector for reactive updates
  // This ensures the component re-renders when step3SubStep changes
  const step3SubStepData = useNewClientWizardStore(
    (state) => (state.stepData as any)?.step3SubStep,
  );

  // Check if we're coming from step-3b (prioritize store value over prop)
  const isFromStep3b = step3SubStepData?.fromStep3b === true || fromStep3b;

  // Static categories - always show these 4 categories
  const categories: BenefitsCategory[] = [
    "Retirement",
    "Group Health",
    "Group Life",
    "Other Benefits",
  ];

  const categoryIcons: Record<BenefitsCategory, typeof Building2> = {
    Retirement: Building2,
    "Group Health": Shield,
    "Group Life": Heart,
    "Other Benefits": Gift,
    "Company / Plan Sponsor": Building2,
    "Recordkeeper / Vendor": Building2,
    "Third Party Contact": Building2,
    Multiple: Building2,
  };

  // Map categories to their logos
  const categoryLogos: Record<BenefitsCategory, string> = {
    Retirement: "/benefits-logo/Waypoint-WEB.webp",
    "Group Health": "/benefits-logo/Integrity_H_CMYK.jpeg",
    "Group Life": "/benefits-logo/Sun-Life-Financial.jpg",
    "Other Benefits": "/benefits-logo/wellhub.png",
    "Company / Plan Sponsor": "",
    "Recordkeeper / Vendor": "",
    "Third Party Contact": "",
    Multiple: "",
  };

  const step3aData = (stepData as any).step3a || {};
  // Sync selectedCategoryStep3a from store on mount; skip when coming from step3b so we don't restore focus after creating a contact (including Company / Plan Sponsor)
  useEffect(() => {
    const fromStep3b = (stepData as any).step3SubStep?.fromStep3b === true;
    if (fromStep3b) return;
    if (!selectedCategoryStep3a && step3aData.benefitsCategory) {
      setSelectedCategoryStep3a(step3aData.benefitsCategory);
    }
  }, []);
  const [otherBenefitsText, setOtherBenefitsText] = useState<string>(
    step3aData.otherBenefitsText || "",
  );

  // Company name and logo for Plan Sponsor (Company / Plan Sponsor)
  const defaultCompanyName = stepData?.companyBasics?.companyName || "";
  const defaultCompanyLogo = stepData?.companyBasics?.companyLogo?.url || "";

  // Get saved values from step3a or use defaults
  const step3aDataForCompany = (stepData as any).step3a || {};
  const [planSponsorCompanyName, setPlanSponsorCompanyName] = useState<string>(
    step3aDataForCompany.planSponsorCompanyName || defaultCompanyName,
  );
  const [planSponsorCompanyLogo, setPlanSponsorCompanyLogo] = useState<string>(
    step3aDataForCompany.planSponsorCompanyLogo || defaultCompanyLogo,
  );

  // Primary contact flag for HR/People category
  const [isPrimaryForHRPeople, setIsPrimaryForHRPeople] = useState<boolean>(
    step3aDataForCompany.isPrimaryForHRPeople ?? true, // Default to true
  );

  // Modal states for primary contact confirmation
  const [showSetPrimaryConfirm, setShowSetPrimaryConfirm] = useState(false);
  const [showUnsetPrimaryWarning, setShowUnsetPrimaryWarning] = useState(false);
  const [pendingPrimaryChange, setPendingPrimaryChange] = useState<
    boolean | null
  >(null);
  const [pendingCreateContact, setPendingCreateContact] = useState(false);

  // Company name and logo for Other Benefits category
  const [companyName, setCompanyName] = useState<string>(
    step3aDataForCompany.otherBenefitsCompanyName || "",
  );
  const [companyLogo, setCompanyLogo] = useState<string>(
    step3aDataForCompany.otherBenefitsCompanyLogo || "",
  );

  // Advisor organization data
  const [advisorOrgName, setAdvisorOrgName] = useState<string>("");
  const [advisorOrgLogo, setAdvisorOrgLogo] = useState<string>("");

  // Error state for missing plan sponsor contact
  const [isSponsorMissingError, setIsSponsorMissingError] = useState(false);

  // Fetch advisor organization data
  useEffect(() => {
    const fetchAdvisorOrg = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const profile = await response.json();
          if (profile.company) {
            setAdvisorOrgName(profile.company);
          }
          if (profile.advisorLogo || profile.advisorLogoUrl) {
            setAdvisorOrgLogo(
              profile.advisorLogo || profile.advisorLogoUrl || "",
            );
          }
        }
      } catch (error) {
        console.error("Failed to fetch advisor organization:", error);
      }
    };
    fetchAdvisorOrg();
  }, []);

  const advisorOffersThisBenefit = !!advisorOrgName;

  // Get contacts to count them per category
  const keyContactsData = stepData.keyContacts || { contacts: [] };
  const contacts = keyContactsData.contacts || [];
  const savedContacts = contacts;

  // Count contacts for each category (only count COMPLETE contacts)
  // A contact is complete if it has: firstName AND lastName AND (email OR phone)
  const getContactCount = (category: BenefitsCategory): number => {
    return contacts.filter((contact) => {
      // Check all required fields for a complete contact
      const hasFirstName = contact.firstName && contact.firstName.trim() !== "";
      const hasLastName = contact.lastName && contact.lastName.trim() !== "";
      const hasEmail = contact.email && contact.email.trim() !== "";
      const hasPhone = contact.phone && contact.phone.trim() !== "";

      // Contact must have firstName, lastName, AND at least email or phone
      const isComplete = hasFirstName && hasLastName && (hasEmail || hasPhone);

      if (!isComplete) {
        return false;
      }

      const contactCategories =
        contact.benefitsCategories ||
        (contact.benefitsCategory ? [contact.benefitsCategory] : []);

      if (!contactCategories || contactCategories.length === 0) {
        return false;
      }
      return contactCategories.includes(category);
    }).length;
  };

  // Count contacts for Company/Plan Sponsor (Company / Plan Sponsor category)
  const companyContactCount = getContactCount("Company / Plan Sponsor");
  const hasCompanyContacts = companyContactCount > 0;

  // Track last persisted data to avoid unnecessary saves
  const lastPersistedStep3aData = useRef<{
    benefitsCategory: BenefitsCategory | null;
    otherBenefitsText?: string;
    planSponsorCompanyName?: string;
    planSponsorCompanyLogo?: string;
    isPrimaryForHRPeople?: boolean;
    otherBenefitsCompanyName?: string;
    otherBenefitsCompanyLogo?: string;
  }>({
    benefitsCategory: step3aData.benefitsCategory || null,
    otherBenefitsText: step3aData.otherBenefitsText || "",
    planSponsorCompanyName:
      step3aDataForCompany.planSponsorCompanyName || defaultCompanyName,
    planSponsorCompanyLogo:
      step3aDataForCompany.planSponsorCompanyLogo || defaultCompanyLogo,
    isPrimaryForHRPeople: step3aDataForCompany.isPrimaryForHRPeople ?? true,
    otherBenefitsCompanyName:
      step3aDataForCompany.otherBenefitsCompanyName || "",
    otherBenefitsCompanyLogo:
      step3aDataForCompany.otherBenefitsCompanyLogo || "",
  });

  // Save selection to store (auto-save)
  useEffect(() => {
    const currentData = {
      benefitsCategory: selectedCategoryStep3a,
      otherBenefitsText:
        selectedCategoryStep3a === "Other Benefits" ? otherBenefitsText : "",
      planSponsorCompanyName: planSponsorCompanyName,
      planSponsorCompanyLogo: planSponsorCompanyLogo,
      isPrimaryForHRPeople: isPrimaryForHRPeople,
      otherBenefitsCompanyName:
        selectedCategoryStep3a === "Other Benefits" ? companyName : "",
      otherBenefitsCompanyLogo:
        selectedCategoryStep3a === "Other Benefits" ? companyLogo : "",
    };

    if (
      lastPersistedStep3aData.current.benefitsCategory ===
        currentData.benefitsCategory &&
      lastPersistedStep3aData.current.otherBenefitsText ===
        currentData.otherBenefitsText &&
      (lastPersistedStep3aData.current as any).planSponsorCompanyName ===
        currentData.planSponsorCompanyName &&
      (lastPersistedStep3aData.current as any).planSponsorCompanyLogo ===
        currentData.planSponsorCompanyLogo &&
      (lastPersistedStep3aData.current as any).isPrimaryForHRPeople ===
        currentData.isPrimaryForHRPeople &&
      (lastPersistedStep3aData.current as any).otherBenefitsCompanyName ===
        currentData.otherBenefitsCompanyName &&
      (lastPersistedStep3aData.current as any).otherBenefitsCompanyLogo ===
        currentData.otherBenefitsCompanyLogo
    ) {
      return;
    }

    lastPersistedStep3aData.current = currentData as any;
    saveStepDataLocally("step3a", currentData);
  }, [
    selectedCategoryStep3a,
    otherBenefitsText,
    planSponsorCompanyName,
    planSponsorCompanyLogo,
    isPrimaryForHRPeople,
    companyName,
    companyLogo,
    saveStepDataLocally,
  ]);

  // Sync isPrimaryForHRPeople with HR/People contacts in keyContacts
  useEffect(() => {
    // Skip if there's a pending change (waiting for confirmation)
    if (pendingPrimaryChange !== null) return;

    const hrPeopleContacts = contacts.filter((contact: any) => {
      if (
        !contact.benefitsCategories ||
        contact.benefitsCategories.length === 0
      )
        return false;
      return contact.benefitsCategories.includes("Company / Plan Sponsor");
    });

    if (hrPeopleContacts.length === 0) return;

    // Check if any HR/People contact needs to be updated
    const needsUpdate = hrPeopleContacts.some((contact: any) => {
      const currentPrimary = contact.isPrimaryOverall ?? false;
      return currentPrimary !== isPrimaryForHRPeople;
    });

    if (!needsUpdate) return;

    // Check if there's already a primary contact (excluding HR/People contacts)
    const hasExistingPrimaryContact = contacts.some(
      (contact: any) =>
        !contact.benefitsCategories?.includes("Company / Plan Sponsor") &&
        (contact.isPrimaryOverall || contact.isPrimary),
    );

    // If setting to primary and there's already a primary contact, show confirmation
    if (isPrimaryForHRPeople && hasExistingPrimaryContact) {
      setPendingPrimaryChange(true);
      setShowSetPrimaryConfirm(true);
      return;
    }

    // Update all HR/People contacts to match isPrimaryForHRPeople
    const updatedContacts = contacts.map((contact: any) => {
      const isHRPeople = contact.benefitsCategories?.includes(
        "Company / Plan Sponsor",
      );
      if (isHRPeople) {
        return {
          ...contact,
          isPrimaryOverall: isPrimaryForHRPeople,
          isPrimary: isPrimaryForHRPeople, // Also update legacy isPrimary
        };
      }
      return contact;
    });

    const updatedKeyContacts = {
      ...keyContactsData,
      contacts: updatedContacts,
    };

    saveStepDataLocally("keyContacts", updatedKeyContacts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPrimaryForHRPeople,
    contacts.length,
    keyContactsData,
    saveStepDataLocally,
    pendingPrimaryChange,
  ]);

  // Track if company name/logo have been initialized
  const hasInitializedCompanyData = useRef(false);

  // Clear category selection when coming from step-3b to add a new contact
  useEffect(() => {
    if (isFromStep3b) {
      // Clear the selected category to allow selecting a new one for adding a new contact
      setSelectedCategoryStep3a(null);
      setOtherBenefitsText("");
      // Clear saved category in step3a data
      saveStepDataLocally("step3a", {
        ...step3aData,
        benefitsCategory: null,
        otherBenefitsText: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFromStep3b]);

  // Sync with store when stepData changes (e.g., after loading draft)
  useEffect(() => {
    // Skip if coming from step-3b (we want to clear selection)
    if (isFromStep3b) {
      return;
    }

    const step3aData = (stepData as any).step3a || {};
    const normalizedData = {
      benefitsCategory: step3aData.benefitsCategory || null,
      otherBenefitsText: step3aData.otherBenefitsText || "",
      planSponsorCompanyName:
        step3aData.planSponsorCompanyName || defaultCompanyName,
      planSponsorCompanyLogo:
        step3aData.planSponsorCompanyLogo || defaultCompanyLogo,
      isPrimaryForHRPeople: step3aData.isPrimaryForHRPeople ?? true,
      otherBenefitsCompanyName: step3aData.otherBenefitsCompanyName || "",
      otherBenefitsCompanyLogo: step3aData.otherBenefitsCompanyLogo || "",
    };

    // Update category and other benefits text
    if (
      lastPersistedStep3aData.current.benefitsCategory !==
        normalizedData.benefitsCategory ||
      lastPersistedStep3aData.current.otherBenefitsText !==
        normalizedData.otherBenefitsText
    ) {
      lastPersistedStep3aData.current = normalizedData as any;
      setSelectedCategoryStep3a(normalizedData.benefitsCategory);
      setOtherBenefitsText(normalizedData.otherBenefitsText);
    }

    // Update isPrimaryForHRPeople if changed
    if (
      (lastPersistedStep3aData.current as any).isPrimaryForHRPeople !==
      normalizedData.isPrimaryForHRPeople
    ) {
      setIsPrimaryForHRPeople(normalizedData.isPrimaryForHRPeople);
    }

    // Only initialize company name/logo once on mount if they're empty
    if (!hasInitializedCompanyData.current) {
      if (!planSponsorCompanyName && normalizedData.planSponsorCompanyName) {
        setPlanSponsorCompanyName(normalizedData.planSponsorCompanyName);
      }
      if (!planSponsorCompanyLogo && normalizedData.planSponsorCompanyLogo) {
        setPlanSponsorCompanyLogo(normalizedData.planSponsorCompanyLogo);
      }
      // Initialize Other Benefits company name/logo only if category is Other Benefits
      if (
        normalizedData.benefitsCategory === "Other Benefits" &&
        normalizedData.otherBenefitsCompanyName &&
        !companyName
      ) {
        setCompanyName(normalizedData.otherBenefitsCompanyName);
      }
      if (
        normalizedData.benefitsCategory === "Other Benefits" &&
        normalizedData.otherBenefitsCompanyLogo &&
        !companyLogo
      ) {
        setCompanyLogo(normalizedData.otherBenefitsCompanyLogo);
      }
      hasInitializedCompanyData.current = true;
    } else {
      // After initialization, sync Other Benefits company name/logo only when category is Other Benefits
      // and only if the store has different values (to avoid overwriting user's current input)
      if (normalizedData.benefitsCategory === "Other Benefits") {
        if (
          normalizedData.otherBenefitsCompanyName &&
          normalizedData.otherBenefitsCompanyName !== companyName
        ) {
          setCompanyName(normalizedData.otherBenefitsCompanyName);
        }
        if (
          normalizedData.otherBenefitsCompanyLogo &&
          normalizedData.otherBenefitsCompanyLogo !== companyLogo
        ) {
          setCompanyLogo(normalizedData.otherBenefitsCompanyLogo);
        }
      }
    }
  }, [
    stepData,
    defaultCompanyName,
    defaultCompanyLogo,
    // Removed companyName and companyLogo from dependencies to avoid infinite loop
    // They are only updated when stepData changes, not when they change themselves
  ]);

  // Auto-fill removed as per user request
  // useEffect(() => {
  //   if (
  //     selectedCategoryStep3a === "Other Benefits" &&
  //     (!otherBenefitsText || otherBenefitsText.trim() === "")
  //   ) {
  //     const sponsorName = planSponsorCompanyName || defaultCompanyName;
  //     if (sponsorName) {
  //       setOtherBenefitsText(sponsorName);
  //     }
  //   }
  // }, [selectedCategoryStep3a, planSponsorCompanyName, defaultCompanyName]);

  // When user already has a complete Plan Sponsor contact AND 2+ contacts total, drop the
  // category highlight so they can pick another card without a forced selection.
  // Do NOT clear while Plan Sponsor is still missing — seeded advisor rows can make
  // contacts.length >= 2 immediately (onboarding), and we still want Plan Sponsor selected by default.
  useEffect(() => {
    if (
      contacts.length >= 2 &&
      hasCompanyContacts &&
      selectedCategoryStep3a !== null
    ) {
      setSelectedCategoryStep3a(null);
      const step3aDataCurrent = (stepData as any).step3a || {};
      saveStepDataLocally("step3a", {
        ...step3aDataCurrent,
        benefitsCategory: null,
      });
    }
  }, [contacts.length, hasCompanyContacts, selectedCategoryStep3a]);

  // Default to Company / Plan Sponsor until at least one complete Plan Sponsor contact exists.
  // (Requires !isFromStep3b so "add another category" after step3b stays unforced.)
  useLayoutEffect(() => {
    if (isFromStep3b) return;
    if (selectedCategoryStep3a !== null) return;
    if (!hasCompanyContacts) {
      setSelectedCategoryStep3a("Company / Plan Sponsor");
    }
  }, [isFromStep3b, selectedCategoryStep3a, hasCompanyContacts]);

  // Load customService from onboarding when "Other Benefits" is selected and otherBenefitsText is empty
  useEffect(() => {
    const loadCustomServiceFromOnboarding = async () => {
      // Only load if:
      // 1. "Other Benefits" is selected
      // 2. otherBenefitsText is empty (not already set by user)
      // 3. Not coming from step-3b (which clears the selection)
      if (
        selectedCategoryStep3a === "Other Benefits" &&
        (!otherBenefitsText || otherBenefitsText.trim() === "") &&
        !isFromStep3b
      ) {
        try {
          const onboardingData = await loadOnboardingData();
          if (
            onboardingData &&
            typeof onboardingData === "object" &&
            onboardingData.services
          ) {
            const services = onboardingData.services;
            // Check if "other" service is selected and has customService
            // ServiceType.OTHER = 'other' (string value)
            if (
              services.services &&
              (services.services.includes("other") ||
                services.services.includes("OTHER")) &&
              services.customService &&
              services.customService.trim() !== ""
            ) {
              // Pre-fill otherBenefitsText with onboarding's customService
              setOtherBenefitsText(services.customService);
              // Save to step3a data
              const currentStep3aData = (stepData as any).step3a || {};
              saveStepDataLocally("step3a", {
                ...currentStep3aData,
                otherBenefitsText: services.customService,
              });
            }
          }
        } catch (error) {
          console.error(
            "Failed to load custom service from onboarding:",
            error,
          );
        }
      }
    };

    loadCustomServiceFromOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryStep3a, isFromStep3b]);

  // Handle category selection - just save the selection, don't create contact yet
  const handleCategorySelect = (category: BenefitsCategory) => {
    // Until at least one complete Company/Plan Sponsor contact exists, only that category may be selected.
    if (category !== "Company / Plan Sponsor" && !hasCompanyContacts) {
      setIsSponsorMissingError(true);
      return;
    }

    setIsSponsorMissingError(false);

    // While no Plan Sponsor contact exists, this is the only selectable category — do not allow deselecting it.
    if (
      category === "Company / Plan Sponsor" &&
      !hasCompanyContacts &&
      selectedCategoryStep3a === "Company / Plan Sponsor"
    ) {
      return;
    }

    // Toggle selection: if already selected, de-select (set to null)
    const isSelected = selectedCategoryStep3a === category;
    const newCategory = isSelected ? null : category;

    setSelectedCategoryStep3a(newCategory);

    // Clear other benefits text and company name/logo if switching away from Other Benefits
    if (newCategory !== "Other Benefits") {
      setOtherBenefitsText("");
      setCompanyName("");
      setCompanyLogo("");
    }

    // Always save immediately to prevent validation errors
    const dataToSave = {
      benefitsCategory: newCategory,
      otherBenefitsText:
        newCategory === "Other Benefits" ? otherBenefitsText : "",
      planSponsorCompanyName: planSponsorCompanyName,
      planSponsorCompanyLogo: planSponsorCompanyLogo,
      isPrimaryForHRPeople: isPrimaryForHRPeople,
      otherBenefitsCompanyName:
        newCategory === "Other Benefits" ? companyName : "",
      otherBenefitsCompanyLogo:
        newCategory === "Other Benefits" ? companyLogo : "",
    };
    lastPersistedStep3aData.current = dataToSave as any;
    saveStepDataLocally("step3a", dataToSave);
  };

  // Create contact from selected category when Next is clicked
  const createContactFromSelectedCategory = useCallback(() => {
    // Get fresh data from store to ensure we have latest values
    const currentStepData = useNewClientWizardStore.getState().stepData;
    const step3aData = (currentStepData as any).step3a || {};
    const step3SubStepData = (currentStepData as any)?.step3SubStep || {};
    const categoryToUse = selectedCategoryStep3a || step3aData.benefitsCategory;

    if (!categoryToUse) {
      return null;
    }

    const currentKeyContactsData = currentStepData.keyContacts || {
      contacts: [],
    };
    const currentContacts = currentKeyContactsData.contacts || [];

    // Check if we're editing an existing contact (coming from step-3b)
    const editingContactId = step3SubStepData?.selectedContactId;
    const isEditingExisting = isFromStep3b && editingContactId;

    const defaultCompanyName =
      currentStepData?.companyBasics?.companyName || "";
    const defaultCompanyLogo =
      currentStepData?.companyBasics?.companyLogo?.url || "";

    const step3aDataForContact = (currentStepData as any).step3a || {};
    const otherText =
      categoryToUse === "Other Benefits"
        ? step3aDataForContact.otherBenefitsText || otherBenefitsText || ""
        : undefined;

    // Get company name and logo for Other Benefits category
    const otherBenefitsCompanyName =
      categoryToUse === "Other Benefits"
        ? step3aDataForContact.otherBenefitsCompanyName || companyName || ""
        : undefined;
    const otherBenefitsCompanyLogo =
      categoryToUse === "Other Benefits"
        ? step3aDataForContact.otherBenefitsCompanyLogo ||
          companyLogo ||
          undefined
        : undefined;

    // Use overridden company name and logo for Company / Plan Sponsor category
    // For Other Benefits, use the specific company name/logo
    // For Retirement, Group Health, Group Life - these should be EMPTY (user fills separately)
    const isHRPeople = categoryToUse === "Company / Plan Sponsor";
    const isOtherBenefits = categoryToUse === "Other Benefits";

    // Only prefill companyName/Logo for Company/Plan Sponsor or Other Benefits
    // Retirement, Group Health, Group Life should start empty
    const contactCompanyName = isHRPeople
      ? planSponsorCompanyName || defaultCompanyName
      : isOtherBenefits
      ? otherBenefitsCompanyName || ""
      : ""; // Empty for Retirement, Group Health, Group Life
    const contactCompanyLogo = isHRPeople
      ? planSponsorCompanyLogo || defaultCompanyLogo || undefined
      : isOtherBenefits
      ? otherBenefitsCompanyLogo || undefined
      : undefined; // No logo for Retirement, Group Health, Group Life

    // Check if we're editing an existing contact
    if (isEditingExisting && editingContactId) {
      // Find the existing contact
      const existingContactIndex = currentContacts.findIndex(
        (c: any) => c.id === editingContactId,
      );

      if (existingContactIndex !== -1) {
        // Update existing contact with new category
        const existingContact = currentContacts[existingContactIndex];
        const updatedContact = {
          ...existingContact,
          benefitsCategories: [categoryToUse],
          benefitsCategory: categoryToUse,
          benefitsCategoryOther: otherText,
          companyName: contactCompanyName,
          companyLogo: contactCompanyLogo,
        };

        const updatedContacts = [...currentContacts];
        updatedContacts[existingContactIndex] = updatedContact;
        const updatedKeyContacts = {
          ...currentKeyContactsData,
          contacts: updatedContacts,
        };

        // Save the updated contact
        const { saveStepDataLocally: saveToStore } =
          useNewClientWizardStore.getState();
        saveToStore("keyContacts", updatedKeyContacts);

        // Dispatch event to select the updated contact in step3b
        window.dispatchEvent(
          new CustomEvent("selectContact", {
            detail: { contactId: editingContactId },
          }),
        );

        return editingContactId;
      }
    }

    // Check if there's already a primary contact in the SAME benefits category
    const hasExistingPrimaryInSameCategory = currentContacts.some((c: any) => {
      if (!(c.isPrimaryOverall || c.isPrimary)) return false;
      const contactCategories = c.benefitsCategories || [];
      return [categoryToUse].some((cat) => contactCategories.includes(cat));
    });

    // Only set primary if there are no existing contacts with primary in the same category
    const shouldBePrimary = !hasExistingPrimaryInSameCategory;

    // If this NEW contact should be primary, we only remove primary from others in the SAME category
    const updatedContactsProcessing = shouldBePrimary
      ? currentContacts.map((c: any) => {
          const contactCategories = c.benefitsCategories || [];
          const sharesCategory = [categoryToUse].some((cat) =>
            contactCategories.includes(cat),
          );
          if (sharesCategory) {
            return {
              ...c,
              isPrimaryOverall: false,
              isPrimary: false,
            };
          }
          return c;
        })
      : currentContacts;

    const newContact = {
      id: `contact-${Date.now()}-${Math.random()}`,
      contactType: "individual" as const,
      benefitsCategories: [categoryToUse],
      role: "HR Generalist" as const,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName: contactCompanyName,
      companyLogo:
        contactCompanyLogo || stepData?.companyBasics?.companyLogo?.url,
      companyLogoAssetId: undefined,
      name: "",
      showOnPortal: true,
      isPrimary: shouldBePrimary,
      displayScope: "thisPortal" as const,
      isPrimaryByCategory:
        shouldBePrimary && categoryToUse
          ? ({ [categoryToUse]: true } as any)
          : undefined,
      isPrimaryOverall: shouldBePrimary,
      displayEmail: true,
      displayPhone: true,
      displayUrl: false,
      enableContactButton: true,
      benefitsCategory: categoryToUse,
      benefitsCategoryOther: otherText,
    };

    const updatedContacts = [...updatedContactsProcessing, newContact];

    // Sort contacts: Primary contacts come first
    const sortedContacts = [...updatedContacts].sort((a, b) => {
      const aIsPrimary = a.isPrimaryOverall || a.isPrimary || false;
      const bIsPrimary = b.isPrimaryOverall || b.isPrimary || false;
      if (aIsPrimary && !bIsPrimary) return -1;
      if (!aIsPrimary && bIsPrimary) return 1;
      return 0;
    });

    const updatedKeyContacts = {
      ...currentKeyContactsData,
      contacts: sortedContacts,
      contactDisplayOrder: sortedContacts.map((c: any) => c.id),
    };

    // Save the new contact using store's saveStepDataLocally
    const { saveStepDataLocally: saveToStore } =
      useNewClientWizardStore.getState();
    saveToStore("keyContacts", updatedKeyContacts);

    // Dispatch event to select the new contact in step3b
    window.dispatchEvent(
      new CustomEvent("selectContact", {
        detail: { contactId: newContact.id },
      }),
    );

    return newContact.id;
  }, [
    selectedCategoryStep3a,
    otherBenefitsText,
    planSponsorCompanyName,
    planSponsorCompanyLogo,
    isPrimaryForHRPeople,
    companyName,
    companyLogo,
    isFromStep3b,
  ]);

  // Expose createContactFromSelectedCategory function to parent via window
  useEffect(() => {
    (window as any).__step3aCreateContact = createContactFromSelectedCategory;
    return () => {
      delete (window as any).__step3aCreateContact;
    };
  }, [createContactFromSelectedCategory]);

  return (
    <div className="space-y-5 dark:text-gray-100">
      {/* Question */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1.5 dark:text-gray-100">
          {contacts.length >= 2
            ? "Add contacts for other benefits"
            : isFromStep3b
            ? "Add Another Contact"
            : "Add Key Benefits Contacts"}
        </h2>
        <p className="text-base text-gray-600 max-w-2xl mx-auto dark:text-gray-400">
          {(() => {
            if (contacts.length >= 2) {
              if (selectedCategoryStep3a) {
                return `To add a ${
                  selectedCategoryStep3a === "Company / Plan Sponsor"
                    ? "Company / Plan Sponsor"
                    : selectedCategoryStep3a
                } contact, click Add New Card. You can also click Continue to proceed to the next step.`;
              }
              return "Your key contacts are set up. You can add more now or proceed to the next step.";
            } else if (isFromStep3b) {
              return "Select another benefits category to add a contact for.";
            } else {
              return "Add Key Benefits Contacts for the categories that apply to your company. You can add more contacts later if needed.";
            }
          })()}
        </p>
      </div>

      {/* Company / Plan Sponsor Section */}
      <div
        className={cn(
          "rounded-lg border max-w-2xl mx-auto cursor-pointer transition-all hover:shadow-md",
          selectedCategoryStep3a === "Company / Plan Sponsor"
            ? "border-2 border-accent-blue bg-accent-blue/5"
            : "bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-600",
          errorFields.includes("benefitsCategory") &&
            selectedCategoryStep3a !== "Company / Plan Sponsor" &&
            "border-red-300",
        )}
        onClick={() => handleCategorySelect("Company / Plan Sponsor")}
      >
        <div className="p-4 text-center">
          <h3 className="text-base font-semibold text-gray-900 mb-2 dark:text-gray-100">
            Company / Plan Sponsor
          </h3>

          {/* Company Logo */}
          {stepData?.companyBasics?.companyLogo?.url?.trim() ? (
            <div className="relative inline-block mb-2">
              <BrandingImage
                src={stepData.companyBasics.companyLogo.url}
                alt="Company logo"
                className="w-32 h-32"
              />
              {selectedCategoryStep3a === "Company / Plan Sponsor" && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
          ) : (
            selectedCategoryStep3a === "Company / Plan Sponsor" && (
              <div className="relative inline-block mb-2">
                <div className="w-32 h-14" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            )
          )}

          {!isFromStep3b && (
            <p className="text-xs text-gray-700 dark:text-gray-400">
              {companyContactCount === 0
                ? "Contact(s) needed"
                : `${companyContactCount} ${
                    companyContactCount === 1 ? "contact" : "contacts"
                  } added`}
            </p>
          )}
        </div>
      </div>

      {/* Benefits Category Selection */}
      <div className="space-y-2">
        <div className="flex gap-3 max-w-2xl mx-auto">
          {categories.map((category) => {
            const Icon = categoryIcons[category];
            const isSelected = selectedCategoryStep3a === category;
            const contactCount = getContactCount(category);
            const hasError =
              errorFields.includes("benefitsCategory") &&
              selectedCategoryStep3a === null;

            return (
              <Card
                key={category}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md flex-1",
                  isSelected
                    ? "border-2 border-accent-blue bg-accent-blue/5"
                    : "border border-gray-200 hover:border-gray-300 dark:border-gray-600",
                  hasError && !isSelected && "border-red-300",
                  !hasCompanyContacts &&
                    "cursor-not-allowed opacity-[0.58] hover:shadow-none",
                )}
                onClick={() => handleCategorySelect(category)}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center space-y-2 min-h-[100px]">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center relative",
                      isSelected ? "bg-accent-blue/10" : "bg-gray-100 dark:bg-gray-700",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-6 h-6",
                        isSelected ? "text-accent-blue" : "text-gray-600 dark:text-gray-400",
                      )}
                    />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center space-y-0.5">
                    <span className="text-xs font-semibold text-center dark:text-gray-200">
                      {category === "Other Benefits" ? "Other" : category}
                    </span>
                    {!isFromStep3b && (
                      <span
                        className={cn(
                          "text-xs",
                          contactCount === 0
                            ? "text-gray-500 font-medium dark:text-gray-400"
                            : "text-gray-500 dark:text-gray-400",
                        )}
                      >
                        {contactCount === 0
                          ? "Contact(s) needed"
                          : `${contactCount} ${
                              contactCount === 1 ? "contact" : "contacts"
                            } added`}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Custom input for Other Benefits */}
        <div
          className={cn(
            "max-w-2xl mx-auto mt-4 transition-all duration-300 ease-in-out overflow-hidden",
            selectedCategoryStep3a === "Other Benefits"
              ? "opacity-100 max-h-[500px]"
              : "opacity-0 max-h-0 mt-0",
          )}
        >
          <Card className="dark:bg-gray-800 dark:border-gray-600">
            <CardContent className="p-4">
              <div className="space-y-2">
                <Label
                  htmlFor="other-benefits-text"
                  className="text-sm font-medium dark:text-gray-300"
                >
                  Please specify other category (max 50 characters)
                </Label>
                <Input
                  id="other-benefits-text"
                  value={otherBenefitsText}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setOtherBenefitsText(newValue);
                    // Save immediately
                    const dataToSave = {
                      benefitsCategory: selectedCategoryStep3a,
                      otherBenefitsText: newValue,
                      planSponsorCompanyName: planSponsorCompanyName,
                      planSponsorCompanyLogo: planSponsorCompanyLogo,
                      isPrimaryForHRPeople: isPrimaryForHRPeople,
                      otherBenefitsCompanyName: companyName,
                      otherBenefitsCompanyLogo: companyLogo,
                    };
                    lastPersistedStep3aData.current = dataToSave as any;
                    saveStepDataLocally("step3a", dataToSave);
                  }}
                  placeholder="Enter custom type"
                  maxLength={50}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground text-right dark:text-gray-400">
                  {otherBenefitsText.length}/50 characters
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* <div className="flex justify-end max-w-4xl mx-auto mb-2">
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={() => setIsServicesModalOpen(true)}
            className="flex h-9 w-36 items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Add more
          </Button>
        </div> */}
      </div>

      {/* Error Messages */}
      {isSponsorMissingError && (
        <div className="text-center animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-sm text-red-500 font-medium">
            You must enter a Company/Plan Sponsor point of contact first. Please
            click Next to continue.
          </p>
        </div>
      )}

      {errorFields.includes("benefitsCategory") && !selectedCategoryStep3a && (
        <div className="text-center">
          <p className="text-sm text-red-500">
            Please select a benefits category
          </p>
        </div>
      )}
    </div>
  );
}
