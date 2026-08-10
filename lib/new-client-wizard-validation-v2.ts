import {
  CompanyBasicsData,
  WelcomeStatementData,
  KeyContactsData,
  ComplianceDocumentsData
} from "@/types/new-client-wizard";
import { KeyContact } from "@/types/new-client-wizard";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import {
  resolveStoredWelcomeBody,
  resolveStoredWelcomeHeadline,
} from "@/lib/wizard-effective-content";
import {
  areAllCategoriesHiddenInPortal,
  getCategoryPortalVisibility,
} from "@/lib/portal-category-visibility";

const getFieldFromError = (message: string): string[] => {
  try {
    const parsed = JSON.parse(message);
    if (parsed && Array.isArray(parsed.fields)) {
      return parsed.fields;
    }
  } catch {
  }

  const fields: string[] = [];

  if (message.includes("companyName")) fields.push("companyName");
  if (message.includes("companyWebsite")) fields.push("companyWebsite");
  if (message.includes("organizationType")) fields.push("organizationType");
  if (message.includes("headline")) fields.push("headline");
  if (message.includes("bodyText")) fields.push("bodyText");
  if (message.includes("missionHeadline")) fields.push("missionHeadline");
  if (message.includes("missionBody")) fields.push("missionBody");
  if (message.includes("contactName")) fields.push("contactName");
  if (message.includes("contactEmail")) fields.push("contactEmail");
  if (message.includes("contactPhone")) fields.push("contactPhone");
  if (message.includes("spdFile")) fields.push("spdFile");

  if (fields.length === 0) {
    if (message.includes("company name")) return ["companyName"];
    if (message.includes("company website")) return ["companyWebsite"];
    if (message.includes("organization type")) return ["organizationType"];
    if (message.includes("headline")) return ["headline"];
    if (message.includes("welcome message")) return ["bodyText"];
    if (message.includes("mission headline")) return ["missionHeadline"];
    if (message.includes("mission description")) return ["missionBody"];
    if (message.includes("contact name")) return ["contactName"];
    if (message.includes("contact email")) return ["contactEmail"];
    if (message.includes("contact phone")) return ["contactPhone"];
    if (message.includes("SPD file")) return ["spdFile"];
  }

  return fields;
};

/** Contact is complete only if it has firstName, lastName, and (email or phone). */
function isKeyContactComplete(contact: any): boolean {
  const hasFirstName = contact.firstName != null && String(contact.firstName).trim() !== "";
  const hasLastName = contact.lastName != null && String(contact.lastName).trim() !== "";
  const hasEmail = contact.email != null && String(contact.email).trim() !== "";
  const hasPhone = contact.phone != null && String(contact.phone).trim() !== "";
  return hasFirstName && hasLastName && (hasEmail || hasPhone);
}

// Validation functions for new wizard structure
export const validateCompanyBasics = (data: CompanyBasicsData) => {
  const errors: Array<{ field: string; message: string }> = [];

  // Required company data fields
  if (!data.companyName || data.companyName.trim() === "") {
    errors.push({ field: "companyName", message: "Company name is required" });
  }

  // Company website is optional in new structure
  if (data.companyWebsite && data.companyWebsite.trim() !== "") {
    const trimmed = data.companyWebsite.trim();
    // Validate using built-in URL parser for better accuracy.
    // Accept: example.com, sub.example.com, https://example.com/path?query,
    //         calendly.com/username (with @ in path internally encoded).
    let valid = false;
    try {
      // Try as full URL first
      const url = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? new URL(trimmed)
        : new URL(`https://${trimmed}`);
      // Must have at least a hostname with a dot (basic domain check)
      valid = url.hostname.includes(".");
    } catch {
      valid = false;
    }
    if (!valid) {
      errors.push({ field: "companyWebsite", message: "Please enter a valid website URL" });
    }
  }

  // Organization Type is required - use default "Advisor Firm" if not set
  // This field has a default value, so we only validate if it's explicitly empty
  const organizationType = data.organizationType || "Advisor Firm";
  if (organizationType && organizationType.trim() === "") {
    errors.push({ field: "organizationType", message: "Organization Type is required" });
  }

  // Company logo is optional in new structure
  // Brand colors have defaults, so no validation needed

  // Portal URL is required
  if (!data.portalUrl || data.portalUrl.trim() === "") {
    errors.push({ field: "portalUrl", message: "Portal URL is required" });
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }

  return true;
};

export const validateWelcomeStatement = (data: WelcomeStatementData) => {
  const errors: Array<{ field: string; message: string }> = [];

  if (!data.headline || data.headline.trim() === "") {
    errors.push({ field: "headline", message: "Welcome headline is required" });
  }

  if (!data.bodyText || data.bodyText.trim() === "") {
    errors.push({ field: "bodyText", message: "Welcome message body is required" });
  }

  if (data.bodyText && (data.bodyText.length < 250 || data.bodyText.length > 2000)) {
    errors.push({ field: "bodyText", message: "Welcome message body must be between 250-2000 characters" });
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }

  return true;
};

export const validateKeyContacts = (data: KeyContactsData) => {
  const errors: Array<{ field: string; message: string }> = [];

  if (!data.contacts || data.contacts.length === 0) {
    errors.push({ field: "contacts", message: "At least one key contact is required" });
  } else {
    // Validate each key contact
    data.contacts.forEach((contact, index) => {
      const contactNum = index + 1;

      // Name validation
      if (!contact.name || contact.name.trim() === "") {
        errors.push({ field: `contact_${contact.id}_name`, message: `Full Name is required` });
      }

      // Email validation
      if (!contact.email || contact.email.trim() === "") {
        errors.push({ field: `contact_${contact.id}_email`, message: `Email is required` });
      } else {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact.email)) {
          errors.push({ field: `contact_${contact.id}_email`, message: `Please enter a valid email address` });
        }
      }

      // Role/customRole are deprecated and no longer required.

      // Organization Type validation
      if (!contact.orgType || contact.orgType.trim() === "") {
        errors.push({ field: `contact_${contact.id}_orgType`, message: `Organization Type is required` });
      }

      // Organization/Recordkeeper Name validation
      if (contact.orgType === "Recordkeeper") {
        if (!contact.recordkeeper || contact.recordkeeper.trim() === "") {
          errors.push({ field: `contact_${contact.id}_recordkeeper`, message: `Recordkeeper Name is required` });
        }
      } else {
        if (!contact.organization || contact.organization.trim() === "") {
          errors.push({ field: `contact_${contact.id}_organization`, message: `Organization / Company Name is required` });
        }
      }

      // Description validation
      if (!contact.description || contact.description.trim() === "") {
        errors.push({ field: `contact_${contact.id}_description`, message: `Description is required` });
      } else if (contact.description.length > 240) {
        errors.push({ field: `contact_${contact.id}_description`, message: `Description must be 240 characters or less` });
      }

      // Display Scope validation - defaults to "thisPortal" if not set
      const displayScopeValue = contact.displayScope || "thisPortal";
      if (!displayScopeValue || displayScopeValue.trim() === "") {
        errors.push({ field: `contact_${contact.id}_displayScope`, message: `Display Scope is required` });
      }

      // Phone validation
      if (!contact.phone || contact.phone.trim() === "") {
        errors.push({ field: `contact_${contact.id}_phone`, message: `Phone is required` });
      }

      // Headshot validation
      if (!contact.headshot || contact.headshot.trim() === "") {
        errors.push({ field: `contact_${contact.id}_headshot`, message: `Headshot is required` });
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }

  return true;
};

export const validateComplianceDocuments = (data: ComplianceDocumentsData) => {
  const errors: Array<{ field: string; message: string }> = [];

  const documents = data.retirementPlanDocuments || [];

  const uncategorizedCount = documents.filter(doc => !doc.category).length;

  if (uncategorizedCount > 0) {
    errors.push({
      field: "complianceDocuments",
      message: `${uncategorizedCount} document(s) need to be categorized before proceeding.`
    });
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }

  return true;
};

// Main validation function for new wizard structure
export const validateNewClientCurrentStepV2 = async (step: number, stepData: any) => {
  try {
    switch (step) {
      case 1: {
        // Always require company + website + plan type on step 1 (single screen; legacy welcomeMission substep is unused).
        const step1Errors: string[] = [];

        if (
          !stepData.companyBasics?.companyName ||
          stepData.companyBasics.companyName.trim() === ""
        ) {
          step1Errors.push("companyName");
        }

        // companyWebsite is optional — only validate format if provided (handled in validateCompanyBasics below)

        if (
          !stepData.companyBasics?.planType ||
          stepData.companyBasics.planType.trim() === ""
        ) {
          step1Errors.push("planType");
        }

        // Portal URL is required
        if (
          !stepData.companyBasics?.portalUrl ||
          stepData.companyBasics.portalUrl.trim() === ""
        ) {
          step1Errors.push("portalUrl");
        }

        if (step1Errors.length > 0) {
          throw new Error(
            `Please complete the following fields: ${step1Errors.join(", ")}`
          );
        }

        if (stepData.companyBasics) {
          validateCompanyBasics(stepData.companyBasics);
        }
        break;
      }

      case 2:
        // Step 2: Welcome banner + mission (hero copy lives on companyBasics; welcomeStatement is legacy mirror)
        const step2Errors: string[] = [];

        // Validate Mission Headline (from companyBasics)
        const missionHeadline = stepData.companyBasics?.missionHeadline || "";
        if (!missionHeadline || missionHeadline.trim() === "") {
          step2Errors.push("missionHeadline");
        } else if (missionHeadline.length > 60) {
          step2Errors.push("missionHeadline");
        }

        // Validate Mission Body (from companyBasics)
        const missionBody = stepData.companyBasics?.missionBody || "";
        if (!missionBody || missionBody.trim() === "") {
          step2Errors.push("missionBody");
        } else if (missionBody.length < 250) {
          step2Errors.push("missionBody");
        } else if (missionBody.length > 2000) {
          step2Errors.push("missionBody");
        }

        // Validate Background Header Image (Hero) — required
        const heroHeaderUrl =
          stepData.companyBasics?.brandImages?.header?.url?.trim() || "";
        if (!heroHeaderUrl) {
          step2Errors.push("brandImages.header");
        }

        const effectiveWelcomeHeadline = resolveStoredWelcomeHeadline(stepData);
        const effectiveWelcomeBody = resolveStoredWelcomeBody(stepData);

        if (!effectiveWelcomeHeadline) {
          step2Errors.push("headline");
        }

        if (!effectiveWelcomeBody) {
          step2Errors.push("bodyText");
        } else if (
          effectiveWelcomeBody.length < 250 ||
          effectiveWelcomeBody.length > 2000
        ) {
          step2Errors.push("bodyText");
        }

        if (step2Errors.length > 0) {
          const errorMessages: Array<{ field: string; message: string }> = [];

          if (step2Errors.includes("missionHeadline")) {
            if (!missionHeadline || missionHeadline.trim() === "") {
              errorMessages.push({ field: "missionHeadline", message: "Mission Headline is required" });
            } else if (missionHeadline.length > 60) {
              errorMessages.push({ field: "missionHeadline", message: "Mission Headline must be 60 characters or less" });
            }
          }

          if (step2Errors.includes("missionBody")) {
            if (!missionBody || missionBody.trim() === "") {
              errorMessages.push({ field: "missionBody", message: "Mission Statement is required" });
            } else if (missionBody.length < 250) {
              errorMessages.push({ field: "missionBody", message: "Mission Statement must be at least 250 characters" });
            } else if (missionBody.length > 2000) {
              errorMessages.push({ field: "missionBody", message: "Mission Statement must be 2000 characters or less" });
            }
          }

          if (step2Errors.includes("brandImages.header")) {
            errorMessages.push({
              field: "brandImages.header",
              message: "Background Header Image (Hero) is required",
            });
          }

          if (step2Errors.includes("headline")) {
            errorMessages.push({
              field: "headline",
              message:
                "Welcome headline is required (banner title, welcome headline, or stored hero copy)",
            });
          }

          if (step2Errors.includes("bodyText")) {
            if (!effectiveWelcomeBody) {
              errorMessages.push({
                field: "bodyText",
                message: "Welcome message body is required",
              });
            } else {
              errorMessages.push({
                field: "bodyText",
                message: "Welcome message body must be between 250-2000 characters",
              });
            }
          }

          if (errorMessages.length > 0) {
            throw new Error(JSON.stringify(errorMessages));
          }

          throw new Error(`Please complete the following fields: ${step2Errors.join(", ")}`);
        }

        break;

      case 3:
        // Step 3: Key Contacts - Validate based on sub-step or slide index
        // New slide-based system takes priority over legacy step3SubStep
        const step3SlideIndex = (stepData as any)?.step3SlideIndex;
        
        // Map slide index to legacy sub-step for validation
        let step3SubStep: string;
        if (typeof step3SlideIndex === "number" && step3SlideIndex >= 0 && step3SlideIndex <= 3) {
          const slideMap: Record<number, string> = {
            0: "step3a",
            1: "step3b",
            2: "step3c",
            3: "step3d",
          };
          step3SubStep = slideMap[step3SlideIndex];
        } else {
          // Legacy: read from step3SubStep
          step3SubStep =
            (stepData?.step3SubStep?.step3SubStep as string) ||
            (stepData?.step3SubStep as string) ||
            "step3a";
        }

        // Check if contacts exist - if they do, we're likely on step3b or later
        const keyContacts = stepData.keyContacts || { contacts: [] };
        const contacts = keyContacts.contacts || [];
        const hasContacts = contacts.length > 0;

        // Validate step3a - always validate if we're on step3a
        // Only validate category selection, not contact fields (those are validated in step3b)
        // Skip when using slides (first-contact-prompt doesn't select categories)
        if (step3SubStep === "step3a" && typeof useNewClientWizardStore.getState().step3SlideIndex !== "number") {
          const step3aData = stepData.step3a || {};

          // Validate only category selection
          if (!step3aData.benefitsCategory) {
            throw new Error(
              JSON.stringify([
                {
                  field: "benefitsCategory",
                  message: "Please select a benefits category",
                },
              ])
            );
          }

          // Validate otherBenefitsText ONLY if "Other Benefits" is selected
          // Don't validate if category is different, even if otherBenefitsText exists in data
          if (step3aData.benefitsCategory === "Other Benefits") {
            // Only validate if the category is actually "Other Benefits"
            const otherText = step3aData.otherBenefitsText || "";
            if (!otherText || otherText.trim() === "") {
              throw new Error(
                JSON.stringify([
                  {
                    field: "otherBenefitsText",
                    message: "Please specify the benefit type",
                  },
                ])
              );
            }
          }
          // If category is not "Other Benefits", skip otherBenefitsText validation
          // even if it exists in the data (it will be cleared when category changes)

          // Skip step3b validation - we're on step3a, so only validate category selection
          break;
        }

        // Validate step3c - require benefits category selection (same as step3a)
        // Skip when using slide-based routing (the Category Explorer doesn't select categories)
        if (step3SubStep === "step3c" && typeof useNewClientWizardStore.getState().step3SlideIndex !== "number") {
          const step3cData = stepData.step3c || {};
          if (!step3cData.benefitsCategory) {
            throw new Error(
              JSON.stringify([
                {
                  field: "benefitsCategory",
                  message: "Please select a benefits category",
                },
              ])
            );
          }
          // Validate otherBenefitsText ONLY if "Other Benefits" is selected
          // Don't validate if category is different, even if otherBenefitsText exists in data
          if (step3cData.benefitsCategory === "Other Benefits") {
            // Only validate if the category is actually "Other Benefits"
            const otherText = step3cData.otherBenefitsText || "";
            if (!otherText || otherText.trim() === "") {
              throw new Error(
                JSON.stringify([
                  {
                    field: "otherBenefitsText",
                    message: "Please specify the benefit type",
                  },
                ])
              );
            }
          }
          // If category is not "Other Benefits", skip otherBenefitsText validation
          // even if it exists in the data (it will be cleared when category changes)

          // Milestone 2 §5: Each category with contacts must have at least one Primary (when clicking Continue)
          const contactsStep3c = (stepData.keyContacts || { contacts: [] }).contacts || [];
          if (contactsStep3c.length > 0) {
            const completeStep3c = contactsStep3c.filter((c: any) => isKeyContactComplete(c));
            const categoriesPresent = new Set<string>();
            completeStep3c.forEach((c: any) => ((c.benefitsCategories || []) as string[]).forEach((cat: string) => categoriesPresent.add(cat)));
            for (const cat of Array.from(categoriesPresent)) {
              const inCategory = completeStep3c.filter((c: any) => (c.benefitsCategories || []).includes(cat));
              const hasPrimary = inCategory.some(
                (c: any) =>
                  c.isPrimaryOverall === true ||
                  c.isPrimary === true ||
                  (c.isPrimaryByCategory && (c.isPrimaryByCategory as any)[cat] === true),
              );
              const singleContactIsPrimary = inCategory.length === 1;
              if (!hasPrimary && !singleContactIsPrimary) {
                throw new Error(
                  JSON.stringify([
                    {
                      field: "primaryContactRequired",
                      message: `"${cat}" must have at least one Primary contact. Go back and mark one contact as Primary for this category.`,
                    },
                  ])
                );
              }
            }
          }
        }

        // Validate step3b (contact form) - only validate when we're actually on step3b
        // Don't validate step3b fields when on step3a (step3a only validates category selection)
        if (step3SubStep === "step3b") {
          const step3Errors: Array<{ field: string; contactId: string | number; contactName: string }> = [];
          const keyContactsForValidation = stepData.keyContacts || { contacts: [] };
          const contactsForValidation = keyContactsForValidation.contacts || [];
          const step3bData = (stepData as any).step3b;
          const step3SubStepData = (stepData as any).step3SubStep || {};
          const isCreatingNew = step3SubStepData.isCreatingNew === true;
          // Slide flow uses `editingContactId`; legacy flow uses `selectedContactId`.
          const editId = step3bData?.selectedContactId || step3bData?.editingContactId;

          // Build a virtual contact from the step3b form so the current (possibly
          // unsaved) contact's fields — including the CTA scheduling/contact-form
          // URLs — are always validated on Next.
          const step3bHasFormData =
            !!step3bData &&
            (!!step3bData.firstName ||
              !!step3bData.lastName ||
              !!step3bData.displayName ||
              !!step3bData.contactType ||
              !!step3bData.email ||
              !!step3bData.phone);

          let contactsToValidate: any[] = contactsForValidation;
          if (step3bHasFormData) {
            const formContact = {
              id: editId || "new",
              contactType: step3bData.contactType || "individual",
              firstName: step3bData.firstName,
              lastName: step3bData.lastName,
              title: step3bData.title,
              displayName: step3bData.displayName,
              email: step3bData.email,
              phone: step3bData.phone,
              benefitsCategories: step3bData.benefitsCategories || (step3bData.benefitsCategory ? [step3bData.benefitsCategory] : []),
              benefitsCategoryOther: step3bData.otherBenefitsText,
              name: step3bData.contactType === "individual"
                ? `${step3bData.firstName || ""} ${step3bData.lastName || ""}`.trim()
                : step3bData.displayName,
              // Carry over the action-visibility flags so the "Contact Action
              // Buttons" validation doesn't falsely fail a fully-filled form.
              displayEmail: step3bData.displayEmail ?? true,
              displayPhone: step3bData.displayPhone ?? true,
              displayScheduleAppointment: step3bData.displayScheduleAppointment,
              displayUrl: step3bData.displayUrl,
              // Carry over CTA fields so scheduling/contact-form URL validation works.
              enableContactButton: step3bData.enableContactButton,
              ctaType: step3bData.ctaType,
              schedulingUrl: step3bData.schedulingUrl,
              websiteUrl: step3bData.websiteUrl,
            };

            if (editId && contactsForValidation.some((c: any) => c.id === editId)) {
              // Editing an existing contact — merge the form into it and
              // validate ONLY the edited contact (not all contacts).
              const merged = contactsForValidation.map((c: any) =>
                c.id === editId ? { ...c, ...formContact, id: c.id } : c,
              );
              contactsToValidate = merged.filter((c: any) => c.id === editId);
            } else {
              // Creating a new contact — only validate the form fields,
              // not all pre-existing contacts (which may have been saved
              // before phone became required).
              contactsToValidate = [formContact];
            }
          }

          // Check if at least one contact exists (after virtual contact for isCreatingNew)
          if (contactsToValidate.length === 0) {
            throw new Error(
              JSON.stringify([
                {
                  field: "contacts",
                  message: "At least one contact is required",
                },
              ])
            );
          }

          // Also validate the current contact in step3b local state (unsaved form data)
          if (step3bData) {
            // Check if all actions are false/undefined in the current form
            const hasActionsInForm =
              step3bData.displayEmail ||
              step3bData.displayPhone ||
              step3bData.displayScheduleAppointment ||
              step3bData.displayWebsite ||
              step3bData.displayUrl;

            if (!hasActionsInForm) {
              const contactName =
                step3bData.firstName || step3bData.lastName
                  ? `${step3bData.firstName || ""} ${step3bData.lastName || ""}`.trim()
                  : step3bData.displayName || "Current Contact";

              step3Errors.push({
                field: "contactActions",
                contactId: step3bData.selectedContactId || "new",
                contactName: contactName,
              });
              step3Errors.push({
                field: `contact_${step3bData.selectedContactId || "new"}_contactActions`,
                contactId: step3bData.selectedContactId || "new",
                contactName: contactName,
              });
            }
          }

          // Validate each contact (using merged form data for the current contact)
          contactsToValidate.forEach((contact: any, index: number) => {
            const contactNum = index + 1;
            const contactId = contact.id || index;

            // Get contact identifier for error messages
            const contactName =
              contact.contactType === "individual"
                ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.name || `Contact ${contactNum}`
                : contact.displayName || contact.name || `Contact ${contactNum}`;

            const contactIdentifier = contactName || `Contact ${contactNum}`;

            // Benefits Categories validation
            if (
              !contact.benefitsCategories ||
              !Array.isArray(contact.benefitsCategories) ||
              contact.benefitsCategories.length === 0
            ) {
              step3Errors.push({
                field: `benefitsCategories`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
              step3Errors.push({
                field: `contact_${contactId}_benefitsCategories`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
            }

            // Validate otherBenefitsText for "Other Benefits" category
            const hasOtherBenefits = contact.benefitsCategories?.includes("Other Benefits");
            const otherBenefitsText = contact.benefitsCategoryOther || (contact as any).otherBenefitsText || "";
            if (hasOtherBenefits && (!otherBenefitsText || otherBenefitsText.trim() === "")) {
              step3Errors.push({
                field: `otherBenefitsText`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
              step3Errors.push({
                field: `contact_${contactId}_otherBenefitsText`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
            }


            // Name validation (different for individual vs team_support)
            if (contact.contactType === "individual") {
              if (!contact.firstName || contact.firstName.trim() === "") {
                step3Errors.push({
                  field: `firstName`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
                step3Errors.push({
                  field: `contact_${contactId}_firstName`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
              }
              if (!contact.lastName || contact.lastName.trim() === "") {
                step3Errors.push({
                  field: `lastName`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
                step3Errors.push({
                  field: `contact_${contactId}_lastName`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
              }
              // Title validation (required, max 60 characters)
              if (!contact.title || contact.title.trim() === "") {
                step3Errors.push({
                  field: `title`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
                step3Errors.push({
                  field: `contact_${contactId}_title`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
              } else if (contact.title.length > 60) {
                step3Errors.push({
                  field: `title`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
                step3Errors.push({
                  field: `contact_${contactId}_title`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
              }
            } else if (contact.contactType === "team_support") {
              if (!contact.displayName || contact.displayName.trim() === "") {
                step3Errors.push({
                  field: `displayName`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
                step3Errors.push({
                  field: `contact_${contactId}_displayName`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
              }
            } else {
              // Fallback: check name field
              if (!contact.name || contact.name.trim() === "") {
                step3Errors.push({
                  field: `name`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
                step3Errors.push({
                  field: `contact_${contactId}_name`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
              }
            }

            // Email validation
            if (!contact.email || contact.email.trim() === "") {
              step3Errors.push({
                field: `email`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
              step3Errors.push({
                field: `contact_${contactId}_email`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
            } else {
              // Validate email format
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(contact.email)) {
                step3Errors.push({
                  field: `email`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
                step3Errors.push({
                  field: `contact_${contactId}_email`,
                  contactId: contactId,
                  contactName: contactIdentifier,
                });
              }
            }

            // Phone is optional — no required validation.

            // Scheduling URL is required when the "Schedule Appt." CTA is enabled
            const enableContactButton = contact.enableContactButton === true;
            const contactCtaType = contact.ctaType;
            if (
              enableContactButton &&
              contactCtaType === "schedule" &&
              !(contact.schedulingUrl || "").trim()
            ) {
              step3Errors.push({
                field: `schedulingUrl`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
              step3Errors.push({
                field: `contact_${contactId}_schedulingUrl`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
            }

            // Contact Form URL is required when the "Contact Form" CTA is enabled
            if (
              enableContactButton &&
              contactCtaType === "contact" &&
              !(contact.websiteUrl || "").trim()
            ) {
              step3Errors.push({
                field: `websiteUrl`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
              step3Errors.push({
                field: `contact_${contactId}_websiteUrl`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
            }

            // Contact Action Buttons validation
            if (
              !contact.displayEmail &&
              !contact.displayPhone &&
              !contact.displayScheduleAppointment &&
              !contact.displayUrl
            ) {
              step3Errors.push({
                field: `contactActions`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
              step3Errors.push({
                field: `contact_${contactId}_contactActions`,
                contactId: contactId,
                contactName: contactIdentifier,
              });
            }
          });

          // Milestone 2 §5: Each category with contacts must have at least one Primary contact
          const completeContacts = contactsForValidation.filter((c: any) =>
            isKeyContactComplete(c),
          );
          const categoriesWithContacts = new Set<string>();
          completeContacts.forEach((c: any) => {
            const cats = c.benefitsCategories || [];
            cats.forEach((cat: string) => categoriesWithContacts.add(cat));
          });
          for (const category of Array.from(categoriesWithContacts)) {
            const contactsInCategory = completeContacts.filter(
              (c: any) => (c.benefitsCategories || []).includes(category),
            );
            const hasPrimary = contactsInCategory.some(
              (c: any) =>
                c.isPrimaryOverall === true ||
                c.isPrimary === true ||
                (c.isPrimaryByCategory && (c.isPrimaryByCategory as any)[category] === true),
            );
            // If there is only one complete contact in the category, treat it as primary (no need to force the flag)
            const singleContactIsPrimary = contactsInCategory.length === 1;
            if (!hasPrimary && !singleContactIsPrimary) {
              step3Errors.push({
                field: `primaryContact_${category}`,
                contactId: "category",
                contactName: category,
              });
            }
          }

          // 3b.2: Any R2-backed Hub document in wizard state must have an explicit category before leaving step 3b
          const hubDocs = (stepData as any).complianceDocuments?.retirementPlanDocuments;
          if (Array.isArray(hubDocs) && hubDocs.length > 0) {
            const missingHubCategory = hubDocs.some((doc: any) => {
              const hasCat =
                doc?.category != null && String(doc.category).trim() !== "";
              if (hasCat) return false;
              const sk = doc?.storageKey && String(doc.storageKey).trim();
              const r2 = doc?.file === "r2:stored";
              return !!(sk || r2);
            });
            if (missingHubCategory) {
              step3Errors.push({
                field: "hubDocumentsCategory",
                contactId: "hub",
                contactName: "Benefits Hub documents",
              });
            }
          }

          if (step3Errors.length > 0) {
            const errorMessages: Array<{ field: string; message: string; contactName?: string }> = [];
            const seenFields = new Map<string, string>(); // Map: "contactName_field" -> contactName

            // Process errors and group by contact
            step3Errors.forEach((errorObj) => {
              const field = errorObj.field;
              const contactName = errorObj.contactName;

              // Extract base field name (without contact_ prefix)
              const baseField = field.replace(/^contact_\w+_/, "");

              // Create unique key for this contact+field combination
              const uniqueKey = `${contactName}_${baseField}`;

              // Skip if we've already processed this contact+field combination
              if (seenFields.has(uniqueKey)) {
                return;
              }

              seenFields.set(uniqueKey, contactName);

              if (baseField === "benefitsCategories" || field.includes("benefitsCategories")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please select at least one benefits category`,
                  contactName: contactName,
                });
              } else if (baseField === "role" || field.includes("role")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please select a role`,
                  contactName: contactName,
                });
              } else if (baseField === "firstName" || field.includes("firstName")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please enter the first name`,
                  contactName: contactName,
                });
              } else if (baseField === "lastName" || field.includes("lastName")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please enter the last name`,
                  contactName: contactName,
                });
              } else if (baseField === "title" || field.includes("title")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please enter a title`,
                  contactName: contactName,
                });
              } else if (baseField === "displayName" || field.includes("displayName")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please enter a display name`,
                  contactName: contactName,
                });
              } else if (baseField === "otherBenefitsText" || field.includes("otherBenefitsText")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please specify the benefit type`,
                  contactName: contactName,
                });
              } else if (baseField === "name" || field.includes("name")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please enter the name`,
                  contactName: contactName,
                });
              } else if (baseField === "email" || field.includes("email")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please enter a valid email address`,
                  contactName: contactName,
                });
              } else if (baseField === "phone" || field.includes("phone")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": Please enter a phone number`,
                  contactName: contactName,
                });
              } else if (baseField === "contactActions" || field.includes("contactActions")) {
                errorMessages.push({
                  field: baseField,
                  message: "You must select one contact action",
                  contactName: contactName,
                });
              } else if (baseField === "primaryContact" || field.includes("primaryContact")) {
                errorMessages.push({
                  field: baseField,
                  message: `"${contactName}": This category must have at least one Primary contact. Select a contact and mark it as Primary for this category.`,
                  contactName: contactName,
                });
              } else if (
                baseField === "hubDocumentsCategory" ||
                field === "hubDocumentsCategory"
              ) {
                errorMessages.push({
                  field: "hubDocumentsCategory",
                  message:
                    "Assign a benefit category to every uploaded Benefits Hub document (Documents section below) before continuing.",
                  contactName: contactName,
                });
              } else if (
                baseField === "schedulingUrl" ||
                field.includes("schedulingUrl")
              ) {
                errorMessages.push({
                  field: "schedulingUrl",
                  message: `"${contactName}": Please enter a scheduling URL for the Schedule Appt. button`,
                  contactName: contactName,
                });
              } else if (
                baseField === "websiteUrl" ||
                field.includes("websiteUrl")
              ) {
                errorMessages.push({
                  field: "websiteUrl",
                  message: `"${contactName}": Please enter a contact form URL for the Contact Form button`,
                  contactName: contactName,
                });
              }
            });

            throw new Error(JSON.stringify(errorMessages));
          }
        }

        // Benefit Category Limits: plan must have 1–4 distinct categories (from complete contacts)
        const step3SubStepData = (stepData as any)?.step3SubStep || {};
        const isCreatingNew = step3SubStepData.isCreatingNew === true;
        const step3bDataForMerge = (stepData as any)?.step3b;
        const contactsForPlanLimit = contacts.filter((c: any) => isKeyContactComplete(c));
        const selectedContactId = step3bDataForMerge?.selectedContactId;

        const categoriesPresent = new Set<string>();
        contactsForPlanLimit.forEach((c: any) => {
          if (c.id === selectedContactId && step3bDataForMerge?.benefitsCategories?.length) {
            (step3bDataForMerge.benefitsCategories || []).forEach((cat: string) =>
              categoriesPresent.add(cat)
            );
          } else {
            (c.benefitsCategories || []).forEach((cat: string) =>
              categoriesPresent.add(cat)
            );
          }
        });
        if (isCreatingNew && step3bDataForMerge?.benefitsCategories?.length) {
          const newContactComplete =
            step3bDataForMerge.firstName?.trim() &&
            step3bDataForMerge.lastName?.trim() &&
            (step3bDataForMerge.email?.trim() || step3bDataForMerge.phone?.trim());
          if (newContactComplete) {
            (step3bDataForMerge.benefitsCategories || []).forEach((cat: string) =>
              categoriesPresent.add(cat)
            );
          }
        }

        if (contactsForPlanLimit.length > 0 || (isCreatingNew && categoriesPresent.size > 0)) {
          const distinctCount = categoriesPresent.size;
          if (distinctCount === 0) {
            throw new Error(
              JSON.stringify([
                {
                  field: "benefitsCategories",
                  message: "Plan must have at least one benefit category. Add a contact with a category.",
                },
              ])
            );
          }
          if (distinctCount > 4) {
            throw new Error(
              JSON.stringify([
                {
                  field: "benefitsCategories",
                  message: "Plan cannot have more than 4 benefit categories. Remove a category from a contact.",
                },
              ])
            );
          }
        }
        break;

      case 4:
        if (stepData.complianceDocuments) {
          validateComplianceDocuments(stepData.complianceDocuments);
        }
        break;

      case 5: {
        // 3b.0: cannot finish/publish with every portal category hidden
        const rawVis =
          (stepData.employeePortalPreview as any)?.previewData
            ?.categoryPortalVisibility ??
          (stepData.employeePortalPreview as any)?.categoryPortalVisibility;
        const visibility = getCategoryPortalVisibility(rawVis);
        if (areAllCategoriesHiddenInPortal(visibility)) {
          throw new Error(
            JSON.stringify([
              {
                field: "categoryPortalVisibility",
                message:
                  "At least one benefit category must be visible on the Benefits Hub before you can finish. In Step 5 → Benefits, turn Visibility on for one category.",
              },
            ]),
          );
        }
        break;
      }

      default:
        throw new Error(`Invalid step number: ${step}`);
    }

    return { isValid: true, errors: [], errorFields: [] };
  } catch (error: any) {
    let errorFields: string[] = [];
    let errors: Array<{ field: string; message: string; contactName?: string }> = [];

    try {
      // Try to parse error message as JSON (for step 3 contacts)
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.messages && Array.isArray(parsed.messages)) {
        errorFields = parsed.messages;
        errors = parsed.messages.map((msg: any) => ({
          field: msg.field || "unknown",
          message: msg.message || msg,
          contactName: msg.contactName,
        }));
      } else if (parsed && Array.isArray(parsed)) {
        // This is an array of error objects
        // Collect all field variations (base field and contact-specific)
        const fieldSet = new Set<string>();
        parsed.forEach((e: any) => {
          const field = e.field || e;
          if (field) {
            fieldSet.add(field);
            // Also add base field name for contact-specific fields
            const baseField = field.replace(/^contact_\w+_/, "");
            if (baseField !== field) {
              fieldSet.add(baseField);
            }
          }
        });
        errorFields = Array.from(fieldSet);
        errors = parsed.map((e: any) => ({
          field: e.field || "unknown",
          message: e.message || e,
          contactName: e.contactName,
        }));
      } else {
        // Not an array, use old method
        errorFields = getFieldFromError(error.message);
        errors = [{ message: error.message, field: errorFields[0] || "unknown" }];
      }
    } catch {
      // If not JSON, use old method
      errorFields = getFieldFromError(error.message);
      errors = [{ message: error.message, field: errorFields[0] || "unknown" }];
    }

    return {
      isValid: false,
      errors: errors,
      errorFields: errorFields
    };
  }
};
