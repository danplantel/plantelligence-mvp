"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BrandingImage } from "@/components/ui/branding-image";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";
import { BenefitsCategory, ContactType } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";

// ==================== Types ====================

export interface ContactFormSlideProps {
  /** The benefits category this contact is for */
  category: BenefitsCategory;
  /** Pre-filled company name */
  defaultCompanyName?: string;
  /** Pre-filled company logo */
  defaultCompanyLogo?: string;
  /** Whether to show as primary by default */
  defaultIsPrimary?: boolean;
  /** Called when user clicks Back */
  onBack: () => void;
  /** Called when user clicks Continue after saving */
  onContinue: () => void;
  /** Whether this is the "guided first contact" mode */
  isGuided?: boolean;
  /** Error fields from validation */
  errorFields?: string[];
}

// ==================== Helpers ====================

const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, "");
  if (phoneNumber.length <= 3) return phoneNumber;
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  if (phoneNumber.length <= 10)
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  return `+${phoneNumber.slice(0, 1)} (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 11)}`;
};

// ==================== Component ====================

export function ContactFormSlide({
  category,
  defaultCompanyName = "",
  defaultCompanyLogo = "",
  defaultIsPrimary = false,
  onBack,
  onContinue,
  isGuided = false,
  errorFields: externalErrorFields = [],
}: ContactFormSlideProps) {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();

  const step3bData = (stepData as any).step3b || {};

  // Form state
  const [contactType, setContactType] = useState<"individual" | "team_support">(
    (step3bData.contactType as "individual" | "team_support") || "individual",
  );
  const [firstName, setFirstName] = useState(step3bData.firstName || "");
  const [lastName, setLastName] = useState(step3bData.lastName || "");
  const [title, setTitle] = useState(step3bData.title || "");
  const [displayName, setDisplayName] = useState(step3bData.displayName || "");
  const [email, setEmail] = useState(step3bData.email || "");
  const [phone, setPhone] = useState(step3bData.phone || "");
  const [phoneExtension, setPhoneExtension] = useState(
    step3bData.phoneExtension || "",
  );
  const [headshot, setHeadshot] = useState<string>(step3bData.headshot || "");
  const [headshotFileName, setHeadshotFileName] = useState<string>(
    step3bData.headshotFileName || "",
  );
  const [companyName, setCompanyName] = useState(
    step3bData.companyName || defaultCompanyName || "",
  );
  const [isPrimary, setIsPrimary] = useState(
    category === "Company / Plan Sponsor" ? true : (step3bData.isPrimaryOverall ?? defaultIsPrimary),
  );

  // Validation state
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  // Refs
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  // Capture editingContactId on mount so auto-save preserves it without reactive deps
  const editingContactIdRef = useRef<string | null | undefined>(
    (stepData as any)?.step3b?.editingContactId,
  );

  // When the parent reuses this component instance (same category key) for a
  // different contact, the ref and all form state must be reset to match the
  // freshly populated step3b data — otherwise the auto-save effect will
  // overwrite step3b with stale values from the previous editing session.
  useEffect(() => {
    const incomingId = (stepData as any)?.step3b?.editingContactId as
      | string
      | null
      | undefined;
    if (incomingId !== editingContactIdRef.current) {
      editingContactIdRef.current = incomingId;
      // Reset form state to the new step3b data
      const sb = (stepData as any).step3b || {};
      setContactType(
        (sb.contactType as "individual" | "team_support") || "individual",
      );
      setFirstName(sb.firstName || "");
      setLastName(sb.lastName || "");
      setTitle(sb.title || "");
      setDisplayName(sb.displayName || "");
      setEmail(sb.email || "");
      setPhone(sb.phone || "");
      setPhoneExtension(sb.phoneExtension || "");
      setHeadshot(sb.headshot || "");
      setHeadshotFileName(sb.headshotFileName || "");
      setCompanyName(sb.companyName || defaultCompanyName || "");
      setIsPrimary(
        category === "Company / Plan Sponsor"
          ? true
          : (sb.isPrimaryOverall ?? defaultIsPrimary),
      );
      setValidationAttempted(false);
      setLocalErrors([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(stepData as any)?.step3b?.editingContactId]);

  // Focus first name on mount for guided mode
  useEffect(() => {
    if (isGuided) {
      setTimeout(() => {
        firstNameRef.current?.focus();
      }, 500); // Wait for slide animation
    }
  }, [isGuided]);

  // Sync validation with external error fields
  useEffect(() => {
    if (externalErrorFields.length > 0) {
      setValidationAttempted(true);
    }
  }, [externalErrorFields]);

  // Auto-save form to store
  useEffect(() => {
    // Preserve editingContactId captured on mount (e.g. when editing an existing contact)
    // Using a ref instead of reactive step3bData to avoid infinite save loops
    const editingContactId = editingContactIdRef.current;

    saveStepDataLocally("step3b", {
      editingContactId: editingContactId || null,
      contactType,
      benefitsCategories: [category],
      benefitsCategory: category,
      firstName,
      lastName,
      title,
      displayName,
      email,
      phone,
      phoneExtension,
      headshot,
      headshotFileName,
      companyName,
      isPrimaryOverall: isPrimary,
    });
  }, [
    contactType,
    category,
    firstName,
    lastName,
    title,
    displayName,
    email,
    phone,
    phoneExtension,
    headshot,
    headshotFileName,
    companyName,
    isPrimary,
    saveStepDataLocally,
  ]);

  // When the user checks "Mark as primary", immediately demote other primary
  // contacts that share the same category — before the user even returns to
  // the CategoryExplorer. This guarantees only one primary per category at
  // all times, without waiting for "Save Contact".
  useEffect(() => {
    if (!isPrimary || category === "Company / Plan Sponsor") return;

    const keyContactsData = stepData.keyContacts || { contacts: [] };
    const savedContacts = (keyContactsData.contacts || []) as any[];
    if (!savedContacts.length) return;

    const editingContactId = editingContactIdRef.current;

    // Determine which categories to scope demotion to
    const promotedContact = editingContactId
      ? savedContacts.find((c: any) => c.id === editingContactId)
      : null;
    const promotedCats: BenefitsCategory[] =
      promotedContact?.benefitsCategories ||
      (promotedContact?.benefitsCategory
        ? [promotedContact.benefitsCategory]
        : [category]);

    // Only update if there's actually another primary contact to demote
    const needsUpdate = savedContacts.some((c: any) => {
      if (editingContactId && c.id === editingContactId) return false;
      const contactCats: BenefitsCategory[] =
        c.benefitsCategories ||
        (c.benefitsCategory ? [c.benefitsCategory] : []);
      const sharesCategory = promotedCats.some((cat) =>
        contactCats.includes(cat),
      );
      return sharesCategory && (c.isPrimaryOverall || c.isPrimary);
    });

    if (!needsUpdate) return;

    const updatedContacts = savedContacts.map((c: any) => {
      if (editingContactId && c.id === editingContactId) {
        return { ...c, isPrimaryOverall: true, isPrimary: true };
      }
      const contactCats: BenefitsCategory[] =
        c.benefitsCategories ||
        (c.benefitsCategory ? [c.benefitsCategory] : []);
      const sharesCategory = promotedCats.some((cat) =>
        contactCats.includes(cat),
      );
      if (sharesCategory && (c.isPrimaryOverall || c.isPrimary)) {
        return { ...c, isPrimaryOverall: false, isPrimary: false };
      }
      return c;
    });

    const updatedKeyContacts = { ...keyContactsData, contacts: updatedContacts };
    saveStepDataLocally("keyContacts", updatedKeyContacts);
  }, [isPrimary, category, stepData.keyContacts, saveStepDataLocally]);

  // Build contact object and save to keyContacts
  // Supports both creating new contacts and editing existing ones
  const saveContact = useCallback(
    (): string => {
      const keyContactsData = stepData.keyContacts || { contacts: [] };
      const savedContacts = keyContactsData.contacts || [];
      const shouldBePrimary = category === "Company / Plan Sponsor" ? true : isPrimary;

      // Check if we're editing an existing contact (passed via step3b.editingContactId)
      const editingContactId = step3bData.editingContactId as string | undefined | null;
      const existingContact = editingContactId
        ? savedContacts.find((c: any) => c.id === editingContactId)
        : null;

      if (existingContact) {
        // Update the existing contact in-place
        const updatedContact = {
          ...existingContact,
          contactType,
          firstName: contactType === "individual" ? firstName : undefined,
          lastName: contactType === "individual" ? lastName : undefined,
          title: contactType === "individual" ? title : undefined,
          displayName: contactType === "team_support" ? displayName : undefined,
          email,
          phone,
          phoneExtension,
          headshot: contactType === "individual" ? headshot || undefined : undefined,
          headshotFileName:
            contactType === "individual" ? headshotFileName || undefined : undefined,
          companyName:
            category === "Company / Plan Sponsor"
              ? companyName || defaultCompanyName
              : companyName || "",
          companyLogo:
            category === "Company / Plan Sponsor"
              ? defaultCompanyLogo || undefined
              : undefined,
          name:
            contactType === "individual"
              ? `${firstName} ${lastName}`.trim()
              : displayName,
          isPrimary: shouldBePrimary,
          isPrimaryOverall: shouldBePrimary,
        };

        // If this contact is being saved as primary, demote only contacts that
        // share a category with the promoted contact (one primary per category)
        const promotedCats: BenefitsCategory[] =
          updatedContact.benefitsCategories ||
          (updatedContact.benefitsCategory
            ? [updatedContact.benefitsCategory]
            : [category]);

        const baseContacts = shouldBePrimary
          ? savedContacts.map((c: any) => {
              const contactCats: BenefitsCategory[] =
                c.benefitsCategories ||
                (c.benefitsCategory ? [c.benefitsCategory] : []);
              const sharesCategory = promotedCats.some((cat) =>
                contactCats.includes(cat),
              );
              if (sharesCategory) {
                return {
                  ...c,
                  isPrimary: false,
                  isPrimaryOverall: false,
                };
              }
              return c;
            })
          : savedContacts;

        const updatedContacts = baseContacts.map((c: any) =>
          c.id === existingContact.id ? updatedContact : c,
        );
        const updatedKeyContacts = { ...keyContactsData, contacts: updatedContacts };
        saveStepDataLocally("keyContacts", updatedKeyContacts);
        return existingContact.id;
      }

      // Guard for non-editing path: if saving a Company / Plan Sponsor contact
      // and one already exists, update it instead of creating a duplicate
      if (category === "Company / Plan Sponsor") {
        const existingMainContact = savedContacts.find((c: any) => {
          const cats = c.benefitsCategories || (c.benefitsCategory ? [c.benefitsCategory] : []);
          return cats.includes("Company / Plan Sponsor");
        });

        if (existingMainContact) {
          const updatedContact = {
            ...existingMainContact,
            contactType,
            firstName: contactType === "individual" ? firstName : undefined,
            lastName: contactType === "individual" ? lastName : undefined,
            title: contactType === "individual" ? title : undefined,
            displayName: contactType === "team_support" ? displayName : undefined,
            email,
            phone,
            phoneExtension,
            headshot: contactType === "individual" ? headshot || undefined : undefined,
            headshotFileName:
              contactType === "individual" ? headshotFileName || undefined : undefined,
            companyName: companyName || defaultCompanyName,
            companyLogo: defaultCompanyLogo || undefined,
            name:
              contactType === "individual"
                ? `${firstName} ${lastName}`.trim()
                : displayName,
            isPrimary: true,
            isPrimaryOverall: true,
          };

          // Demote only contacts in the same category to prevent duplicate primaries
          const baseContacts = savedContacts.map((c: any) => {
            const contactCats: BenefitsCategory[] =
              c.benefitsCategories ||
              (c.benefitsCategory ? [c.benefitsCategory] : []);
            if (contactCats.includes("Company / Plan Sponsor")) {
              return {
                ...c,
                isPrimary: false,
                isPrimaryOverall: false,
              };
            }
            return c;
          });

          const updatedContacts = baseContacts.map((c: any) =>
            c.id === existingMainContact.id ? updatedContact : c,
          );
          const updatedKeyContacts = { ...keyContactsData, contacts: updatedContacts };
          saveStepDataLocally("keyContacts", updatedKeyContacts);
          return existingMainContact.id;
        }
      }

      // If this contact is being saved as primary, demote only contacts that share
      // a category with the new contact (one primary per category)
      const demotedContacts = shouldBePrimary
        ? savedContacts.map((c: any) => {
            const contactCats: BenefitsCategory[] =
              c.benefitsCategories ||
              (c.benefitsCategory ? [c.benefitsCategory] : []);
            if (contactCats.includes(category)) {
              return {
                ...c,
                isPrimary: false,
                isPrimaryOverall: false,
              };
            }
            return c;
          })
        : savedContacts;

      const newContact = {
        id: `contact-${Date.now()}-${Math.random()}`,
        contactType,
        benefitsCategories: [category],
        benefitsCategory: category,
        firstName: contactType === "individual" ? firstName : undefined,
        lastName: contactType === "individual" ? lastName : undefined,
        title: contactType === "individual" ? title : undefined,
        displayName: contactType === "team_support" ? displayName : undefined,
        email,
        phone,
        phoneExtension,
        headshot: contactType === "individual" ? headshot || undefined : undefined,
        headshotFileName:
          contactType === "individual" ? headshotFileName || undefined : undefined,
        companyName:
          category === "Company / Plan Sponsor"
            ? companyName || defaultCompanyName
            : companyName || "",
        companyLogo:
          category === "Company / Plan Sponsor"
            ? defaultCompanyLogo || undefined
            : undefined,
        name:
          contactType === "individual"
            ? `${firstName} ${lastName}`.trim()
            : displayName,
        showOnPortal: true,
        isPrimary: shouldBePrimary,
        isPrimaryOverall: shouldBePrimary,
        displayScope: "thisPortal" as const,
        displayEmail: true,
        displayPhone: true,
        displayUrl: false,
        enableContactButton: true,
      };

      const updatedContacts = [...demotedContacts, newContact];
      const updatedKeyContacts = { ...keyContactsData, contacts: updatedContacts };
      saveStepDataLocally("keyContacts", updatedKeyContacts);
      return newContact.id;
    },
    [
      stepData.keyContacts,
      step3bData,
      contactType,
      category,
      firstName,
      lastName,
      title,
      displayName,
      email,
      phone,
      phoneExtension,
      headshot,
      headshotFileName,
      companyName,
      defaultCompanyName,
      defaultCompanyLogo,
      isPrimary,
      saveStepDataLocally,
    ],
  );

  // Validate form
  const validate = useCallback((): boolean => {
    const errors: string[] = [];

    if (contactType === "individual") {
      if (!firstName.trim()) errors.push("firstName");
      if (!lastName.trim()) errors.push("lastName");
      if (!title.trim()) errors.push("title");
    } else {
      if (!displayName.trim()) errors.push("displayName");
    }

    if (!email.trim()) {
      errors.push("email");
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.push("email");
      }
    }

    if (!phone.trim()) errors.push("phone");

    setLocalErrors(errors);
    setValidationAttempted(true);

    if (errors.length > 0) {
      // Focus first error field
      const firstError = errors[0];
      if (firstError === "firstName" && firstNameRef.current) {
        firstNameRef.current.focus();
      } else if (firstError === "lastName" && lastNameRef.current) {
        lastNameRef.current.focus();
      }
    }

    return errors.length === 0;
  }, [contactType, firstName, lastName, title, displayName, email, phone]);

  // Handle Continue
  const handleContinue = useCallback(() => {
    if (!validate()) return;
    saveContact();
    onContinue();
  }, [validate, saveContact, onContinue]);

  const hasError = (field: string): boolean => {
    if (!validationAttempted) return false;
    return localErrors.includes(field) || externalErrorFields.includes(field);
  };

  const categoryLabel =
    category === "Company / Plan Sponsor"
      ? "Company / Plan Sponsor"
      : category === "Other Benefits"
        ? "Other Benefits"
        : category;

  // Category emoji matching CategoryExplorer
  const categoryEmoji: Record<string, string> = {
    Retirement: "🏢",
    "Group Health": "🛡️",
    "Group Life": "❤️",
    "Other Benefits": "🎁",
    "Company / Plan Sponsor": "👥",
  };
  const emoji = categoryEmoji[category] || "🏢";

  return (
    <div className="flex flex-col items-center space-y-4 py-2">
      {/* Company Logo above header */}
      {defaultCompanyLogo?.trim() && (
        <BrandingImage
          src={defaultCompanyLogo}
          alt="Company logo"
          className="w-12 h-12 object-contain mx-auto"
        />
      )}

      {/* Header - compact */}
      <div className="text-center space-y-1 max-w-lg">
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">{emoji}</span>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {isGuided
              ? "Tell us about your primary contact"
              : `Add a ${categoryLabel} contact`}
          </h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-200">
          {isGuided
            ? "Employees will see this person on their Benefits Team page."
            : `Enter contact details for ${categoryLabel}.`}
        </p>
      </div>

      {/* Contact Type - Radio List (compact) */}
      <div className="w-full max-w-md space-y-1.5">
        <Label className="dark:text-gray-300 font-medium text-sm">
          Contact Type
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setContactType("individual")}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all",
              contactType === "individual"
                ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
            )}
          >
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                contactType === "individual"
                  ? "border-accent-blue"
                  : "border-gray-300 dark:border-gray-500",
              )}
            >
              {contactType === "individual" && (
                <div className="w-2 h-2 rounded-full bg-accent-blue" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                Individual
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                A specific person
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setContactType("team_support")}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all",
              contactType === "team_support"
                ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
            )}
          >
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                contactType === "team_support"
                  ? "border-accent-blue"
                  : "border-gray-300 dark:border-gray-500",
              )}
            >
              {contactType === "team_support" && (
                <div className="w-2 h-2 rounded-full bg-accent-blue" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                Team / Support Line
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                A department or group
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Form Fields */}
      <Card className="w-full max-w-md dark:bg-gray-800 dark:border-gray-700 shadow-sm">
        <CardContent className="pt-3 space-y-2.5">
          {/* Primary Contact Toggle (top of form) — hidden for Company / Plan Sponsor since they are always primary */}
          {category !== "Company / Plan Sponsor" && (
            <div className="pb-2 border-b border-gray-100 dark:border-gray-700 mb-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-primary-contact"
                  checked={isPrimary}
                  onCheckedChange={(checked) => setIsPrimary(checked === true)}
                />
                <Label
                  htmlFor="is-primary-contact"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Mark as primary contact for{" "}
                  <span className="font-semibold">{categoryLabel}</span>
                </Label>
              </div>
            </div>
          )}
          {contactType === "individual" ? (
            <>
              <div className="space-y-1" data-field="firstName">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  ref={firstNameRef}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. John"
                  className={cn("h-8 text-sm", hasError("firstName") && "border-red-500")}
                />
                {hasError("firstName") && (
                  <p className="text-[10px] text-red-500">First name is required</p>
                )}
              </div>
              <div className="space-y-1" data-field="lastName">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  ref={lastNameRef}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Smith"
                  className={cn("h-8 text-sm", hasError("lastName") && "border-red-500")}
                />
                {hasError("lastName") && (
                  <p className="text-[10px] text-red-500">Last name is required</p>
                )}
              </div>
              <div className="space-y-1" data-field="title">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Job Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. HR Director"
                  className={cn("h-8 text-sm", hasError("title") && "border-red-500")}
                />
                {hasError("title") && (
                  <p className="text-[10px] text-red-500">Job title is required</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-1" data-field="displayName">
              <Label className="dark:text-gray-300 text-xs font-medium">
                Team / Department Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Benefits Support Team"
                className={cn("h-8 text-sm", hasError("displayName") && "border-red-500")}
              />
              {hasError("displayName") && (
                <p className="text-[10px] text-red-500">Team name is required</p>
              )}
            </div>
          )}

          <div className="space-y-1" data-field="email">
            <Label className="dark:text-gray-300 text-xs font-medium">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john@company.com"
              className={cn("h-8 text-sm", hasError("email") && "border-red-500")}
            />
            {hasError("email") && (
              <p className="text-[10px] text-red-500">Valid email is required</p>
            )}
          </div>

          <div className="space-y-1" data-field="phone">
            <Label className="dark:text-gray-300 text-xs font-medium">
              Phone <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="tel"
                  value={phone ? formatPhoneNumber(phone) : ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    if (digits.length <= 11) setPhone(digits);
                  }}
                  placeholder="(555) 123-4567"
                  className={cn(
                    "h-8 text-sm",
                    hasError("phone") && "border-red-500",
                  )}
                />
              </div>
              <div className="w-20">
                <Input
                  type="text"
                  value={phoneExtension}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= 8) setPhoneExtension(val);
                  }}
                  placeholder="Ext."
                  className="h-8 text-sm text-center"
                />
              </div>
            </div>
            {hasError("phone") && (
              <p className="text-[10px] text-red-500">Phone number is required</p>
            )}
          </div>

          {/* Headshot (optional) - only for Individual contacts */}
          {contactType === "individual" && (
            <div className="space-y-1" data-field="headshot">
              <Label className="dark:text-gray-300 text-xs font-medium">
                Headshot (optional)
              </Label>
              <div className="items-start">
                <div className="flex-1">
                  <UniversalImageEditorModal
                    value={headshot || ""}
                    fileName={headshotFileName || ""}
                    onChange={(value, fileName) => {
                      setHeadshot(value);
                      setHeadshotFileName(fileName || "");
                    }}
                    onRemove={() => {
                      setHeadshot("");
                      setHeadshotFileName("");
                    }}
                    placeholder="Upload Headshot"
                    modalTitle="Edit Headshot"
                    modalDescription="Upload a clear, front-facing photo. Keep the face inside the circle guide for best results."
                    saveButtonText="Save Headshot"
                    type="headshot"
                    autoSizeOnOpen={true}
                    forceCircularGuidelines={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Company Name (for non-Plan-Sponsor categories) */}
          {category !== "Company / Plan Sponsor" && (
            <div className="space-y-1.5">
              <Label className="dark:text-gray-300">
                Company / Organization (optional)
              </Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Benefits Provider Inc."
              />
            </div>
          )}

        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-center gap-4 w-full max-w-md">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          className="flex items-center gap-2 bg-accent-blue dark:bg-accent-blue hover:bg-accent-blue/90 text-white"
        >
          {isGuided ? "Save & Continue" : "Save Contact"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
