"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Shield, Heart, PiggyBank, Puzzle, Check, Users } from "lucide-react";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";
import { BrandingImage } from "@/components/ui/branding-image";

interface NewClientStep3cProps {
  errorFields?: string[];
  onNext?: () => void;
  onSkip?: () => void;
  onAddContactForCategory?: (category: BenefitsCategory) => void;
  /** When true, start with no category selected (after Add New Card flow); avoids auto-saved selection restoring focus */
  clearSelectionOnMount?: boolean;
}

export function NewClientStep3c({
  errorFields = [],
  onNext,
  onSkip,
  onAddContactForCategory,
  clearSelectionOnMount = false,
}: NewClientStep3cProps) {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();

  // Static categories - always show these 4 categories
  const categories: BenefitsCategory[] = [
    "Retirement",
    "Group Health",
    "Group Life",
    "Other Benefits",
  ];

  const categoryIcons: Record<BenefitsCategory, typeof Building2> = {
    Retirement: PiggyBank,
    "Group Health": Shield,
    "Group Life": Heart,
    "Other Benefits": Puzzle,
    "Company / Plan Sponsor": Users,
    "Recordkeeper / Vendor": Building2,
    "Third Party Contact": Building2,
  };

  // Map categories to their logos (same as step-3a)
  const categoryLogos: Record<BenefitsCategory, string> = {
    Retirement: "/benefits-logo/Waypoint-WEB.webp",
    "Group Health": "/benefits-logo/Integrity_H_CMYK.jpeg",
    "Group Life": "/benefits-logo/Sun-Life-Financial.jpg",
    "Other Benefits": "/benefits-logo/wellhub.png",
    "Company / Plan Sponsor": "",
    "Recordkeeper / Vendor": "",
    "Third Party Contact": "",
  };

  // Get saved benefits category selection or default to null; when clearSelectionOnMount (after creating a contact) start with null so auto-saved focus is not restored
  const step3cData = (stepData as any).step3c || {};
  const contacts = (stepData.keyContacts as any)?.contacts || [];
  const [selectedCategory, setSelectedCategory] =
    useState<BenefitsCategory | null>(
      clearSelectionOnMount ? null : step3cData.benefitsCategory || null,
    );

  const [otherBenefitsText, setOtherBenefitsText] = useState<string>(
    step3cData.otherBenefitsText || "",
  );

  const defaultCompanyName = stepData?.companyBasics?.companyName || "";
  const defaultCompanyLogo = stepData?.companyBasics?.companyLogo?.url || "";

  const step3cDataForCompany = (stepData as any).step3c || {};
  const [planSponsorCompanyName, setPlanSponsorCompanyName] = useState<string>(
    step3cDataForCompany.planSponsorCompanyName || defaultCompanyName,
  );
  const [planSponsorCompanyLogo, setPlanSponsorCompanyLogo] = useState<string>(
    step3cDataForCompany.planSponsorCompanyLogo || defaultCompanyLogo,
  );

  // Company name and logo for Other Benefits category
  const [companyName, setCompanyName] = useState<string>(
    step3cDataForCompany.otherBenefitsCompanyName || "",
  );
  const [companyLogo, setCompanyLogo] = useState<string>(
    step3cDataForCompany.otherBenefitsCompanyLogo || "",
  );

  const [isSponsorMissingError, setIsSponsorMissingError] = useState(false);

  // Get contacts to count them per category
  const keyContactsData = stepData.keyContacts || { contacts: [] };

  // Count complete contacts per category (same rules as step-3a: first + last + email or phone)
  const getContactCount = (category: BenefitsCategory): number => {
    return contacts.filter((contact: any) => {
      const hasFirstName =
        contact.firstName && String(contact.firstName).trim() !== "";
      const hasLastName =
        contact.lastName && String(contact.lastName).trim() !== "";
      const hasEmail = contact.email && String(contact.email).trim() !== "";
      const hasPhone = contact.phone && String(contact.phone).trim() !== "";
      const isComplete =
        hasFirstName && hasLastName && (hasEmail || hasPhone);
      if (!isComplete) return false;

      const contactCategories =
        contact.benefitsCategories ||
        (contact.benefitsCategory ? [contact.benefitsCategory] : []);
      if (!contactCategories || contactCategories.length === 0) return false;
      return contactCategories.includes(category);
    }).length;
  };

  // Track last persisted data to avoid unnecessary saves
  const lastPersistedStep3cData = useRef<{
    benefitsCategory: BenefitsCategory | null;
    otherBenefitsText?: string;
    planSponsorCompanyName?: string;
    planSponsorCompanyLogo?: string;
    otherBenefitsCompanyName?: string;
    otherBenefitsCompanyLogo?: string;
  }>({
    benefitsCategory: step3cData.benefitsCategory || null,
    otherBenefitsText: step3cData.otherBenefitsText || "",
    planSponsorCompanyName:
      step3cDataForCompany.planSponsorCompanyName || defaultCompanyName,
    planSponsorCompanyLogo:
      step3cDataForCompany.planSponsorCompanyLogo || defaultCompanyLogo,
    otherBenefitsCompanyName:
      step3cDataForCompany.otherBenefitsCompanyName || "",
    otherBenefitsCompanyLogo:
      step3cDataForCompany.otherBenefitsCompanyLogo || "",
  });

  // When we've just landed from step3b (after creating a category contact), force-clear selection before paint
  useLayoutEffect(() => {
    const subStep = (stepData as any).step3SubStep;
    if (subStep?.fromStep3bJustNow) {
      setSelectedCategory(null);
      lastPersistedStep3cData.current = {
        ...lastPersistedStep3cData.current,
        benefitsCategory: null,
      };
      const step3cDataCurrent = (stepData as any).step3c || {};
      saveStepDataLocally("step3c", {
        ...step3cDataCurrent,
        benefitsCategory: null,
      });
      saveStepDataLocally("step3SubStep", { step3SubStep: "step3c" });
    }
  }, [stepData, saveStepDataLocally]);

  // When user has 2+ contacts, remove automatic focus (no card highlighted) when this screen is shown
  useEffect(() => {
    if (contacts.length >= 2 && selectedCategory !== null) {
      setSelectedCategory(null);
      lastPersistedStep3cData.current = {
        ...lastPersistedStep3cData.current,
        benefitsCategory: null,
      };
      const step3cDataCurrent = (stepData as any).step3c || {};
      saveStepDataLocally("step3c", {
        ...step3cDataCurrent,
        benefitsCategory: null,
      });
    }
  }, [contacts.length]);

  // Save selection to store (auto-save)
  useEffect(() => {
    const currentData = {
      benefitsCategory: selectedCategory,
      otherBenefitsText:
        selectedCategory === "Other Benefits" ? otherBenefitsText : "",
      planSponsorCompanyName: planSponsorCompanyName,
      planSponsorCompanyLogo: planSponsorCompanyLogo,
      otherBenefitsCompanyName:
        selectedCategory === "Other Benefits" ? companyName : "",
      otherBenefitsCompanyLogo:
        selectedCategory === "Other Benefits" ? companyLogo : "",
    };

    // Check if data has changed
    if (
      lastPersistedStep3cData.current.benefitsCategory ===
        currentData.benefitsCategory &&
      lastPersistedStep3cData.current.otherBenefitsText ===
        currentData.otherBenefitsText &&
      (lastPersistedStep3cData.current as any).planSponsorCompanyName ===
        currentData.planSponsorCompanyName &&
      (lastPersistedStep3cData.current as any).planSponsorCompanyLogo ===
        currentData.planSponsorCompanyLogo &&
      (lastPersistedStep3cData.current as any).otherBenefitsCompanyName ===
        currentData.otherBenefitsCompanyName &&
      (lastPersistedStep3cData.current as any).otherBenefitsCompanyLogo ===
        currentData.otherBenefitsCompanyLogo
    ) {
      return;
    }

    lastPersistedStep3cData.current = currentData as any;
    saveStepDataLocally("step3c", currentData);
  }, [
    selectedCategory,
    otherBenefitsText,
    planSponsorCompanyName,
    planSponsorCompanyLogo,
    companyName,
    companyLogo,
    saveStepDataLocally,
  ]);

  const hasInitializedCompanyData = useRef(false);

  // Sync with store when stepData changes (e.g., after loading draft); skip when just landed from step3b so we don't restore focus (including Company / Plan Sponsor)
  useEffect(() => {
    if ((stepData as any).step3SubStep?.fromStep3bJustNow) return;
    const step3cData = (stepData as any).step3c || {};
    const normalizedData = {
      benefitsCategory: step3cData.benefitsCategory || null,
      otherBenefitsText: step3cData.otherBenefitsText || "",
      planSponsorCompanyName:
        step3cData.planSponsorCompanyName || defaultCompanyName,
      planSponsorCompanyLogo:
        step3cData.planSponsorCompanyLogo || defaultCompanyLogo,
      otherBenefitsCompanyName: step3cData.otherBenefitsCompanyName || "",
      otherBenefitsCompanyLogo: step3cData.otherBenefitsCompanyLogo || "",
    };

    // Update category and other benefits text
    if (
      lastPersistedStep3cData.current.benefitsCategory !==
        normalizedData.benefitsCategory ||
      lastPersistedStep3cData.current.otherBenefitsText !==
        normalizedData.otherBenefitsText
    ) {
      lastPersistedStep3cData.current = normalizedData as any;
      setSelectedCategory(normalizedData.benefitsCategory);
      setOtherBenefitsText(normalizedData.otherBenefitsText);
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
  ]);

  // Auto-fill removed as per user request
  // useEffect(() => {
  //   if (
  //     selectedCategory === "Other Benefits" &&
  //     (!otherBenefitsText || otherBenefitsText.trim() === "")
  //   ) {
  //     const sponsorName = planSponsorCompanyName || defaultCompanyName;
  //     if (sponsorName) {
  //       setOtherBenefitsText(sponsorName);
  //     }
  //   }
  // }, [selectedCategory, planSponsorCompanyName, defaultCompanyName]);

  // Handle category selection - just save the selection, don't create contact yet
  const handleCategorySelect = (category: BenefitsCategory) => {
    const hasCompletePlanSponsor =
      getContactCount("Company / Plan Sponsor") > 0;

    if (category !== "Company / Plan Sponsor" && !hasCompletePlanSponsor) {
      setIsSponsorMissingError(true);
      return;
    }

    setIsSponsorMissingError(false);

    // While no Plan Sponsor contact exists, this is the only selectable category — do not allow deselecting it.
    if (
      category === "Company / Plan Sponsor" &&
      !hasCompletePlanSponsor &&
      selectedCategory === "Company / Plan Sponsor"
    ) {
      return;
    }

    // Toggle selection: if already selected, de-select (set to null)
    const isSelected = selectedCategory === category;
    const newCategory = isSelected ? null : category;

    setSelectedCategory(newCategory);

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
      otherBenefitsCompanyName:
        newCategory === "Other Benefits" ? companyName : "",
      otherBenefitsCompanyLogo:
        newCategory === "Other Benefits" ? companyLogo : "",
    };
    lastPersistedStep3cData.current = dataToSave as any;
    saveStepDataLocally("step3c", dataToSave);
  };

  // Create contact from selected category when Next is clicked
  const createContactFromSelectedCategory = useCallback(() => {
    // Get fresh data from store to ensure we have latest values
    const currentStepData = useNewClientWizardStore.getState().stepData;
    const step3cData = (currentStepData as any).step3c || {};
    const categoryToUse = selectedCategory || step3cData.benefitsCategory;

    if (!categoryToUse) {
      return null;
    }

    const currentKeyContactsData = currentStepData.keyContacts || {
      contacts: [],
    };
    const currentContacts = currentKeyContactsData.contacts || [];

    const defaultCompanyName =
      currentStepData?.companyBasics?.companyName || "";
    const defaultCompanyLogo =
      currentStepData?.companyBasics?.companyLogo?.url || "";

    const step3cDataForContact = (currentStepData as any).step3c || {};
    const otherText =
      categoryToUse === "Other Benefits"
        ? step3cDataForContact.otherBenefitsText || otherBenefitsText || ""
        : undefined;

    // Get company name and logo for Other Benefits category
    const otherBenefitsCompanyName =
      categoryToUse === "Other Benefits"
        ? step3cDataForContact.otherBenefitsCompanyName || companyName || ""
        : undefined;
    const otherBenefitsCompanyLogo =
      categoryToUse === "Other Benefits"
        ? step3cDataForContact.otherBenefitsCompanyLogo ||
          companyLogo ||
          undefined
        : undefined;

    // Use overridden company name and logo for Company / Plan Sponsor category
    // For Other Benefits, use the specific company name/logo
    const isHRPeople = categoryToUse === "Company / Plan Sponsor";
    const isOtherBenefits = categoryToUse === "Other Benefits";
    const contactCompanyName = isHRPeople
      ? planSponsorCompanyName || defaultCompanyName
      : isOtherBenefits
      ? otherBenefitsCompanyName || defaultCompanyName
      : defaultCompanyName;
    const contactCompanyLogo = isHRPeople
      ? planSponsorCompanyLogo || defaultCompanyLogo || undefined
      : isOtherBenefits
      ? otherBenefitsCompanyLogo || defaultCompanyLogo || undefined
      : defaultCompanyLogo || undefined;

    // Check if there's already a primary contact in the SAME benefits category
    const hasExistingPrimaryInSameCategory = currentContacts.some((c: any) => {
      if (!(c.isPrimaryOverall || c.isPrimary)) return false;
      const contactCategories = c.benefitsCategories || [];
      return [categoryToUse].some((cat) => contactCategories.includes(cat));
    });

    // Only set primary if there are no existing contacts with primary in the same category
    const newContactIsPrimary = !hasExistingPrimaryInSameCategory;

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
      companyLogo: contactCompanyLogo,
      companyLogoAssetId: undefined,
      name: "",
      showOnPortal: true,
      isPrimary: newContactIsPrimary,
      displayScope: "thisPortal" as const,
      isPrimaryByCategory:
        newContactIsPrimary && categoryToUse
          ? ({ [categoryToUse]: true } as any)
          : undefined,
      isPrimaryOverall: newContactIsPrimary,
      displayEmail: true,
      displayPhone: true,
      displayUrl: false,
      enableContactButton: true,
      benefitsCategory: categoryToUse,
      benefitsCategoryOther: otherText,
    };

    const updatedContacts = [...currentContacts, newContact];

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
    selectedCategory,
    otherBenefitsText,
    planSponsorCompanyName,
    planSponsorCompanyLogo,
    companyName,
    companyLogo,
  ]);

  // Expose createContactFromSelectedCategory function to parent via window
  useEffect(() => {
    (window as any).__step3cCreateContact = createContactFromSelectedCategory;
    return () => {
      delete (window as any).__step3cCreateContact;
    };
  }, [createContactFromSelectedCategory]);

  // Count contacts for Company/Plan Sponsor (Company / Plan Sponsor category)
  const companyContactCount = getContactCount("Company / Plan Sponsor");
  const hasCompanyContacts = companyContactCount > 0;

  const getSubheaderText = () => {
    const hasPlanSponsor = companyContactCount > 0;
    const hasNonSponsor = contacts.some(
      (c: any) =>
        c.benefitsCategories?.some(
          (cat: any) => cat !== "Company / Plan Sponsor",
        ),
    );

    if (hasPlanSponsor && hasNonSponsor) {
      return "Your key contacts are set up. You can add more now or proceed to the next step.";
    }

    if (hasNonSponsor) {
      return "You can continue adding contacts for other benefits, or click Next to move on.";
    }

    if (selectedCategory && selectedCategory !== "Company / Plan Sponsor") {
      const label =
        selectedCategory === "Other Benefits"
          ? otherBenefitsText || "Other"
          : selectedCategory;
      return `You’re adding a ${label} contact. Click Next to enter contact details.`;
    }

    if (selectedCategory === "Company / Plan Sponsor") {
      return "Company / Plan Sponsor added. Next, add a contact for another benefits category (Retirement, Group Health, Group Life, etc).";
    }

    return "Do employees need different contacts for retirement, health insurance, or other benefits?";
  };

  const handleSkip = () => {
    // Navigate to step3d
    saveStepDataLocally("step3SubStep", { step3SubStep: "step3d" });
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <div className="space-y-5 dark:text-gray-100">
      {/* Question */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1.5 dark:text-gray-100">
          Add contacts for other benefits
        </h2>
        <div className="py-1.5 px-4 rounded-sm inline-block max-w-2xl mx-auto">
          <p className="text-sm font-medium">{getSubheaderText()}</p>
        </div>
      </div>

      {/* Company / Plan Sponsor Section */}
      <div
        className={cn(
          "rounded-lg p-4 border max-w-2xl mx-auto cursor-pointer transition-all hover:shadow-md",
          selectedCategory === "Company / Plan Sponsor"
            ? "border-2 border-accent-blue bg-accent-blue/5"
            : "bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-600",
          errorFields.includes("benefitsCategory") &&
            selectedCategory !== "Company / Plan Sponsor" &&
            "border-red-300",
        )}
        onClick={() => handleCategorySelect("Company / Plan Sponsor")}
      >
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-3 dark:text-gray-100">
              Company / Plan Sponsor
            </h3>
            {/* Company Logo */}
            <div className="flex items-center justify-center mb-3">
              <div className="relative flex min-h-[4rem] max-h-24 w-full max-w-[220px] min-w-0 items-center justify-center px-1 py-1">
                {defaultCompanyLogo?.trim() ? (
                  <BrandingImage
                    src={defaultCompanyLogo}
                    alt="Company logo"
                    className="max-h-[5.5rem] w-auto max-w-full object-contain"
                  />
                ) : null}
                {selectedCategory === "Company / Plan Sponsor" && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs">
              <span
                className={cn(
                  "text-gray-700 dark:text-gray-300",
                  companyContactCount === 0 && "text-gray-500 dark:text-gray-400",
                )}
              >
                {companyContactCount} contact
                {companyContactCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Category Selection */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto">
          {categories.map((category) => {
            const Icon = categoryIcons[category];
            const isSelected = selectedCategory === category;
            const contactCount = getContactCount(category);
            const hasError =
              errorFields.includes("benefitsCategory") &&
              selectedCategory === null;

            return (
              <Card
                key={category}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md dark:bg-gray-800",
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
                      "w-12 h-12 flex items-center justify-center relative",
                      isSelected
                        ? "bg-accent-blue/10"
                        : "bg-gray-100 dark:bg-gray-700",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-7 h-7",
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
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {contactCount}{" "}
                      {contactCount === 1 ? "contact" : "contacts"}
                    </span>
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
            selectedCategory === "Other Benefits"
              ? "opacity-100 max-h-[500px]"
              : "opacity-0 max-h-0 mt-0",
          )}
        >
          <Card className="dark:bg-gray-800 dark:border-gray-600">
            <CardContent className="p-4">
              <div className="space-y-2">
                <Label
                  htmlFor="other-benefits-text-step3c"
                  className="text-sm font-medium dark:text-gray-300"
                >
                  Please specify other category (max 50 characters)
                </Label>
                <Input
                  id="other-benefits-text-step3c"
                  value={otherBenefitsText}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setOtherBenefitsText(newValue);
                    // Save immediately
                    const dataToSave = {
                      benefitsCategory: selectedCategory,
                      otherBenefitsText: newValue,
                      planSponsorCompanyName: planSponsorCompanyName,
                      planSponsorCompanyLogo: planSponsorCompanyLogo,
                      otherBenefitsCompanyName: companyName,
                      otherBenefitsCompanyLogo: companyLogo,
                    };
                    lastPersistedStep3cData.current = dataToSave as any;
                    saveStepDataLocally("step3c", dataToSave);
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
      {errorFields.includes("benefitsCategory") && !selectedCategory && (
        <div className="text-center">
          <p className="text-sm text-red-500">
            Please select a benefits category
          </p>
        </div>
      )}
      {errorFields.includes("benefitsCategory") &&
        selectedCategory === "Company / Plan Sponsor" &&
        companyContactCount === 0 && (
          <div className="text-center">
            <p className="text-sm text-red-500">
              Please add at least one contact for Company / Plan Sponsor
            </p>
          </div>
        )}
      {errorFields.includes("otherBenefitsText") &&
        selectedCategory === "Other Benefits" &&
        !otherBenefitsText.trim() && (
          <div className="text-center">
            <p className="text-sm text-red-500">
              Please specify the benefit type
            </p>
          </div>
        )}

      {/* Skip Button */}
      <div className="flex justify-center pt-4 border-t max-w-2xl mx-auto dark:border-gray-700">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSkip}
          className="text-gray-600 hover:text-gray-900 font-medium dark:text-gray-400 dark:hover:text-gray-200"
        >
          skip for now
        </Button>
      </div>
    </div>
  );
}
