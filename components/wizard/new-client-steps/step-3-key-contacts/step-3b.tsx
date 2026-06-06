"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LargeHorizontalCard } from "@/components/pages/my-benefits-team/large-horizontal-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { KeyContact } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactTypeSelector } from "./components/contact-type-selector";
import { CompanyNameSelector } from "./components/company-name-selector";
import { ContactFormFields } from "./components/contact-form-fields";
import { ContactCardActions } from "./components/contact-card-actions";
import { ContactList } from "./components/contact-list";
import { AddContactModal } from "./components/add-contact-modal";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Palette,
  Users,
} from "lucide-react";
import { BrandColorsSection } from "./components/brand-colors-section";
import { useContactStyles } from "../sections/hooks/use-contact-styles";
import { useEditorState } from "../sections/hooks/use-editor-state";
import { EditorPanelWrapper } from "../sections/components/editor-panel-wrapper";
import { ContactSectionEditor } from "../sections/components/contact-section-editor";
import { ModalGallery } from "@/components/ui/modalGallery";
import { useLenisScroll } from "../sections/hooks/use-lenis-scroll";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info } from "lucide-react";
import { normalizeExtension } from "@/lib/phone-utils";
import { isOnboardingAdvisorContactId } from "@/lib/seed-onboarding-advisor-contacts";
import { BrandingImage } from "@/components/ui/branding-image";

interface NewClientStep3bProps {
  errorFields?: string[];
  onNext?: () => void;
  defaultBenefitsCategory?: BenefitsCategory;
  onSaveContact?: (saveFn: () => Promise<boolean>) => void;
}

interface PlanSummary {
  id: string;
  companyName?: string;
  companyLogo?: string;
  status?: string;
}

import { BenefitsCategory, ContactType } from "@/types/new-client-wizard";

function benefitsCategoriesOverlap(
  formCats: BenefitsCategory[],
  contactCats: BenefitsCategory[] | undefined,
): boolean {
  if (!contactCats?.length) return false;
  return formCats.some((c) => contactCats.includes(c));
}

function normalizeContactName(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** First-name token for duplicate checks (categories overlap checked separately). */
function formComparableFirstNameToken(
  contactType: ContactType,
  firstName: string,
  displayName: string,
): string {
  if (contactType === "team_support") {
    const firstWord = (displayName || "").trim().split(/\s+/)[0] || "";
    return normalizeContactName(firstWord);
  }
  return normalizeContactName(firstName);
}

function storedComparableFirstNameToken(other: KeyContact): string {
  if (other.contactType === "team_support") {
    const raw = (other.displayName || other.name || "").trim();
    const firstWord = raw.split(/\s+/)[0] || "";
    return normalizeContactName(firstWord);
  }
  if (other.firstName != null && other.firstName.trim() !== "") {
    return normalizeContactName(other.firstName);
  }
  const full = (other.name || "").trim();
  if (!full) return "";
  const firstWord = full.split(/\s+/)[0] || "";
  return normalizeContactName(firstWord);
}

/** True if first name (individual: full first name field; team: first word of display name) matches another contact. */
function contactFirstNameMatchesForm(
  contactType: ContactType,
  firstName: string,
  displayName: string,
  other: KeyContact,
): boolean {
  const formToken = formComparableFirstNameToken(
    contactType,
    firstName,
    displayName,
  );
  if (!formToken) return false;
  const otherToken = storedComparableFirstNameToken(other);
  if (!otherToken) return false;
  return formToken === otherToken;
}

interface Step3aData {
  benefitsCategory?: BenefitsCategory;
  otherBenefitsText?: string;
  planSponsorCompanyName?: string;
  planSponsorCompanyLogo?: string;
  isPrimaryForHRPeople?: boolean;
  otherBenefitsCompanyName?: string;
  otherBenefitsCompanyLogo?: string;
  primaryContact?: string;
  hrType?: string;
  planSponsorCompanyLogoAssetId?: string;
  otherBenefitsCompanyLogoAssetId?: string;
}

interface Step3bData {
  contactType?: ContactType;
  benefitsCategories?: BenefitsCategory[];
  benefitsCategory?: BenefitsCategory;
  firstName?: string;
  lastName?: string;
  title?: string;
  displayName?: string;
  departmentLabel?: string;
  supportHours?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  websiteUrl?: string;
  schedulingUrl?: string;
  headshot?: string;
  headshotFileName?: string;
  headshotAssetId?: string;
  teamImage?: string;
  teamImageFileName?: string;
  teamImageAssetId?: string;
  companyLogo?: string;
  companyLogoAssetId?: string;
  isPrimaryByCategory?: Record<BenefitsCategory, boolean>;
  isPrimaryOverall?: boolean;
  displayEmail?: boolean;
  displayPhone?: boolean;
  displayScheduleAppointment?: boolean;
  displayWebsite?: boolean;
  contactInfoOrder?: ("phone" | "email")[];
  actionButtonOrder?:
    | ("phone" | "email" | "schedule" | "website")[]
    | ("schedule" | "website")[];
  cardDisplayMode?: "large-horizontal" | "small-vertical";
  otherBenefitsText?: string;
  phoneExtension?: string;
  cardBackgroundColor?: string;
  logoScale?: number;
}

interface Step3SubStepData {
  step3SubStep?: string;
  fromStep3b?: boolean;
  selectedContactId?: string;
  isCreatingNew?: boolean;
}

export function NewClientStep3b({
  errorFields = [],
  onNext,
  defaultBenefitsCategory,
  onSaveContact,
}: NewClientStep3bProps) {
  const {
    stepData,
    saveStepDataLocally,
    draftClientId,
    clearErrorFields,
    previousStep,
    saveAsDraft,
    currentStep,
    advisorProfile,
  } = useNewClientWizardStore();

  // Loading state for Save as Draft button
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [globalContacts, setGlobalContacts] = useState<any[]>([]);
  const [isFetchingGlobalContacts, setIsFetchingGlobalContacts] =
    useState(false);

  const { styles, updateStyle } = useContactStyles();
  const editorState = useEditorState({ autoOpen: false });
  const { editorScrollContainerRef } = useLenisScroll(editorState.isEditorOpen);

  // Get brand colors and appointment link from stepData
  const primaryColor = styles.cardPrimaryColor;
  const secondaryColor = styles.cardSecondaryColor;
  const backgroundColor = styles.cardBackgroundColor || "#ffffff";
  const logoScale = styles.logoScale || 1;
  const appointmentLink =
    stepData?.companyBasics?.appointmentLink ||
    "https://go.oncehub.com/WFAParticipantInquiry";

  // State for color override confirmation
  const [isColorWarningOpen, setIsColorWarningOpen] = useState(false);
  const [pendingColor, setPendingColor] = useState<string | null>(null);

  // Refs for form fields to enable focus from preview clicks
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const websiteUrlRef = useRef<HTMLInputElement>(null);
  const schedulingUrlRef = useRef<HTMLInputElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);

  // Sticky preview card state
  const [isFixed, setIsFixed] = useState(false);
  const [leftOffset, setLeftOffset] = useState<number | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  const [isBackgroundColorPickerOpen, setIsBackgroundColorPickerOpen] =
    useState(false);

  // Handle open/close editor from Stepper
  useEffect(() => {
    const handleOpenEditor = () => {
      editorState.setIsEditorOpen(true);
    };
    const handleCloseEditor = () => {
      editorState.handleCloseEditor();
    };

    window.addEventListener("openStep3Editor" as any, handleOpenEditor);
    window.addEventListener("closeStep3Editor" as any, handleCloseEditor);

    return () => {
      window.removeEventListener("openStep3Editor" as any, handleOpenEditor);
      window.removeEventListener("closeStep3Editor" as any, handleCloseEditor);
    };
  }, [editorState]);

  // Broadcast editor state changes to WizardStepper
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("step3EditorStateChange", {
        detail: { isOpen: editorState.isEditorOpen },
      }),
    );
  }, [editorState.isEditorOpen]);

  // Broadcast open/close events for stepper button sync
  useEffect(() => {
    if (editorState.isEditorOpen) {
      window.dispatchEvent(new CustomEvent("step3EditorOpen"));
    } else {
      window.dispatchEvent(new CustomEvent("step3EditorClose"));
    }
  }, [editorState.isEditorOpen]);

  // Close editor panel when leaving Step 3
  useEffect(() => {
    if (currentStep !== 3 && editorState.isEditorOpen) {
      editorState.handleCloseEditor();
    }
  }, [currentStep, editorState]);

  // Tab state for fixed preview: new plan → Contacts; loaded/editing draft → Preview; after first Save as draft → switch to Preview
  const prevDraftIdForActiveTabRef = useRef<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"preview" | "contacts">(() =>
    useNewClientWizardStore.getState().draftClientId ? "preview" : "contacts",
  );
  /** Bumps after programmatic contact load so the preview fingerprint effect can capture baseline while !isUpdatingRef */
  const [contactLoadBaselineEpoch, setContactLoadBaselineEpoch] = useState(0);

  useEffect(() => {
    const curr = draftClientId ?? undefined;
    const prev = prevDraftIdForActiveTabRef.current;
    if (curr && !prev) {
      setActiveTab("preview");
    }
    prevDraftIdForActiveTabRef.current = curr;
  }, [draftClientId]);

  // From step3a/3c via Next → step3b (createContact + navigate): open Contacts tab without isCreatingNew side effects
  /** When true, the next `handleSelectContact` (programmatic select of the new row) must not switch to Preview */
  const suppressPreviewAfterSelectContactRef = useRef(false);
  /** Reset when landing on Contacts so first paint does not count as an "edit"; cleared by openContacts / isCreatingNew */
  const contactsTabBaselineFingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    const sub = (stepData as any).step3SubStep;
    if (!sub || typeof sub !== "object" || sub.openContactsTab !== true) return;
    setActiveTab("contacts");
    suppressPreviewAfterSelectContactRef.current = true;
    contactsTabBaselineFingerprintRef.current = null;
    const { openContactsTab: _omit, ...rest } = sub as Record<string, unknown>;
    saveStepDataLocally("step3SubStep", rest as any);
  }, [stepData, saveStepDataLocally]);

  // Get saved data from step3a and step3b
  const step3aData = ((stepData as any).step3a as Step3aData) || {};
  const step3bData = ((stepData as any).step3b as Step3bData) || {};

  // Check if Internal HR (companyName and logo should be locked)
  const isInternalHR =
    step3aData.primaryContact === "hr" && step3aData.hrType === "internal";
  const defaultCompanyName = stepData?.companyBasics?.companyName || "";
  const defaultCompanyLogo = stepData?.companyBasics?.companyLogo?.url || "";

  // Advisor organization data
  const [advisorOrgName, setAdvisorOrgName] = useState<string>("");
  const [advisorOrgLogo, setAdvisorOrgLogo] = useState<string>("");
  const [advisorServices, setAdvisorServices] = useState<string[]>([]);
  const [advisorPhone, setAdvisorPhone] = useState<string>("");
  const [advisorEmail, setAdvisorEmail] = useState<string>("");
  const [advisorWebsite, setAdvisorWebsite] = useState<string>("");
  const [advisorName, setAdvisorName] = useState<string>("");
  const [advisorTitle, setAdvisorTitle] = useState<string>("");
  const [advisorHeadshot, setAdvisorHeadshot] = useState<string>("");
  const [advisorSaveAsContact, setAdvisorSaveAsContact] =
    useState<boolean>(true);

  // Handle global plan name update from Step 3b
  const handleUpdatePlanName = useCallback(
    (newName: string) => {
      if (!stepData.companyBasics) return;

      // Update companyBasics in store
      const updatedCompanyBasics = {
        ...stepData.companyBasics,
        companyName: newName,
      };

      saveStepDataLocally("companyBasics", updatedCompanyBasics);
    },
    [stepData.companyBasics, saveStepDataLocally],
  );

  // Handle global plan logo update from Step 3b
  const handleUpdatePlanLogo = useCallback(
    (newLogo: string) => {
      if (!stepData.companyBasics) return;

      // Update companyBasics in store
      const updatedCompanyBasics = {
        ...stepData.companyBasics,
        companyLogo: newLogo
          ? {
              ...(stepData.companyBasics.companyLogo || {
                fileName: "company-logo",
                fileSize: 0,
                width: 0,
                height: 0,
                hasTransparency: false,
                warnings: [],
              }),
              url: newLogo,
            }
          : null,
      };

      saveStepDataLocally("companyBasics", updatedCompanyBasics);
    },
    [stepData.companyBasics, saveStepDataLocally],
  );

  // Fetch advisor organization data
  useEffect(() => {
    const fetchAdvisorOrg = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const profile = await response.json();
          const { setAdvisorProfile } = useNewClientWizardStore.getState();
          // Still update the store for other components, but we use the fresh data here
          setAdvisorProfile(profile);

          if (profile) {
            setAdvisorSaveAsContact(profile.saveAsContact ?? true);
            // Get the most recent completed wizard session
            const wizardSession = profile.wizardSessions?.[0];

            // 1. Organization Name & Logo (Branding)
            if (wizardSession?.branding) {
              setAdvisorOrgName(wizardSession.branding.organizationName || "");

              setAdvisorOrgLogo(
                wizardSession.branding.logo || profile.advisorLogoUrl || "",
              );

              setAdvisorWebsite(
                wizardSession.branding.website || profile.advisorLink || "",
              );
            } else {
              // Fallback to profile root fields
              setAdvisorOrgName(profile.company || "");
              setAdvisorOrgLogo(
                profile.advisorLogo || profile.advisorLogoUrl || "",
              );
              setAdvisorWebsite(profile.advisorLink || "");
            }

            // 2. Services
            if (wizardSession?.services?.services) {
              setAdvisorServices(wizardSession.services.services);
            }

            // 3. Contact Info (User Setup)
            if (wizardSession?.userSetup) {
              setAdvisorPhone(
                wizardSession.userSetup.phone || profile.phone || "",
              );
              setAdvisorEmail(
                wizardSession.userSetup.email || profile.email || "",
              );
              setAdvisorName(
                wizardSession.userSetup.name || profile.name || "",
              );
              setAdvisorTitle(
                wizardSession.userSetup.title || profile.title || "",
              );
              setAdvisorHeadshot(
                wizardSession.userSetup.headshot || profile.headshot || "",
              );
              setAdvisorServices(
                profile.primaryServiceCategories || [],
              );
            } else {
              setAdvisorPhone(profile.phone || "");
              setAdvisorEmail(profile.email || "");
              setAdvisorName(profile.name || "");
              setAdvisorTitle(profile.title || "");
              setAdvisorHeadshot(profile.headshot || "");
              setAdvisorServices(profile.primaryServiceCategories || []);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch advisor organization:", error);
      }
    };
    fetchAdvisorOrg();
  }, []);

  // Fetch global saved contacts
  useEffect(() => {
    const fetchGlobalContacts = async () => {
      try {
        setIsFetchingGlobalContacts(true);
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        const userId = sessionData.user?.id;

        if (userId) {
          const response = await fetch(
            `/api/user/${userId}/save-future-contact`,
          );
          if (response.ok) {
            const contacts = await response.json();
            setGlobalContacts(contacts);
          }
        }
      } catch (error) {
        console.error("Failed to fetch global contacts:", error);
      } finally {
        setIsFetchingGlobalContacts(false);
      }
    };

    fetchGlobalContacts();
  }, []);

  // Map BenefitsCategory to ServiceType
  const getServiceTypeForCategory = (
    category: BenefitsCategory,
  ): string | null => {
    switch (category) {
      case "Retirement":
        return "Retirement";
      case "Group Health":
        return "Group Health";
      case "Group Life":
        return "Group Life";
      case "Other Benefits":
        return "Other";
      default:
        return null;
    }
  };

  // Determine if advisor org offers this benefit
  const advisorOffersThisBenefit = (category: BenefitsCategory): boolean => {
    const serviceType = getServiceTypeForCategory(category);
    if (!serviceType) return false;
    return advisorServices.includes(serviceType);
  };

  // Helper to split full name
  const splitName = (fullName: string): { first: string; last: string } => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return { first: "", last: "" };
    if (parts.length === 1) return { first: parts[0], last: "" };
    const first = parts[0];
    const last = parts.slice(1).join(" ");
    return { first, last };
  };

  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null,
  );
  const isUpdatingRef = useRef(false);
  const isCreatingNewContactRef = useRef(false);
  const isConfirmedRef = useRef(false);
  const duplicateSaveAnywayRef = useRef(false);
  const duplicateDialogSkipValidationRef = useRef(false);
  const [duplicateContactDialog, setDuplicateContactDialog] = useState<{
    open: boolean;
    existingLabel: string;
  }>({ open: false, existingLabel: "" });

  // Sync isCreatingNewContactRef with store state
  useEffect(() => {
    const step3SubStepData = (stepData as any).step3SubStep || {};
    if (step3SubStepData.isCreatingNew === true) {
      isCreatingNewContactRef.current = true;
      setActiveTab("contacts");
      contactsTabBaselineFingerprintRef.current = null;
      // Also ensure we are not "editing" an old contact
      setSelectedContactId(null);

      // Reset all form fields to ensure a clean slate for new contact
      setFirstName("");
      setLastName("");
      setTitle("");
      setDisplayName("");
      setDepartmentLabel("");
      setSupportHours("");
      setEmail("");
      setPhone("");
      setPhoneExtension("");
      setWebsiteUrl("");
      setSchedulingUrl("");
      setHeadshot("");
      setHeadshotFileName("");
      setHeadshotAssetId(undefined);
      setTeamImage("");
      setTeamImageFileName("");
      setTeamImageAssetId(undefined);
      setWebsiteUrlError("");
      setSchedulingUrlError("");
      setActionsError("");

      // Pre-fill fields logic for new contact
      const categoryFrom3a = step3aData.benefitsCategory;
      if (categoryFrom3a) {
        setBenefitsCategories([categoryFrom3a]);
        // Set other fields based on category
        if (categoryFrom3a === "Company / Plan Sponsor") {
          setCompanyName(
            step3aData.planSponsorCompanyName || defaultCompanyName,
          );
          setCompanyLogo(
            step3aData.planSponsorCompanyLogo || defaultCompanyLogo,
          );
        } else if (categoryFrom3a === "Other Benefits") {
          setCompanyName(step3aData.otherBenefitsCompanyName || "");
          setCompanyLogo(step3aData.otherBenefitsCompanyLogo || "");
          setOtherBenefitsText(step3aData.otherBenefitsText || "");
        } else {
          // For Retirement, Group Health, Group Life - start fresh
          setCompanyName("");
          setCompanyLogo("");
        }
      }
    } else if (step3SubStepData.selectedContactId) {
      // If navigating back and we have a selected ID, it's NOT a new creation anymore
      isCreatingNewContactRef.current = false;
    }
  }, [stepData, defaultCompanyName, defaultCompanyLogo]);

  // Initialize contact data
  const [contactType, setContactType] = useState<ContactType>(
    (step3bData.contactType as ContactType) || "individual",
  );

  const normalizeBenefitsCategories = useCallback(
    (cats?: BenefitsCategory[] | null): BenefitsCategory[] => {
      const first =
        cats?.[0] ??
        step3bData?.benefitsCategories?.[0] ??
        step3bData?.benefitsCategory ??
        defaultBenefitsCategory ??
        ("Company / Plan Sponsor" as BenefitsCategory);
      return [first];
    },
    [
      defaultBenefitsCategory,
      step3bData?.benefitsCategories,
      step3bData?.benefitsCategory,
    ],
  );

  const [benefitsCategories, setBenefitsCategories] = useState<
    BenefitsCategory[]
  >(normalizeBenefitsCategories(step3bData.benefitsCategories));

  // Individual contact fields
  const [firstName, setFirstName] = useState<string>(
    step3bData.firstName || "",
  );
  const [lastName, setLastName] = useState<string>(step3bData.lastName || "");
  const [title, setTitle] = useState<string>(step3bData.title || "");

  // Team/Support contact fields
  const [displayName, setDisplayName] = useState<string>(
    step3bData.displayName || "",
  );
  const [departmentLabel, setDepartmentLabel] = useState<string>(
    step3bData.departmentLabel || "",
  );
  const [supportHours, setSupportHours] = useState<string>(
    step3bData.supportHours || "",
  );

  // Common fields
  const [email, setEmail] = useState<string>(step3bData.email || "");
  const [phone, setPhone] = useState<string>(step3bData.phone || "");
  const [phoneExtension, setPhoneExtension] = useState<string>(
    step3bData.phoneExtension || "",
  );
  // Initialize companyName based on category - only fill for Company / Plan Sponsor
  const initialCategory =
    defaultBenefitsCategory ||
    step3bData.benefitsCategory ||
    step3bData.benefitsCategories?.[0];
  const getCategoryLabel = (category?: BenefitsCategory | string | null) => {
    if (category === "Company / Plan Sponsor") return "Company / Plan Sponsor";
    if (category === "Other Benefits") return "Other";
    return category || "";
  };
  const shouldAutoFillCompany = initialCategory === "Company / Plan Sponsor";
  const [companyName, setCompanyName] = useState<string>(
    isInternalHR
      ? defaultCompanyName
      : shouldAutoFillCompany
      ? step3bData.companyName || defaultCompanyName || ""
      : step3bData.companyName || "",
  );
  const [websiteUrl, setWebsiteUrl] = useState<string>(
    step3bData.websiteUrl || "",
  );
  const [schedulingUrl, setSchedulingUrl] = useState<string>(
    step3bData.schedulingUrl || "",
  );

  // URL validation errors
  const [websiteUrlError, setWebsiteUrlError] = useState<string>("");
  const [schedulingUrlError, setSchedulingUrlError] = useState<string>("");
  const [actionsError, setActionsError] = useState<string>("");

  // Optional logo and headshot
  const [headshot, setHeadshot] = useState<string>(step3bData.headshot || "");
  const [headshotFileName, setHeadshotFileName] = useState<string>(
    step3bData.headshotFileName || "",
  );
  const [headshotAssetId, setHeadshotAssetId] = useState<string | undefined>(
    step3bData.headshotAssetId || undefined,
  );
  const [individualCardBackgroundColor, setIndividualCardBackgroundColor] =
    useState<string | undefined>(step3bData.cardBackgroundColor || undefined);
  const [individualLogoScale, setIndividualLogoScale] = useState<
    number | undefined
  >(step3bData.logoScale || undefined);

  // Team image for team_support contact type
  const [teamImage, setTeamImage] = useState<string>(
    step3bData.teamImage || "",
  );
  const [teamImageFileName, setTeamImageFileName] = useState<string>(
    step3bData.teamImageFileName || "",
  );
  const [teamImageAssetId, setTeamImageAssetId] = useState<string | undefined>(
    step3bData.teamImageAssetId || undefined,
  );
  const [isTeamImageGalleryOpen, setIsTeamImageGalleryOpen] = useState(false);
  // Initialize companyLogo based on category - only fill for Company / Plan Sponsor
  const [companyLogo, setCompanyLogo] = useState<string>(
    shouldAutoFillCompany
      ? step3bData.companyLogo || defaultCompanyLogo || ""
      : step3bData.companyLogo || "",
  );
  const [companyLogoAssetId, setCompanyLogoAssetId] = useState<
    string | undefined
  >(step3bData.companyLogoAssetId || undefined);

  // Other Benefits custom text
  const [otherBenefitsText, setOtherBenefitsText] = useState<string>(
    step3bData.otherBenefitsText || "",
  );

  // Primary contact flags
  const [isPrimaryByCategory, setIsPrimaryByCategory] = useState<
    Record<BenefitsCategory, boolean>
  >(
    step3bData.isPrimaryByCategory || ({} as Record<BenefitsCategory, boolean>),
  );
  const [isPrimaryOverall, setIsPrimaryOverall] = useState<boolean>(
    step3bData.isPrimaryOverall || false,
  );

  // Contact card action buttons
  const [displayEmail, setDisplayEmail] = useState<boolean>(
    step3bData.displayEmail ?? true,
  );
  const [displayPhone, setDisplayPhone] = useState<boolean>(
    step3bData.displayPhone ?? true,
  );
  const [displayScheduleAppointment, setDisplayScheduleAppointment] =
    useState<boolean>(step3bData.displayScheduleAppointment ?? false);
  const [displayWebsite, setDisplayWebsite] = useState<boolean>(
    step3bData.displayWebsite ?? false,
  );

  // Validation check for at least one action
  useEffect(() => {
    if (
      !displayEmail &&
      !displayPhone &&
      !displayScheduleAppointment &&
      !displayWebsite
    ) {
      setActionsError("You must select one contact action");
    } else {
      setActionsError("");
    }
  }, [displayEmail, displayPhone, displayScheduleAppointment, displayWebsite]);
  // Track if user tried to enable "Visit Website" without URL
  const [pendingWebsiteEnable, setPendingWebsiteEnable] = useState(false);
  // Track if user tried to enable "Schedule Appointment" without URL
  const [
    pendingScheduleAppointmentEnable,
    setPendingScheduleAppointmentEnable,
  ] = useState(false);

  // Contact info and action button orders (separate)
  type ContactInfoType = "phone" | "email";
  type ActionButtonType = "schedule" | "website";

  // Helper to split old actionButtonOrder into two separate orders
  const splitOldOrder = (
    oldOrder: string[],
  ): {
    contactInfoOrder: ContactInfoType[];
    actionButtonOrder: ActionButtonType[];
  } => {
    const contactInfoOrder: ContactInfoType[] = [];
    const actionButtonOrder: ActionButtonType[] = [];

    oldOrder.forEach((item) => {
      if (item === "phone" || item === "email") {
        contactInfoOrder.push(item as ContactInfoType);
      } else if (item === "schedule" || item === "website") {
        actionButtonOrder.push(item as ActionButtonType);
      }
    });

    // Defaults if empty
    if (contactInfoOrder.length === 0) {
      contactInfoOrder.push("phone", "email");
    }
    if (actionButtonOrder.length === 0) {
      actionButtonOrder.push("schedule", "website");
    }

    return { contactInfoOrder, actionButtonOrder };
  };

  // Initialize orders - check for new format first, then fall back to old format
  const oldOrder = step3bData.actionButtonOrder as string[] | undefined;
  const hasNewFormat =
    step3bData.contactInfoOrder && step3bData.actionButtonOrder;

  let initialContactInfoOrder: ContactInfoType[] = ["phone", "email"];
  let initialActionButtonOrder: ActionButtonType[] = ["schedule", "website"];

  if (hasNewFormat) {
    initialContactInfoOrder =
      (step3bData.contactInfoOrder as ContactInfoType[]) || ["phone", "email"];
    initialActionButtonOrder =
      (step3bData.actionButtonOrder as ActionButtonType[]) || [
        "schedule",
        "website",
      ];
  } else if (oldOrder) {
    const split = splitOldOrder(oldOrder);
    initialContactInfoOrder = split.contactInfoOrder;
    initialActionButtonOrder = split.actionButtonOrder;
  }

  const [contactInfoOrder, setContactInfoOrder] = useState<ContactInfoType[]>(
    initialContactInfoOrder,
  );
  const [actionButtonOrder, setActionButtonOrder] = useState<
    ActionButtonType[]
  >(initialActionButtonOrder);

  // Card display mode
  const [cardDisplayMode, setCardDisplayMode] = useState<
    "large-horizontal" | "small-vertical"
  >(
    (step3bData.cardDisplayMode as "large-horizontal" | "small-vertical") ||
      "large-horizontal",
  );

  // Sync isPrimaryByCategory when benefitsCategories change
  useEffect(() => {
    const currentKeys = Object.keys(isPrimaryByCategory) as BenefitsCategory[];
    const hasRemovedCategories = currentKeys.some(
      (category) => !benefitsCategories.includes(category),
    );

    if (hasRemovedCategories) {
      const updated: Record<BenefitsCategory, boolean> = {} as Record<
        BenefitsCategory,
        boolean
      >;
      // Only keep categories that are still selected
      benefitsCategories.forEach((category) => {
        if (isPrimaryByCategory[category]) {
          updated[category] = true;
        }
      });
      setIsPrimaryByCategory(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benefitsCategories]); // Only depend on benefitsCategories

  // Sync benefitsCategory when benefitsCategories change
  useEffect(() => {
    // Note: We used to skip if isUpdatingRef.current was true, but that prevented
    // auto-fill from running when creating a new contact from the modal.
    // Instead, we rely on dependency checks and hasUserEnteredData to prevent loops.

    // Skip auto-fill only if form has data that differs from advisor data
    // This means user has manually entered data or loaded an existing contact
    // But allow auto-fill if form is empty or matches advisor data (new contact)
    const advisorNameParts = splitName(advisorName || "");
    const currentCategory = benefitsCategories[0];
    const isCompanyPlanSponsor = currentCategory === "Company / Plan Sponsor";

    // 1. Check if Advisor has matching service category
    const isMatchedCategory = advisorOffersThisBenefit(currentCategory);

    const persistedContacts =
      useNewClientWizardStore.getState().stepData.keyContacts?.contacts ?? [];
    const selectedPersistedContact = selectedContactId
      ? persistedContacts.find((c) => c.id === selectedContactId)
      : undefined;
    // Only inject advisor profile for contacts seeded from onboarding (stable ids).
    // New cards for the same primary-service category must stay blank unless the user fills them.
    const allowAdvisorProfileAutofill =
      !!selectedPersistedContact &&
      isOnboardingAdvisorContactId(selectedPersistedContact.id);

    // 2. Determine if auto-fill should happen
    const isNameDirty =
      companyName.trim() !== "" &&
      companyName !== advisorOrgName &&
      companyName !== defaultCompanyName;

    const isLogoDirty =
      companyLogo &&
      companyLogo !== advisorOrgLogo &&
      companyLogo !== defaultCompanyLogo;

    // A field is considered "user entered" if it has data AND that data is different from the advisor data
    const hasUserEnteredEmail = email.trim() !== "" && email !== advisorEmail;
    const hasUserEnteredPhone = phone.trim() !== "" && phone !== advisorPhone;
    const hasUserEnteredFirstName =
      firstName.trim() !== "" && firstName !== advisorNameParts.first;
    const hasUserEnteredLastName =
      lastName.trim() !== "" && lastName !== advisorNameParts.last;
    const hasUserEnteredTitle = title.trim() !== "" && title !== advisorTitle;
    const hasUserEnteredHeadshot =
      headshot.trim() !== "" && headshot !== advisorHeadshot;

    const hasUserEnteredData =
      hasUserEnteredEmail ||
      hasUserEnteredPhone ||
      hasUserEnteredFirstName ||
      hasUserEnteredLastName ||
      isNameDirty ||
      isLogoDirty ||
      hasUserEnteredHeadshot ||
      (displayName.trim() !== "" && displayName !== advisorName) ||
      hasUserEnteredTitle;

    // 3. Process Auto-fill Logic
    if (benefitsCategories.length > 0) {
      setBenefitsCategory(benefitsCategories[0]);

      // We allow auto-fill if NO contact is selected OR if it's a newly created contact
      // where we want to ensure auto-fill happens after state transitions.
      // Additionally, we allow it if the data currently matches the advisor data or is empty
      // to ensure robustness after navigation.
      const isNewOrEmpty =
        !selectedContactId ||
        isCreatingNewContactRef.current ||
        !hasUserEnteredData;
      const shouldAllowAutoFill = isNewOrEmpty;

      if (isCompanyPlanSponsor) {
        // Plan Sponsor: Always pull from Step 1 data if empty/new
        if (shouldAllowAutoFill) {
          if (!isNameDirty) setCompanyName(defaultCompanyName);
          if (!isLogoDirty) setCompanyLogo(defaultCompanyLogo);
        }
      } else if (isMatchedCategory && allowAdvisorProfileAutofill) {
        // Seeded onboarding row only: keep form in sync with advisor profile for that category.
        if (shouldAllowAutoFill) {
          if (!hasUserEnteredFirstName) setFirstName(advisorNameParts.first);
          if (!hasUserEnteredLastName) setLastName(advisorNameParts.last);
          if (!hasUserEnteredTitle) setTitle(advisorTitle);
          if (!hasUserEnteredEmail) setEmail(advisorEmail);
          if (!hasUserEnteredPhone) setPhone(advisorPhone);
          if (!hasUserEnteredHeadshot) setHeadshot(advisorHeadshot);
          if (!isNameDirty) setCompanyName(advisorOrgName);
          if (!isLogoDirty) setCompanyLogo(advisorOrgLogo);
          setWebsiteUrl(advisorWebsite);
          setDisplayName(""); // Clear team fields for matched individual advisor
        }
      } else if (!isMatchedCategory) {
        // Category not in advisor primary services — strip advisor-shaped defaults when safe
        if (shouldAllowAutoFill) {
          if (!hasUserEnteredFirstName) setFirstName("");
          if (!hasUserEnteredLastName) setLastName("");
          if (!hasUserEnteredTitle) setTitle("");
          if (!hasUserEnteredEmail) setEmail("");
          if (!hasUserEnteredPhone) setPhone("");
          if (!hasUserEnteredHeadshot) setHeadshot("");
          if (!isNameDirty) setCompanyName("");
          if (!isLogoDirty) setCompanyLogo("");
          setWebsiteUrl("");
          setDisplayName("");
        }
      }
      // else: matched service category but a manual (non-seeded) card — do not inject or clear
    }
  }, [
    benefitsCategories,
    advisorOrgName,
    advisorOrgLogo,
    advisorPhone,
    advisorEmail,
    advisorWebsite,
    advisorName,
    advisorTitle,
    advisorHeadshot,
    advisorServices,
    advisorSaveAsContact,
    selectedContactId,
  ]);

  // Legacy support - keep for backward compatibility
  const [benefitsCategory, setBenefitsCategory] = useState<BenefitsCategory>(
    step3bData.benefitsCategory ||
      benefitsCategories[0] ||
      "Company / Plan Sponsor",
  );

  // Step 3b should only ever have one category, and it should come from the previous step.
  // Sync categories and otherBenefitsText when defaultBenefitsCategory changes
  // WARNING: Do NOT include stepData in dependencies, as it changes on every save and causes infinite loops/resets
  useEffect(() => {
    if (!defaultBenefitsCategory) return;
    if (isUpdatingRef.current) return;

    // Only update if defaultBenefitsCategory truly changed (and we're not just editing another contact)
    // But since this effect runs on mount, and defaultBenefitsCategory is stable,
    // we should rely on it.

    // However, we don't want to reset categories if we are working on a contact that has a DIFFERENT category.
    // Ideally this only runs when defaultBenefitsCategory *changes*.

    setBenefitsCategories((prev) => {
      // If we already have categories set, and defaultBenefitsCategory hasn't changed, don't reset.
      // But here we only know if defaultBenefitsCategory changed by the fact that the effect ran.

      const next = [defaultBenefitsCategory] as BenefitsCategory[];
      return prev.length === 1 && prev[0] === next[0] ? prev : next;
    });

    if (defaultBenefitsCategory === "Other Benefits") {
      const step3aData = ((stepData as any).step3a as Step3aData) || {};
      if (step3aData.otherBenefitsText) {
        setOtherBenefitsText(step3aData.otherBenefitsText);
      }
    }
  }, [defaultBenefitsCategory]);

  // Auto-fill company name and logo is now only done for Plan Sponsor (handled in the benefitsCategories useEffect above)
  // Non-Plan Sponsor categories should not auto-fill any fields from advisor data

  // Track last persisted step3b data to avoid unnecessary saves
  const lastPersistedStep3bData = useRef<any>(null);
  // Ref used by wizard to flush form to store before validation (fixes intermittent auto-fill not recognized)
  const step3bPayloadRef = useRef<any>(null);
  // Ref so flush callback always sees latest selectedContactId when called from wizard
  const selectedContactIdRef = useRef<string | number | null>(
    selectedContactId,
  );
  useEffect(() => {
    selectedContactIdRef.current = selectedContactId;
  }, [selectedContactId]);

  // Save data to store (auto-save)
  useEffect(() => {
    const currentStep3bData = {
      contactType,
      benefitsCategories,
      // Individual fields
      firstName: contactType === "individual" ? firstName : undefined,
      lastName: contactType === "individual" ? lastName : undefined,
      title: contactType === "individual" ? title : undefined,
      // Team/Support fields
      displayName: contactType === "team_support" ? displayName : undefined,
      departmentLabel:
        contactType === "team_support" ? departmentLabel : undefined,
      supportHours: contactType === "team_support" ? supportHours : undefined,
      // Common fields
      email,
      phone,
      phoneExtension,
      companyName: companyName,
      websiteUrl,
      schedulingUrl,
      // Optional logo and headshot
      headshot,
      headshotFileName,
      headshotAssetId,
      companyLogo,
      companyLogoAssetId,
      // Primary contact flags
      isPrimaryByCategory,
      isPrimaryOverall,
      // Contact card action buttons
      displayEmail,
      displayPhone,
      displayScheduleAppointment,
      displayWebsite,
      contactInfoOrder,
      actionButtonOrder,
      // Card display mode
      cardDisplayMode,
      otherBenefitsText:
        benefitsCategories[0] === "Other Benefits" ? otherBenefitsText : "",
      // Legacy support
      benefitsCategory: benefitsCategories[0] || "Company / Plan Sponsor",
    };

    // Check if data has changed
    if (
      lastPersistedStep3bData.current &&
      JSON.stringify(lastPersistedStep3bData.current) ===
        JSON.stringify(currentStep3bData)
    ) {
      return;
    }

    lastPersistedStep3bData.current = currentStep3bData;
    step3bPayloadRef.current = currentStep3bData;
    saveStepDataLocally("step3b", currentStep3bData);
  }, [
    contactType,
    benefitsCategories,
    firstName,
    lastName,
    title,
    displayName,
    departmentLabel,
    supportHours,
    email,
    phone,
    phoneExtension,
    companyName,
    websiteUrl,
    schedulingUrl,
    headshot,
    headshotFileName,
    headshotAssetId,
    companyLogo,
    companyLogoAssetId,
    teamImage,
    teamImageFileName,
    teamImageAssetId,
    isPrimaryByCategory,
    isPrimaryOverall,
    displayEmail,
    displayPhone,
    displayScheduleAppointment,
    displayWebsite,
    contactInfoOrder,
    actionButtonOrder,
    cardDisplayMode,
    otherBenefitsText,
    isInternalHR,
    defaultCompanyName,
    saveStepDataLocally,
  ]);

  const lastPersistedKeyContactsData = useRef<any>(null);

  useEffect(() => {
    const currentKeyContactsData = stepData.keyContacts || { contacts: [] };
    if (
      lastPersistedKeyContactsData.current &&
      JSON.stringify(lastPersistedKeyContactsData.current) ===
        JSON.stringify(currentKeyContactsData)
    ) {
      return;
    }

    lastPersistedKeyContactsData.current = currentKeyContactsData;
  }, [stepData.keyContacts]);

  const categoryLogos: Record<BenefitsCategory, string> = {
    Retirement: "/benefits-logo/Waypoint-WEB.webp",
    "Group Health": "/benefits-logo/Integrity_H_CMYK.jpeg",
    "Group Life": "/benefits-logo/Sun-Life-Financial.jpg",
    "Other Benefits": "/benefits-logo/wellhub.png",
    "Company / Plan Sponsor": "",
    "Recordkeeper / Vendor": "",
    "Third Party Contact": "",
  };

  // Get step3a data for logo selection (step3aData already declared above)
  const selectedCategory = benefitsCategories[0];
  const planSponsorCompanyLogo =
    step3aData.planSponsorCompanyLogo || defaultCompanyLogo;
  const otherBenefitsCompanyLogo = step3aData.otherBenefitsCompanyLogo || "";

  // Use the contact's logo, falling back to the plan's company logo so the card
  // always shows a company logo regardless of whether a headshot or contact logo exists.
  let previewCompanyLogo: string | undefined = companyLogo || defaultCompanyLogo;

  const formatPhoneNumber = (value: string): string => {
    const phoneNumber = value.replace(/\D/g, "");
    if (phoneNumber.length <= 3) return phoneNumber;
    if (phoneNumber.length <= 6)
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    if (phoneNumber.length <= 10)
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
        3,
        6,
      )}-${phoneNumber.slice(6)}`;
    return `+${phoneNumber.slice(0, 1)} (${phoneNumber.slice(
      1,
      4,
    )}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 11)}`;
  };

  const normalizePhoneNumber = (value: string) => value.replace(/\D/g, "");

  const handlePhoneChange = (value: string) => {
    const normalized = normalizePhoneNumber(value);
    if (normalized.length <= 11) {
      setPhone(normalized);
    }
  };

  const handlePhoneExtensionChange = (value: string) => {
    const normalized = normalizeExtension(value);
    setPhoneExtension(normalized);
  };

  // URL validation function
  const isValidUrl = (url: string): boolean => {
    if (!url || url.trim() === "") {
      return true; // Empty is valid (optional field)
    }

    const trimmedUrl = url.trim();

    // Basic URL pattern - accepts http://, https://, or just domain
    const urlPattern =
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;

    return urlPattern.test(trimmedUrl);
  };

  const handleWebsiteUrlChange = (value: string) => {
    if (savedContacts.length > 0) {
      setWebsiteUrl(value);
      // Validate URL
      if (value.trim() !== "" && !isValidUrl(value)) {
        setWebsiteUrlError(
          "Please enter a valid URL (e.g., https://example.com)",
        );
      } else {
        setWebsiteUrlError("");
      }

      // Auto-disable "Visit Website" if URL becomes empty
      if (!value || !value.trim()) {
        if (displayWebsite) {
          setDisplayWebsite(false);
        }
        setPendingWebsiteEnable(false);
      } else if (value.trim() && isValidUrl(value)) {
        // If URL is now valid and user previously tried to enable, auto-enable
        if (pendingWebsiteEnable) {
          setDisplayWebsite(true);
          setPendingWebsiteEnable(false);
          setWebsiteUrlError("");
        }
      }
    }
  };

  const handleSchedulingUrlChange = (value: string) => {
    if (savedContacts.length > 0) {
      setSchedulingUrl(value);
      // Validate URL
      if (value.trim() !== "" && !isValidUrl(value)) {
        setSchedulingUrlError(
          "Please enter a valid URL (e.g., https://calendar.example.com)",
        );
      } else {
        setSchedulingUrlError("");
        // If URL is now valid and user previously tried to enable, auto-enable
        if (value.trim() && isValidUrl(value)) {
          if (pendingScheduleAppointmentEnable) {
            setDisplayScheduleAppointment(true);
            setPendingScheduleAppointmentEnable(false);
            setSchedulingUrlError("");
          }
        }
      }

      // Auto-disable "Schedule Appointment" if URL becomes empty
      if (!value || !value.trim()) {
        if (displayScheduleAppointment) {
          setDisplayScheduleAppointment(false);
        }
        setPendingScheduleAppointmentEnable(false);
      }
    }
  };

  // Handle schedule appointment display change with validation
  const handleScheduleAppointmentDisplayChange = (checked: boolean) => {
    if (!checked) {
      // If unchecking, just update state
      setDisplayScheduleAppointment(false);
      setPendingScheduleAppointmentEnable(false);
      return;
    }

    // If checking, validate that schedulingUrl is filled
    if (!schedulingUrl || !schedulingUrl.trim()) {
      // Don't allow enabling if URL is empty
      // Mark that user wants to enable it
      setPendingScheduleAppointmentEnable(true);
      // Scroll to and highlight the field
      setTimeout(() => {
        if (schedulingUrlRef.current) {
          schedulingUrlRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          schedulingUrlRef.current.focus();
          // Add red border by setting error
          setSchedulingUrlError(
            "Please enter a Scheduling URL to enable Schedule Appointment",
          );
        }
      }, 100);
      return;
    }

    // Validate URL format if provided
    if (!isValidUrl(schedulingUrl)) {
      setPendingScheduleAppointmentEnable(true);
      setSchedulingUrlError(
        "Please enter a valid URL (e.g., https://calendar.example.com)",
      );
      setTimeout(() => {
        if (schedulingUrlRef.current) {
          schedulingUrlRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          schedulingUrlRef.current.focus();
        }
      }, 100);
      return;
    }

    // Clear any errors and enable
    setSchedulingUrlError("");
    setPendingScheduleAppointmentEnable(false);
    setDisplayScheduleAppointment(true);
  };

  // Handle website display change with validation
  const handleWebsiteDisplayChange = (checked: boolean) => {
    if (!checked) {
      // If unchecking, just update state
      setDisplayWebsite(false);
      setPendingWebsiteEnable(false);
      return;
    }

    // If checking, validate that websiteUrl is filled
    if (!websiteUrl || !websiteUrl.trim()) {
      // Don't allow enabling if URL is empty
      // Mark that user wants to enable it
      setPendingWebsiteEnable(true);
      // Scroll to and highlight the field
      setTimeout(() => {
        if (websiteUrlRef.current) {
          websiteUrlRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          websiteUrlRef.current.focus();
          // Add red border by setting error
          setWebsiteUrlError(
            "Please enter a Benefits Access URL to enable Visit Website",
          );
        }
      }, 100);
      return;
    }

    // Validate URL format if provided
    if (!isValidUrl(websiteUrl)) {
      setPendingWebsiteEnable(true);
      setWebsiteUrlError(
        "Please enter a valid URL (e.g., https://example.com)",
      );
      setTimeout(() => {
        if (websiteUrlRef.current) {
          websiteUrlRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          websiteUrlRef.current.focus();
        }
      }, 100);
      return;
    }

    // Clear any errors and enable
    setWebsiteUrlError("");
    setPendingWebsiteEnable(false);
    setDisplayWebsite(true);
  };

  const keyContactsData = stepData.keyContacts || { contacts: [] };
  const savedContacts = keyContactsData.contacts || [];

  // Initialize lastPersistedKeyContactsData on mount
  useEffect(() => {
    if (!lastPersistedKeyContactsData.current) {
      lastPersistedKeyContactsData.current = keyContactsData;
    }
  }, [keyContactsData]);

  // Track if we've loaded initial contact from API
  const hasLoadedInitialContact = useRef(false);
  const [isInitialLoadingComplete, setIsInitialLoadingComplete] =
    useState(false);

  const isFirstContact = selectedContactId
    ? savedContacts[0]?.id === selectedContactId
    : savedContacts.length === 0;

  // console.log("DEBUG: Step3b RENDER", { selectedContactId, benefitsCategories, companyName });

  // SAFETY GUARD: Force clear company details if "new" contact is selected and it's NOT a Plan Sponsor.
  // This overrides any potential race conditions or zombie data from previous contact selections.
  // SAFETY GUARD: Force clear company details if we just created a new contact and it's NOT a Plan Sponsor.
  // This uses a ref to track the "creation" event across renders.
  useEffect(() => {
    if (isCreatingNewContactRef.current) {
      const currentCategory = benefitsCategories[0];
      // console.log("DEBUG: Safety Guard Checking (Ref Triggered)", { currentCategory });
      const isCompanyPlanSponsor = currentCategory === "Company / Plan Sponsor";

      if (!isCompanyPlanSponsor) {
        // console.log("DEBUG: Safety Guard FORCING CLEAR - Resetting Ref");
        setCompanyName("");

        setCompanyLogo("");
        setCompanyLogoAssetId(undefined);
        // We leave the ref true for one render cycle to ensure it catches, but we should clear it eventually.
        // Actually, we can clear it here if we are sure the state update will happen.
        // Let's clear it in a timeout to be safe, or just check if companyName is already empty.
        // For now, let's keep it simple: consume the flag.
        isCreatingNewContactRef.current = false;
      } else {
        // console.log("DEBUG: Safety Guard SKIPPING (Is Plan Sponsor) - Resetting Ref");
        isCreatingNewContactRef.current = false;
      }
    }
  }, [selectedContactId, benefitsCategories]); // Run when ID or category changes

  const previewContact: KeyContact & {
    logo?: string;
    displayScheduleAppointment?: boolean;
  } = {
    id: "preview-contact",
    contactType,
    benefitsCategories,
    // Individual fields
    firstName: contactType === "individual" ? firstName : undefined,
    lastName: contactType === "individual" ? lastName : undefined,
    title: contactType === "individual" ? title : undefined,
    // Team/Support fields
    displayName: contactType === "team_support" ? displayName : undefined,
    departmentLabel:
      contactType === "team_support" ? departmentLabel : undefined,
    // Common fields
    email,
    phone,
    phoneExtension,
    companyName: companyName,
    websiteUrl: websiteUrl || undefined,
    schedulingUrl: schedulingUrl || undefined,
    name:
      contactType === "individual"
        ? `${firstName} ${lastName}`.trim()
        : displayName,
    showOnPortal: true,
    enableContactButton:
      displayEmail ||
      displayPhone ||
      displayScheduleAppointment ||
      displayWebsite,
    isPrimary: (isPrimaryOverall && isFirstContact) || false,
    displayScope: "thisPortal",
    companyLogo: previewCompanyLogo,
    logo: previewCompanyLogo,
    headshot:
      (contactType === "individual" ? headshot : teamImage) || undefined,
    teamImage: contactType === "team_support" ? teamImage : undefined,
    displayEmail: displayEmail,
    displayPhone: displayPhone,
    displayUrl: displayWebsite,
    displayScheduleAppointment: displayScheduleAppointment,
    contactInfoOrder: contactInfoOrder,
    actionButtonOrder: actionButtonOrder,
    supportHours: contactType === "team_support" ? supportHours : undefined,
    benefitsCategory: benefitsCategories[0] || "Company / Plan Sponsor",
    cardBackgroundColor: individualCardBackgroundColor || backgroundColor,
    logoScale: individualLogoScale || logoScale,
  } as KeyContact;

  /** Stable fingerprint of everything that drives the live preview — any change while on Contacts switches to Preview */
  const contactPreviewEditFingerprint = useMemo(
    () =>
      JSON.stringify({
        contactType,
        benefitsCategories,
        firstName,
        lastName,
        title,
        displayName,
        departmentLabel,
        supportHours,
        email,
        phone,
        phoneExtension,
        companyName,
        websiteUrl,
        schedulingUrl,
        displayEmail,
        displayPhone,
        displayScheduleAppointment,
        displayWebsite,
        contactInfoOrder,
        actionButtonOrder,
        headshotSig: `${headshot?.length ?? 0}:${headshot?.slice(-64)}`,
        teamImageSig: `${teamImage?.length ?? 0}:${teamImage?.slice(-64)}`,
        companyLogoSig: `${companyLogo?.length ?? 0}:${companyLogo?.slice(-64)}`,
        isPrimaryOverall,
        isPrimaryByCategory,
        otherBenefitsText,
        individualCardBackgroundColor,
        individualLogoScale,
        logoScale,
        backgroundColor,
        primaryColor,
        secondaryColor,
        cardDisplayMode,
      }),
    [
      contactType,
      benefitsCategories,
      firstName,
      lastName,
      title,
      displayName,
      departmentLabel,
      supportHours,
      email,
      phone,
      phoneExtension,
      companyName,
      websiteUrl,
      schedulingUrl,
      displayEmail,
      displayPhone,
      displayScheduleAppointment,
      displayWebsite,
      contactInfoOrder,
      actionButtonOrder,
      headshot,
      teamImage,
      companyLogo,
      isPrimaryOverall,
      isPrimaryByCategory,
      otherBenefitsText,
      individualCardBackgroundColor,
      individualLogoScale,
      logoScale,
      backgroundColor,
      primaryColor,
      secondaryColor,
      cardDisplayMode,
    ],
  );

  useEffect(() => {
    if (activeTab === "contacts") {
      contactsTabBaselineFingerprintRef.current = null;
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "contacts") return;
    if (isUpdatingRef.current) return;
    const fp = contactPreviewEditFingerprint;
    if (contactsTabBaselineFingerprintRef.current === null) {
      contactsTabBaselineFingerprintRef.current = fp;
      return;
    }
    if (fp !== contactsTabBaselineFingerprintRef.current) {
      setActiveTab("preview");
      contactsTabBaselineFingerprintRef.current = fp;
    }
  }, [contactPreviewEditFingerprint, activeTab, contactLoadBaselineEpoch]);

  // Track if validation was attempted (when Next button is clicked)
  const [validationAttempted, setValidationAttempted] = useState(false);

  // Set validationAttempted to true when errorFields are present (Next button was clicked)
  // Keep it true as long as there are errors, even when switching contacts
  useEffect(() => {
    if (errorFields.length > 0) {
      setValidationAttempted(true);
      setActiveTab("contacts");
    } else {
      // Only reset when all errors are cleared
      setValidationAttempted(false);
    }
  }, [errorFields]);

  // Auto-clear error fields when user enters valid data
  useEffect(() => {
    if (!validationAttempted || errorFields.length === 0) return;

    const { setErrorFields } = useNewClientWizardStore.getState();
    const updatedErrorFields = [...errorFields];

    // Clear errors for fields that are now valid
    if (contactType === "individual") {
      // Clear firstName error if field is now valid
      if (firstName && firstName.trim()) {
        const index = updatedErrorFields.findIndex(
          (field) =>
            field === "firstName" ||
            field === `contact_${selectedContactId}_firstName`,
        );
        if (index !== -1) {
          updatedErrorFields.splice(index, 1);
        }
      }

      // Clear lastName error if field is now valid
      if (lastName && lastName.trim()) {
        const index = updatedErrorFields.findIndex(
          (field) =>
            field === "lastName" ||
            field === `contact_${selectedContactId}_lastName`,
        );
        if (index !== -1) {
          updatedErrorFields.splice(index, 1);
        }
      }

      // Clear title error if field is now valid
      if (title && title.trim()) {
        const index = updatedErrorFields.findIndex(
          (field) =>
            field === "title" || field === `contact_${selectedContactId}_title`,
        );
        if (index !== -1) {
          updatedErrorFields.splice(index, 1);
        }
      }
    } else if (contactType === "team_support") {
      // Clear displayName error if field is now valid
      if (displayName && displayName.trim()) {
        const index = updatedErrorFields.findIndex(
          (field) =>
            field === "displayName" ||
            field === `contact_${selectedContactId}_displayName`,
        );
        if (index !== -1) {
          updatedErrorFields.splice(index, 1);
        }
      }
    }

    // Clear email error if field is now valid
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email.trim())) {
        const index = updatedErrorFields.findIndex(
          (field) =>
            field === "email" || field === `contact_${selectedContactId}_email`,
        );
        if (index !== -1) {
          updatedErrorFields.splice(index, 1);
        }
      }
    }

    // Clear phone error if field is now valid
    if (phone && phone.trim()) {
      const index = updatedErrorFields.findIndex(
        (field) =>
          field === "phone" || field === `contact_${selectedContactId}_phone`,
      );
      if (index !== -1) {
        updatedErrorFields.splice(index, 1);
      }
    }

    // Clear benefitsCategories error if field is now valid
    if (benefitsCategories && benefitsCategories.length > 0) {
      const index = updatedErrorFields.findIndex((field) =>
        field.includes("benefitsCategories"),
      );
      if (index !== -1) {
        updatedErrorFields.splice(index, 1);
      }
    }

    // Only update if there are changes
    if (updatedErrorFields.length !== errorFields.length) {
      setErrorFields(updatedErrorFields);
    }
  }, [
    validationAttempted,
    errorFields,
    contactType,
    firstName,
    lastName,
    title,
    displayName,
    email,
    phone,
    benefitsCategories,
    selectedContactId,
  ]);

  // Load initial contact from API on first mount if no contacts exist
  useEffect(() => {
    if (hasLoadedInitialContact.current) {
      setIsInitialLoadingComplete(true);
      return;
    }
    if (savedContacts.length > 0) {
      hasLoadedInitialContact.current = true;
      setIsInitialLoadingComplete(true);
      return;
    }

    const loadInitialContact = async () => {
      if (!draftClientId) {
        // Try to get clientId from URL or other source
        // For now, skip if no draftClientId
        hasLoadedInitialContact.current = true;
        setIsInitialLoadingComplete(true);
        return;
      }

      try {
        const response = await fetch(`/api/clients/${draftClientId}`);
        if (!response.ok) {
          console.warn(
            "[Step3b] Failed to fetch client data:",
            response.status,
          );
          hasLoadedInitialContact.current = true;
          setIsInitialLoadingComplete(true);
          return;
        }

        const result = await response.json();
        if (!result.success || !result.data) {
          console.warn("[Step3b] No client data found");
          hasLoadedInitialContact.current = true;
          setIsInitialLoadingComplete(true);
          return;
        }

        const clientData = result.data;

        // Check if client has keyContacts
        let contactsFromApi: any[] = [];
        if (clientData.keyContacts) {
          // Handle different formats
          if (Array.isArray(clientData.keyContacts)) {
            contactsFromApi = clientData.keyContacts;
          } else if (
            typeof clientData.keyContacts === "object" &&
            clientData.keyContacts !== null &&
            Array.isArray(clientData.keyContacts.contacts)
          ) {
            contactsFromApi = clientData.keyContacts.contacts;
          } else if (typeof clientData.keyContacts === "string") {
            try {
              const parsed = JSON.parse(clientData.keyContacts);
              if (Array.isArray(parsed)) {
                contactsFromApi = parsed;
              } else if (parsed.contacts && Array.isArray(parsed.contacts)) {
                contactsFromApi = parsed.contacts;
              }
            } catch (e) {
              console.warn("[Step3b] Failed to parse keyContacts string:", e);
            }
          }
        }

        if (contactsFromApi.length > 0) {
          // Map API contacts to KeyContact format
          const mappedContacts: KeyContact[] = contactsFromApi.map(
            (contact: any, index: number) => {
              // Determine contact type
              const contactType: ContactType =
                contact.contactType ||
                (contact.firstName || contact.lastName
                  ? "individual"
                  : "team_support");

              // Map benefits category
              let benefitsCategories: BenefitsCategory[] = [
                "Company / Plan Sponsor",
              ];
              if (contact.benefitsCategory) {
                benefitsCategories = [contact.benefitsCategory];
              } else if (
                contact.benefitsCategories &&
                Array.isArray(contact.benefitsCategories)
              ) {
                benefitsCategories = contact.benefitsCategories;
              }

              const mappedContact: KeyContact = {
                id:
                  contact.id ||
                  `contact-${Date.now()}-${index}-${Math.random()}`,
                contactType,
                benefitsCategories,
                benefitsCategory:
                  benefitsCategories[0] || "Company / Plan Sponsor",
                firstName:
                  contactType === "individual"
                    ? contact.firstName || contact.name?.split(" ")[0] || ""
                    : undefined,
                lastName:
                  contactType === "individual"
                    ? contact.lastName ||
                      contact.name?.split(" ").slice(1).join(" ") ||
                      ""
                    : undefined,
                displayName:
                  contactType === "team_support"
                    ? contact.displayName || contact.name || ""
                    : undefined,
                title: contact.title || "",
                email: contact.email || "",
                phone: contact.phone || "",
                phoneExtension: contact.phoneExtension || "",
                companyName:
                  contact.companyName ||
                  clientData.companyName ||
                  defaultCompanyName,
                companyLogo:
                  contact.companyLogo || clientData.companyLogo || "",
                headshot: contact.headshot || "",
                headshotFileName: contact.headshotFileName || "",
                headshotAssetId: contact.headshotAssetId,
                teamImage: contact.teamImage || "",
                teamImageFileName: contact.teamImageFileName || "",
                teamImageAssetId: contact.teamImageAssetId,
                websiteUrl: contact.websiteUrl || contact.contactUrl || "",
                schedulingUrl: contact.schedulingUrl || "",
                name:
                  contact.name ||
                  (contactType === "individual"
                    ? `${contact.firstName || ""} ${
                        contact.lastName || ""
                      }`.trim()
                    : contact.displayName) ||
                  "New Contact",
                showOnPortal:
                  contact.showOnPortal !== undefined
                    ? contact.showOnPortal
                    : true,
                isPrimary: contact.isPrimary || false,
                displayScope: contact.displayScope || "thisPortal",
                isPrimaryByCategory: contact.isPrimaryByCategory,
                isPrimaryOverall:
                  contact.isPrimaryOverall || contact.isPrimary || false,
                displayEmail:
                  contact.displayEmail !== undefined
                    ? contact.displayEmail
                    : true,
                displayPhone:
                  contact.displayPhone !== undefined
                    ? contact.displayPhone
                    : true,
                displayUrl:
                  contact.displayUrl !== undefined ? contact.displayUrl : false,
                displayScheduleAppointment:
                  contact.displayScheduleAppointment !== undefined
                    ? contact.displayScheduleAppointment
                    : false,
                contactInfoOrder:
                  contact.contactInfoOrder ||
                  (contact.actionButtonOrder
                    ? splitOldOrder(contact.actionButtonOrder as string[])
                        .contactInfoOrder
                    : ["phone", "email"]),
                actionButtonOrder:
                  contact.actionButtonOrder ||
                  (contact.actionButtonOrder
                    ? splitOldOrder(contact.actionButtonOrder as string[])
                        .actionButtonOrder
                    : ["schedule", "website"]),
                enableContactButton:
                  contact.enableContactButton !== undefined
                    ? contact.enableContactButton
                    : true,
                cardBackgroundColor: contact.cardBackgroundColor,
                logoScale: contact.logoScale,
              };

              return mappedContact;
            },
          );

          // Save contacts to store
          const updatedKeyContacts = {
            ...keyContactsData,
            contacts: mappedContacts,
          };

          await saveStepDataLocally("keyContacts", updatedKeyContacts);
        }

        hasLoadedInitialContact.current = true;
        setIsInitialLoadingComplete(true);
      } catch (error) {
        console.error(
          "[Step3b] Error loading initial contact from API:",
          error,
        );
        hasLoadedInitialContact.current = true;
        setIsInitialLoadingComplete(true);
      }
    };

    loadInitialContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftClientId, savedContacts.length]);

  // Handle primary contact change with confirmation
  const handlePrimaryChange = (checked: boolean) => {
    // Get fresh data from store
    const freshKeyContactsData = stepData.keyContacts || { contacts: [] };
    const freshSavedContacts = freshKeyContactsData.contacts || [];

    if (!freshSavedContacts.length || !selectedContactId) return;

    const selectedContact = freshSavedContacts.find(
      (c: KeyContact) => c.id === selectedContactId,
    );
    if (!selectedContact) return;

    // Get the benefits categories for the selected contact
    const selectedCategories = selectedContact.benefitsCategories || [];

    // Check if there's already a primary contact with the SAME benefits category (excluding current one)
    const hasExistingPrimaryInSameCategory = freshSavedContacts.some(
      (contact: KeyContact) => {
        if (contact.id === selectedContactId) return false;
        if (!(contact.isPrimaryOverall || contact.isPrimary)) return false;

        // Check if contacts share any benefits category
        const contactCategories = contact.benefitsCategories || [];
        return selectedCategories.some((cat) =>
          contactCategories.includes(cat),
        );
      },
    );

    // If setting to primary and there's already a primary contact in the same category, show confirmation
    if (checked && hasExistingPrimaryInSameCategory) {
      setPendingPrimaryChange(true);
      setShowSetPrimaryConfirm(true);
      return;
    }

    // If unsetting primary, show warning
    // Check both local state and actual contact state in store
    const contactIsPrimary =
      isPrimaryOverall ||
      selectedContact.isPrimaryOverall ||
      selectedContact.isPrimary ||
      false;
    if (!checked && contactIsPrimary) {
      setPendingPrimaryChange(false);
      setShowUnsetPrimaryWarning(true);
      return;
    }

    // No confirmation needed, apply change directly
    // If setting to primary, update store immediately to remove primary from others in the SAME category
    if (checked && selectedContactId) {
      // Check if this is an HR/People contact
      const isHRPeopleContact = selectedContact?.benefitsCategories?.includes(
        "Company / Plan Sponsor",
      );

      const updatedContacts = freshSavedContacts.map((contact: KeyContact) => {
        if (contact.id === selectedContactId) {
          return {
            ...contact,
            isPrimaryOverall: true,
            isPrimary: true,
          };
        } else {
          // Only remove primary from contacts that share the same benefits category
          const contactCategories = contact.benefitsCategories || [];
          const sharesCategory = selectedCategories.some((cat) =>
            contactCategories.includes(cat),
          );

          if (sharesCategory) {
            return {
              ...contact,
              isPrimaryOverall: false,
              isPrimary: false,
            };
          }
          // Keep other contacts' primary status if they have different categories
          return contact;
        }
      });

      // Sort contacts: Primary contacts for each category should come first
      const sortedContacts = [...updatedContacts].sort((a, b) => {
        const aIsPrimary = a.isPrimaryOverall || a.isPrimary || false;
        const bIsPrimary = b.isPrimaryOverall || b.isPrimary || false;

        if (aIsPrimary && !bIsPrimary) return -1;
        if (!aIsPrimary && bIsPrimary) return 1;

        return 0;
      });

      const updatedKeyContacts = {
        ...freshKeyContactsData,
        contacts: sortedContacts,
        contactDisplayOrder: sortedContacts.map((c: KeyContact) => c.id),
      };

      saveStepDataLocally("keyContacts", updatedKeyContacts);

      // If this is an HR/People contact, also update step3a.isPrimaryForHRPeople
      if (isHRPeopleContact) {
        const step3aData = ((stepData as any).step3a as Step3aData) || {};
        saveStepDataLocally("step3a", {
          ...step3aData,
          isPrimaryForHRPeople: true,
        });
      }
    } else if (!checked && selectedContactId) {
      // If unsetting primary, also update step3a for HR/People contacts
      const isHRPeopleContact = selectedContact?.benefitsCategories?.includes(
        "Company / Plan Sponsor",
      );

      if (isHRPeopleContact) {
        const step3aData = ((stepData as any).step3a as Step3aData) || {};
        saveStepDataLocally("step3a", {
          ...step3aData,
          isPrimaryForHRPeople: false,
        });
      }
    }

    setIsPrimaryOverall(checked);
  };

  // Confirm setting primary contact
  const confirmSetPrimary = () => {
    setShowSetPrimaryConfirm(false);
    setPendingPrimaryChange(null);

    // Get fresh data from store
    const freshKeyContactsData = stepData.keyContacts || { contacts: [] };
    const freshSavedContacts = freshKeyContactsData.contacts || [];

    if (selectedContactId) {
      const selectedContact = freshSavedContacts.find(
        (c: KeyContact) => c.id === selectedContactId,
      );

      if (!selectedContact) return;

      // Get the benefits categories for the selected contact
      const selectedCategories = selectedContact.benefitsCategories || [];

      // Check if this is an HR/People contact
      const isHRPeopleContact = selectedContact?.benefitsCategories?.includes(
        "Company / Plan Sponsor",
      );

      // Update contacts: set selected as primary, remove primary from others in the SAME category
      const updatedContacts = freshSavedContacts.map((contact: KeyContact) => {
        if (contact.id === selectedContactId) {
          return {
            ...contact,
            isPrimaryOverall: true,
            isPrimary: true,
          };
        } else {
          // Only remove primary from contacts that share the same benefits category
          const contactCategories = contact.benefitsCategories || [];
          const sharesCategory = selectedCategories.some((cat) =>
            contactCategories.includes(cat),
          );

          if (sharesCategory) {
            return {
              ...contact,
              isPrimaryOverall: false,
              isPrimary: false,
            };
          }
          // Keep other contacts' primary status if they have different categories
          return contact;
        }
      });

      // Sort contacts: Primary contacts for each category should come first
      // We'll move the newly selected primary contact to the top of its category
      const sortedContacts = [...updatedContacts].sort((a, b) => {
        const aIsPrimary = a.isPrimaryOverall || a.isPrimary || false;
        const bIsPrimary = b.isPrimaryOverall || b.isPrimary || false;

        // If one is primary and other isn't, primary comes first
        if (aIsPrimary && !bIsPrimary) return -1;
        if (!aIsPrimary && bIsPrimary) return 1;

        return 0;
      });

      const updatedKeyContacts = {
        ...freshKeyContactsData,
        contacts: sortedContacts,
        contactDisplayOrder: sortedContacts.map((c: KeyContact) => c.id),
      };

      saveStepDataLocally("keyContacts", updatedKeyContacts);

      // If this is an HR/People contact, also update step3a.isPrimaryForHRPeople
      if (isHRPeopleContact) {
        const step3aData = ((stepData as any).step3a as Step3aData) || {};
        saveStepDataLocally("step3a", {
          ...step3aData,
          isPrimaryForHRPeople: true,
        });
      }

      setIsPrimaryOverall(true);
    }
  };

  // Confirm unsetting primary contact
  const confirmUnsetPrimary = () => {
    setShowUnsetPrimaryWarning(false);
    setPendingPrimaryChange(null);

    // Get fresh data from store
    const freshKeyContactsData = stepData.keyContacts || { contacts: [] };
    const freshSavedContacts = freshKeyContactsData.contacts || [];

    if (!selectedContactId) return;

    const selectedContact = freshSavedContacts.find(
      (c: KeyContact) => c.id === selectedContactId,
    );
    if (!selectedContact) return;

    // Check if this is an HR/People contact
    const isHRPeopleContact = selectedContact.benefitsCategories?.includes(
      "Company / Plan Sponsor",
    );

    // Update the selected contact to remove primary status
    const updatedContacts = freshSavedContacts.map((contact: KeyContact) => {
      if (contact.id === selectedContactId) {
        return {
          ...contact,
          isPrimaryOverall: false,
          isPrimary: false,
        };
      }
      return contact;
    });

    const updatedKeyContacts = {
      ...freshKeyContactsData,
      contacts: updatedContacts,
    };

    // Save changes immediately
    saveStepDataLocally("keyContacts", updatedKeyContacts);

    // If this is an HR/People contact, also update step3a.isPrimaryForHRPeople
    if (isHRPeopleContact) {
      const step3aData = ((stepData as any).step3a as Step3aData) || {};
      saveStepDataLocally("step3a", {
        ...step3aData,
        isPrimaryForHRPeople: false,
      });
    }

    // Update form state
    setIsPrimaryOverall(false);
  };

  // Modal states for primary contact confirmation
  const [showSetPrimaryConfirm, setShowSetPrimaryConfirm] = useState(false);
  const [showUnsetPrimaryWarning, setShowUnsetPrimaryWarning] = useState(false);
  const [pendingPrimaryChange, setPendingPrimaryChange] = useState<
    boolean | null
  >(null);

  // When isPrimaryOverall is set to true, remove primary status from other contacts in the SAME category
  useEffect(() => {
    // Skip if there's a pending primary change (waiting for confirmation)
    if (pendingPrimaryChange !== null) return;

    if (isPrimaryOverall && selectedContactId) {
      // Get fresh data from store to avoid stale closures
      const freshKeyContactsData = stepData.keyContacts || { contacts: [] };
      const freshSavedContacts = freshKeyContactsData.contacts || [];

      // Check if the contact already has primary status in store
      const selectedContact = freshSavedContacts.find(
        (c: KeyContact) => c.id === selectedContactId,
      );

      if (!selectedContact) return;

      // Get the benefits categories for the selected contact
      const selectedCategories = selectedContact.benefitsCategories || [];

      // Only update if the contact doesn't already have primary status
      if (
        selectedContact &&
        !selectedContact.isPrimaryOverall &&
        !selectedContact.isPrimary
      ) {
        const updatedContacts = freshSavedContacts.map(
          (contact: KeyContact) => {
            if (contact.id === selectedContactId) {
              // Update this contact to be primary
              return {
                ...contact,
                isPrimaryOverall: true,
                isPrimary: true, // Also set legacy isPrimary
              };
            } else {
              // Only remove primary from contacts that share the same benefits category
              const contactCategories = contact.benefitsCategories || [];
              const sharesCategory = selectedCategories.some((cat) =>
                contactCategories.includes(cat),
              );

              if (sharesCategory) {
                return {
                  ...contact,
                  isPrimaryOverall: false,
                  isPrimary: false, // Also clear legacy isPrimary
                };
              }
              // Keep other contacts' primary status if they have different categories
              return contact;
            }
          },
        );

        const hasChanges = updatedContacts.some(
          (contact: KeyContact, index: number) => {
            const original = freshSavedContacts[index];
            return (
              (contact.isPrimaryOverall || false) !==
                (original.isPrimaryOverall || false) ||
              (contact.isPrimary || false) !== (original.isPrimary || false)
            );
          },
        );

        if (hasChanges) {
          // Sort contacts: Primary contacts come first
          const sortedContacts = [...updatedContacts].sort((a, b) => {
            const aIsPrimary = a.isPrimaryOverall || a.isPrimary || false;
            const bIsPrimary = b.isPrimaryOverall || b.isPrimary || false;
            if (aIsPrimary && !bIsPrimary) return -1;
            if (!aIsPrimary && bIsPrimary) return 1;
            return 0;
          });

          const updatedKeyContacts = {
            ...freshKeyContactsData,
            contacts: sortedContacts,
            contactDisplayOrder: sortedContacts.map((c: KeyContact) => c.id),
          };

          saveStepDataLocally("keyContacts", updatedKeyContacts);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPrimaryOverall,
    selectedContactId,
    stepData.keyContacts,
    pendingPrimaryChange,
  ]); // Include pendingPrimaryChange to skip during confirmation

  // Modal state for adding new contact
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [modalBenefitsCategory, setModalBenefitsCategory] =
    useState<BenefitsCategory>("Retirement");

  /** Reset the step 3b form when the selected contact was removed (list or side editor). */
  const clearStep3bFormAfterContactRemoved = useCallback(() => {
    setSelectedContactId("");
    setContactType("individual");
    setBenefitsCategories(
      normalizeBenefitsCategories(["Company / Plan Sponsor"]),
    );
    setFirstName("");
    setLastName("");
    setTitle("");
    setDisplayName("");
    setDepartmentLabel("");
    setSupportHours("");
    setEmail("");
    setPhone("");
    setPhoneExtension("");
    setCompanyName("");
    setWebsiteUrl("");
    setSchedulingUrl("");
    setWebsiteUrlError("");
    setSchedulingUrlError("");
    setHeadshot("");
    setHeadshotFileName("");
    setHeadshotAssetId(undefined);
    setTeamImage("");
    setTeamImageFileName("");
    setTeamImageAssetId(undefined);
    setCompanyLogo("");
    setCompanyLogoAssetId(undefined);
    setIsPrimaryByCategory({} as Record<BenefitsCategory, boolean>);
    setIsPrimaryOverall(false);
    setOtherBenefitsText("");
  }, [normalizeBenefitsCategories]);

  // Side editor (ContactSectionEditor) can delete contacts; keep form in sync with store
  useEffect(() => {
    if (!selectedContactId) return;
    if (savedContacts.some((c: KeyContact) => c.id === selectedContactId)) {
      return;
    }
    clearStep3bFormAfterContactRemoved();
  }, [savedContacts, selectedContactId, clearStep3bFormAfterContactRemoved]);

  // Function to delete a contact
  const handleDeleteContact = (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the contact when clicking delete

    const updatedContacts = savedContacts.filter(
      (c: KeyContact) => c.id !== contactId,
    );
    const prevOrder = (keyContactsData as { contactDisplayOrder?: string[] })
      .contactDisplayOrder;
    const nextOrder = Array.isArray(prevOrder)
      ? prevOrder.filter((id: string) => id !== contactId)
      : updatedContacts.map((c: KeyContact) => c.id);
    const updatedKeyContacts = {
      ...keyContactsData,
      contacts: updatedContacts,
      contactDisplayOrder: nextOrder,
    };

    saveStepDataLocally("keyContacts", updatedKeyContacts);

    // If deleted contact was selected, clear selection
    if (selectedContactId === contactId) {
      clearStep3bFormAfterContactRemoved();
    }
  };

  // Function to select a saved contact and populate form
  const handleSelectContact = (contact: KeyContact) => {
    isUpdatingRef.current = true;
    isCreatingNewContactRef.current = false;

    const freshKeyContactsData = stepData.keyContacts || { contacts: [] };
    const freshSavedContacts = freshKeyContactsData.contacts || [];
    const freshContact =
      freshSavedContacts.find((c: KeyContact) => c.id === contact.id) ||
      contact;

    setSelectedContactId(freshContact.id);
    setContactType(freshContact.contactType || "individual");
    setBenefitsCategories(
      normalizeBenefitsCategories(freshContact.benefitsCategories),
    );

    if (freshContact.contactType === "individual") {
      setFirstName(freshContact.firstName || "");
      setLastName(freshContact.lastName || "");
      setTitle(freshContact.title || "");
      setDisplayName("");
    } else {
      setDisplayName(freshContact.displayName || "");
      setDepartmentLabel(freshContact.departmentLabel || "");
      setSupportHours(freshContact.supportHours || "");
      setFirstName("");
      setLastName("");
      setTitle("");
    }

    setEmail(freshContact.email || "");
    setPhone(freshContact.phone || "");
    setPhoneExtension(freshContact.phoneExtension || "");

    // Set contact card action buttons
    setDisplayEmail(
      freshContact.displayEmail !== undefined
        ? freshContact.displayEmail
        : true,
    );
    const contactDisplayPhone =
      freshContact.displayPhone !== undefined
        ? freshContact.displayPhone
        : true;
    const contactDisplayScheduleAppointment =
      freshContact.displayScheduleAppointment !== undefined
        ? freshContact.displayScheduleAppointment
        : false;
    const contactDisplayWebsite =
      freshContact.displayUrl !== undefined ? freshContact.displayUrl : false;

    setDisplayPhone(contactDisplayPhone);
    setDisplayScheduleAppointment(contactDisplayScheduleAppointment);
    setDisplayWebsite(contactDisplayWebsite);

    // Load contact info and action button orders
    const hasNewOrderFormat =
      freshContact.contactInfoOrder && freshContact.actionButtonOrder;
    const contactOldOrder = freshContact.actionButtonOrder as
      | string[]
      | undefined;

    const {
      contactInfoOrder: contactInitialInfoOrder,
      actionButtonOrder: contactInitialActionButtonOrder,
    } = hasNewOrderFormat
      ? {
          contactInfoOrder: freshContact.contactInfoOrder || ["phone", "email"],
          actionButtonOrder: freshContact.actionButtonOrder || [
            "schedule",
            "website",
          ],
        }
      : contactOldOrder
      ? splitOldOrder(contactOldOrder)
      : {
          contactInfoOrder: ["phone", "email"],
          actionButtonOrder: ["schedule", "website"],
        };

    setContactInfoOrder(contactInitialInfoOrder as ContactInfoType[]);
    setActionButtonOrder(contactInitialActionButtonOrder as ActionButtonType[]);

    // Set company name based on category
    const contactIsHRPeople = freshContact.benefitsCategories?.includes(
      "Company / Plan Sponsor",
    );
    if (contactIsHRPeople) {
      // For HR/People contacts, use contact's company name or default from plan
      setCompanyName(freshContact.companyName || defaultCompanyName || "");
    } else {
      // For other categories, use contact's company name if exists,
      // otherwise auto-fill from advisor onboarding if advisor offers this benefit
      const contactCategory = freshContact.benefitsCategories?.[0];
      if (freshContact.companyName) {
        // Contact already has company name, use it
        setCompanyName(freshContact.companyName);
      } else {
        // For non-Plan Sponsor categories, don't auto-fill from advisor
        setCompanyName("");
      }
    }

    const contactWebsiteUrl = freshContact.websiteUrl || "";
    const contactSchedulingUrl = freshContact.schedulingUrl || "";
    setWebsiteUrl(contactWebsiteUrl);
    setSchedulingUrl(contactSchedulingUrl);
    // Validate URLs when loading contact
    if (contactWebsiteUrl.trim() !== "" && !isValidUrl(contactWebsiteUrl)) {
      setWebsiteUrlError(
        "Please enter a valid URL (e.g., https://example.com)",
      );
    } else {
      setWebsiteUrlError("");
    }
    if (
      contactSchedulingUrl.trim() !== "" &&
      !isValidUrl(contactSchedulingUrl)
    ) {
      setSchedulingUrlError(
        "Please enter a valid URL (e.g., https://calendar.example.com)",
      );
    } else {
      setSchedulingUrlError("");
    }
    setHeadshot(freshContact.headshot || "");
    setHeadshotFileName(freshContact.headshotFileName || "");
    setHeadshotAssetId(freshContact.headshotAssetId);
    setTeamImage(freshContact.teamImage || "");
    setTeamImageFileName(freshContact.teamImageFileName || "");
    setTeamImageAssetId(freshContact.teamImageAssetId);

    // Set company logo based on category
    if (contactIsHRPeople) {
      // For HR/People contacts, use contact's logo or default from plan
      const contactCompanyLogo =
        freshContact.companyLogo ||
        stepData?.companyBasics?.companyLogo?.url ||
        "";
      setCompanyLogo(contactCompanyLogo);
    } else {
      // For other categories, use contact's logo if exists and it's not plan data,
      // otherwise auto-fill from advisor onboarding if advisor offers this benefit
      const contactCategory = freshContact.benefitsCategories?.[0];
      if (
        freshContact.companyLogo &&
        freshContact.companyLogo !== defaultCompanyLogo
      ) {
        // Contact already has logo (and it's not plan data), use it
        setCompanyLogo(freshContact.companyLogo);
      } else {
        // For non-Plan Sponsor categories, don't auto-fill from advisor
        setCompanyLogo("");
      }
    }
    setCompanyLogoAssetId(freshContact.companyLogoAssetId);
    setIsPrimaryByCategory(
      freshContact.isPrimaryByCategory ||
        ({} as Record<BenefitsCategory, boolean>),
    );

    // Sync isPrimaryOverall with step3a.isPrimaryForHRPeople for HR/People contacts
    // BUT: If there are already contacts, don't set primary (only one primary for all cards)

    // Sync isPrimaryOverall with step3a.isPrimaryForHRPeople for HR/People contacts
    const contactIsHRPeopleForPrimary =
      freshContact.benefitsCategories?.includes("Company / Plan Sponsor");
    if (contactIsHRPeopleForPrimary) {
      const step3aData = ((stepData as any).step3a as Step3aData) || {};
      const step3aPrimary = step3aData.isPrimaryForHRPeople ?? false;
      // Only set primary if there are no existing contacts OR if contact already has primary
      // This prevents automatically setting primary for new contacts when others exist
      const hasExistingContacts = freshSavedContacts.length > 1; // More than just this contact
      const shouldSetPrimary = hasExistingContacts
        ? freshContact.isPrimaryOverall || freshContact.isPrimary || false
        : step3aPrimary || freshContact.isPrimaryOverall || false;
      setIsPrimaryOverall(shouldSetPrimary);
    } else {
      setIsPrimaryOverall(freshContact.isPrimaryOverall || false);
    }

    // Set other benefits text if available
    setOtherBenefitsText(
      freshContact.benefitsCategoryOther ||
        (freshContact as any).otherBenefitsText ||
        "",
    );

    setIndividualCardBackgroundColor(freshContact.cardBackgroundColor);
    setIndividualLogoScale(freshContact.logoScale);

    // Allow updates after a short delay
    setTimeout(() => {
      isUpdatingRef.current = false;
      setContactLoadBaselineEpoch((e) => e + 1);
    }, 100);

    // Re-baseline preview fingerprint after load so the "edit → Preview" effect does not fire on programmatic fill
    contactsTabBaselineFingerprintRef.current = null;

    if (suppressPreviewAfterSelectContactRef.current) {
      suppressPreviewAfterSelectContactRef.current = false;
    } else {
      setActiveTab("preview");
    }
  };

  // Function to save current contact (used when onNext is called from step-3c)
  const handleSaveContact = useCallback(async () => {
    if (!isConfirmedRef.current) {
      return false;
    }

    // Check minimum data required to create/update a contact
    const hasMinimumData =
      benefitsCategories.length > 0 &&
      ((contactType === "individual" &&
        (firstName.trim() || lastName.trim())) ||
        (contactType === "team_support" && displayName.trim()) ||
        email.trim() ||
        phone.trim() ||
        phoneExtension.trim());

    if (!hasMinimumData) {
      return false;
    }

    // Ensure at least one contact action is selected
    const hasAtLeastOneAction =
      displayEmail ||
      displayPhone ||
      displayScheduleAppointment ||
      displayWebsite;

    if (!hasAtLeastOneAction) {
      setActionsError("You must select one contact action");
      return false;
    }

    // Get fresh contacts from store (avoid stale closure)
    const latestStepData = useNewClientWizardStore.getState().stepData;
    const freshKeyContactsData = latestStepData.keyContacts || { contacts: [] };
    const freshSavedContacts = freshKeyContactsData.contacts || [];

    if (!duplicateSaveAnywayRef.current) {
      const myCats = normalizeBenefitsCategories(benefitsCategories);
      const dup = freshSavedContacts.find(
        (c: KeyContact) =>
          Boolean(c.id) &&
          c.id !== selectedContactId &&
          benefitsCategoriesOverlap(myCats, c.benefitsCategories) &&
          contactFirstNameMatchesForm(contactType, firstName, displayName, c),
      );
      if (dup) {
        const label =
          dup.name?.trim() ||
          `${dup.firstName || ""} ${dup.lastName || ""}`.trim() ||
          dup.email ||
          "This contact";
        duplicateDialogSkipValidationRef.current = true;
        setDuplicateContactDialog({ open: true, existingLabel: label });
        return false;
      }
    }

    if (selectedContactId && selectedContactId !== "new") {
      // Contact is already being tracked, but we need to ensure it's saved now
      // Re-use logic to find contact and update it
      const contactIndex = freshSavedContacts.findIndex(
        (c: KeyContact) => c.id === selectedContactId,
      );

      if (contactIndex === -1) return false;

      const currentContact = freshSavedContacts[contactIndex];

      const updatedContact: KeyContact = {
        ...currentContact,
        contactType,
        benefitsCategories: normalizeBenefitsCategories(benefitsCategories),
        firstName: contactType === "individual" ? firstName : undefined,
        lastName: contactType === "individual" ? lastName : undefined,
        title: contactType === "individual" ? title : undefined,
        displayName: contactType === "team_support" ? displayName : undefined,
        departmentLabel:
          contactType === "team_support" ? departmentLabel : undefined,
        supportHours: contactType === "team_support" ? supportHours : undefined,
        email,
        phone,
        phoneExtension,
        companyName: companyName,
        websiteUrl,
        schedulingUrl,
        name:
          contactType === "individual"
            ? `${firstName} ${lastName}`.trim()
            : displayName,
        headshot: headshot || undefined,
        headshotFileName: headshotFileName || undefined,
        headshotAssetId: headshotAssetId,
        teamImage: teamImage || undefined,
        teamImageFileName: teamImageFileName || undefined,
        teamImageAssetId: teamImageAssetId,
        companyLogo: companyLogo || undefined,
        companyLogoAssetId: companyLogoAssetId,
        isPrimaryByCategory:
          Object.keys(isPrimaryByCategory).length > 0
            ? isPrimaryByCategory
            : currentContact.isPrimaryByCategory,
        isPrimaryOverall:
          isPrimaryOverall ?? currentContact.isPrimaryOverall ?? undefined,
        displayEmail: displayEmail || undefined,
        displayPhone: displayPhone || undefined,
        displayUrl: displayWebsite || undefined,
        displayScheduleAppointment: displayScheduleAppointment || undefined,
        contactInfoOrder: contactInfoOrder,
        actionButtonOrder: actionButtonOrder,
        benefitsCategory:
          normalizeBenefitsCategories(benefitsCategories)[0] ||
          "Company / Plan Sponsor",
        benefitsCategoryOther:
          benefitsCategories[0] === "Other Benefits" && otherBenefitsText
            ? otherBenefitsText
            : undefined,
        cardBackgroundColor: individualCardBackgroundColor,
        logoScale: individualLogoScale,
      } as KeyContact;

      const updatedContacts = [...freshSavedContacts];
      updatedContacts[contactIndex] = updatedContact;

      const updatedKeyContacts = {
        ...freshKeyContactsData,
        contacts: updatedContacts,
      };

      await saveStepDataLocally("keyContacts", updatedKeyContacts);
      prevStoreContactRef.current = JSON.stringify(updatedContact);
      isUpdatingRef.current = false;
      duplicateSaveAnywayRef.current = false;
      return true;
    } else {
      // Check if there's already a primary contact in the SAME benefits category
      const newContactCategories =
        normalizeBenefitsCategories(benefitsCategories);
      const hasExistingPrimaryInSameCategory = freshSavedContacts.some(
        (c: KeyContact) => {
          if (!(c.isPrimaryOverall || c.isPrimary)) return false;
          const contactCategories = c.benefitsCategories || [];
          // Check if contacts share any benefits category
          return newContactCategories.some((cat) =>
            contactCategories.includes(cat),
          );
        },
      );

      // Only set primary if there are no existing contacts with primary in the same category
      // If there's already a primary contact in the same category, don't set primary for new one
      const newContactIsPrimary = !hasExistingPrimaryInSameCategory;

      // Only remove primary status from other contacts in the SAME category if new contact is primary
      const updatedContactsWithoutPrimary = newContactIsPrimary
        ? freshSavedContacts.map((c: KeyContact) => {
            const contactCategories = c.benefitsCategories || [];
            const sharesCategory = newContactCategories.some((cat) =>
              contactCategories.includes(cat),
            );

            if (sharesCategory) {
              return {
                ...c,
                isPrimaryOverall: false,
                isPrimary: false, // Also clear legacy isPrimary
              };
            }
            // Keep other contacts' primary status if they have different categories
            return c;
          })
        : freshSavedContacts; // Keep existing contacts as is if new contact is not primary

      const newContact: KeyContact = {
        id: `contact-${Date.now()}-${Math.random()}`,
        contactType,
        benefitsCategories: normalizeBenefitsCategories(benefitsCategories),
        firstName: contactType === "individual" ? firstName : undefined,
        lastName: contactType === "individual" ? lastName : undefined,
        title: contactType === "individual" ? title : undefined,
        displayName: contactType === "team_support" ? displayName : undefined,
        departmentLabel:
          contactType === "team_support" ? departmentLabel : undefined,
        supportHours: contactType === "team_support" ? supportHours : undefined,
        email,
        phone,
        phoneExtension,
        companyName: companyName,
        websiteUrl,
        schedulingUrl,
        name:
          contactType === "individual"
            ? `${firstName} ${lastName}`.trim()
            : displayName,
        showOnPortal: true,
        enableContactButton: true,
        isPrimary: newContactIsPrimary,
        displayScope: "thisPortal",
        headshot: headshot || undefined,
        headshotFileName: headshotFileName || undefined,
        headshotAssetId: headshotAssetId,
        teamImage: teamImage || undefined,
        teamImageFileName: teamImageFileName || undefined,
        teamImageAssetId: teamImageAssetId,
        companyLogo: companyLogo || undefined,
        companyLogoAssetId: companyLogoAssetId,
        isPrimaryByCategory:
          Object.keys(isPrimaryByCategory).length > 0
            ? isPrimaryByCategory
            : newContactIsPrimary
            ? (() => {
                const map: Record<string, boolean> = {};
                newContactCategories.forEach((cat) => {
                  map[cat] = true;
                });
                return map as Record<BenefitsCategory, boolean>;
              })()
            : undefined,
        isPrimaryOverall: newContactIsPrimary,
        displayEmail: true,
        displayPhone: true,
        displayUrl: false,
        displayScheduleAppointment: false,
        contactInfoOrder: contactInfoOrder,
        actionButtonOrder: actionButtonOrder,
        benefitsCategory:
          normalizeBenefitsCategories(benefitsCategories)[0] ||
          "Company / Plan Sponsor",
        benefitsCategoryOther:
          benefitsCategories[0] === "Other Benefits" && otherBenefitsText
            ? otherBenefitsText
            : undefined,
        cardBackgroundColor: individualCardBackgroundColor,
        logoScale: individualLogoScale,
      } as KeyContact;

      const updatedContacts = [...updatedContactsWithoutPrimary, newContact];
      const updatedKeyContacts = {
        ...freshKeyContactsData,
        contacts: updatedContacts,
      };

      await saveStepDataLocally("keyContacts", updatedKeyContacts);

      // Clear isCreatingNew flag after successful creation
      const step3SubStepData = (stepData as any).step3SubStep || {};
      if (step3SubStepData.isCreatingNew) {
        saveStepDataLocally("step3SubStep", {
          ...step3SubStepData,
          isCreatingNew: false,
          selectedContactId: newContact.id,
        });
      }

      setSelectedContactId(newContact.id);
      setIsPrimaryOverall(newContactIsPrimary); // Update form state
      duplicateSaveAnywayRef.current = false;
      return true;
    }
  }, [
    email,
    benefitsCategories,
    contactType,
    firstName,
    lastName,
    title,
    displayName,
    departmentLabel,
    supportHours,
    phone,
    phoneExtension,
    companyName,
    websiteUrl,
    schedulingUrl,
    headshot,
    headshotFileName,
    headshotAssetId,
    teamImage,
    teamImageFileName,
    teamImageAssetId,
    companyLogo,
    companyLogoAssetId,
    isPrimaryByCategory,
    isPrimaryOverall,
    isInternalHR,
    defaultCompanyName,
    selectedContactId,
    stepData,
    saveStepDataLocally,
    normalizeBenefitsCategories,
    displayEmail,
    displayPhone,
    displayScheduleAppointment,
    displayWebsite,
    contactInfoOrder,
    actionButtonOrder,
    otherBenefitsText,
  ]);

  const confirmDuplicateSaveAnyway = useCallback(async () => {
    duplicateSaveAnywayRef.current = true;
    duplicateDialogSkipValidationRef.current = false;
    setDuplicateContactDialog({ open: false, existingLabel: "" });
    await handleSaveContact();
  }, [handleSaveContact]);

  // Expose handleSaveContact to parent component
  useEffect(() => {
    if (onSaveContact) {
      onSaveContact(handleSaveContact);
    }
  }, [handleSaveContact, onSaveContact]);

  // Build current step3b form payload (same shape as persistence useEffect) for flushing before validation
  const getCurrentStep3bPayload = useCallback(
    () => ({
      contactType,
      benefitsCategories,
      firstName: contactType === "individual" ? firstName : undefined,
      lastName: contactType === "individual" ? lastName : undefined,
      title: contactType === "individual" ? title : undefined,
      displayName: contactType === "team_support" ? displayName : undefined,
      departmentLabel:
        contactType === "team_support" ? departmentLabel : undefined,
      supportHours: contactType === "team_support" ? supportHours : undefined,
      email,
      phone,
      phoneExtension,
      companyName: companyName,
      websiteUrl,
      schedulingUrl,
      headshot,
      headshotFileName,
      headshotAssetId,
      companyLogo,
      companyLogoAssetId,
      isPrimaryByCategory,
      isPrimaryOverall,
      displayEmail,
      displayPhone,
      displayScheduleAppointment,
      displayWebsite,
      contactInfoOrder,
      actionButtonOrder,
      cardDisplayMode,
      otherBenefitsText:
        benefitsCategories[0] === "Other Benefits" ? otherBenefitsText : "",
      benefitsCategory: benefitsCategories[0] || "Company / Plan Sponsor",
      selectedContactId: selectedContactId ?? undefined,
    }),
    [
      contactType,
      benefitsCategories,
      firstName,
      lastName,
      title,
      displayName,
      departmentLabel,
      supportHours,
      email,
      phone,
      phoneExtension,
      companyName,
      websiteUrl,
      schedulingUrl,
      headshot,
      headshotFileName,
      headshotAssetId,
      companyLogo,
      companyLogoAssetId,
      isPrimaryByCategory,
      isPrimaryOverall,
      displayEmail,
      displayPhone,
      displayScheduleAppointment,
      displayWebsite,
      contactInfoOrder,
      actionButtonOrder,
      cardDisplayMode,
      otherBenefitsText,
      selectedContactId,
    ],
  );

  // Keep ref updated every render so wizard can flush latest form state before validation
  step3bPayloadRef.current = getCurrentStep3bPayload();

  // Expose flush so main wizard can sync form → store before validation (fixes intermittent auto-fill not recognized).
  // Also merges current form into keyContacts so validation sees auto-filled fields (firstName, lastName, email, phone).
  useEffect(() => {
    (window as any).__step3bFlushFormToStore = async () => {
      const payload = step3bPayloadRef.current;
      if (!payload) return;

      lastPersistedStep3bData.current = payload;
      await saveStepDataLocally("step3b", payload);

      const state = useNewClientWizardStore.getState();
      const stepDataAfter = state.stepData as any;
      const keyContactsData = stepDataAfter?.keyContacts || { contacts: [] };
      const contacts = keyContactsData.contacts || [];
      const step3SubStep = stepDataAfter?.step3SubStep || {};
      const selectedId =
        selectedContactIdRef.current ?? step3SubStep?.selectedContactId;
      const isCreatingNew = step3SubStep?.isCreatingNew === true;

      const cats =
        payload.benefitsCategories ??
        (payload.benefitsCategory
          ? [payload.benefitsCategory]
          : ["Company / Plan Sponsor"]);
      const benefitsCategoriesNorm = normalizeBenefitsCategories(cats);

      const mergedContactFields = (): Partial<KeyContact> => ({
        contactType: payload.contactType || "individual",
        benefitsCategories: benefitsCategoriesNorm,
        firstName:
          payload.contactType === "individual" ? payload.firstName : undefined,
        lastName:
          payload.contactType === "individual" ? payload.lastName : undefined,
        title: payload.contactType === "individual" ? payload.title : undefined,
        displayName:
          payload.contactType === "team_support"
            ? payload.displayName
            : undefined,
        departmentLabel:
          payload.contactType === "team_support"
            ? payload.departmentLabel
            : undefined,
        supportHours:
          payload.contactType === "team_support"
            ? payload.supportHours
            : undefined,
        email: payload.email ?? "",
        phone: payload.phone ?? "",
        phoneExtension: payload.phoneExtension,
        companyName: payload.companyName,
        websiteUrl: payload.websiteUrl,
        schedulingUrl: payload.schedulingUrl,
        name:
          payload.contactType === "individual"
            ? `${payload.firstName || ""} ${payload.lastName || ""}`.trim()
            : payload.displayName || "",
        headshot: payload.headshot,
        headshotFileName: payload.headshotFileName,
        headshotAssetId: payload.headshotAssetId,
        companyLogo: payload.companyLogo,
        companyLogoAssetId: payload.companyLogoAssetId,
        displayEmail: payload.displayEmail,
        displayPhone: payload.displayPhone,
        displayUrl: payload.displayWebsite,
        displayScheduleAppointment: payload.displayScheduleAppointment,
        contactInfoOrder: payload.contactInfoOrder,
        actionButtonOrder: payload.actionButtonOrder,
        benefitsCategory: benefitsCategoriesNorm[0] || "Company / Plan Sponsor",
        benefitsCategoryOther:
          payload.benefitsCategory === "Other Benefits" &&
          payload.otherBenefitsText
            ? payload.otherBenefitsText
            : undefined,
      });

      if (selectedId && selectedId !== "new") {
        const idx = contacts.findIndex((c: KeyContact) => c.id === selectedId);
        if (idx !== -1) {
          const currentContact = contacts[idx] as KeyContact;
          const updatedContact = {
            ...currentContact,
            ...mergedContactFields(),
          } as KeyContact;
          const updatedContacts = [...contacts];
          updatedContacts[idx] = updatedContact;
          await saveStepDataLocally("keyContacts", {
            ...keyContactsData,
            contacts: updatedContacts,
          });
        }
      }
      // When isCreatingNew we do not add a new contact here (would duplicate on second Continue).
      // Validation uses step3b form data for the current contact when on step3b.
    };
    return () => {
      delete (window as any).__step3bFlushFormToStore;
    };
  }, [saveStepDataLocally, normalizeBenefitsCategories]);

  // Function to handle Next button click
  const handleNext = async () => {
    const step3SubStepData = (stepData as any).step3SubStep || {};
    const isCreatingNew = step3SubStepData.isCreatingNew === true;

    // Flush current form state to step3b so validation sees latest values (fixes auto-fill not recognized intermittently)
    const step3bPayload = getCurrentStep3bPayload();
    lastPersistedStep3bData.current = step3bPayload;
    saveStepDataLocally("step3b", step3bPayload);

    // First, save current contact if it exists or if we are creating a new one
    if (selectedContactId || isCreatingNew) {
      const saved = await handleSaveContact();
      if (!saved) {
        if (duplicateDialogSkipValidationRef.current) {
          return;
        }
        // If save failed, trigger validation
        const { validateCurrentStepFields } =
          useNewClientWizardStore.getState();
        await validateCurrentStepFields();
        return;
      }
    }

    // Validate current step fields
    const { validateCurrentStepFields } = useNewClientWizardStore.getState();
    await validateCurrentStepFields();

    // Get fresh errorFields after validation
    const freshErrorFields = useNewClientWizardStore.getState().errorFields;

    // If there are validation errors, don't proceed
    if (freshErrorFields && freshErrorFields.length > 0) {
      // Validation failed, errors are already set in store
      return;
    }
    if (onNext) {
      onNext();
    }
  };

  // Function to open add contact modal with validation
  const handleAddEmptyContact = async () => {
    const step3SubStepData = (stepData as any).step3SubStep || {};
    const isCreatingNew = step3SubStepData.isCreatingNew === true;

    // Flush current form state to step3b so validation sees latest values
    const step3bPayloadAdd = getCurrentStep3bPayload();
    lastPersistedStep3bData.current = step3bPayloadAdd;
    saveStepDataLocally("step3b", step3bPayloadAdd);

    // First, save current contact if it exists or if we are creating a new one
    if (selectedContactId || isCreatingNew) {
      const saved = await handleSaveContact();
      if (!saved) {
        if (duplicateDialogSkipValidationRef.current) {
          return;
        }
        // If save failed, trigger validation
        const { validateCurrentStepFields } =
          useNewClientWizardStore.getState();
        await validateCurrentStepFields();
        return;
      }
    }

    // Validate current step fields (same as Next button)
    const { validateCurrentStepFields, errorFields: storeErrorFields } =
      useNewClientWizardStore.getState();
    await validateCurrentStepFields();

    // Get fresh errorFields after validation
    const freshErrorFields = useNewClientWizardStore.getState().errorFields;

    // If there are validation errors, don't proceed
    if (freshErrorFields && freshErrorFields.length > 0) {
      // Validation failed, errors are already set in store
      return;
    }
    if (onNext) {
      onNext();
    }
  };

  const handleSaveAndAddAnother = async () => {
    // Flush current form state to step3b so validation sees latest values
    const step3bPayloadSave = getCurrentStep3bPayload();
    lastPersistedStep3bData.current = step3bPayloadSave;
    saveStepDataLocally("step3b", step3bPayloadSave);

    // Validate current step fields
    const { validateCurrentStepFields } = useNewClientWizardStore.getState();
    await validateCurrentStepFields();

    // Get fresh errorFields after validation
    const freshErrorFields = useNewClientWizardStore.getState().errorFields;

    // If there are validation errors, don't proceed and switch to contacts tab
    if (freshErrorFields && freshErrorFields.length > 0) {
      setActiveTab("contacts");
      return;
    }

    const saved = await handleSaveContact();
    if (!saved && duplicateDialogSkipValidationRef.current) {
      return;
    }
    if (saved) {
      // Allow auto-selection of the newly saved contact
      isCreatingNewContactRef.current = false;
      setIsAddContactModalOpen(true);
    }
  };

  // Function to create contact with selected type and category
  const handleCreateContactFromModal = (selectedContact?: any) => {
    // console.log("DEBUG: handleCreateContactFromModal CALLED");

    // IMPORTANT: Use the selected modalBenefitsCategory, not defaultBenefitsCategory

    const selectedCategory = modalBenefitsCategory;
    const isCompanyPlanSponsor = selectedCategory === "Company / Plan Sponsor";

    // Set flag to prevent auto-selection of other contacts while we're setting up this new one
    // Set the contact type and category
    setContactType("individual");
    setBenefitsCategories(normalizeBenefitsCategories([selectedCategory])); // Update category immediately

    // Set a temporary ID to prevent auto-selection logic from triggering
    // (since auto-select only runs when selectedContactId is falsy)
    // console.log("DEBUG: Setting ID to NEW");
    setSelectedContactId("new");

    // Determine company name & logo based on category
    let contactCompanyName = "";
    let contactCompanyLogo = "";

    if (selectedCategory === "Company / Plan Sponsor") {
      // Use default company name & logo for Company / Plan Sponsor category
      contactCompanyName = defaultCompanyName;
      contactCompanyLogo =
        companyLogo || stepData?.companyBasics?.companyLogo?.url || "";
    }
    // For non-Plan Sponsor categories, leave company name & logo empty
    // console.log("DEBUG: Calculated Company Name:", contactCompanyName);

    // Update local state so preview and form reflect selection

    setCompanyName(contactCompanyName);
    setCompanyLogo(contactCompanyLogo);
    setCompanyLogoAssetId(undefined);

    // Reset all other contact fields to ensure clean state
    setFirstName("");
    setLastName("");
    setTitle("");
    setDisplayName("");
    setDepartmentLabel("");
    setSupportHours("");
    setEmail("");
    setPhone("");
    setPhoneExtension("");
    setWebsiteUrl("");
    setSchedulingUrl("");
    setHeadshot("");
    setHeadshotFileName("");
    setHeadshotAssetId(undefined);
    setTeamImage("");
    setTeamImageFileName("");
    setTeamImageAssetId(undefined);
    setOtherBenefitsText("");

    // Reset action displays to defaults
    setDisplayEmail(true);
    setDisplayPhone(true);
    setDisplayScheduleAppointment(false);
    setDisplayWebsite(false);

    // Default to individual contact type
    const defaultContactType: ContactType = "individual";

    // Check if there's already a primary contact in the SAME benefits category
    const newContactCategories = [selectedCategory];
    const hasExistingPrimaryInSameCategory = savedContacts.some(
      (c: KeyContact) => {
        if (!(c.isPrimaryOverall || c.isPrimary)) return false;
        const contactCategories = c.benefitsCategories || [];
        // Check if contacts share any benefits category
        return newContactCategories.some((cat) =>
          contactCategories.includes(cat),
        );
      },
    );

    // Only set primary if there are no existing contacts with primary in the same category
    // If there's already a primary contact in the same category, don't set primary for new one
    const newContactIsPrimary = !hasExistingPrimaryInSameCategory;

    // Only remove primary status from other contacts in the SAME category if new contact is primary
    const updatedContactsWithoutPrimary = newContactIsPrimary
      ? savedContacts.map((c: KeyContact) => {
          const contactCategories = c.benefitsCategories || [];
          const sharesCategory = newContactCategories.some((cat) =>
            contactCategories.includes(cat),
          );

          if (sharesCategory) {
            return {
              ...c,
              isPrimaryOverall: false,
              isPrimary: false, // Also clear legacy isPrimary
            };
          }
          // Keep other contacts' primary status if they have different categories
          return c;
        })
      : savedContacts; // Keep existing contacts as is if new contact is not primary

    const newContact: KeyContact = {
      id: `contact-${Date.now()}-${Math.random()}`,
      contactType: defaultContactType,
      benefitsCategories: [selectedCategory],
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName: contactCompanyName,
      companyLogo: contactCompanyLogo || undefined,
      companyLogoAssetId: undefined,
      name: "",
      showOnPortal: true,
      isPrimary: newContactIsPrimary,
      displayScope: "thisPortal",
      isPrimaryByCategory:
        newContactIsPrimary && selectedCategory
          ? ({ [selectedCategory]: true } as any)
          : undefined,
      isPrimaryOverall: newContactIsPrimary,
      displayEmail: true,
      displayPhone: true,
      displayUrl: false,
      enableContactButton: true,
      benefitsCategory: selectedCategory,
    };

    const updatedContacts = [...updatedContactsWithoutPrimary, newContact];

    // Sort contacts: Primary contacts come first
    const sortedContacts = [...updatedContacts].sort((a, b) => {
      const aIsPrimary = a.isPrimaryOverall || a.isPrimary || false;
      const bIsPrimary = b.isPrimaryOverall || b.isPrimary || false;
      if (aIsPrimary && !bIsPrimary) return -1;
      if (!aIsPrimary && bIsPrimary) return 1;
      return 0;
    });

    const updatedKeyContacts = {
      ...keyContactsData,
      contacts: sortedContacts,
      contactDisplayOrder: sortedContacts.map((c) => c.id),
    };

    saveStepDataLocally("keyContacts", updatedKeyContacts);

    // Select the new empty contact - this will set benefitsCategories from the contact
    isUpdatingRef.current = true;
    isCreatingNewContactRef.current = true; // MARKER: We just created a new contact
    // console.log("DEBUG: Setting ID to generated ID and Ref to true", newContact.id);
    setSelectedContactId(newContact.id);

    setContactType(defaultContactType);
    setBenefitsCategories(normalizeBenefitsCategories([selectedCategory]));

    // Use selectedContact data if provided, otherwise fallback to auto-fill or empty
    if (selectedContact) {
      const nameParts = (selectedContact.name || selectedContact.fullName || "")
        .trim()
        .split(/\s+/);
      const fName = selectedContact.firstName || nameParts[0] || "";
      const lName =
        selectedContact.lastName ||
        (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

      setFirstName(fName);
      setLastName(lName);
      setTitle(selectedContact.title || "");
      setEmail(selectedContact.email || "");
      setPhone(selectedContact.phone || "");
      setPhoneExtension(selectedContact.phoneExtension || "");
      setCompanyName(selectedContact.companyName || contactCompanyName);
      setWebsiteUrl(
        selectedContact.website || selectedContact.websiteUrl || "",
      );
      setHeadshot(selectedContact.headshot || "");
      setCompanyLogo(selectedContact.companyLogo || contactCompanyLogo);
    } else if (isCompanyPlanSponsor) {
      setFirstName("");
      setLastName("");
      setTitle("");
      setDisplayName("");
      setDepartmentLabel("");
      setSupportHours("");
      setEmail("");
      setPhone("");
      setPhoneExtension("");
      setCompanyName(defaultCompanyName); // Pulls from Step 1
      setCompanyLogo(defaultCompanyLogo); // Pulls from Step 1
      setWebsiteUrl("");
      setHeadshot("");
    } else {
      // New cards (including “Add contact” modal) are not back-filled from the advisor profile.
      // Only rows seeded on load (onboarding-primary-advisor-*) get that data.
      setFirstName("");
      setLastName("");
      setTitle("");
      setDisplayName("");
      setDepartmentLabel("");
      setSupportHours("");
      setEmail("");
      setPhone("");
      setPhoneExtension("");
      setCompanyName(contactCompanyName);
      setWebsiteUrl("");
      setHeadshot("");
      setCompanyLogo(contactCompanyLogo);
    }

    setWebsiteUrlError("");
    setSchedulingUrlError("");
    setHeadshotFileName("");
    setHeadshotAssetId(undefined);
    setTeamImage("");
    setTeamImageFileName("");
    setTeamImageAssetId(undefined);
    setCompanyLogoAssetId(undefined);
    setIsPrimaryByCategory({} as Record<BenefitsCategory, boolean>);
    setIsPrimaryOverall(newContactIsPrimary); // Set as primary by default for new contact
    // Get other benefits text from step3a if category is Other Benefits
    const step3aData = ((stepData as any).step3a as Step3aData) || {};
    if (selectedCategory === "Other Benefits" && step3aData.otherBenefitsText) {
      setOtherBenefitsText(step3aData.otherBenefitsText);
    } else {
      setOtherBenefitsText("");
    }

    // Allow updates after a short delay
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);

    // Close modal
    setIsAddContactModalOpen(false);

    // Reset modal state
    setModalBenefitsCategory("Retirement");
  };

  const hasAutoSelectedContactRef = useRef(false);
  const lastContactCountRef = useRef<number>(0);

  useEffect(() => {
    const currentContactCount = savedContacts.length;
    const wasNewContactAdded =
      currentContactCount > lastContactCountRef.current;

    if (wasNewContactAdded && !selectedContactId) {
      // If we just created a new contact and saved it, allow auto-select
      // But ensure we reset the creating flag so subsequent updates work correctly
      isCreatingNewContactRef.current = false;

      const mostRecentContact = savedContacts[savedContacts.length - 1];
      if (mostRecentContact) {
        hasAutoSelectedContactRef.current = true;
        handleSelectContact(mostRecentContact);
        lastContactCountRef.current = currentContactCount;
        return;
      }
    }

    if (
      !hasAutoSelectedContactRef.current &&
      savedContacts.length > 0 &&
      !selectedContactId &&
      !isCreatingNewContactRef.current
    ) {
      const firstContact = savedContacts[0];
      if (firstContact) {
        hasAutoSelectedContactRef.current = true;
        handleSelectContact(firstContact);
      }
    }

    lastContactCountRef.current = currentContactCount;
  }, [savedContacts, selectedContactId]);

  // Load otherBenefitsText from step3a when component mounts if no contact selected
  useEffect(() => {
    if (!selectedContactId && defaultBenefitsCategory === "Other Benefits") {
      const step3aData = ((stepData as any).step3a as Step3aData) || {};
      if (step3aData.otherBenefitsText && !otherBenefitsText) {
        setOtherBenefitsText(step3aData.otherBenefitsText);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBenefitsCategory, stepData]);

  const contactToSelectRef = useRef<string | null>(null);

  useEffect(() => {
    const handleSelectContactEvent = (event: CustomEvent) => {
      const contactId = event.detail?.contactId;
      if (contactId) {
        contactToSelectRef.current = contactId;
      }
    };

    window.addEventListener(
      "selectContact",
      handleSelectContactEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        "selectContact",
        handleSelectContactEvent as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (contactToSelectRef.current) {
      const keyContactsData = stepData.keyContacts || { contacts: [] };
      const savedContacts = keyContactsData.contacts || [];
      const contact = savedContacts.find(
        (c: KeyContact) => c.id === contactToSelectRef.current,
      );
      if (contact) {
        handleSelectContact(contact);
        contactToSelectRef.current = null;
        return;
      }
    }

    const step3SubStepData = (stepData as any).step3SubStep || {};
    const isCreatingNew = step3SubStepData.isCreatingNew === true;

    if (isCreatingNew) {
      // In creation mode, we don't auto-select.
      // Instead, we ensure the form is pre-filled with the category from step-3a
      if (!selectedContactId) {
        // Form is already initialized with defaults or step3bData
        // We might want to force a reset if we were previously editing
      }
      return;
    }

    if (!selectedContactId && savedContacts.length > 0) {
      const mostRecentContact = savedContacts[savedContacts.length - 1];
      if (mostRecentContact && !hasAutoSelectedContactRef.current) {
        const step3SubStep =
          ((stepData as any).step3SubStep as Step3SubStepData)?.step3SubStep ||
          ((stepData as any).step3SubStep as Step3SubStepData);
        if (
          (step3SubStep === "step3b" || !step3SubStep) &&
          !isCreatingNewContactRef.current
        ) {
          handleSelectContact(mostRecentContact);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepData.keyContacts, selectedContactId]);

  useEffect(() => {
    if (selectedContactId) {
      const selectedContact = savedContacts.find(
        (c: KeyContact) => c.id === selectedContactId,
      );
      if (selectedContact) {
        const contactOtherText = selectedContact.benefitsCategoryOther || "";
        if (contactOtherText !== otherBenefitsText) {
          setOtherBenefitsText(contactOtherText);
        }
      }
    } else if (defaultBenefitsCategory === "Other Benefits") {
      const step3aData = ((stepData as any).step3a as Step3aData) || {};
      if (
        step3aData.otherBenefitsText &&
        step3aData.otherBenefitsText !== otherBenefitsText
      ) {
        setOtherBenefitsText(step3aData.otherBenefitsText);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId, savedContacts, defaultBenefitsCategory, stepData]);

  const handleUseAdvisorInfo = () => {
    // Split advisor name into first and last
    const nameParts = advisorName.trim().split(/\s+/);
    const fName = nameParts[0] || "";
    const lName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    setFirstName(fName);
    setLastName(lName);
    setTitle(advisorTitle);
    setEmail(advisorEmail);
    setPhone(advisorPhone);
    setCompanyName(advisorOrgName);
    setWebsiteUrl(advisorWebsite);
    setHeadshot(advisorHeadshot);
    setCompanyLogo(advisorOrgLogo);
  };

  useEffect(() => {
    if (!selectedContactId) return;

    // Skip if there's a pending primary change (waiting for confirmation)
    if (pendingPrimaryChange !== null) return;

    const selectedContact = savedContacts.find(
      (c: KeyContact) => c.id === selectedContactId,
    );
    if (!selectedContact) return;

    const isHRPeopleContact = selectedContact.benefitsCategories?.includes(
      "Company / Plan Sponsor",
    );
    if (!isHRPeopleContact) return;

    const step3aData = ((stepData as any).step3a as Step3aData) || {};
    const step3aPrimary = step3aData.isPrimaryForHRPeople ?? false;

    // Check if there are other contacts with primary in the SAME category (Company / Plan Sponsor)
    const selectedCategories = selectedContact.benefitsCategories || [];
    const hasOtherPrimaryContactsInSameCategory = savedContacts.some(
      (c: KeyContact) => {
        if (c.id === selectedContactId) return false;
        if (!(c.isPrimaryOverall || c.isPrimary)) return false;
        const contactCategories = c.benefitsCategories || [];
        // Check if contacts share any benefits category
        return selectedCategories.some((cat) =>
          contactCategories.includes(cat),
        );
      },
    );

    // Only sync with step3a.isPrimaryForHRPeople if:
    // 1. There are no other primary contacts in the same category, OR
    // 2. The contact already has primary status
    // This prevents automatically setting primary for new contacts when others exist in the same category
    // Also check if the contact's current primary status matches what we want to set
    const contactCurrentPrimary =
      selectedContact.isPrimaryOverall || selectedContact.isPrimary || false;

    if (!hasOtherPrimaryContactsInSameCategory || contactCurrentPrimary) {
      // Only sync if the contact's stored status matches step3a, and form state differs
      if (
        contactCurrentPrimary === step3aPrimary &&
        isPrimaryOverall !== step3aPrimary
      ) {
        setIsPrimaryOverall(step3aPrimary);
      }
    } else if (isPrimaryOverall && !contactCurrentPrimary) {
      // If contact shouldn't be primary but isPrimaryOverall is true, set it to false
      setIsPrimaryOverall(false);
    }
  }, [
    stepData,
    selectedContactId,
    savedContacts,
    isPrimaryOverall,
    pendingPrimaryChange,
  ]);

  const prevStoreContactRef = useRef<string>("");

  // Sync local state FROM store ONLY when the store actually changes (e.g. from Side Editor)
  useEffect(() => {
    if (!selectedContactId || isUpdatingRef.current) return;

    const currentContact = savedContacts.find(
      (c: KeyContact) => c.id === selectedContactId,
    );
    if (!currentContact) return;

    const contactString = JSON.stringify(currentContact);
    if (contactString === prevStoreContactRef.current) return;

    // Okay, the store actually changed from an external source. Sync local state.
    const isDifferent = (a: any, b: any) => {
      const valA = a === undefined || a === null ? "" : a;
      const valB = b === undefined || b === null ? "" : b;
      return valA !== valB;
    };

    if (contactType === "individual") {
      if (isDifferent(currentContact.firstName, firstName))
        setFirstName(currentContact.firstName || "");
      if (isDifferent(currentContact.lastName, lastName))
        setLastName(currentContact.lastName || "");
      if (isDifferent(currentContact.title, title))
        setTitle(currentContact.title || "");
      if (
        currentContact.headshot !== undefined &&
        currentContact.headshot !== headshot
      )
        setHeadshot(currentContact.headshot || "");
      if (
        currentContact.headshotFileName !== undefined &&
        currentContact.headshotFileName !== headshotFileName
      )
        setHeadshotFileName(currentContact.headshotFileName || "");
    } else {
      if (isDifferent(currentContact.displayName, displayName))
        setDisplayName(currentContact.displayName || "");
      if (isDifferent(currentContact.departmentLabel, departmentLabel))
        setDepartmentLabel(currentContact.departmentLabel || "");
      if (isDifferent(currentContact.supportHours, supportHours))
        setSupportHours(currentContact.supportHours || "");
      if (
        currentContact.teamImage !== undefined &&
        currentContact.teamImage !== teamImage
      )
        setTeamImage(currentContact.teamImage || "");
      if (
        currentContact.teamImageFileName !== undefined &&
        currentContact.teamImageFileName !== teamImageFileName
      )
        setTeamImageFileName(currentContact.teamImageFileName || "");
    }

    if (isDifferent(currentContact.email, email))
      setEmail(currentContact.email || "");
    if (isDifferent(currentContact.phone, phone))
      setPhone(currentContact.phone || "");
    if (isDifferent(currentContact.phoneExtension, phoneExtension))
      setPhoneExtension(currentContact.phoneExtension || "");

    if (isDifferent(currentContact.companyName, companyName))
      setCompanyName(currentContact.companyName || "");
    if (
      currentContact.companyLogo !== undefined &&
      currentContact.companyLogo !== companyLogo
    )
      setCompanyLogo(currentContact.companyLogo || "");

    if (
      currentContact.displayEmail !== undefined &&
      currentContact.displayEmail !== displayEmail
    )
      setDisplayEmail(currentContact.displayEmail);
    if (
      currentContact.displayPhone !== undefined &&
      currentContact.displayPhone !== displayPhone
    )
      setDisplayPhone(currentContact.displayPhone);
    if (
      currentContact.displayScheduleAppointment !== undefined &&
      currentContact.displayScheduleAppointment !== displayScheduleAppointment
    )
      setDisplayScheduleAppointment(currentContact.displayScheduleAppointment);

    const storeDisplayUrl = currentContact.displayUrl;
    if (storeDisplayUrl !== undefined && storeDisplayUrl !== displayWebsite)
      setDisplayWebsite(storeDisplayUrl);

    if (
      currentContact.contactInfoOrder &&
      JSON.stringify(currentContact.contactInfoOrder) !==
        JSON.stringify(contactInfoOrder)
    ) {
      setContactInfoOrder(currentContact.contactInfoOrder as any);
    }
    if (
      currentContact.actionButtonOrder &&
      JSON.stringify(currentContact.actionButtonOrder) !==
        JSON.stringify(actionButtonOrder)
    ) {
      setActionButtonOrder(currentContact.actionButtonOrder as any);
    }

    if (
      isDifferent(
        currentContact.cardBackgroundColor,
        individualCardBackgroundColor,
      )
    ) {
      setIndividualCardBackgroundColor(currentContact.cardBackgroundColor);
    }
    if (isDifferent(currentContact.logoScale, individualLogoScale)) {
      setIndividualLogoScale(currentContact.logoScale);
    }

    // Update ref to current store state
    prevStoreContactRef.current = contactString;
  }, [savedContacts, selectedContactId]);

  useEffect(() => {
    if (isUpdatingRef.current) return;

    if (defaultBenefitsCategory && !selectedContactId) {
      const categoryContact = savedContacts.find((c: KeyContact) => {
        if (!c.benefitsCategories || c.benefitsCategories.length === 0)
          return false;
        return c.benefitsCategories.includes(defaultBenefitsCategory);
      });

      if (categoryContact) {
        setSelectedContactId(categoryContact.id);
        return;
      }

      const hasRequiredFields =
        email.trim() &&
        (phone.trim() || phoneExtension.trim()) &&
        benefitsCategories.length > 0 &&
        ((contactType === "individual" &&
          firstName.trim() &&
          lastName.trim()) ||
          (contactType === "team_support" && displayName.trim()));

      const step3SubStepData = (stepData as any).step3SubStep || {};
      const isCreatingNew = step3SubStepData.isCreatingNew === true;

      // GUARD: If we are in "Creation Mode", do NOT auto-save.
      // The contact will be saved only when the user clicks "Next"/"Continue".
      if (isCreatingNew) {
        return;
      }

      if (hasRequiredFields) {
        handleSaveContact().catch(console.error);
      }
      return;
    }

    const contactIndex = savedContacts.findIndex(
      (c: KeyContact) => c.id === selectedContactId,
    );
    if (contactIndex === -1) return;

    const currentContact = savedContacts[contactIndex];
    const isHRPeopleContact = currentContact.benefitsCategories?.includes(
      "Company / Plan Sponsor",
    );

    const currentPrimaryByCategory = currentContact.isPrimaryByCategory ?? {};
    const nextPrimaryByCategory = isPrimaryByCategory ?? {};
    const currentIsPrimaryOverall = currentContact.isPrimaryOverall ?? false;
    const currentHeadshot = currentContact.headshot ?? "";
    const currentHeadshotFileName = currentContact.headshotFileName ?? "";
    const currentTeamImage = currentContact.teamImage ?? "";
    const currentTeamImageFileName = currentContact.teamImageFileName ?? "";

    const nameChanged =
      contactType === "individual"
        ? `${firstName} ${lastName}`.trim() !==
          `${currentContact.firstName || ""} ${
            currentContact.lastName || ""
          }`.trim()
        : displayName !== (currentContact.displayName || "");

    const normalizedCurrentIsPrimaryOverall = currentIsPrimaryOverall ?? false;
    const normalizedIsPrimaryOverall = isPrimaryOverall ?? false;
    const normalizedCurrentPrimaryByCategory = currentPrimaryByCategory ?? {};
    const normalizedNextPrimaryByCategory = nextPrimaryByCategory ?? {};

    const hasChanges =
      currentContact.contactType !== contactType ||
      JSON.stringify(currentContact.benefitsCategories) !==
        JSON.stringify(benefitsCategories) ||
      currentContact.firstName !==
        (contactType === "individual" ? firstName : undefined) ||
      currentContact.lastName !==
        (contactType === "individual" ? lastName : undefined) ||
      currentContact.title !==
        (contactType === "individual" ? title : undefined) ||
      currentContact.displayName !==
        (contactType === "team_support" ? displayName : undefined) ||
      currentContact.departmentLabel !==
        (contactType === "team_support" ? departmentLabel : undefined) ||
      currentContact.supportHours !==
        (contactType === "team_support" ? supportHours : undefined) ||
      currentContact.email !== email ||
      currentContact.phone !== phone ||
      currentContact.phoneExtension !== phoneExtension ||
      currentContact.companyName !== companyName ||
      currentContact.websiteUrl !== websiteUrl ||
      currentContact.schedulingUrl !== schedulingUrl ||
      currentHeadshot !== headshot ||
      currentHeadshotFileName !== headshotFileName ||
      currentContact.headshotAssetId !== headshotAssetId ||
      (currentContact.companyLogo || "") !== companyLogo ||
      currentContact.companyLogoAssetId !== companyLogoAssetId ||
      currentTeamImage !== teamImage ||
      currentTeamImageFileName !== teamImageFileName ||
      currentContact.teamImageAssetId !== teamImageAssetId ||
      JSON.stringify(normalizedCurrentPrimaryByCategory) !==
        JSON.stringify(normalizedNextPrimaryByCategory) ||
      normalizedCurrentIsPrimaryOverall !== normalizedIsPrimaryOverall ||
      currentContact.benefitsCategoryOther !==
        (benefitsCategories[0] === "Other Benefits" && otherBenefitsText
          ? otherBenefitsText
          : undefined) ||
      currentContact.displayEmail !== displayEmail ||
      currentContact.displayPhone !== displayPhone ||
      currentContact.displayUrl !== displayWebsite ||
      currentContact.displayScheduleAppointment !==
        displayScheduleAppointment ||
      currentContact.cardBackgroundColor !== individualCardBackgroundColor ||
      currentContact.logoScale !== individualLogoScale ||
      JSON.stringify(currentContact.contactInfoOrder) !==
        JSON.stringify(contactInfoOrder) ||
      JSON.stringify(currentContact.actionButtonOrder) !==
        JSON.stringify(actionButtonOrder) ||
      nameChanged;

    if (!hasChanges) {
      // If no changes, make sure our ref is up to date with the store
      // to prevent unnecessary syncing if store updates elsewhere with same data
      prevStoreContactRef.current = JSON.stringify(currentContact);
      return;
    }

    isUpdatingRef.current = true;

    // Sync isPrimaryOverall with step3a.isPrimaryForHRPeople for HR/People contacts
    let finalIsPrimaryOverall = isPrimaryOverall;
    if (isHRPeopleContact) {
      // Update step3a.isPrimaryForHRPeople when isPrimaryOverall changes for HR/People contact
      const step3aData = (stepData as any).step3a || {};
      if (step3aData.isPrimaryForHRPeople !== isPrimaryOverall) {
        saveStepDataLocally("step3a", {
          ...step3aData,
          isPrimaryForHRPeople: isPrimaryOverall,
        });
      }
      finalIsPrimaryOverall = isPrimaryOverall;
    }

    const updatedContact: KeyContact = {
      ...currentContact,
      contactType,
      benefitsCategories,
      firstName: contactType === "individual" ? firstName : undefined,
      lastName: contactType === "individual" ? lastName : undefined,
      title: contactType === "individual" ? title : undefined,
      displayName: contactType === "team_support" ? displayName : undefined,
      departmentLabel:
        contactType === "team_support" ? departmentLabel : undefined,
      supportHours: contactType === "team_support" ? supportHours : undefined,
      email,
      phone,
      phoneExtension,
      companyName: companyName,
      websiteUrl,
      schedulingUrl,
      name:
        contactType === "individual"
          ? `${firstName} ${lastName}`.trim()
          : displayName,
      headshot: headshot || undefined,
      headshotFileName: headshotFileName || undefined,
      headshotAssetId: headshotAssetId,
      teamImage: teamImage || undefined,
      teamImageFileName: teamImageFileName || undefined,
      teamImageAssetId: teamImageAssetId,
      companyLogo: companyLogo || undefined,
      companyLogoAssetId: companyLogoAssetId,
      isPrimaryByCategory:
        Object.keys(isPrimaryByCategory).length > 0
          ? isPrimaryByCategory
          : undefined,
      isPrimaryOverall: finalIsPrimaryOverall || undefined,
      benefitsCategory: benefitsCategories[0] || "Company / Plan Sponsor",
      benefitsCategoryOther:
        benefitsCategories[0] === "Other Benefits" && otherBenefitsText
          ? otherBenefitsText
          : undefined,
      displayEmail,
      displayPhone,
      displayUrl: displayWebsite,
      displayScheduleAppointment,
      contactInfoOrder,
      actionButtonOrder,
      cardBackgroundColor: individualCardBackgroundColor,
      logoScale: individualLogoScale,
    };

    const updatedContacts = [...savedContacts];
    updatedContacts[contactIndex] = updatedContact;
    const updatedKeyContacts = {
      ...keyContactsData,
      contacts: updatedContacts,
    };

    saveStepDataLocally("keyContacts", updatedKeyContacts).then(() => {
      // After successful save, update our ref to the new store state
      // to ensure we don't immediately sync BACK from what we just pushed
      prevStoreContactRef.current = JSON.stringify(updatedContact);
      isUpdatingRef.current = false;
    });
  }, [
    selectedContactId,
    contactType,
    benefitsCategories,
    firstName,
    lastName,
    title,
    displayName,
    departmentLabel,
    supportHours,
    email,
    phone,
    phoneExtension,
    companyName,
    websiteUrl,
    schedulingUrl,
    headshot,
    headshotFileName,
    headshotAssetId,
    companyLogo,
    companyLogoAssetId,
    isPrimaryByCategory,
    isPrimaryOverall,
    teamImage,
    teamImageFileName,
    teamImageAssetId,
    otherBenefitsText,
    isInternalHR,
    defaultCompanyName,
    savedContacts,
    keyContactsData,

    saveStepDataLocally,
    defaultBenefitsCategory,
    handleSaveContact,
    stepData,
  ]);

  // Clear headshot when contact type changes to team_support
  // Clear headshot/teamImage when contact type changes
  useEffect(() => {
    if (contactType === "team_support") {
      setHeadshot("");
      setHeadshotFileName("");
      setHeadshotAssetId(undefined);
    } else if (contactType === "individual") {
      setTeamImage("");
      setTeamImageFileName("");
      setTeamImageAssetId(undefined);
    }
  }, [contactType]);

  // Refs to store initial position (avoid re-renders)
  const initialPositionRef = useRef<{
    offsetTop: number | null;
    left: number | null;
    width: number | null;
    originalOffsetTop: number | null; // Store original position before fixing
  }>({
    offsetTop: null,
    left: null,
    width: null,
    originalOffsetTop: null,
  });

  // Ref to track fixed state to avoid stale closures in scroll handler
  const isFixedRef = useRef(isFixed);

  // Sync ref with state
  useEffect(() => {
    isFixedRef.current = isFixed;
  }, [isFixed]);

  const FIX_THRESHOLD = 70; // When to fix (scroll down)
  const RETURN_THRESHOLD = 80; // When to unfix (scroll up) - larger for hysteresis
  const UPDATE_THRESHOLD = 150; // Only update position when far from transition
  const FIXED_TOP_OFFSET = 50;

  // Sticky preview card behavior: normal flow → fixed on scroll
  useEffect(() => {
    if (typeof window === "undefined" || !previewCardRef.current) return;

    const previewCard = previewCardRef.current;

    const updateInitialPosition = () => {
      if (!previewCard || isFixedRef.current) return; // Don't update when fixed
      const rect = previewCard.getBoundingClientRect();
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      // Only update if we're in normal flow and far from transition point
      if (rect.top > UPDATE_THRESHOLD) {
        initialPositionRef.current = {
          offsetTop: scrollY + rect.top,
          left: rect.left,
          width: rect.width,
          originalOffsetTop: scrollY + rect.top, // Store original position
        };
      }
    };

    // Store initial position only if not fixed
    if (!isFixedRef.current) {
      updateInitialPosition();
    }

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId) return; // Throttle with requestAnimationFrame

      rafId = requestAnimationFrame(() => {
        if (!previewCard) {
          rafId = null;
          return;
        }

        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const rect = previewCard.getBoundingClientRect();
        const { offsetTop, originalOffsetTop } = initialPositionRef.current;
        const currentIsFixed = isFixedRef.current; // Get current state from ref

        // Only update position when card is in normal flow and far from transition
        if (!currentIsFixed && rect.top > UPDATE_THRESHOLD) {
          updateInitialPosition();
        }

        // When preview reaches threshold position, make it fixed
        // Only trigger if we haven't already fixed it AND we've scrolled down (not at page top)
        if (
          !currentIsFixed &&
          rect.top <= FIX_THRESHOLD &&
          offsetTop !== null &&
          scrollY > 0 // Don't fix if we're at the top of the page
        ) {
          // Save original position BEFORE fixing (for return logic)
          // Use the stored offsetTop, not current position
          const savedOriginalOffsetTop =
            originalOffsetTop !== null ? originalOffsetTop : offsetTop;

          initialPositionRef.current.originalOffsetTop = savedOriginalOffsetTop;

          // Use CURRENT position for fixed state
          setPreviewHeight(rect.height);
          setIsFixed(true);
          isFixedRef.current = true; // Update ref immediately
          setLeftOffset(rect.left);
          setWidth(rect.width);
          // Don't update offsetTop when fixing - keep original for return logic
        }

        // When scrolling back up past the ORIGINAL position, return to normal flow
        // Use originalOffsetTop (position before fixing) for accurate return
        // Add hysteresis: need to scroll further up to unfix (RETURN_THRESHOLD > FIX_THRESHOLD difference)
        if (
          currentIsFixed &&
          originalOffsetTop !== null &&
          scrollY < originalOffsetTop - RETURN_THRESHOLD
        ) {
          setIsFixed(false);
          isFixedRef.current = false; // Update ref immediately
          setLeftOffset(null);
          setWidth(null);
          setPreviewHeight(null);
          // Reset original position after a delay to allow DOM to update
          const resetPosition = () => {
            if (previewCard && !isFixedRef.current) {
              const newRect = previewCard.getBoundingClientRect();
              const newScrollY =
                window.scrollY || document.documentElement.scrollTop;
              // Only reset if card is actually in normal flow (not fixed)
              if (newRect.top > FIX_THRESHOLD) {
                initialPositionRef.current = {
                  offsetTop: newScrollY + newRect.top,
                  left: newRect.left,
                  width: newRect.width,
                  originalOffsetTop: null,
                };
              }
            }
          };
          setTimeout(resetPosition, 100);
        }

        rafId = null;
      });
    };

    const handleResize = () => {
      if (!isFixed) {
        updateInitialPosition();
      } else if (previewCard) {
        // Update fixed position on resize
        const rect = previewCard.getBoundingClientRect();
        setLeftOffset(rect.left);
        setWidth(rect.width);
      }
    };

    // Initial check
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - we use refs to avoid stale closures

  // Check if errorFields contain errors for the selected contact
  // errorFields can contain: "firstName", "contact_${contactId}_firstName", etc.
  const hasErrorsForSelectedContact = (): boolean => {
    if (
      !selectedContactId ||
      !validationAttempted ||
      errorFields.length === 0
    ) {
      return false;
    }

    // Check if errorFields contains contact-specific fields for selected contact
    const hasContactSpecificErrors = errorFields.some((field) =>
      field.includes(`contact_${selectedContactId}_`),
    );

    if (hasContactSpecificErrors) {
      return true;
    }

    // If no contact-specific fields, check if current form data has errors
    // This handles cases where errorFields contains general fields like "phone", "email"
    const contactHasErrors = errorFields.some((field) => {
      const baseField = field.replace(/^contact_\w+_/, "");

      // Check fields based on contact type
      if (contactType === "individual") {
        // Individual contact fields
        if (baseField === "firstName" && (!firstName || !firstName.trim())) {
          return true;
        }
        if (baseField === "lastName" && (!lastName || !lastName.trim())) {
          return true;
        }
        if (baseField === "title" && (!title || !title.trim())) {
          return true;
        }
      } else if (contactType === "team_support") {
        // Team/Support contact fields
        if (
          baseField === "displayName" &&
          (!displayName || !displayName.trim())
        ) {
          return true;
        }
      }

      // Common fields for both contact types
      if (baseField === "email") {
        if (!email || !email.trim()) {
          return true;
        }
        // Validate email format (must contain @ and .)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return true;
        }
      }
      if (baseField === "phone" && (!phone || !phone.trim())) {
        return true;
      }
      if (
        baseField === "benefitsCategories" &&
        (!benefitsCategories || benefitsCategories.length === 0)
      ) {
        return true;
      }

      return false;
    });

    return contactHasErrors;
  };

  // Show errors only if validation was attempted and selected contact has errors
  const shouldShowErrors = hasErrorsForSelectedContact();

  return (
    <div
      className="space-y-4 transition-all duration-200"
      style={{
        paddingLeft: editorState.isEditorOpen ? "36rem" : "0",
      }}
    >
      {/* Side editor panel */}
      <EditorPanelWrapper
        isOpen={editorState.isEditorOpen}
        isAnimating={editorState.isEditorAnimating}
        editorScrollContainerRef={editorScrollContainerRef}
        onClose={editorState.handleCloseEditor}
      >
        <ContactSectionEditor errorFields={errorFields} />
      </EditorPanelWrapper>

      <div className="space-y-4 overflow-visible">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-2xl text-center font-semibold text-gray-900 mb-1 dark:text-gray-100">
            <CardTitle className="flex justify-center items-center gap-2">
              <Building2 className="w-5 h-5 text-accent-blue" />
              <p>Add Contact Details</p>
            </CardTitle>
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Fill in the information employees will see when they need help.
              </p>
              {savedContacts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUseAdvisorInfo}
                  className="text-accent-blue hover:text-accent-blue/80 h-7 text-xs flex items-center gap-1.5 px-3 border border-accent-blue/20 hover:bg-accent-blue/5 rounded-full transition-all"
                >
                  <Users className="w-3.5 h-3.5" />
                  Use Advisor Info
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full relative">
          <Card className="w-full dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="pt-4 space-y-4">
              {/* Check if no contacts exist */}
              {savedContacts.length === 0 && (
                <div className="mb-4 p-4 bg-accent-blue/5 border border-accent-blue/20 rounded-lg dark:bg-accent-blue/10 dark:border-accent-blue/30">
                  <p className="text-sm text-accent-blue font-medium dark:text-accent-blue-light">
                    Please click &quot;Add Contact&quot; button to create your
                    first contact before filling in the form.
                  </p>
                </div>
              )}

              {/* Contact Type */}
              <ContactTypeSelector
                value={contactType}
                onChange={setContactType}
                disabled={savedContacts.length === 0}
              />

              {/* Benefits Categories */}
              <div
                className="space-y-2 flex flex-col"
                data-field="benefitsCategories"
              >
                <Label className="dark:text-gray-300">
                  Benefits Categories <span className="text-red-500">*</span>
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="space-y-2">
                        <Input
                          value={getCategoryLabel(
                            benefitsCategories[0] ||
                              defaultBenefitsCategory ||
                              "Retirement",
                          )}
                          readOnly
                          className={cn(
                            "bg-gray-50 cursor-default dark:bg-gray-700 dark:text-gray-300",
                            shouldShowErrors &&
                              errorFields.some((field) =>
                                field.includes("benefitsCategories"),
                              ) &&
                              "border-red-500",
                          )}
                        />

                        {/* Custom text input for Other Benefits - Read-only */}
                        {benefitsCategories[0] === "Other Benefits" && (
                          <div className="mt-4 space-y-2">
                            <Label htmlFor="other-benefits-text-step3b" className="dark:text-gray-300">
                              Benefit Name{" "}
                              <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="other-benefits-text-step3b"
                              type="text"
                              value={otherBenefitsText}
                              readOnly
                              className={cn(
                                "bg-gray-50 cursor-default dark:bg-gray-700 dark:text-gray-300",
                                shouldShowErrors &&
                                  errorFields.includes("otherBenefitsText") &&
                                  "border-red-500",
                              )}
                              disabled={savedContacts.length === 0}
                            />
                            {shouldShowErrors &&
                              errorFields.includes("otherBenefitsText") && (
                                <p className="text-xs text-red-500">
                                  Please specify the benefit type
                                </p>
                              )}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>To change, hit previous to go back</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Primary Contact (single toggle) */}
              <div className="border-t pt-4 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPrimaryOverall"
                    checked={isPrimaryOverall}
                    onCheckedChange={(checked) => {
                      if (savedContacts.length > 0) {
                        handlePrimaryChange(checked === true);
                      }
                    }}
                    disabled={savedContacts.length === 0}
                    className={
                      savedContacts.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                    }
                  />
                  <Label
                    htmlFor="isPrimaryOverall"
                    className={cn(
                      "text-sm font-normal",
                      savedContacts.length === 0
                        ? "text-gray-400 cursor-not-allowed"
                        : "cursor-pointer dark:text-gray-300",
                    )}
                  >
                    Mark as primary contact for this category [{getCategoryLabel(benefitsCategories[0])}].
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <CompanyNameSelector
                  key={selectedContactId || "new"}
                  value={companyName}
                  onChange={setCompanyName}
                  logo={companyLogo}
                  onLogoChange={setCompanyLogo}
                  defaultCompanyName={defaultCompanyName}
                  defaultCompanyLogo={defaultCompanyLogo}
                  isInternalHR={isInternalHR}
                  companyNameRef={companyNameRef}
                  disabled={savedContacts.length === 0}
                  benefitsCategories={benefitsCategories}
                  advisorOrgName={advisorOrgName}
                  advisorOrgLogo={advisorOrgLogo}
                  advisorOffersThisBenefit={advisorOffersThisBenefit(
                    benefitsCategories[0],
                  )}
                  otherBenefitsText={otherBenefitsText}
                  onOtherBenefitsTextChange={setOtherBenefitsText}
                  onUpdatePlanName={handleUpdatePlanName}
                  onUpdatePlanLogo={handleUpdatePlanLogo}
                  errorFields={shouldShowErrors ? errorFields : []}
                />
              </div>

              {/* Contact Form Fields */}
              <ContactFormFields
                contactType={contactType}
                firstName={firstName}
                lastName={lastName}
                title={title}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onTitleChange={setTitle}
                displayName={displayName}
                departmentLabel={departmentLabel}
                supportHours={supportHours}
                onDisplayNameChange={setDisplayName}
                onDepartmentLabelChange={setDepartmentLabel}
                onSupportHoursChange={setSupportHours}
                headshot={headshot}
                headshotFileName={headshotFileName}
                onHeadshotChange={(value, fileName) => {
                  setHeadshot(value);
                  setHeadshotFileName(fileName);
                }}
                onHeadshotRemove={() => {
                  setHeadshot("");
                  setHeadshotFileName("");
                }}
                teamImage={teamImage}
                teamImageFileName={teamImageFileName}
                onTeamImageChange={(value, fileName) => {
                  setTeamImage(value);
                  setTeamImageFileName(fileName);
                }}
                onTeamImageRemove={() => {
                  setTeamImage("");
                  setTeamImageFileName("");
                }}
                onDefaultTeamImageClick={() => setIsTeamImageGalleryOpen(true)}
                firstNameRef={firstNameRef}
                lastNameRef={lastNameRef}
                titleRef={titleRef}
                errorFields={shouldShowErrors ? errorFields : []}
                disabled={savedContacts.length === 0}
              />

              {/* Email */}
              <div className="space-y-2" data-field="email">
                <Label className="dark:text-gray-300">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    if (savedContacts.length > 0) {
                      setEmail(e.target.value);
                    }
                  }}
                  placeholder="email@example.com"
                  destructive={
                    shouldShowErrors &&
                    errorFields.some((field) => field.includes("email"))
                  }
                  className={
                    savedContacts.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : "dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  }
                  disabled={savedContacts.length === 0}
                />
              </div>

              {/* Phone - Required */}
              <div className="flex gap-4">
                <div className="space-y-2 flex-grow" data-field="phone">
                  <Label className="dark:text-gray-300">
                    Phone <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    ref={phoneRef}
                    type="tel"
                    value={phone ? formatPhoneNumber(phone) : ""}
                    onChange={(e) => {
                      if (savedContacts.length > 0) {
                        handlePhoneChange(e.target.value);
                      }
                    }}
                    placeholder="(555) 123-4567"
                    destructive={
                      shouldShowErrors &&
                      errorFields.some((field) => field.includes("phone"))
                    }
                    className={
                      savedContacts.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                    }
                    disabled={savedContacts.length === 0}
                  />
                </div>
                <div className="space-y-2 w-24">
                  <Label className="dark:text-gray-300">Ext.</Label>
                  <Input
                    type="text"
                    value={phoneExtension}
                    onChange={(e) => {
                      if (savedContacts.length > 0) {
                        handlePhoneExtensionChange(e.target.value);
                      }
                    }}
                    placeholder="123"
                    className={
                      savedContacts.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                    }
                    disabled={savedContacts.length === 0}
                    maxLength={6}
                  />
                </div>
              </div>

              {/* Scheduling URL (optional) */}
              <div className="space-y-2">
                <Label className="dark:text-gray-300">Scheduling URL (optional)</Label>
                <Input
                  ref={schedulingUrlRef}
                  type="url"
                  value={schedulingUrl}
                  onChange={(e) => handleSchedulingUrlChange(e.target.value)}
                  placeholder="https://calendar.example.com"
                  destructive={!!schedulingUrlError}
                  className={cn(
                    savedContacts.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : "dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
                    schedulingUrlError && "border-red-500 ring-2 ring-red-500",
                  )}
                  disabled={savedContacts.length === 0}
                />
                {schedulingUrlError && (
                  <p className="text-xs text-red-500">{schedulingUrlError}</p>
                )}
              </div>

              {/* Benefits Access URL (optional) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="dark:text-gray-300">Benefits Access URL (optional)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          This is where an employee logs in / registers for
                          benefits
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  ref={websiteUrlRef}
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => handleWebsiteUrlChange(e.target.value)}
                  placeholder="https://example.com"
                  destructive={!!websiteUrlError}
                  className={cn(
                    savedContacts.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : "dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
                    websiteUrlError && "border-red-500 ring-2 ring-red-500",
                  )}
                  disabled={savedContacts.length === 0}
                />
                {websiteUrlError && (
                  <p className="text-xs text-red-500">{websiteUrlError}</p>
                )}
              </div>

              {/* Contact Card Actions */}
              <ContactCardActions
                displayScheduleAppointment={displayScheduleAppointment}
                displayPhone={displayPhone}
                displayEmail={displayEmail}
                displayWebsite={displayWebsite}
                onScheduleAppointmentChange={
                  handleScheduleAppointmentDisplayChange
                }
                onPhoneChange={setDisplayPhone}
                onEmailChange={setDisplayEmail}
                onWebsiteChange={handleWebsiteDisplayChange}
                contactInfoOrder={contactInfoOrder}
                onContactInfoOrderChange={setContactInfoOrder}
                actionButtonOrder={actionButtonOrder}
                onActionButtonOrderChange={setActionButtonOrder}
                disabled={savedContacts.length === 0}
                error={actionsError}
              />


            </CardContent>
          </Card>

          <div className="hidden lg:block">
            {/* Placeholder to maintain space when preview is fixed */}
            {isFixed && previewHeight !== null && (
              <div style={{ height: previewHeight }} aria-hidden="true" />
            )}

            {/* Live Preview - sticky/fixed */}
            <Card
              ref={previewCardRef}
              className={cn("shadow-lg dark:bg-gray-800 dark:border-gray-700", isFixed ? "fixed z-20" : "relative")}
              style={
                isFixed
                  ? {
                      top: `${70}px`, // Fixed at top
                      left: leftOffset ?? undefined,
                      width: width ?? undefined,
                    }
                  : undefined
              }
            >
              {/* Tabs - inside Card */}
              <div className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={cn(
                      "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === "preview"
                        ? "bg-accent-blue/5 text-accent-blue border-b-2 border-accent-blue"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700",
                    )}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("contacts")}
                    className={cn(
                      "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === "contacts"
                        ? "bg-accent-blue/5 text-accent-blue border-b-2 border-accent-blue"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700",
                    )}
                  >
                    Contacts
                  </button>
                </div>
              </div>

              <CardContent
                className={cn(
                  "space-y-4",
                  isFixed &&
                    "max-h-[calc(100vh-180px)] overflow-y-auto overflow-x-hidden custom-scrollbar",
                )}
              >
                {activeTab === "contacts" ? (
                  /* Contact List when contacts tab active */
                  <div className="pt-4 space-y-2">
                    <ContactList
                      contacts={savedContacts}
                      selectedContactId={selectedContactId}
                      onSelectContact={(contact) => {
                        handleSelectContact(contact);
                        if (!editorState.isEditorOpen) {
                          editorState.setIsEditorOpen(true);
                          setTimeout(
                            () => editorState.setIsEditorAnimating(true),
                            10,
                          );
                        }
                      }}
                      onDeleteContact={handleDeleteContact}
                      onAddContact={handleAddEmptyContact}
                      validationAttempted={validationAttempted}
                    />
                  </div>
                ) : (
                  /* Preview content */
                  <>
                    <div className="pt-2">
                      <BrandColorsSection
                        backgroundColor={
                          individualCardBackgroundColor || backgroundColor
                        }
                        defaultBrandColor={backgroundColor}
                        logoScale={logoScale}
                        onBackgroundColorChange={(color: string) =>
                          setIndividualCardBackgroundColor(color)
                        }
                        onApply={(color: string) => {
                          setPendingColor(color);
                          setIsColorWarningOpen(true);
                        }}
                        onLogoScaleChange={(scale: number) =>
                          updateStyle("logoScale", scale)
                        }
                        isBackgroundColorPickerOpen={
                          isBackgroundColorPickerOpen
                        }
                        onBackgroundColorPickerOpenChange={
                          setIsBackgroundColorPickerOpen
                        }
                      />
                    </div>
                    {/* Card Display Mode Selection with Navigation Buttons */}
                    <div className="space-y-2 border-t pt-4 dark:border-gray-700">
                      <div className="flex items-center justify-between gap-3">
                        {/* Card Display Mode Buttons */}
                        <div className="flex items-center gap-2 flex-1">
                          <Label className="text-sm font-medium whitespace-nowrap dark:text-gray-300">
                            Card Display Mode
                          </Label>
                          <div className="flex items-center gap-2 flex-1">
                            <Button
                              type="button"
                              variant={
                                cardDisplayMode === "large-horizontal"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                setCardDisplayMode("large-horizontal")
                              }
                              size="sm"
                              className={cn(
                                "flex items-center justify-center gap-1.5 h-8 flex-1 py-1.5 px-2 text-xs",
                                cardDisplayMode === "large-horizontal"
                                  ? "bg-accent-blue text-white hover:opacity-90"
                                  : "bg-white text-gray-700 hover:bg-gray-50 hover:border-accent-blue/50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-3 bg-accent-blue/20 rounded"></div>
                                <span>Large Horizontal</span>
                              </div>
                            </Button>
                            <Button
                              type="button"
                              variant={
                                cardDisplayMode === "small-vertical"
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() =>
                                setCardDisplayMode("small-vertical")
                              }
                              size="sm"
                              className={cn(
                                "flex items-center justify-center gap-1.5 h-8 flex-1 py-1.5 px-2 text-xs",
                                cardDisplayMode === "small-vertical"
                                  ? "bg-accent-blue text-white hover:opacity-90"
                                  : "bg-white text-gray-700 hover:bg-gray-50 hover:border-accent-blue/50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-4 bg-green-200 rounded"></div>
                                <span>Small Vertical</span>
                              </div>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Preview - Shrunk */}
                    <h4 className="text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                      Live Preview
                    </h4>
                    <div
                      className="relative flex flex-col items-center justify-center mb-3 origin-center scale-[0.8] 2xl:scale-100 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        // Switch to contacts tab
                        setActiveTab("contacts");
                        // Open editor if not open
                        if (!editorState.isEditorOpen) {
                          editorState.setIsEditorOpen(true);
                          setTimeout(
                            () => editorState.setIsEditorAnimating(true),
                            10,
                          );
                        }
                      }}
                    >
                      {/* Company Logo above the headshot */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={defaultCompanyLogo}
                        alt="Company logo"
                        className="h-8 w-auto max-w-[140px] object-contain mb-3"
                      />
                      {cardDisplayMode === "large-horizontal" ? (
                        <LargeHorizontalCard
                          key={`preview-${displayEmail}-${displayPhone}-${displayScheduleAppointment}-${displayWebsite}-${email}-${phone}-${websiteUrl}`}
                          contact={previewContact as any}
                          brandColor={primaryColor}
                          secondaryColor={secondaryColor}
                          appointmentLink={appointmentLink}
                          companyName={companyName}
                          index={0}
                          disableAnimation={true}
                          baselineBackgroundColor={backgroundColor}
                          baselineLogoScale={logoScale}
                        />
                      ) : (
                        <SmallVerticalCard
                          key={`preview-${displayEmail}-${displayPhone}-${displayScheduleAppointment}-${displayWebsite}-${email}-${phone}-${websiteUrl}`}
                          contact={previewContact as any}
                          brandColor={primaryColor}
                          secondaryColor={secondaryColor}
                          appointmentLink={appointmentLink}
                          companyName={companyName}
                          index={0}
                          disableAnimation={true}
                          baselineBackgroundColor={backgroundColor}
                          baselineLogoScale={logoScale}
                        />
                      )}
                    </div>

                    {/* Save & Add Contact Button in Preview */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddEmptyContact}
                      className="w-full mt-4 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      <Plus className="w-4 h-4" />
                      Save & Add Contact
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <AddContactModal
          open={isAddContactModalOpen}
          onOpenChange={setIsAddContactModalOpen}
          benefitsCategory={modalBenefitsCategory}
          onBenefitsCategoryChange={setModalBenefitsCategory}
          onCreateContact={handleCreateContactFromModal}
          contacts={savedContacts}
          globalContacts={globalContacts}
          advisorProfile={advisorProfile}
          isFetchingGlobalContacts={isFetchingGlobalContacts}
        />

        {/* Confirmation dialog for setting primary contact */}
        <AlertDialog
          open={showSetPrimaryConfirm}
          onOpenChange={setShowSetPrimaryConfirm}
        >
          <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="dark:text-gray-100">Set as Primary Contact?</AlertDialogTitle>
              <AlertDialogDescription className="dark:text-gray-400">
                Are you sure you want to make this contact the primary contact
                for this benefits category? This will change the display order
                and remove the primary status from the current primary contact
                in the same category.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="items-center">
              <AlertDialogAction
                onClick={() => {
                  setShowSetPrimaryConfirm(false);
                  setPendingPrimaryChange(null);
                }}
                className="dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </AlertDialogAction>
              <AlertDialogAction onClick={confirmSetPrimary}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Warning dialog for unsetting primary contact */}
        <AlertDialog
          open={showUnsetPrimaryWarning}
          onOpenChange={setShowUnsetPrimaryWarning}
        >
          <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="dark:text-gray-100">Remove Primary Status?</AlertDialogTitle>
              <AlertDialogDescription className="dark:text-gray-400">
                Are you sure you want to remove the primary status from this
                contact? You can select a new primary contact later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="items-center">
              <AlertDialogAction
                onClick={() => {
                  setShowUnsetPrimaryWarning(false);
                  setPendingPrimaryChange(null);
                }}
                className="dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </AlertDialogAction>
              <AlertDialogAction onClick={confirmUnsetPrimary}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Team Image Gallery Modal */}
        <ModalGallery
          open={isTeamImageGalleryOpen}
          onOpenChange={setIsTeamImageGalleryOpen}
          onSelect={(url) => {
            setTeamImage(url);
            setTeamImageFileName("default-team-image.png");
            setIsTeamImageGalleryOpen(false);
          }}
        />
      </div>
      <AlertDialog
        open={duplicateContactDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            duplicateDialogSkipValidationRef.current = false;
            setDuplicateContactDialog({ open: false, existingLabel: "" });
          }
        }}
      >
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-gray-100">First name already in use</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              A contact with this first name already exists for this benefits
              category
              {duplicateContactDialog.existingLabel
                ? ` (${duplicateContactDialog.existingLabel})`
                : ""}
              . Would you like to save anyway, or cancel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="items-center">
            <AlertDialogCancel
              onClick={() => {
                duplicateDialogSkipValidationRef.current = false;
                setDuplicateContactDialog({ open: false, existingLabel: "" });
              }}
              className="dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDuplicateSaveAnyway()}
            >
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={isColorWarningOpen}
        onOpenChange={setIsColorWarningOpen}
      >
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-gray-100">
              Change standard card color for this contact?
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              You are changing the standard card color for this contact. This
              card will no longer update automatically when you change your
              global Brand Colors. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="items-center">
            <AlertDialogCancel
              onClick={() => {
                setPendingColor(null);
                setIsColorWarningOpen(false);
              }}
              className="dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingColor) {
                  setIndividualCardBackgroundColor(pendingColor);
                  setPendingColor(null);
                }
                setIsColorWarningOpen(false);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
