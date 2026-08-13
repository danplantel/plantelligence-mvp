"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, ArrowRight, Mail, Phone, BadgeCheck, Calendar, Globe, PiggyBank, Shield, Heart, Puzzle, Users, Briefcase, Info } from "lucide-react";
import { BrandingImage } from "@/components/ui/branding-image";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";
import { BenefitsCategory, ContactType } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";
import { formatPhoneWithExtension } from "@/lib/phone-utils";
import { toast } from "sonner";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { useContactStyles } from "../../sections/hooks/use-contact-styles";

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
  /** Whether this form is shown after selecting "Someone Else" on the first contact prompt */
  isFromSomeoneElse?: boolean;
}

// ==================== Helpers ====================

const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, "");
  if (phoneNumber.length <= 3) return phoneNumber;
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

/** Compute a two-letter monogram from a contact name */
const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Derive a light card accent color from the category */
const categoryAccent: Record<string, string> = {
  Retirement: "#1F3A60",
  "Group Health": "#0F766E",
  "Group Life": "#B91C1C",
  "Other Benefits": "#7C3AED",
  "Company / Plan Sponsor": "#1E40AF",
  "External HR / Administrator": "#6B7280",
};

// ==================== Contact Card Preview ====================

interface ContactCardPreviewProps {
  contactType: "individual" | "team_support";
  firstName: string;
  lastName: string;
  title: string;
  displayName: string;
  email: string;
  phone: string;
  phoneExtension: string;
  headshot: string;
  companyName: string;
  companyLogoSrc?: string;
  isPrimary: boolean;
  category: BenefitsCategory;
  enableCtaButton?: boolean;
  ctaType?: "schedule" | "call" | "email" | "contact";
  displayEmail?: boolean;
  displayPhone?: boolean;
  /** Brand color for the CTA button background */
  ctaColor?: string;
}

function ContactCardPreview({
  contactType,
  firstName,
  lastName,
  title,
  displayName,
  email,
  phone,
  phoneExtension,
  headshot,
  companyName,
  companyLogoSrc,
  isPrimary,
  category,
  enableCtaButton = false,
  ctaType = "schedule",
  displayEmail = true,
  displayPhone = true,
  ctaColor = "#1F3A60",
}: ContactCardPreviewProps) {
  const resolvedName =
    contactType === "individual"
      ? `${firstName} ${lastName}`.trim()
      : displayName || "Team Name";
  const resolvedTitle =
    contactType === "individual"
      ? title || "Job Title"
      : "Team / Department";
  const avatarSrc = contactType === "individual" ? headshot || "" : "";
  const accentColor = categoryAccent[category] || "#1F3A60";
  const showAvatar = contactType === "individual";

  return (
    <Card className="w-full max-w-xs overflow-hidden border border-gray-200 shadow-md rounded-xl bg-white">
      <CardContent className="p-5 flex flex-col items-center gap-3">
        {/* Company Logo above the headshot — or placeholder when not set */}
        {companyLogoSrc?.trim() ? (
          <BrandingImage
            src={companyLogoSrc}
            alt="Company logo"
            className="!w-[120px] h-12 mb-1"
            style={{ width: "120px", overflow: "visible" }}
          />
        ) : (
          <div className="h-12 w-[120px] mb-1 flex items-center justify-center rounded bg-gray-50 border border-dashed border-gray-200 px-3">
            <span className="text-[10px] text-gray-400 font-medium text-center leading-tight">
              [Upload Logo]
            </span>
          </div>
        )}

        {/* Avatar / headshot */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-2"
          style={{ borderColor: accentColor }}
        >
          {showAvatar && avatarSrc ? (
            <Headshot src={avatarSrc} alt={resolvedName} monogramName={resolvedName} />
          ) : (
            <span
              className="text-xl font-bold font-dm-serif select-none"
              style={{ color: accentColor }}
            >
              {showAvatar ? getInitials(resolvedName) : "👥"}
            </span>
          )}
        </div>

        {/* Name */}
        {resolvedName ? (
          <h3
            className="text-base font-semibold text-center text-gray-900 font-dm-serif leading-tight"
          >
            {resolvedName}
          </h3>
        ) : (
          <h3 className="text-base font-semibold text-center text-gray-400 font-dm-serif italic leading-tight">
            Contact name...
          </h3>
        )}

        {/* Title / Department */}
        <p className="text-[11px] font-medium text-gray-500 text-center -mt-1">
          {resolvedTitle}
        </p>

        {/* Company Name */}
        {companyName?.trim() && (
          <p className="text-[11px] font-semibold text-gray-700 text-center -mt-1">
            {companyName}
          </p>
        )}

        {/* Divider */}
        <div className="w-full border-t border-gray-100 pt-2 space-y-1.5">
          {/* Email — controlled by displayEmail toggle */}
          {displayEmail && (
            email ? (
              <div className="flex items-center gap-2 text-[11px] text-gray-600">
                <Mail className="w-3 h-3 flex-shrink-0" style={{ color: accentColor }} />
                <span className="truncate text-gray-500">{email}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span>email@company.com</span>
              </div>
            )
          )}

          {/* Phone — controlled by displayPhone toggle */}
          {displayPhone && (
            phone ? (
              <div className="flex items-center gap-2 text-[11px] text-gray-600">
                <Phone className="w-3 h-3 flex-shrink-0" style={{ color: accentColor }} />
                <span className="truncate text-gray-500">{formatPhoneWithExtension(phone, phoneExtension)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <span>(555) 000-0000</span>
              </div>
            )
          )}
        </div>

        {/* CTA Button */}
        {enableCtaButton && (
          <div className="w-full pt-1.5">
            {ctaType === "schedule" && (
              <span
                className="inline-flex items-center gap-1.5 w-full justify-center rounded-md px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: ctaColor }}
              >
                <Calendar className="w-3 h-3" />
                Schedule Appt.
              </span>
            )}
            {ctaType === "call" && (
              <span
                className="inline-flex items-center gap-1.5 w-full justify-center rounded-md px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: ctaColor }}
              >
                <Phone className="w-3 h-3" />
                Call Now
              </span>
            )}
            {ctaType === "email" && (
              <span
                className="inline-flex items-center gap-1.5 w-full justify-center rounded-md px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: ctaColor }}
              >
                <Mail className="w-3 h-3" />
                Send Email
              </span>
            )}
            {ctaType === "contact" && (
              <span
                className="inline-flex items-center gap-1.5 w-full justify-center rounded-md px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: ctaColor }}
              >
                <Globe className="w-3 h-3" />
                Contact
              </span>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}

// ==================== Sticky Preview Container ====================

/**
 * Pins its children to the top of the viewport via translateY so the
 * element stays in its natural DOM position (no horizontal issues) while
 * bypassing all ancestor overflow / transform / containing-block constraints.
 */
function StickyPreviewContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);
  const offsetYRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const threshold = 130; // px from viewport top — start pinning well before the header
    const BOTTOM_PADDING = 180; // px to keep clear at the bottom for the buttons + bottom nav bar

    const recalc = () => {
      const rect = el.getBoundingClientRect();
      // rect.top includes any translateY already applied.
      // Subtract the current offset to get the natural (untransformed) position.
      const naturalTop = rect.top - offsetYRef.current;
      const elHeight = rect.height;
      const viewportHeight = window.innerHeight;

      if (naturalTop < threshold) {
        // Desired offset to bring the element's top to `threshold`
        let newOffset = threshold - naturalTop;

        // Bottom constraint: keep the card's bottom edge above the
        // Back / Save & Continue buttons and the fixed bottom nav bar.
        const elementBottomWithOffset = threshold + elHeight;
        const maxAllowedBottom = viewportHeight - BOTTOM_PADDING;

        if (elementBottomWithOffset > maxAllowedBottom) {
          // Cap the offset so the bottom aligns with maxAllowedBottom
          newOffset = maxAllowedBottom - naturalTop - elHeight;
          if (newOffset < 0) newOffset = 0;
        }

        offsetYRef.current = newOffset;
        setOffsetY(newOffset);
      } else {
        offsetYRef.current = 0;
        setOffsetY(0);
      }
    };

    window.addEventListener("scroll", recalc, { passive: true });
    window.addEventListener("resize", recalc, { passive: true });
    recalc();

    return () => {
      window.removeEventListener("scroll", recalc);
      window.removeEventListener("resize", recalc);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="flex flex-col items-center justify-start gap-2 pt-1 will-change-transform"
      style={{ transform: offsetY > 0 ? `translateY(${offsetY}px)` : undefined }}
    >
      {children}
    </div>
  );
}

// ==================== Component ====================

export function ContactFormSlide({
  category,
  defaultCompanyName = "",
  defaultCompanyLogo = "",
  defaultIsPrimary = false,
  onBack,
  onContinue,
  isGuided = false,
  isFromSomeoneElse = false,
  errorFields: externalErrorFields = [],
}: ContactFormSlideProps) {
  const { stepData, saveStepDataLocally } = useNewClientWizardStore();

  // Match the card styling used in the Step 3 preview (step-3d.tsx).
  const { styles } = useContactStyles();
  const brandColor = styles.cardPrimaryColor;
  const secondaryColor = styles.cardSecondaryColor;

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
  // Company/Organization starts blank for new contacts, but is restored from
  // step3b when editing an existing contact (editingContactId set) or when
  // returning to a Someone Else form that already has a saved value (e.g.
  // Next → Category Explorer → back). This keeps the field populated across
  // slide navigation/remounts, matching how all other fields are initialised.
  const restoreCompanyName =
    Boolean(step3bData.editingContactId) || isFromSomeoneElse;
  const [companyName, setCompanyName] = useState(
    restoreCompanyName ? step3bData.companyName || "" : "",
  );
  const [isPrimary, setIsPrimary] = useState(
    category === "Company / Plan Sponsor"
      ? true
      : (() => {
          // Auto-check primary when this is the first contact for the category
          const existingContacts = (
            stepData.keyContacts?.contacts || []
          ) as any[];
          const contactsInCategory = existingContacts.filter((c: any) => {
            const cats: BenefitsCategory[] =
              c.benefitsCategories ||
              (c.benefitsCategory ? [c.benefitsCategory] : []);
            return cats.includes(category);
          });
          const isFirstContact = contactsInCategory.length === 0;
          return step3bData.isPrimaryOverall ?? (isFirstContact || defaultIsPrimary);
        })(),
  );

  // Display toggles for Email / Phone on the card
  const [displayEmail, setDisplayEmail] = useState(
    step3bData.displayEmail ?? true,
  );
  // Phone "show on card" toggle: defaults to unchecked when there is no phone
  // value to display; otherwise respects the saved preference.
  const [displayPhone, setDisplayPhone] = useState(
    phone ? (step3bData.displayPhone ?? true) : false,
  );

  // Custom Benefits description — only shown when category is "Other Benefits"
  const [customBenefits, setCustomBenefits] = useState(
    (step3bData as any).benefitsCategoryOther || "",
  );

  // External Admin Logo state — only shown for "Third Party Contact" category
  const [externalAdminLogo, setExternalAdminLogo] = useState(
    (step3bData as any).externalAdminLogo || "",
  );
  const [externalAdminLogoFileName, setExternalAdminLogoFileName] = useState(
    (step3bData as any).externalAdminLogoFileName || "",
  );
  const [useCustomLogo, setUseCustomLogo] = useState(
    (step3bData as any).useCustomLogo === true,
  );

  // CTA state
  const [enableCtaButton, setEnableCtaButton] = useState(
    step3bData.enableContactButton ?? false,
  );
  const [ctaType, setCtaType] = useState<"schedule" | "call" | "email" | "contact">(
    step3bData.ctaType || "schedule",
  );
  const [schedulingUrl, setSchedulingUrl] = useState(
    step3bData.schedulingUrl || "",
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    step3bData.websiteUrl || "",
  );

  // Validation state
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  // Refs
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const customBenefitsRef = useRef<HTMLInputElement>(null);
  const schedulingUrlRef = useRef<HTMLInputElement>(null);
  const websiteUrlRef = useRef<HTMLInputElement>(null);
  // Capture editingContactId on mount so auto-save preserves it without reactive deps
  const editingContactIdRef = useRef<string | null | undefined>(
    (stepData as any)?.step3b?.editingContactId,
  );

  // Refs that always hold the latest form values, updated on every render.
  // These are used by __step3bFlushFormToStore to avoid stale closure issues
  // where the effect hasn't re-run yet but the wizard's validation already
  // needs the latest data (e.g. phone typed right before clicking Next).
  const phoneValueRef = useRef(phone);
  const emailValueRef = useRef(email);
  const firstNameValueRef = useRef(firstName);
  const lastNameValueRef = useRef(lastName);
  const titleValueRef = useRef(title);
  const displayNameValueRef = useRef(displayName);
  phoneValueRef.current = phone;
  emailValueRef.current = email;
  firstNameValueRef.current = firstName;
  lastNameValueRef.current = lastName;
  titleValueRef.current = title;
  displayNameValueRef.current = displayName;

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
      setCustomBenefits(sb.benefitsCategoryOther || "");
      setExternalAdminLogo(sb.externalAdminLogo || "");
      setExternalAdminLogoFileName(sb.externalAdminLogoFileName || "");
      setUseCustomLogo(sb.useCustomLogo === true);
      setCompanyName(sb.companyName || "");
      setIsPrimary(
        category === "Company / Plan Sponsor"
          ? true
          : (() => {
              const existingContacts = (
                stepData.keyContacts?.contacts || []
              ) as any[];
              const contactsInCategory = existingContacts.filter((c: any) => {
                const cats: BenefitsCategory[] =
                  c.benefitsCategories ||
                  (c.benefitsCategory ? [c.benefitsCategory] : []);
                return cats.includes(category);
              });
              const isFirstContact = contactsInCategory.length === 0;
              return sb.isPrimaryOverall ?? (isFirstContact || defaultIsPrimary);
            })(),
      );
      setDisplayEmail(sb.displayEmail ?? true);
      setDisplayPhone(sb.phone ? (sb.displayPhone ?? true) : false);
      setEnableCtaButton(sb.enableContactButton ?? false);
      setCtaType(sb.ctaType || "schedule");
      setSchedulingUrl(sb.schedulingUrl || "");
      setWebsiteUrl(sb.websiteUrl || "");
      setValidationAttempted(false);
      setLocalErrors([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(stepData as any)?.step3b?.editingContactId]);

  // Keep the Phone "show on card" toggle in sync with the phone field: uncheck
  // when there is no phone value, and auto-check when the user first adds one.
  // An explicit display preference on an already-populated contact is preserved
  // (the ref ensures we only auto-check on the empty → non-empty transition).
  const prevPhoneRef = useRef(phone);
  useEffect(() => {
    const prevPhone = prevPhoneRef.current;
    prevPhoneRef.current = phone;
    if (!phone) {
      setDisplayPhone(false);
    } else if (!prevPhone) {
      setDisplayPhone(true);
    }
  }, [phone]);

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
      benefitsCategoryOther: customBenefits,
      externalAdminLogo,
      externalAdminLogoFileName,
      useCustomLogo,
      isPrimaryOverall: isPrimary,
      displayEmail,
      displayPhone,
      enableContactButton: enableCtaButton,
      ctaType,
      schedulingUrl,
      websiteUrl,
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
    customBenefits,
    externalAdminLogo,
    externalAdminLogoFileName,
    useCustomLogo,
    companyName,
    isPrimary,
    displayEmail,
    displayPhone,
    enableCtaButton,
    ctaType,
    schedulingUrl,
    websiteUrl,
    saveStepDataLocally,
  ]);

  // Expose a flush callback for the wizard so the current form state is
  // committed to the store BEFORE validation runs. This prevents intermittent
  // false errors (e.g. "Phone is required" even when the field is filled) that
  // occur when the wizard's store read races ahead of the auto-save effect.
  useEffect(() => {
    (window as any).__step3bFlushFormToStore = async () => {
      // Use value refs for fields the user can type, so the flush always
      // writes the absolute latest value even when the enclosing effect
      // hasn't re-run yet (React 18 schedules effects after paint).
      await saveStepDataLocally("step3b", {
        editingContactId: editingContactIdRef.current || null,
        contactType,
        benefitsCategories: [category],
        benefitsCategory: category,
        firstName: firstNameValueRef.current,
        lastName: lastNameValueRef.current,
        title: titleValueRef.current,
        displayName: displayNameValueRef.current,
        email: emailValueRef.current,
        phone: phoneValueRef.current,
        phoneExtension,
        headshot,
        headshotFileName,
        companyName,
        benefitsCategoryOther: customBenefits,
        externalAdminLogo,
        externalAdminLogoFileName,
        useCustomLogo,
        isPrimaryOverall: isPrimary,
        displayEmail,
        displayPhone,
        enableContactButton: enableCtaButton,
        ctaType,
        schedulingUrl,
        websiteUrl,
      });
    };
    return () => {
      delete (window as any).__step3bFlushFormToStore;
    };
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
    customBenefits,
    externalAdminLogo,
    externalAdminLogoFileName,
    useCustomLogo,
    isPrimary,
    displayEmail,
    displayPhone,
    enableCtaButton,
    ctaType,
    schedulingUrl,
    websiteUrl,
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
        // Update the existing contact in-place, resetting its category to the current one
        const updatedContact = {
          ...existingContact,
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
            category !== "Company / Plan Sponsor" && externalAdminLogo
              ? externalAdminLogo
              : defaultCompanyLogo || undefined,
          name:
            contactType === "individual"
              ? `${firstName} ${lastName}`.trim()
              : displayName,
          isPrimary: shouldBePrimary,
          isPrimaryOverall: shouldBePrimary,
          displayEmail,
          displayPhone,
          displayUrl: enableCtaButton ? ctaType === "contact" : false,
          displayScheduleAppointment: enableCtaButton ? ctaType === "schedule" : false,
          enableContactButton: enableCtaButton,
          contactButtonType: enableCtaButton
            ? ((ctaType === "schedule" ? "calendar" : ctaType === "call" ? "phone" : ctaType === "email" ? "email" : "url") as "calendar" | "phone" | "email" | "url")
            : undefined,
          schedulingUrl: enableCtaButton && ctaType === "schedule" ? schedulingUrl || undefined : undefined,
          websiteUrl: enableCtaButton && ctaType === "contact" ? websiteUrl || undefined : undefined,
          benefitsCategoryOther: category === "Other Benefits" ? customBenefits || undefined : undefined,
        };

        // If this contact is being saved as primary, demote only contacts that
        // share a category with the promoted contact (one primary per category)
        const promotedCats: BenefitsCategory[] = [category];

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
        // Persist editingContactId in step3b so re-entering the form after
        // navigating back (e.g. via the breadcrumb dots) edits this contact
        // instead of creating a duplicate.
        editingContactIdRef.current = existingContact.id;
        saveStepDataLocally("step3b", {
          ...step3bData,
          editingContactId: existingContact.id,
        });
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
            companyName: companyName || defaultCompanyName,
            companyLogo: defaultCompanyLogo || undefined,
            name:
              contactType === "individual"
                ? `${firstName} ${lastName}`.trim()
                : displayName,
            isPrimary: true,
            isPrimaryOverall: true,
            displayEmail,
            displayPhone,
            displayUrl: enableCtaButton ? ctaType === "contact" : false,
            displayScheduleAppointment: enableCtaButton ? ctaType === "schedule" : false,
            enableContactButton: enableCtaButton,
            contactButtonType: enableCtaButton
              ? ((ctaType === "schedule" ? "calendar" : ctaType === "call" ? "phone" : ctaType === "email" ? "email" : "url") as "calendar" | "phone" | "email" | "url")
              : undefined,
            schedulingUrl: enableCtaButton && ctaType === "schedule" ? schedulingUrl || undefined : undefined,
            websiteUrl: enableCtaButton && ctaType === "contact" ? websiteUrl || undefined : undefined,
            benefitsCategoryOther: customBenefits || undefined,
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
          // Persist editingContactId in step3b so re-entering the form edits
          // instead of creating a duplicate.
          editingContactIdRef.current = existingMainContact.id;
          saveStepDataLocally("step3b", {
            ...step3bData,
            editingContactId: existingMainContact.id,
          });
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
          category !== "Company / Plan Sponsor" && externalAdminLogo
            ? externalAdminLogo
            : defaultCompanyLogo || undefined,
        name:
          contactType === "individual"
            ? `${firstName} ${lastName}`.trim()
            : displayName,
        showOnPortal: true,
        isPrimary: shouldBePrimary,
        isPrimaryOverall: shouldBePrimary,
        displayScope: "thisPortal" as const,
        displayEmail,
        displayPhone,
        displayUrl: enableCtaButton ? ctaType === "contact" : false,
        displayScheduleAppointment: enableCtaButton ? ctaType === "schedule" : false,
        enableContactButton: enableCtaButton,
        contactButtonType: enableCtaButton
          ? ((ctaType === "schedule" ? "calendar" : ctaType === "call" ? "phone" : ctaType === "email" ? "email" : "url") as "calendar" | "phone" | "email" | "url")
          : undefined,
        schedulingUrl: enableCtaButton && ctaType === "schedule" ? schedulingUrl || undefined : undefined,
        websiteUrl: enableCtaButton && ctaType === "contact" ? websiteUrl || undefined : undefined,
        benefitsCategoryOther: category === "Other Benefits" ? customBenefits || undefined : undefined,
      };

      const updatedContacts = [...demotedContacts, newContact];
      const updatedKeyContacts = { ...keyContactsData, contacts: updatedContacts };
      saveStepDataLocally("keyContacts", updatedKeyContacts);
      // Persist the new contact's ID in step3b so re-entering the form
      // edits this contact instead of creating a duplicate.
      editingContactIdRef.current = newContact.id;
      saveStepDataLocally("step3b", {
        ...step3bData,
        editingContactId: newContact.id,
      });
      return newContact.id;
    },
    [
      stepData.keyContacts,
      step3bData,
      contactType,
      category,
      customBenefits,
      firstName,
      lastName,
      title,
      displayName,
      email,
      phone,
      phoneExtension,
      headshot,
      headshotFileName,
      externalAdminLogo,
      externalAdminLogoFileName,
      useCustomLogo,
      companyName,
      defaultCompanyName,
      defaultCompanyLogo,
      isPrimary,
      enableCtaButton,
      ctaType,
      schedulingUrl,
      websiteUrl,
      saveStepDataLocally,
    ],
  );

  // Always point to the latest saveContact so the event listener below
  // never suffers from a stale closure (same root cause as the flush).
  const saveContactRef = useRef(saveContact);
  saveContactRef.current = saveContact;

  // Listen for save request from bottom bar Next button
  useEffect(() => {
    const handler = () => {
      const contactId = saveContactRef.current();
      window.dispatchEvent(
        new CustomEvent("step3SaveContactResponse", {
          detail: { success: !!contactId },
        }),
      );
    };
    window.addEventListener("step3SaveContactRequest", handler);
    return () =>
      window.removeEventListener("step3SaveContactRequest", handler);
  }, []); // Stable subscription — handler reads latest saveContact via ref

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

    // Email is optional — only validate the format when a value is provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      errors.push("email");
    }

    // Phone is required — must contain 10 digits
    if (phone.replace(/\D/g, "").length < 10) {
      errors.push("phone");
    }

    // Custom Benefits is required when category is "Other Benefits"
    if (category === "Other Benefits" && !customBenefits.trim()) {
      errors.push("customBenefits");
    }

    // Company / Organization is required for non-Plan-Sponsor contacts
    if (category !== "Company / Plan Sponsor" && !isFromSomeoneElse && !companyName.trim()) {
      errors.push("companyName");
    }

    // Scheduling URL is required when the "Schedule Appt." CTA is enabled
    if (enableCtaButton && ctaType === "schedule" && !schedulingUrl.trim()) {
      errors.push("schedulingUrl");
    }

    // Contact Form URL is required when the "Contact Form" CTA is enabled
    if (enableCtaButton && ctaType === "contact" && !websiteUrl.trim()) {
      errors.push("websiteUrl");
    }

    setLocalErrors(errors);
    setValidationAttempted(true);

    if (errors.length > 0) {
      // Scroll to and focus the first invalid field, then show a toast
      const firstError = errors[0];
      const errorRefMap: Record<string, React.RefObject<HTMLInputElement | null>> = {
        firstName: firstNameRef,
        lastName: lastNameRef,
        title: titleRef,
        displayName: displayNameRef,
        email: emailRef,
        phone: phoneRef,
        customBenefits: customBenefitsRef,
        schedulingUrl: schedulingUrlRef,
        websiteUrl: websiteUrlRef,
      };
      const targetRef = errorRefMap[firstError];
      if (targetRef?.current) {
        targetRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        targetRef.current.focus();
      }
      toast.error("Please fill out all required fields");
    }

    return errors.length === 0;
  }, [
    contactType,
    firstName,
    lastName,
    title,
    displayName,
    email,
    phone,
    customBenefits,
    category,
    enableCtaButton,
    ctaType,
    schedulingUrl,
    websiteUrl,
  ]);

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
        : category === "Third Party Contact"
          ? "External HR / Administrator"
          : category;

  // Category icons matching CategoryExplorer
  const categoryIcons: Record<
    string,
    React.ComponentType<{ className?: string }>
  > = {
    Retirement: PiggyBank,
    "Group Health": Shield,
    "Group Life": Heart,
    "Other Benefits": Puzzle,
    "Company / Plan Sponsor": Briefcase,
    "Third Party Contact": Users,
  };
  const CategoryIcon = categoryIcons[category];

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
          {CategoryIcon && <CategoryIcon className="w-5 h-5 text-accent-blue" />}
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

      {/* Form + Preview: side-by-side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-3xl items-start">
        {/* Left column: Form Fields */}
        <div className="flex flex-col gap-2.5 min-w-0">
          {/* Back button — visible escape hatch above the form card so users
              aren't forced to fill out the form when they accidentally clicked
              "+" on the Category Explorer or changed their mind. */}
          <button
            type="button"
            onClick={onBack}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-accent-blue dark:hover:text-accent-blue shadow-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {isFromSomeoneElse
              ? "Back to contact selection"
              : isGuided
                ? "Back"
                : "Back to categories"}
          </button>

          <Card className="w-full dark:bg-gray-800 dark:border-gray-700 shadow-sm">
            <CardContent className="pt-3 space-y-2.5">
            {/* Contact Type - Radio List (compact) */}
            <div className="space-y-1.5">
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
                    <span className="text-[0.65em] font-semibold text-gray-900 dark:text-gray-100">
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
                    <span className="text-[0.65em] font-semibold text-gray-900 dark:text-gray-100">
                      Team / Support Line
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      A department or group
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Primary Contact Toggle — hidden for Company / Plan Sponsor and TPA (Someone Else) since they are always primary */}
            {category !== "Company / Plan Sponsor" && !isFromSomeoneElse && (
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
            {/* Company / Organization — first input for TPA/Someone Else contacts */}
            {isFromSomeoneElse && (
              <div className="space-y-1">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Company / Organization <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Benefits Provider Inc."
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Custom Benefits — only shown for "Other Benefits" category */}
            {category === "Other Benefits" && (
              <div className="space-y-1.5 pb-2 border-b border-gray-100 dark:border-gray-700 mb-1" data-field="customBenefits">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Custom Benefits <span className="text-red-500">*</span>
                </Label>
                <Input
                  ref={customBenefitsRef}
                  value={customBenefits}
                  onChange={(e) => setCustomBenefits(e.target.value)}
                  placeholder="e.g. Disability, Dental, Vision, etc."
                  className={cn("h-8 text-sm", hasError("customBenefits") && "border-red-500")}
                />
                {hasError("customBenefits") ? (
                  <p className="text-[10px] text-red-500">Please describe what &ldquo;Other Benefits&rdquo; this contact handles.</p>
                ) : (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Describe what &ldquo;Other Benefits&rdquo; this contact handles.
                  </p>
                )}
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
                    ref={titleRef}
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
                  ref={displayNameRef}
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

            <div className="space-y-1" data-field="phone">
              <Label className="dark:text-gray-300 text-xs font-medium">
                Phone <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    ref={phoneRef}
                    type="tel"
                    value={phone ? formatPhoneNumber(phone) : ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      if (digits.length <= 10) {
                        setPhone(digits);
                        const store = useNewClientWizardStore.getState();
                        // Persist the phone directly to the store on every
                        // keystroke. This guarantees the wizard validation
                        // always sees the latest phone value regardless of
                        // React effect timing (useEffect runs after paint).
                        const currentStep3b =
                          (store.stepData as any)?.step3b || {};
                        store.saveStepDataLocally("step3b", {
                          ...currentStep3b,
                          phone: digits,
                        });
                        // Clear phone validation error as soon as the user
                        // starts typing, so the red border disappears immediately.
                        if (digits.length > 0) {
                          const filtered = store.errorFields.filter(
                            (f) => f !== "phone" && !/_phone$/.test(f),
                          );
                          if (filtered.length !== store.errorFields.length) {
                            store.setErrorFields(filtered);
                          }
                        }
                      }
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
                    maxLength={5}
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

            <div className="space-y-1" data-field="email">
              <Label className="dark:text-gray-300 text-xs font-medium">
                Email
              </Label>
              <Input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john@company.com"
                className={cn("h-8 text-sm", hasError("email") && "border-red-500")}
              />
              {hasError("email") && (
                <p className="text-[10px] text-red-500">Please enter a valid email address</p>
              )}
            </div>

            {/* Call-to-Action Button Section */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-2.5">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-cta-button"
                  checked={enableCtaButton}
                  onCheckedChange={(checked) => setEnableCtaButton(checked === true)}
                />
                <Label
                  htmlFor="enable-cta-button"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Add a call to action button
                </Label>
              </div>

              {enableCtaButton && (
                <>
                  {/* CTA Type Radio Group */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { value: "schedule", label: "Schedule Appt.", icon: Calendar },
                        { value: "call", label: "Call", icon: Phone },
                        { value: "email", label: "Email", icon: Mail },
                        { value: "contact", label: "Contact Form", icon: Globe },
                      ] as const
                    ).map((opt) => {
                      const isActive = ctaType === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCtaType(opt.value)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-all",
                            isActive
                              ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-3.5 h-3.5 flex-shrink-0",
                              isActive
                                ? "text-accent-blue"
                                : "text-gray-400 dark:text-gray-500",
                            )}
                          />
                          <span className="text-[11px] font-medium">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Conditional input based on type */}
                  {ctaType === "schedule" && (
                    <div className="space-y-1" data-field="schedulingUrl">
                      <Label className="dark:text-gray-300 text-xs font-medium">
                        Scheduling URL <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          ref={schedulingUrlRef}
                          value={schedulingUrl}
                          onChange={(e) => setSchedulingUrl(e.target.value)}
                          placeholder="https://calendly.com/..."
                          className={cn(
                            "h-8 text-sm flex-1",
                            hasError("schedulingUrl") && "border-red-500",
                          )}
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex-shrink-0 w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              aria-label="Info about CTA button types"
                            >
                              <Info className="w-3 h-3 text-gray-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3 text-xs" side="left" align="center">
                            <p className="font-medium mb-1 text-gray-900 dark:text-gray-100">
                              Schedule Appt (Appointment)
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 mb-3">
                              When an employee clicks this button, they can book a meeting
                              directly using the scheduling link you provide (e.g., Calendly,
                              Microsoft Bookings).
                            </p>
                            <p className="font-medium mb-1 text-gray-900 dark:text-gray-100">
                              Contact Form
                            </p>
                            <p className="text-gray-500 dark:text-gray-400">
                              This opens a contact form or external page where the employee
                              can send a message or submit an inquiry.
                            </p>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {hasError("schedulingUrl") && (
                        <p className="text-[10px] text-red-500">
                          Scheduling URL is required when &ldquo;Schedule
                          Appt.&rdquo; is enabled
                        </p>
                      )}
                    </div>
                  )}

                  {ctaType === "contact" && (
                    <div className="space-y-1" data-field="websiteUrl">
                      <Label className="dark:text-gray-300 text-xs font-medium">
                        Contact Form URL <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          ref={websiteUrlRef}
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://forms.company.com/..."
                          className={cn(
                            "h-8 text-sm flex-1",
                            hasError("websiteUrl") && "border-red-500",
                          )}
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex-shrink-0 w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              aria-label="Info about CTA button types"
                            >
                              <Info className="w-3 h-3 text-gray-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3 text-xs" side="left" align="center">
                            <p className="font-medium mb-1 text-gray-900 dark:text-gray-100">
                              Schedule Appt (Appointment)
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 mb-3">
                              When an employee clicks this button, they can book a meeting
                              directly using the scheduling link you provide (e.g., Calendly,
                              Microsoft Bookings).
                            </p>
                            <p className="font-medium mb-1 text-gray-900 dark:text-gray-100">
                              Contact Form
                            </p>
                            <p className="text-gray-500 dark:text-gray-400">
                              This opens a contact form or external page where the employee
                              can send a message or submit an inquiry.
                            </p>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {hasError("websiteUrl") && (
                        <p className="text-[10px] text-red-500">
                          Contact Form URL is required when &ldquo;Contact
                          Form&rdquo; is enabled
                        </p>
                      )}
                    </div>
                  )}

                  {ctaType === "call" && (
                    <div className="space-y-1">
                      <Label className="dark:text-gray-300 text-xs font-medium">
                        Phone Number
                      </Label>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                        {phone
                          ? formatPhoneWithExtension(phone, phoneExtension)
                          : "Complete the Phone field above first"}
                      </p>
                    </div>
                  )}

                  {ctaType === "email" && (
                    <div className="space-y-1">
                      <Label className="dark:text-gray-300 text-xs font-medium">
                        Email
                      </Label>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                        {email || "Complete the Email field above first"}
                      </p>
                    </div>
                  )}
                </>
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

            {/* Contact Company Logo — shown for all non-Plan-Sponsor contacts */}
            {category !== "Company / Plan Sponsor" && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-2.5">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Upload Contact Company Logo
                </Label>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Upload a logo to display on this contact&rsquo;s portal card instead of the plan&rsquo;s company logo.
                </p>

                {/* Upload logo */}
                <div className="pt-1">
                  <UniversalImageEditorModal
                    value={externalAdminLogo || ""}
                    fileName={externalAdminLogoFileName || ""}
                    onChange={(value, fileName) => {
                      setExternalAdminLogo(value);
                      setExternalAdminLogoFileName(fileName || "");
                    }}
                    onRemove={() => {
                      setExternalAdminLogo("");
                      setExternalAdminLogoFileName("");
                    }}
                    placeholder="Upload Contact Company Logo"
                    modalTitle="Edit Contact Company Logo"
                    modalDescription="Upload a logo for this contact's portal card."
                    saveButtonText="Save Logo"
                    type="logo"
                  />
                </div>
              </div>
            )}

            {/* Company / Organization — shown for non-Plan-Sponsor, unless already shown at top for Someone Else */}
            {category !== "Company / Plan Sponsor" && !isFromSomeoneElse && (
              <div className="space-y-1.5">
                <Label className="dark:text-gray-300">
                  Company / Organization <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Benefits Provider Inc."
                  className={cn("h-8 text-sm", hasError("companyName") && "border-red-500")}
                />
                {hasError("companyName") && (
                  <p className="text-[10px] text-red-500">Company / Organization is required</p>
                )}
              </div>
            )}

            {/* Email / Phone Visibility Toggles */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-2">
              <Label className="dark:text-gray-300 text-xs font-medium">
                Show on contact card
              </Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="display-email"
                  checked={displayEmail}
                  onCheckedChange={(checked) => setDisplayEmail(checked === true)}
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
                  checked={displayPhone}
                  onCheckedChange={(checked) => setDisplayPhone(checked === true)}
                />
                <Label
                  htmlFor="display-phone"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Phone
                </Label>
              </div>
            </div>

          </CardContent>
          </Card>
        </div>

        {/* Right column: Live Contact Card Preview (sticks on scroll) */}
        <StickyPreviewContainer>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-blue mb-1 text-center">
            Portal Preview
          </span>
          <SmallVerticalCard
            contact={{
              id: "preview",
              contactType,
              name:
                contactType === "individual"
                  ? `${firstName} ${lastName}`.trim()
                  : displayName,
              firstName,
              lastName,
              title: contactType === "individual" ? title : undefined,
              displayName: contactType === "team_support" ? displayName : undefined,
              email,
              phone,
              phoneExtension,
              headshot,
              companyName:
                companyName || (!isFromSomeoneElse ? defaultCompanyName : ""),
              companyLogo:
                category !== "Company / Plan Sponsor" && externalAdminLogo
                  ? externalAdminLogo
                  : category === "Company / Plan Sponsor"
                    ? defaultCompanyLogo
                    : undefined,
              benefitsCategory:
                category === "Group Health"
                  ? "Health Insurance"
                  : category === "Group Life"
                    ? "Life Insurance"
                    : (category as any),
              benefitsCategoryOther: customBenefits,
              isPrimary,
              displayEmail,
              displayPhone,
              enableContactButton: enableCtaButton,
              contactButtonType: enableCtaButton
                ? (ctaType === "schedule" ? "calendar" : ctaType === "call" ? "phone" : ctaType === "email" ? "email" : "url")
                : undefined,
              schedulingUrl: enableCtaButton && ctaType === "schedule" ? schedulingUrl : undefined,
              websiteUrl: enableCtaButton && ctaType === "contact" ? websiteUrl : undefined,
            }}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={stepData?.companyBasics?.appointmentLink || ""}
            companyName={
              companyName || (!isFromSomeoneElse ? defaultCompanyName : "")
            }
            index={0}
            disableAnimation={true}
            baselineBackgroundColor="#ffffff"
            compact={true}
            previewPlaceholders
          />
        </StickyPreviewContainer>
      </div>

      {/* Navigation is handled by the bottom bar (Previous/Next buttons) */}

    </div>
  );
}