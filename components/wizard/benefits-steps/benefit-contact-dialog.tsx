"use client";

/**
 * The ONE contact editor for the Benefits flows.
 *
 * This is the "Create New Contact" dialog lifted out of Step 1 unchanged, so the same
 * form serves both places a contact can be created or changed:
 *
 *   - `mode="create"` — Step 1 / the Branding tab's "Create New Contact" (and the
 *     wizard's Step 3, which shares this component through `BenefitsStep3`).
 *   - `mode="edit"`   — the pencil button on a contact row in Contacts.
 *
 * Keeping it here rather than copying the markup is what guarantees the two stay
 * identical: the field set (including the Call-to-Action block and its "Topic of
 * Interest" builder), the two-column layout with the live portal preview, the
 * validation rules and the derived /contact link all have exactly one definition.
 *
 * The component owns the form only. What happens to the resulting `KeyContact` is the
 * caller's job (`onSubmit`): Step 1 appends it to the plan draft, while Contacts
 * persists it to the plan, because `saveBenefit` merges `keyContacts` starting FROM
 * the stored rows.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ContactFormFields } from "@/components/ui/contact-form-fields";
import { ContactFormTopicBuilder } from "@/components/ui/contact-form-topic-builder";
import { ContactFormPage } from "@/components/pages/contact-form-page";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { buildContactFormHref } from "@/lib/contact-form-link";
import {
  getActiveContactFormTopicLabels,
  normalizeContactTopicCategory,
  resolveContactFormTopics,
} from "@/lib/contact-form-topics";
import type { ContactFormTopic } from "@/lib/contact-form-topics";
import { fetchProfileOnce } from "@/lib/fetch-profile";
import { primaryServiceLabelToBenefitsCategory } from "@/lib/seed-onboarding-advisor-contacts";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
} from "@/components/wizard/steps/sections/user-setup-section/user-setup-section.funcs";
import { normalizeExtension } from "@/lib/phone-utils";
import { toast } from "sonner";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";

export interface BenefitContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "create" starts blank for `category`; "edit" seeds from `contact`. */
  mode?: "create" | "edit";
  /** Plan (client) id — carried into the derived /contact link. */
  planId: string;
  /**
   * Benefits category this contact is for, as the wizard spells it
   * ("Retirement" | "Group Health" | "Group Life" | "Custom" | "Company / Plan Sponsor").
   */
  category: string;
  /** Selected plan's company name — shown on a Company / Plan Sponsor card. */
  planCompanyName?: string;
  /** Plan logo — ditto, when the contact has no company logo of their own. */
  planLogoUrl?: string;
  brandColor?: string;
  secondaryColor?: string;
  appointmentLink?: string;
  /** Live benefit title, used for the Custom hub's topic label. */
  benefitTitle?: string;
  /** Read-once Benefit rows, for the plan's custom-benefit title. */
  categoryBenefitByApi?: Record<string, any> | null;
  /** The contact being edited (`mode="edit"`). */
  contact?: KeyContact | null;
  /** Receives the finished contact. Throwing keeps the dialog open and toasts. */
  onSubmit: (contact: KeyContact) => void | Promise<void>;
}

interface ContactFormState {
  contactType: "individual" | "team_support";
  firstName: string;
  lastName: string;
  title: string;
  displayName: string;
  email: string;
  phone: string;
  phoneExtension: string;
  headshot: string;
  headshotFileName: string;
  teamImage: string;
  teamImageFileName: string;
  companyName: string;
  companyLogo: string;
  companyLogoFileName: string;
  isPrimary: boolean;
  enableContactButton: boolean;
  ctaType: "schedule" | "call" | "email" | "contact";
  schedulingUrl: string;
  displayEmail: boolean;
  displayPhone: boolean;
  /** "Topic of Interest" choices for the Plantelligence /contact form. */
  contactFormTopics: ContactFormTopic[];
}

const EMPTY_FORM: ContactFormState = {
  contactType: "individual",
  firstName: "",
  lastName: "",
  title: "",
  displayName: "",
  email: "",
  phone: "",
  phoneExtension: "",
  headshot: "",
  headshotFileName: "",
  teamImage: "",
  teamImageFileName: "",
  companyName: "",
  companyLogo: "",
  companyLogoFileName: "",
  isPrimary: true,
  enableContactButton: false,
  ctaType: "schedule",
  schedulingUrl: "",
  // "Show on contact card" starts unchecked — adding an email/phone must not
  // auto-enable these toggles.
  displayEmail: false,
  displayPhone: false,
  contactFormTopics: [],
};

/**
 * The company an advisor's OWN contact should default to.
 *
 * A category on their primary-service list is serviced by their firm, so Company /
 * Organization is `User.organizationName`; every other category belongs to a vendor /
 * provider / carrier, whose name has to be typed.
 *
 * `User.primaryServiceCategories` holds the canonical service labels
 * (Retirement / Group Health / Group Life / Other), which are not all spelled like the
 * benefits categories, so each label is mapped through
 * `primaryServiceLabelToBenefitsCategory` ("Other" → "Other Benefits") rather than
 * compared as a string; a direct normalized match is still accepted for a profile that
 * already stores the benefits label.
 *
 * Company / Plan Sponsor contacts are skipped: their form has no Company field and
 * their card shows the plan's own company name.
 */
function primaryOrgCompanyName(
  profile: any,
  category: string,
): string {
  if (String(category) === "Company / Plan Sponsor") return "";
  const primaryCats: string[] = Array.isArray(profile?.primaryServiceCategories)
    ? profile.primaryServiceCategories
    : [];
  if (primaryCats.length === 0) return "";
  const normalize = (raw: string) =>
    (raw || "").toLowerCase().trim().replace(/\s+/g, " ");
  const target = normalize(category);
  const isPrimary = primaryCats.some((label) => {
    const raw = String(label);
    const mapped = primaryServiceLabelToBenefitsCategory(raw);
    return (
      normalize(raw) === target || (!!mapped && normalize(mapped) === target)
    );
  });
  if (!isPrimary) return "";
  return (profile?.organizationName || profile?.user?.organizationName || "").trim();
}

export function BenefitContactDialog({
  open,
  onOpenChange,
  mode = "create",
  planId,
  category,
  planCompanyName = "",
  planLogoUrl = "",
  brandColor = "#002B5B",
  secondaryColor = "#E6C47A",
  appointmentLink = "",
  benefitTitle = "",
  categoryBenefitByApi = null,
  contact = null,
  onSubmit,
}: BenefitContactDialogProps) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  // Whether the live Plantelligence /contact page preview modal is open.
  const [contactPreviewOpen, setContactPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Refs for focusing the first invalid field on submit.
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const schedulingUrlRef = useRef<HTMLInputElement>(null);

  /** The "Custom" benefit maps to the Company / Plan Sponsor hub — those contacts
   *  are always primary and don't require a Company / Org or custom logo. */
  const isPlanSponsorContact =
    category === "Company / Plan Sponsor" || String(category) === "Custom";

  /** Update the form and optionally clear the given error fields. */
  const updateForm = (
    patch: Partial<ContactFormState>,
    clearErrors: string[] = [],
  ) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (clearErrors.length > 0) {
      setErrors((prev) => prev.filter((err) => !clearErrors.includes(err)));
    }
  };

  /**
   * ── Contact Form CTA ──
   *
   * The "Contact Form" CTA opens the first-party Plantelligence `/contact` page, so
   * its link is DERIVED from the contact (name, company, headshot, logo, title) plus
   * the advisor's "Topic of Interest" choices rather than typed in. The contact's
   * email is the recipient, so it becomes required whenever this CTA is selected.
   *
   * `normalizeContactTopicCategory` canonicalizes legacy/display names (the wizard's
   * "Custom" category, "Health Insurance", …) onto the topic sets, matching what both
   * the builder's suggestions and the live /contact page resolve.
   */
  const contactTopicCategory =
    normalizeContactTopicCategory(category) ?? category;

  // Title of the plan's custom benefit: the Company / Plan Sponsor topic list names
  // that benefit, so its topic reads as the advisor's own title instead of the
  // "Custom Benefits" placeholder. Read from what the wizard already holds — the live
  // draft title while the Custom benefit itself is being edited, otherwise the
  // read-once Benefit-row snapshot — instead of re-fetching the row the Plan editor
  // has to request.
  const customBenefitTitle =
    (String(category) === "Custom" ? (benefitTitle || "").trim() : "") ||
    (categoryBenefitByApi?.["company / plan sponsor"]?.title || "").trim();

  /** Everything the Contact Form CTA renders/previews, derived from form + plan. */
  const contactFormCta = useMemo(() => {
    const isTeam = form.contactType === "team_support";
    const name = isTeam
      ? form.displayName
      : `${form.firstName} ${form.lastName}`.trim();
    const company = isPlanSponsorContact ? planCompanyName : form.companyName;
    const title = isTeam ? "" : form.title;
    const avatar = isTeam ? "" : form.headshot;
    const logo = isPlanSponsorContact ? planLogoUrl : form.companyLogo;
    const active = form.enableContactButton && form.ctaType === "contact";
    return {
      active,
      name,
      company,
      title,
      avatar,
      logo,
      url: active
        ? buildContactFormHref(
            form.email,
            company,
            name,
            avatar,
            logo,
            title,
            getActiveContactFormTopicLabels(form.contactFormTopics, {
              customBenefitTitle,
            }),
            contactTopicCategory,
            planId,
          )
        : "",
    };
  }, [
    form,
    isPlanSponsorContact,
    planCompanyName,
    planLogoUrl,
    customBenefitTitle,
    contactTopicCategory,
    planId,
  ]);

  /**
   * (Re)seed the form whenever the dialog opens.
   *
   * Create mode starts from a blank form (plan-sponsor contacts start primary);
   * edit mode starts from the stored contact. Either way the Topics come from
   * `resolveContactFormTopics`, so a contact that was never configured gets the
   * category's suggestions and an explicit saved list is returned untouched.
   */
  useEffect(() => {
    if (!open) return;
    setErrors([]);
    setContactPreviewOpen(false);
    setBusy(false);

    if (isEdit && contact) {
      setForm({
        ...EMPTY_FORM,
        contactType:
          contact.contactType === "team_support" ? "team_support" : "individual",
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        title: contact.title || contact.customRole || "",
        displayName: contact.displayName || contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        phoneExtension: contact.phoneExtension || "",
        headshot: contact.headshot || "",
        headshotFileName: contact.headshotFileName || "",
        teamImage: contact.teamImage || "",
        teamImageFileName: contact.teamImageFileName || "",
        companyName: contact.companyName || "",
        companyLogo: contact.companyLogo || "",
        companyLogoFileName: String((contact as any).companyLogoFileName || ""),
        isPrimary: contact.isPrimaryOverall ?? contact.isPrimary ?? false,
        enableContactButton: contact.enableContactButton === true,
        ctaType:
          contact.contactButtonType === "phone"
            ? "call"
            : contact.contactButtonType === "email"
              ? "email"
              : contact.contactButtonType === "url"
                ? "contact"
                : "schedule",
        schedulingUrl: contact.schedulingUrl || "",
        displayEmail: contact.displayEmail ?? false,
        displayPhone: contact.displayPhone ?? false,
        contactFormTopics: resolveContactFormTopics(
          contact.benefitsCategory ?? category,
          (contact as any).contactFormTopics,
        ),
      });
      return;
    }

    setForm({
      ...EMPTY_FORM,
      isPrimary: true,
      contactFormTopics: resolveContactFormTopics(category, undefined),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, contact, category]);

  /**
   * Fill Company / Organization once the advisor's profile has loaded.
   *
   * The seed above is synchronous, but `/api/profile` may still be in flight when the
   * dialog opens, so this tops it up. It only ever fills a still-empty field, so
   * anything the advisor types is left alone. Create mode only: an existing contact
   * keeps whatever company it was saved with.
   */
  useEffect(() => {
    if (!open || isEdit) return;
    let cancelled = false;
    (async () => {
      const profile: any = await fetchProfileOnce().catch(() => null);
      if (cancelled || !profile) return;
      const orgCompany = primaryOrgCompanyName(profile, category);
      if (!orgCompany) return;
      setForm((prev) =>
        prev.companyName.trim() ? prev : { ...prev, companyName: orgCompany },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isEdit, category]);

  const handleSubmit = async () => {
    const {
      contactType,
      firstName,
      lastName,
      title,
      displayName,
      email,
      phone,
      companyName,
    } = form;

    // ── Validation (mirrors the new-client ContactFormSlide) ──
    const validationErrors: string[] = [];

    if (contactType === "individual") {
      if (!firstName.trim()) validationErrors.push("firstName");
      if (!lastName.trim()) validationErrors.push("lastName");
      if (!title.trim()) validationErrors.push("title");
    } else {
      if (!displayName.trim()) validationErrors.push("displayName");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = (phone || "").replace(/\D/g, "");
    const emailValid = emailRegex.test((email || "").trim());
    const phoneValid = phoneDigits.length >= 10;

    // Validate format only when a value is provided
    if ((phone || "").trim() && !phoneValid) validationErrors.push("phone");
    if ((email || "").trim() && !emailValid) validationErrors.push("email");

    // At least one of Phone or Email is required — the user can choose either
    // contact method (or provide both), instead of one specific field.
    if (!phoneValid && !emailValid) {
      if (!phoneValid) validationErrors.push("phone");
      if (!emailValid) validationErrors.push("email");
    }

    // Company / Organization is required for non-Plan-Sponsor contacts
    if (!isPlanSponsorContact && !companyName.trim()) {
      validationErrors.push("companyName");
    }

    // CTA requirements. "Schedule Appt." needs its URL; "Contact Form" needs a
    // valid email instead, because that CTA opens the Plantelligence-branded
    // /contact page and the link is derived from the contact while the submission
    // is delivered to that address (same rule as the Plan contact editor).
    if (
      form.enableContactButton &&
      form.ctaType === "schedule" &&
      !form.schedulingUrl.trim()
    ) {
      validationErrors.push("schedulingUrl");
    }
    if (
      form.enableContactButton &&
      form.ctaType === "contact" &&
      !emailValid
    ) {
      if (!validationErrors.includes("email")) validationErrors.push("email");
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      const refMap: Record<
        string,
        React.RefObject<HTMLInputElement | null>
      > = {
        firstName: firstNameRef,
        lastName: lastNameRef,
        title: titleRef,
        email: emailRef,
        phone: phoneRef,
        companyName: companyNameRef,
        schedulingUrl: schedulingUrlRef,
      };
      refMap[validationErrors[0]]?.current?.focus();
      toast.error(
        form.enableContactButton &&
          form.ctaType === "contact" &&
          !emailValid
          ? "Selecting the Contact Form CTA requires this contact's email, since form submissions are delivered to it."
          : "Please fill out all required fields",
      );
      return;
    }
    setErrors([]);

    const shouldBePrimary = isPlanSponsorContact || form.isPrimary === true;

    // ── Build the contact ──
    // Create starts from nothing (id + category membership + primary flags are ours to
    // set); edit MERGES onto the stored contact, so everything this form does not
    // expose — the support icon, per-card colours, logo scale, a multi-category
    // membership — is preserved.
    const creationFields: Partial<KeyContact> = isEdit
      ? {}
      : {
          id: `new-contact-${Date.now()}`,
          benefitsCategory: category as BenefitsCategory,
          benefitsCategories: [category as BenefitsCategory],
          showOnPortal: true,
          isPrimary: shouldBePrimary,
          isPrimaryOverall: shouldBePrimary,
          isPrimaryByCategory: {
            [category]: shouldBePrimary,
          } as any,
        };

    const updated = {
      ...(isEdit && contact ? contact : {}),
      ...creationFields,
      contactType,
      firstName: contactType === "individual" ? firstName : undefined,
      lastName: contactType === "individual" ? lastName : undefined,
      title: contactType === "individual" ? title : undefined,
      customRole:
        contactType === "individual" ? title : (contact as any)?.customRole,
      displayName: contactType === "team_support" ? displayName : undefined,
      email,
      phone,
      phoneExtension: form.phoneExtension,
      headshot:
        contactType === "individual"
          ? form.headshot || undefined
          : undefined,
      headshotFileName:
        contactType === "individual"
          ? form.headshotFileName || undefined
          : undefined,
      teamImage:
        contactType === "team_support"
          ? form.teamImage || undefined
          : undefined,
      teamImageFileName:
        contactType === "team_support"
          ? form.teamImageFileName || undefined
          : undefined,
      companyName: companyName || "",
      companyLogo:
        !isPlanSponsorContact && form.companyLogo
          ? form.companyLogo
          : undefined,
      name:
        contactType === "individual"
          ? `${firstName} ${lastName}`.trim()
          : displayName,
      // Primary flags: a create sets them above; an edit keeps whatever the contact
      // already had unless the toggle was changed. (A Company / Plan Sponsor contact
      // is always primary.)
      ...(isEdit
        ? {
            isPrimary: shouldBePrimary,
            isPrimaryOverall: shouldBePrimary,
          }
        : {}),
      displayEmail: form.displayEmail,
      displayPhone: form.displayPhone,
      displayUrl: form.enableContactButton
        ? form.ctaType === "contact"
        : false,
      displayScheduleAppointment: form.enableContactButton
        ? form.ctaType === "schedule"
        : false,
      enableContactButton: form.enableContactButton,
      contactButtonType: form.enableContactButton
        ? ((form.ctaType === "schedule"
            ? "calendar"
            : form.ctaType === "call"
              ? "phone"
              : form.ctaType === "email"
                ? "email"
                : "url") as "calendar" | "phone" | "email" | "url")
        : undefined,
      schedulingUrl:
        form.enableContactButton && form.ctaType === "schedule"
          ? form.schedulingUrl || undefined
          : undefined,
      // Derived first-party /contact link (carrying the advisor's topic choices),
      // not a typed URL — see `contactFormCta`.
      websiteUrl: contactFormCta.active
        ? contactFormCta.url || undefined
        : undefined,
      // The participant-facing "Topic of Interest" configuration is saved WITH the
      // contact so the /contact page (and the plan-side topic lookup that keeps
      // older links correct) resolves it.
      contactFormTopics: form.contactFormTopics,
    } as KeyContact;

    setBusy(true);
    try {
      await onSubmit(updated);
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Could not save the contact", {
        description: error?.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Contact" : "Create New Contact"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this contact. Their details are saved to the plan straight away and show on every benefit they serve."
                : "Add a contact for this benefit. Provide at least one way for employees to reach them (phone or email)."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-2 items-start">
            {/* Left column: Form Fields */}
            <div className="space-y-4 min-w-0">
              {/* Contact Type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium dark:text-gray-300">
                  Contact Type
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateForm({ contactType: "individual" })}
                    className={cn(
                      "flex flex-col p-2.5 rounded-lg border-2 text-left transition-all",
                      form.contactType === "individual"
                        ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                    )}
                  >
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Individual
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      A specific person
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateForm({ contactType: "team_support" })}
                    className={cn(
                      "flex flex-col p-2.5 rounded-lg border-2 text-left transition-all",
                      form.contactType === "team_support"
                        ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                    )}
                  >
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Team / Support Line
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      A department or group
                    </span>
                  </button>
                </div>
              </div>

              {/* Primary Contact Toggle — hidden for Company / Plan Sponsor (always primary) */}
              {!isPlanSponsorContact && (
                <div className="flex items-center space-x-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                  <Checkbox
                    id="contact-is-primary"
                    checked={form.isPrimary}
                    onCheckedChange={(checked) =>
                      updateForm({ isPrimary: checked === true })
                    }
                  />
                  <Label
                    htmlFor="contact-is-primary"
                    className="text-xs font-medium cursor-pointer dark:text-gray-300"
                  >
                    Mark as primary contact for{" "}
                    <span className="font-semibold">{category}</span>
                  </Label>
                </div>
              )}

              {/* Name / Title / Headshot (individual) or Team fields (team_support) */}
              <ContactFormFields
                contactType={form.contactType}
                firstName={form.firstName}
                lastName={form.lastName}
                title={form.title}
                onFirstNameChange={(val) =>
                  updateForm({ firstName: val }, ["firstName"])
                }
                onLastNameChange={(val) =>
                  updateForm({ lastName: val }, ["lastName"])
                }
                onTitleChange={(val) => updateForm({ title: val }, ["title"])}
                displayName={form.displayName}
                departmentLabel=""
                supportHours=""
                onDisplayNameChange={(val) =>
                  updateForm({ displayName: val }, ["displayName"])
                }
                onDepartmentLabelChange={() => {}}
                onSupportHoursChange={() => {}}
                headshot={form.headshot}
                headshotFileName={form.headshotFileName}
                onHeadshotChange={(val, name) =>
                  updateForm({ headshot: val, headshotFileName: name })
                }
                onHeadshotRemove={() =>
                  updateForm({ headshot: "", headshotFileName: "" })
                }
                teamImage={form.teamImage}
                teamImageFileName={form.teamImageFileName}
                onTeamImageChange={(val, name) =>
                  updateForm({ teamImage: val, teamImageFileName: name })
                }
                onTeamImageRemove={() =>
                  updateForm({ teamImage: "", teamImageFileName: "" })
                }
                firstNameRef={firstNameRef}
                lastNameRef={lastNameRef}
                titleRef={titleRef}
                errorFields={errors}
              />

              {/* Company / Organization — required for non-Plan-Sponsor contacts */}
              {!isPlanSponsorContact && (
                <div className="space-y-1.5">
                  <Label className="dark:text-gray-300 text-xs font-medium">
                    Company / Organization <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    ref={companyNameRef}
                    value={form.companyName}
                    onChange={(e) =>
                      updateForm({ companyName: e.target.value }, [
                        "companyName",
                      ])
                    }
                    placeholder="e.g. Benefits Provider Inc."
                    className={cn(
                      "h-8 text-sm",
                      errors.includes("companyName") && "border-red-500",
                    )}
                  />
                  {errors.includes("companyName") && (
                    <p className="text-[10px] text-red-500">
                      Company / Organization is required
                    </p>
                  )}
                </div>
              )}

              {/* Phone / Email — at least one required */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Provide at least one of the following so employees can reach
                  this contact: <b>Phone or Email.</b>
                </p>
                <div className="space-y-1">
                  <Label className="dark:text-gray-300 text-xs font-medium">
                    Phone
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        ref={phoneRef}
                        type="tel"
                        value={formatPhoneNumber(form.phone)}
                        onChange={(e) => {
                          const digits = normalizePhoneNumber(e.target.value);
                          if (digits.length <= 11) {
                            updateForm({ phone: digits }, ["phone", "email"]);
                          }
                        }}
                        placeholder="(555) 123-4567"
                        className={cn(
                          "h-8 text-sm",
                          errors.includes("phone") && "border-red-500",
                        )}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        type="text"
                        maxLength={6}
                        value={form.phoneExtension}
                        onChange={(e) => {
                          const val = normalizeExtension(e.target.value);
                          updateForm({ phoneExtension: val });
                        }}
                        placeholder="Ext."
                        className="h-8 text-sm text-center"
                      />
                    </div>
                  </div>
                  {errors.includes("phone") && (
                    <p className="text-[10px] text-red-500">
                      Enter a valid phone number (or provide an email)
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="dark:text-gray-300 text-xs font-medium">
                    Email
                  </Label>
                  <Input
                    ref={emailRef}
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      updateForm({ email: e.target.value }, ["email", "phone"])
                    }
                    placeholder="e.g. john@company.com"
                    className={cn(
                      "h-8 text-sm",
                      errors.includes("email") && "border-red-500",
                    )}
                  />
                  {errors.includes("email") && (
                    <p className="text-[10px] text-red-500">
                      Please enter a valid email address (or provide a phone)
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Company Logo — non-Plan-Sponsor only */}
              {!isPlanSponsorContact && (
                <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <Label className="dark:text-gray-300 text-xs font-medium">
                    Upload Contact Company Logo
                  </Label>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Upload a logo to display on this contact&rsquo;s portal card
                    instead of the plan&rsquo;s company logo.
                  </p>
                  <UniversalImageEditorModal
                    value={form.companyLogo || ""}
                    fileName={form.companyLogoFileName || ""}
                    onChange={(value, fileName) =>
                      updateForm({
                        companyLogo: value,
                        companyLogoFileName: fileName || "",
                      })
                    }
                    onRemove={() =>
                      updateForm({
                        companyLogo: "",
                        companyLogoFileName: "",
                      })
                    }
                    placeholder="Upload Contact Company Logo"
                    modalTitle="Edit Contact Company Logo"
                    modalDescription="Upload a logo for this contact's portal card."
                    saveButtonText="Save Logo"
                    type="logo"
                  />
                </div>
              )}

              {/* Call-to-Action Button */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2.5">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enable-cta-button"
                    checked={form.enableContactButton}
                    onCheckedChange={(checked) =>
                      updateForm({ enableContactButton: checked === true })
                    }
                  />
                  <Label
                    htmlFor="enable-cta-button"
                    className="text-xs font-medium cursor-pointer dark:text-gray-300"
                  >
                    Add a call to action button
                  </Label>
                </div>

                {form.enableContactButton && (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { value: "schedule", label: "Schedule Appt." },
                          { value: "call", label: "Call" },
                          { value: "email", label: "Email" },
                          { value: "contact", label: "Contact Form" },
                        ] as const
                      ).map((opt) => {
                        const isActive = form.ctaType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateForm({ ctaType: opt.value })}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-all",
                              isActive
                                ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                            )}
                          >
                            <span className="text-[11px] font-medium">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {form.ctaType === "schedule" && (
                      <div className="space-y-1">
                        <Label className="dark:text-gray-300 text-xs font-medium">
                          Scheduling URL <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          ref={schedulingUrlRef}
                          value={form.schedulingUrl}
                          onChange={(e) =>
                            updateForm({ schedulingUrl: e.target.value }, [
                              "schedulingUrl",
                            ])
                          }
                          placeholder="https://calendly.com/..."
                          className={cn(
                            "h-8 text-sm",
                            errors.includes("schedulingUrl") &&
                              "border-red-500",
                          )}
                        />
                        {errors.includes("schedulingUrl") && (
                          <p className="text-[10px] text-red-500">
                            Scheduling URL is required when &ldquo;Schedule
                            Appt.&rdquo; is enabled
                          </p>
                        )}
                      </div>
                    )}

                    {form.ctaType === "contact" && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label className="dark:text-gray-300 text-xs font-medium">
                            Plantelligence Contact Form
                          </Label>
                          <button
                            type="button"
                            onClick={() => setContactPreviewOpen(true)}
                            className="flex-shrink-0 w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Preview the Contact Form page"
                            title="Preview the Contact Form page"
                          >
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5 leading-relaxed">
                          This CTA opens a Plantelligence-branded contact form on
                          the /contact page. Submissions are delivered to this
                          contact&rsquo;s email.
                          {form.email
                            ? ` Incoming messages will be sent to ${form.email}.`
                            : " Enter this contact's email above to receive incoming messages."}
                        </p>

                        {/* Participant-facing "Topic of Interest" choices — the same
                            builder (and the same stored shape) the Plan contact
                            editor uses, pre-seeded with this category's suggestions. */}
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-1">
                          <ContactFormTopicBuilder
                            category={contactTopicCategory}
                            customBenefitTitle={customBenefitTitle}
                            topics={form.contactFormTopics}
                            onChange={(topics) =>
                              updateForm({ contactFormTopics: topics })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {form.ctaType === "call" && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                        {form.phone
                          ? `${formatPhoneNumber(form.phone)}${
                              form.phoneExtension
                                ? ` ext. ${form.phoneExtension}`
                                : ""
                            }`
                          : "Complete the Phone field above first"}
                      </p>
                    )}

                    {form.ctaType === "email" && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                        {form.email || "Complete the Email field above first"}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Email / Phone Visibility Toggles */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Show on contact card
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="display-email"
                    checked={form.displayEmail}
                    onCheckedChange={(checked) =>
                      updateForm({ displayEmail: checked === true })
                    }
                  />
                  <Label
                    htmlFor="display-email"
                    className="text-xs font-medium cursor-pointer dark:text-gray-300"
                  >
                    Email
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="display-phone"
                    checked={form.displayPhone}
                    onCheckedChange={(checked) =>
                      updateForm({ displayPhone: checked === true })
                    }
                  />
                  <Label
                    htmlFor="display-phone"
                    className="text-xs font-medium cursor-pointer dark:text-gray-300"
                  >
                    Phone
                  </Label>
                </div>
              </div>
            </div>

            {/* Right column: Live Portal Preview of the contact card */}
            <div className="flex flex-col items-center gap-2 lg:sticky lg:top-0 self-start w-full">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-blue text-center">
                Portal Preview
              </span>
              <SmallVerticalCard
                contact={{
                  id: "preview",
                  contactType: form.contactType,
                  name:
                    form.contactType === "individual"
                      ? `${form.firstName} ${form.lastName}`.trim()
                      : form.displayName,
                  firstName: form.firstName,
                  lastName: form.lastName,
                  title:
                    form.contactType === "individual" ? form.title : undefined,
                  displayName:
                    form.contactType === "team_support"
                      ? form.displayName
                      : undefined,
                  email: form.email,
                  phone: form.phone,
                  phoneExtension: form.phoneExtension,
                  headshot:
                    form.contactType === "individual"
                      ? form.headshot || undefined
                      : undefined,
                  teamImage:
                    form.contactType === "team_support"
                      ? form.teamImage || undefined
                      : undefined,
                  companyName:
                    form.companyName ||
                    (isPlanSponsorContact ? planCompanyName || "" : ""),
                  companyLogo:
                    !isPlanSponsorContact && form.companyLogo
                      ? form.companyLogo
                      : planLogoUrl || "",
                  benefitsCategory:
                    category === "Group Health"
                      ? "Health Insurance"
                      : category === "Group Life"
                        ? "Life Insurance"
                        : (category as any),
                  isPrimary: isPlanSponsorContact || form.isPrimary,
                  displayEmail: form.displayEmail,
                  displayPhone: form.displayPhone,
                  enableContactButton: form.enableContactButton,
                  contactButtonType: form.enableContactButton
                    ? form.ctaType === "schedule"
                      ? "calendar"
                      : form.ctaType === "call"
                        ? "phone"
                        : form.ctaType === "email"
                          ? "email"
                          : "url"
                    : undefined,
                  schedulingUrl:
                    form.enableContactButton && form.ctaType === "schedule"
                      ? form.schedulingUrl
                      : undefined,
                  websiteUrl: contactFormCta.url || undefined,
                }}
                brandColor={brandColor}
                secondaryColor={secondaryColor}
                appointmentLink={appointmentLink}
                // Only Plan Sponsor contacts fall back to the plan's company name;
                // for the other categories the preview shows a [Company / Organization]
                // placeholder until the user types the provider's company.
                companyName={isPlanSponsorContact ? planCompanyName : ""}
                index={0}
                disableAnimation={true}
                baselineBackgroundColor="#ffffff"
                compact
                previewPlaceholders
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={busy}>
              {busy
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Contact"
                  : "Create Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Form preview — renders the live Plantelligence-branded /contact
          page (with this contact's details and the topics below) so the advisor
          sees exactly what employees will get, matching the Plan contact editor. */}
      <Dialog open={contactPreviewOpen} onOpenChange={setContactPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>Contact Form Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <ContactFormPage
              to={form.email}
              company={contactFormCta.company}
              contactName={contactFormCta.name}
              contactTitle={contactFormCta.title}
              avatar={contactFormCta.avatar}
              companyLogo={contactFormCta.logo}
              topics={getActiveContactFormTopicLabels(form.contactFormTopics, {
                customBenefitTitle,
              })}
              category={contactTopicCategory || ""}
              embedded
              preview
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
