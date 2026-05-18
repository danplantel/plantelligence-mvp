"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { BannerPreviewSection } from "../sections/banner-preview-section";
import { Footer } from "@/components/footer";
import { useModalStates } from "../sections/hooks/use-modal-states";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import type {
  CompanyLogoData,
  KeyContact,
  BenefitsCategory,
  ContactType,
} from "@/types/new-client-wizard";
import { EditorPanelWrapper } from "../sections/components/editor-panel-wrapper";
import { useEditorState } from "../sections/hooks/use-editor-state";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { CompanyNameSelector } from "../step-3-key-contacts/components/company-name-selector";
import { ContactFormFields } from "../step-3-key-contacts/components/contact-form-fields";
import { ContactCardActions } from "../step-3-key-contacts/components/contact-card-actions";
import { AddContactModal } from "../step-3-key-contacts/components/add-contact-modal";
import { Plus } from "lucide-react";
import {
  DndContext,
  MeasuringStrategy,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LargeHorizontalCard } from "@/components/pages/my-benefits-team/large-horizontal-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { PrimaryContactCard } from "@/components/pages/my-benefits-team/primary-contact-card";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import {
  areAllCategoriesHiddenInPortal,
  getCategoryPortalVisibility,
  type CategoryPortalVisibility,
} from "@/lib/portal-category-visibility";
import { toast } from "sonner";
import { PRIMARY_SERVICE_CATEGORY_OPTIONS } from "@/lib/service-categories";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewClientStep5dProps {
  errorFields?: string[];
}

// ==================== SLOT SYSTEM ====================

type CardSlotType = "primary" | "large" | "small";

interface CardSlot {
  id: string;
  type: CardSlotType;
  gridPosition?: {
    row?: number;
    col?: number;
    colSpan?: number;
  };
}

interface ContactPlacement {
  slotId: string;
  contactId: string | number;
}

// Slot definitions for each layout
const getSlotsForLayout = (
  layoutId: number,
  maxContacts: number,
): CardSlot[] => {
  const slots: CardSlot[] = [];

  if (layoutId === 0 || layoutId === 4) {
    // Default Layout: 1 primary + 4 small
    slots.push({ id: "slot-0", type: "primary" });
    for (let i = 1; i < Math.min(5, maxContacts); i++) {
      slots.push({ id: `slot-${i}`, type: "small" });
    }
  } else if (layoutId === 1) {
    // Layout 1: 2 large (top row) + 3 small (bottom row)
    slots.push({ id: "slot-0", type: "large" });
    slots.push({ id: "slot-1", type: "large" });
    for (let i = 2; i < Math.min(5, maxContacts); i++) {
      slots.push({ id: `slot-${i}`, type: "small" });
    }
  } else if (layoutId === 2) {
    // Layout 2: All large horizontal
    for (let i = 0; i < Math.min(4, maxContacts); i++) {
      slots.push({ id: `slot-${i}`, type: "large" });
    }
  } else if (layoutId === 3) {
    // Layout 3: All small vertical
    for (let i = 0; i < Math.min(8, maxContacts); i++) {
      slots.push({ id: `slot-${i}`, type: "small" });
    }
  }

  return slots;
};

// ==================== COMPONENTS ====================

function SortablePreviewCard({
  id,
  children,
  isDragging: externalIsDragging,
  onClick,
}: {
  id: string | number;
  children: React.ReactNode;
  isDragging?: boolean;
  onClick?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || externalIsDragging ? 0.5 : 1,
  };

  // Drag listeners for the entire card, but exclude buttons and links
  const cardDragListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;

      // Don't start drag if clicking on interactive elements
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("a") ||
        target.closest("[role='button']")
      ) {
        return;
      }

      if (listeners?.onPointerDown) {
        listeners.onPointerDown(e as any);
      }
    },
  };

  // Separate drag handle listeners (for visual indicator)
  const dragHandleListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      if (listeners?.onPointerDown) {
        listeners.onPointerDown(e as any);
      }
    },
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative w-full min-w-0 group cursor-grab active:cursor-grabbing",
        (isDragging || externalIsDragging) && "cursor-grabbing",
      )}
      {...attributes}
      {...cardDragListeners}
      onClick={onClick}
    >
      {/* Gray drag handle - visible on hover and when dragging */}
      <div
        {...dragHandleListeners}
        className={cn(
          "absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing",
          "bg-gray-200 hover:bg-gray-300 rounded-md p-1.5 transition-all shadow-sm",
          "opacity-70 group-hover:opacity-100",
          (isDragging || externalIsDragging) && "opacity-100 bg-gray-300",
        )}
        style={{
          touchAction: "none",
        }}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-gray-700" />
      </div>
      {children}
    </div>
  );
}

// Universal card renderer based on slot type
function RenderCardBySlot({
  slot,
  contact,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  index,
  baselineBackgroundColor,
  baselineLogoScale,
}: {
  slot: CardSlot;
  contact: any;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  index?: number;
  baselineBackgroundColor?: string;
  /** keyContacts root logoScale (wizard stores it on the object, not each contact) */
  baselineLogoScale?: number;
}) {
  const isPrimaryContact = index === 0;
  const effectiveLogoScale =
    contact.logoScale ?? baselineLogoScale ?? 1;
  const contactWithProps = {
    ...contact,
    isPrimary: isPrimaryContact,
    logoScale: effectiveLogoScale,
  };

  switch (slot.type) {
    case "primary":
      return (
        <PrimaryContactCard
          contact={contactWithProps}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          appointmentLink={appointmentLink}
          companyName={companyName}
          baselineBackgroundColor={baselineBackgroundColor}
        />
      );
    case "large":
      return (
        <LargeHorizontalCard
          contact={contactWithProps}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          appointmentLink={appointmentLink}
          companyName={companyName}
          index={index}
          disableAnimation={true}
          baselineBackgroundColor={baselineBackgroundColor}
          baselineLogoScale={baselineLogoScale}
        />
      );
    case "small":
      return (
        <SmallVerticalCard
          contact={contactWithProps}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          appointmentLink={appointmentLink}
          companyName={companyName}
          index={index}
          disableAnimation={true}
          baselineBackgroundColor={baselineBackgroundColor}
          baselineLogoScale={baselineLogoScale}
        />
      );
    default:
      return null;
  }
}

export function NewClientStep5d({ errorFields = [] }: NewClientStep5dProps) {
  const { stepData, saveStepDataLocally, saveStepDataToServer, draftClientId } =
    useNewClientWizardStore();
  const modalStates = useModalStates();

  // Refs
  const logoCardRef = useRef<HTMLDivElement>(null);
  const bannerPreviewSectionRef = useRef<HTMLDivElement>(null);
  const originalSidebarWidthRef = useRef<string | null>(null);

  // Form field refs
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const websiteUrlRef = useRef<HTMLInputElement>(null);
  const schedulingUrlRef = useRef<HTMLInputElement>(null);
  const editorScrollContainerRef = useRef<HTMLDivElement>(null);

  // Hooks
  const editorState = useEditorState({ autoOpen: false });

  // Local state
  const [isLogoCardHighlighted, setIsLogoCardHighlighted] = useState(false);
  const [isOverlaySettingsHighlighted, setIsOverlaySettingsHighlighted] =
    useState(false);

  // Contact editing state
  const [selectedContactId, setSelectedContactId] = useState<
    string | number | null
  >(null);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [newContactCategory, setNewContactCategory] =
    useState<BenefitsCategory>("Retirement");
  const [newContactOtherBenefitsText, setNewContactOtherBenefitsText] =
    useState("");
  const [contactType, setContactType] = useState<ContactType>("individual");
  const [benefitsCategories, setBenefitsCategories] = useState<
    BenefitsCategory[]
  >([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [departmentLabel, setDepartmentLabel] = useState("");
  const [supportHours, setSupportHours] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [headshot, setHeadshot] = useState("");
  const [headshotFileName, setHeadshotFileName] = useState("");
  const [headshotAssetId, setHeadshotAssetId] = useState<string | undefined>(
    undefined,
  );
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyLogoAssetId, setCompanyLogoAssetId] = useState<
    string | undefined
  >(undefined);
  const [otherBenefitsText, setOtherBenefitsText] = useState("");
  const [isPrimaryOverall, setIsPrimaryOverall] = useState(false);
  const [displayEmail, setDisplayEmail] = useState(true);
  const [displayPhone, setDisplayPhone] = useState(true);
  const [displayScheduleAppointment, setDisplayScheduleAppointment] =
    useState(false);
  const [displayWebsite, setDisplayWebsite] = useState(false);
  const [contactInfoOrder, setContactInfoOrder] = useState<
    ("phone" | "email")[]
  >(["phone", "email"]);
  const [actionButtonOrder, setActionButtonOrder] = useState<
    ("schedule" | "website")[]
  >(["schedule", "website"]);

  // Category Display (Portal Visibility) — saved to previewData so Complete Setup persists it
  // Read from flat (API load) or nested (local after toggle): previewData.categoryPortalVisibility ?? categoryPortalVisibility
  const [categoryPortalVisibility, setCategoryPortalVisibility] =
    useState<CategoryPortalVisibility>(() =>
      getCategoryPortalVisibility(
        (stepData.employeePortalPreview as any)?.previewData?.categoryPortalVisibility ??
          (stepData.employeePortalPreview as any)?.categoryPortalVisibility
      )
    );

  // Validation state
  const [websiteUrlError, setWebsiteUrlError] = useState("");
  const [schedulingUrlError, setSchedulingUrlError] = useState("");
  const [shouldShowErrors, setShouldShowErrors] = useState(false);

  // Advisor data (for defaults)
  const [advisorOrgName, setAdvisorOrgName] = useState("");
  const [advisorOrgLogo, setAdvisorOrgLogo] = useState("");
  const advisorOffersThisBenefit = !!advisorOrgName;

  const defaultCompanyName = stepData.companyBasics?.companyName || "";
  const defaultCompanyLogo = stepData.companyBasics?.companyLogo?.url || "";
  const defaultBenefitsCategory = "Retirement"; // Fallback

  // Get contacts and layout data
  const keyContactsData = stepData.keyContacts || { contacts: [] };
  const existingContacts = keyContactsData.contacts || [];
  const contactDisplayOrder =
    keyContactsData.contactDisplayOrder ||
    existingContacts.map((c: KeyContact) => c.id);
  const displayStyle = keyContactsData.displayStyle ?? null;
  const initialLayoutStyle =
    displayStyle === null || displayStyle === 0 ? 4 : displayStyle;

  const lastPersistedKeyContactsData = useRef<any>(null);

  // Sort contacts by display order
  const sortedContacts = useMemo(() => {
    return [...existingContacts].sort((a, b) => {
      const indexA = contactDisplayOrder.indexOf(a.id);
      const indexB = contactDisplayOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [existingContacts, contactDisplayOrder]);

  const [contacts, setContacts] = useState<KeyContact[]>(sortedContacts);
  const [layoutStyle, setLayoutStyle] = useState<number>(initialLayoutStyle);
  const [activePreviewId, setActivePreviewId] = useState<
    string | number | null
  >(null);
  const isDraggingRef = useRef<boolean>(false);
  const justFinishedDragRef = useRef<boolean>(false);

  // Track previous values
  const prevSortedContactsRef = useRef<string>("");
  const prevLayoutStyleRef = useRef<number>(initialLayoutStyle);
  const displayStyleRef = useRef(displayStyle);

  useEffect(() => {
    displayStyleRef.current = displayStyle;
  }, [displayStyle]);

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

  // Sync state with selected contact
  useEffect(() => {
    if (selectedContactId) {
      const contact = contacts.find((c) => c.id === selectedContactId);
      if (contact) {
        setContactType(contact.contactType || "individual");
        setBenefitsCategories(contact.benefitsCategories || []);
        setFirstName(contact.firstName || "");
        setLastName(contact.lastName || "");
        setTitle(contact.title || "");
        setDisplayName(contact.displayName || "");
        setDepartmentLabel(contact.departmentLabel || "");
        setSupportHours(contact.supportHours || "");
        setEmail(contact.email || "");
        setPhone(contact.phone || "");
        setCompanyName(contact.companyName || "");
        setWebsiteUrl(contact.websiteUrl || "");
        setSchedulingUrl(contact.schedulingUrl || "");
        setHeadshot(contact.headshot || "");
        setHeadshotFileName(contact.headshotFileName || "");
        setHeadshotAssetId(contact.headshotAssetId);
        setCompanyLogo(contact.companyLogo || "");
        setCompanyLogoAssetId(contact.companyLogoAssetId);
        setOtherBenefitsText(contact.benefitsCategoryOther || "");
        setIsPrimaryOverall(
          contact.isPrimaryOverall || contact.isPrimary || false,
        );
        setDisplayEmail(contact.displayEmail ?? true);
        setDisplayPhone(contact.displayPhone ?? true);
        setDisplayScheduleAppointment(
          contact.displayScheduleAppointment ?? false,
        );
        setDisplayWebsite(contact.displayUrl ?? false);
        setContactInfoOrder(
          (contact.contactInfoOrder as ("phone" | "email")[]) || [
            "phone",
            "email",
          ],
        );
        setActionButtonOrder(
          (contact.actionButtonOrder as ("schedule" | "website")[]) || [
            "schedule",
            "website",
          ],
        );

        // Reset errors when switching contacts
        setWebsiteUrlError("");
        setSchedulingUrlError("");
        setShouldShowErrors(false);
      }
    }
  }, [selectedContactId, contacts]);

  // Auto-save contact changes to stepData with debounce
  useEffect(() => {
    if (!selectedContactId) return;

    // Debounce timer
    const timeoutId = setTimeout(() => {
      setContacts((prevContacts) => {
        const updatedContacts = prevContacts.map((c) => {
          if (c.id === selectedContactId) {
            return {
              ...c,
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
              companyName,
              websiteUrl,
              schedulingUrl,
              name:
                contactType === "individual"
                  ? `${firstName} ${lastName}`.trim()
                  : displayName,
              headshot,
              headshotFileName,
              headshotAssetId,
              companyLogo,
              companyLogoAssetId,
              benefitsCategory: benefitsCategories[0] || "Retirement",
              benefitsCategoryOther: otherBenefitsText,
              displayEmail,
              displayPhone,
              displayScheduleAppointment,
              displayUrl: displayWebsite,
              contactInfoOrder,
              actionButtonOrder,
              enableContactButton:
                displayEmail ||
                displayPhone ||
                displayScheduleAppointment ||
                displayWebsite,
            };
          }
          return c;
        });

        // Get current stepData from store to ensure we have the latest data
        // Use the store's getState method to get the most up-to-date data
        const currentState = useNewClientWizardStore.getState();
        const currentKeyContactsData = currentState.stepData.keyContacts || {
          contacts: [],
        };
        const updatedKeyContacts = {
          ...currentKeyContactsData,
          contacts: updatedContacts,
        };

        saveStepDataLocally("keyContacts", updatedKeyContacts);
        // Save to server
        saveStepDataToServer("keyContacts", updatedKeyContacts).catch(
          (error) => {
            console.error("Failed to save key contacts to server:", error);
          },
        );

        return updatedContacts;
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    companyName,
    websiteUrl,
    schedulingUrl,
    headshot,
    headshotFileName,
    headshotAssetId,
    companyLogo,
    companyLogoAssetId,
    otherBenefitsText,
    displayWebsite,
    contactInfoOrder,
    actionButtonOrder,
    saveStepDataLocally,
    saveStepDataToServer,
  ]);

  // Helper functions
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

  const isValidUrl = (url: string): boolean => {
    if (!url || url.trim() === "") return true;
    const trimmedUrl = url.trim();
    const urlPattern =
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    return urlPattern.test(trimmedUrl);
  };

  const handleWebsiteUrlChange = (value: string) => {
    setWebsiteUrl(value);
    if (value.trim() !== "" && !isValidUrl(value)) {
      setWebsiteUrlError(
        "Please enter a valid URL (e.g., https://example.com)",
      );
    } else {
      setWebsiteUrlError("");
    }
  };

  const handleSchedulingUrlChange = (value: string) => {
    setSchedulingUrl(value);
    if (value.trim() !== "" && !isValidUrl(value)) {
      setSchedulingUrlError(
        "Please enter a valid URL (e.g., https://calendar.example.com)",
      );
    } else {
      setSchedulingUrlError("");
    }
  };

  const handleScheduleAppointmentDisplayChange = (checked: boolean) => {
    if (!checked) {
      setDisplayScheduleAppointment(false);
      return;
    }

    if (!schedulingUrl || !schedulingUrl.trim()) {
      setTimeout(() => {
        if (schedulingUrlRef.current) {
          schedulingUrlRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          schedulingUrlRef.current.focus();
          setSchedulingUrlError(
            "Please enter a Scheduling URL to enable Schedule Appointment",
          );
        }
      }, 100);
      return;
    }
    setDisplayScheduleAppointment(true);
  };

  const handleWebsiteDisplayChange = (checked: boolean) => {
    if (!checked) {
      setDisplayWebsite(false);
      return;
    }

    if (!websiteUrl || !websiteUrl.trim()) {
      setTimeout(() => {
        if (websiteUrlRef.current) {
          websiteUrlRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          websiteUrlRef.current.focus();
          setWebsiteUrlError(
            "Please enter a Website URL to enable Visit Website",
          );
        }
      }, 100);
      return;
    }
    setDisplayWebsite(true);
  };

  const handleSaveContact = () => {
    if (!selectedContactId) return;

    const updatedContacts = contacts.map((c) => {
      if (c.id === selectedContactId) {
        return {
          ...c,
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
          companyName,
          websiteUrl,
          schedulingUrl,
          name:
            contactType === "individual"
              ? `${firstName} ${lastName}`.trim()
              : displayName,
          headshot,
          headshotFileName,
          headshotAssetId,
          companyLogo,
          companyLogoAssetId,
          benefitsCategory: benefitsCategories[0] || "Retirement",
          benefitsCategoryOther: otherBenefitsText,
          displayEmail,
          displayPhone,
          displayScheduleAppointment,
          displayUrl: displayWebsite,
          contactInfoOrder,
          actionButtonOrder,
          enableContactButton:
            displayEmail ||
            displayPhone ||
            displayScheduleAppointment ||
            displayWebsite,
        };
      }
      return c;
    });

    setContacts(updatedContacts);

    const currentKeyContactsData = stepData.keyContacts || { contacts: [] };
    const updatedKeyContacts = {
      ...currentKeyContactsData,
      contacts: updatedContacts,
    };

    saveStepDataLocally("keyContacts", updatedKeyContacts);
    // Save to server
    saveStepDataToServer("keyContacts", updatedKeyContacts).catch((error) => {
      console.error("Failed to save key contacts to server:", error);
    });
    editorState.handleCloseEditor();
  };

  const getCategoryLabel = (category?: BenefitsCategory | string | null) => {
    if (category === "Company / Plan Sponsor") return "Company / Plan Sponsor";
    if (category === "Other Benefits") return "Other";
    return category || "";
  };

  // Initialize smooth transitions for page layout
  useEffect(() => {
    if (!document.body.style.transition.includes("padding-left")) {
      const existingTransition = document.body.style.transition || "";
      document.body.style.transition = existingTransition
        ? `${existingTransition}, padding-left 200ms ease-in-out`
        : "padding-left 200ms ease-in-out";
    }

    const rootStyle = document.documentElement.style;
    if (!rootStyle.transition.includes("--sidebar-width")) {
      const existingTransition = rootStyle.transition || "";
      rootStyle.transition = existingTransition
        ? `${existingTransition}, --sidebar-width 200ms ease-in-out`
        : "--sidebar-width 200ms ease-in-out";
    }
  }, []);

  // Listen for editor toggle events for Step 5
  useEffect(() => {
    const handleOpenEditor = () => {
      editorState.setIsEditorOpen(true);
      setTimeout(() => editorState.setIsEditorAnimating(true), 10);
    };

    const handleCloseEditor = () => {
      if (editorState.isEditorOpen) {
        editorState.setIsEditorAnimating(false);
        editorState.setFocusedTextField(null);
        editorState.setHeroTextField(null);
        setTimeout(() => {
          editorState.setIsEditorOpen(false);
        }, 200);
      }
    };

    window.addEventListener("openStep5Editor" as any, handleOpenEditor);
    window.addEventListener("closeStep5Editor" as any, handleCloseEditor);

    return () => {
      window.removeEventListener("openStep5Editor" as any, handleOpenEditor);
      window.removeEventListener("closeStep5Editor" as any, handleCloseEditor);
    };
  }, [editorState.isEditorOpen]);

  const handleCardClick = (contactId: string | number) => {
    setSelectedContactId(contactId);
    editorState.setIsEditorOpen(true);
    setTimeout(() => editorState.setIsEditorAnimating(true), 10);
  };

  const handleCreateContact = () => {
    const newContactId = `contact-${Date.now()}-${Math.random()}`;
    const isHRPeople = newContactCategory === "Company / Plan Sponsor";
    const isOtherBenefits = newContactCategory === "Other Benefits";

    const contactCompanyName = isHRPeople
      ? stepData.companyBasics?.companyName || ""
      : isOtherBenefits
        ? ""
        : stepData.companyBasics?.companyName || "";

    const contactCompanyLogo = isHRPeople
      ? stepData.companyBasics?.companyLogo?.url || ""
      : isOtherBenefits
        ? ""
        : stepData.companyBasics?.companyLogo?.url || "";

    const newContact: KeyContact = {
      id: newContactId,
      contactType: "individual",
      benefitsCategories: [newContactCategory],
      role: "HR Generalist",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName: contactCompanyName,
      companyLogo: contactCompanyLogo,
      showOnPortal: true,
      isPrimary: false,
      isPrimaryOverall: false,
      displayEmail: true,
      displayPhone: true,
      displayUrl: false,
      enableContactButton: true,
      benefitsCategory: newContactCategory,
      benefitsCategoryOther: isOtherBenefits
        ? newContactOtherBenefitsText
        : undefined,
    };

    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);

    const currentKeyContactsData = stepData.keyContacts || { contacts: [] };
    const updatedKeyContacts = {
      ...currentKeyContactsData,
      contacts: updatedContacts,
    };

    saveStepDataLocally("keyContacts", updatedKeyContacts);
    // Save to server
    saveStepDataToServer("keyContacts", updatedKeyContacts).catch((error) => {
      console.error("Failed to save key contacts to server:", error);
    });

    // Close add modal and open editor for the new contact
    setIsAddContactModalOpen(false);
    setNewContactOtherBenefitsText(""); // Reset for next time
    setSelectedContactId(newContactId);
    editorState.setIsEditorOpen(true);
    setTimeout(() => editorState.setIsEditorAnimating(true), 10);
  };

  // Broadcast editor state changes for Step 5
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("step5EditorStateChange", {
        detail: { isOpen: editorState.isEditorOpen },
      }),
    );
  }, [editorState.isEditorOpen]);

  // Shift bottom panel when side panel is open or animating
  useEffect(() => {
    const sidebarWidth = "36rem";
    const shouldShift =
      editorState.isEditorOpen || editorState.isEditorAnimating;

    if (shouldShift) {
      if (originalSidebarWidthRef.current === null) {
        originalSidebarWidthRef.current =
          document.documentElement.style.getPropertyValue("--sidebar-width");
      }

      document.documentElement.style.setProperty(
        "--sidebar-width",
        sidebarWidth,
      );
    } else {
      if (originalSidebarWidthRef.current !== null) {
        if (originalSidebarWidthRef.current) {
          document.documentElement.style.setProperty(
            "--sidebar-width",
            originalSidebarWidthRef.current,
          );
        } else {
          document.documentElement.style.removeProperty("--sidebar-width");
        }
        originalSidebarWidthRef.current = null;
      }
    }
  }, [editorState.isEditorOpen, editorState.isEditorAnimating]);

  // Initialize placements: map contacts to slots
  const initializePlacements = (
    contacts: KeyContact[],
    slots: CardSlot[],
  ): ContactPlacement[] => {
    return slots
      .map((slot, index) => ({
        slotId: slot.id,
        contactId: contacts[index]?.id || "",
      }))
      .filter((p) => p.contactId !== "");
  };

  // Get slots for current layout
  const slots = useMemo(() => {
    const currentDisplayStyle = layoutStyle === 4 ? 0 : layoutStyle;
    return getSlotsForLayout(currentDisplayStyle, contacts.length);
  }, [layoutStyle, contacts.length]);

  // Derived placements state
  const placements = useMemo(() => {
    return initializePlacements(contacts, slots);
  }, [contacts, slots]);

  // Preview order for sortable list (separate from placements)
  const [previewOrder, setPreviewOrder] = useState<(string | number)[]>(() => {
    return placements.map((p) => p.contactId).filter((id) => id !== "");
  });

  // Sync previewOrder with placements when they change
  useEffect(() => {
    if (isDraggingRef.current || justFinishedDragRef.current) return;

    const newOrder = placements
      .map((p) => p.contactId)
      .filter((id) => id !== "");
    setPreviewOrder(newOrder);
  }, [placements]);

  // Update placements when contacts or layout changes
  useEffect(() => {
    // Don't update if we're dragging or just finished a drag
    if (isDraggingRef.current || justFinishedDragRef.current) return;

    const sortedContactsIds = JSON.stringify(sortedContacts.map((c) => c.id));
    const currentContactsIds = JSON.stringify(contacts.map((c) => c.id));
    const contactsChanged = prevSortedContactsRef.current !== sortedContactsIds;
    const localContactsChanged = sortedContactsIds !== currentContactsIds;

    const currentDisplayStyle = displayStyleRef.current ?? null;
    const currentLayoutStyle =
      currentDisplayStyle === null || currentDisplayStyle === 0
        ? 4
        : currentDisplayStyle;
    const layoutChanged = prevLayoutStyleRef.current !== currentLayoutStyle;

    if (layoutChanged) {
      prevLayoutStyleRef.current = currentLayoutStyle;
      setLayoutStyle(currentLayoutStyle);
    }

    if (contactsChanged && localContactsChanged) {
      prevSortedContactsRef.current = sortedContactsIds;
      setContacts(sortedContacts);
    } else if (contactsChanged && !localContactsChanged) {
      prevSortedContactsRef.current = sortedContactsIds;
    }
  }, [sortedContacts, contacts]);

  // Get brand colors and appointment link
  const brandColor =
    (stepData.companyBasics as any)?.primaryColor ||
    (stepData.companyBasics as any)?.brandColor ||
    "#0D315F";
  const secondaryColor =
    (stepData.companyBasics as any)?.secondaryColor || "#C89B5B";
  const appointmentLink =
    stepData?.companyBasics?.appointmentLink ||
    "https://go.oncehub.com/WFAParticipantInquiry";
  const globalCompanyName = stepData?.companyBasics?.companyName || "";

  // Transform KeyContact to Contact format
  const previewContacts = useMemo(() => {
    return contacts.map((contact) => {
      const isEditing = contact.id === selectedContactId;

      const currentContactType = isEditing ? contactType : contact.contactType;
      const currentFirstName = isEditing ? firstName : contact.firstName;
      const currentLastName = isEditing ? lastName : contact.lastName;
      const currentDisplayName = isEditing ? displayName : contact.displayName;
      const currentTitle = isEditing ? title : contact.title;
      const currentEmail = isEditing ? email : contact.email;
      const currentPhone = isEditing ? phone : contact.phone;
      const currentCompanyName = isEditing ? companyName : contact.companyName;
      const currentWebsiteUrl = isEditing ? websiteUrl : contact.websiteUrl;
      const currentSchedulingUrl = isEditing
        ? schedulingUrl
        : contact.schedulingUrl;
      const currentHeadshot = isEditing ? headshot : contact.headshot;
      const currentCompanyLogo = isEditing ? companyLogo : contact.companyLogo;
      const currentIsPrimary =
        contact.isPrimaryOverall || contact.isPrimary || false;
      const currentDisplayEmail = isEditing
        ? displayEmail
        : contact.displayEmail ?? true;
      const currentDisplayPhone = isEditing
        ? displayPhone
        : contact.displayPhone ?? true;
      const currentDisplayUrl = isEditing
        ? displayWebsite
        : contact.displayUrl ?? false;
      const currentDisplayScheduleAppointment = isEditing
        ? displayScheduleAppointment
        : contact.displayScheduleAppointment ?? false;
      const currentContactInfoOrder = isEditing
        ? contactInfoOrder
        : contact.contactInfoOrder || ["phone", "email"];
      const currentActionButtonOrder = isEditing
        ? actionButtonOrder
        : contact.actionButtonOrder || ["schedule", "website"];

      const effectiveDisplayName =
        (currentContactType === "individual"
          ? `${currentFirstName || ""} ${currentLastName || ""}`.trim()
          : currentDisplayName) || "Unnamed Contact";

      const mapBenefitsCategory = (
        category: string | undefined,
      ):
        | "Retirement"
        | "Health Insurance"
        | "Life Insurance"
        | "Company / Plan Sponsor"
        | "Other"
        | undefined => {
        if (!category) return "Other";
        if (category === "Group Health") return "Health Insurance";
        if (category === "Group Life") return "Life Insurance";
        if (category === "Retirement") return "Retirement";
        if (category === "Company / Plan Sponsor")
          return "Company / Plan Sponsor";
        if (category === "Other Benefits") return "Other";
        if (category === "Recordkeeper / Vendor") return "Other";
        return "Other";
      };

      const benefitsCategory =
        contact.benefitsCategories?.[0] || contact.benefitsCategory || "Other";

      return {
        id: contact.id,
        name: effectiveDisplayName,
        firstName: currentFirstName,
        lastName: currentLastName,
        title: currentTitle,
        customRole: contact.customRole || contact.role,
        email: currentEmail,
        phone: currentPhone,
        headshot: currentHeadshot,
        logo: currentCompanyLogo,
        companyLogo: currentCompanyLogo,
        showOnPortal: contact.showOnPortal !== false,
        benefitsCategory: mapBenefitsCategory(benefitsCategory),
        benefitsCategoryOther: isEditing
          ? otherBenefitsText
          : contact.benefitsCategoryOther,
        companyName: currentCompanyName || globalCompanyName,
        contactType: currentContactType,
        displayName: currentDisplayName,
        isPrimary: currentIsPrimary,
        isPrimaryOverall: currentIsPrimary,
        displayEmail: currentDisplayEmail,
        displayPhone: currentDisplayPhone,
        displayUrl: currentDisplayUrl,
        displayScheduleAppointment: currentDisplayScheduleAppointment,
        contactInfoOrder: currentContactInfoOrder,
        actionButtonOrder: currentActionButtonOrder,
      };
    });
  }, [
    contacts,
    globalCompanyName,
    selectedContactId,
    contactType,
    firstName,
    lastName,
    displayName,
    title,
    email,
    phone,
    companyName,
    websiteUrl,
    schedulingUrl,
    headshot,
    companyLogo,
    otherBenefitsText,
    displayEmail,
    displayPhone,
    displayWebsite,
    displayScheduleAppointment,
    contactInfoOrder,
    actionButtonOrder,
  ]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handlePreviewDragStart = (event: any) => {
    isDraggingRef.current = true;
    setActivePreviewId(event.active.id);
  };

  const handlePreviewDragOver = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPreviewOrder((items) => {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);

      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });

    setActivePreviewId(over.id);
  };

  const handlePreviewDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActivePreviewId(null);

    if (!over || active.id === over.id) {
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
      return;
    }

    // Calculate final order after drag
    const finalOrder = (() => {
      const oldIndex = previewOrder.indexOf(active.id);
      const newIndex = previewOrder.indexOf(over.id);

      if (oldIndex === -1 || newIndex === -1) return previewOrder;
      return arrayMove(previewOrder, oldIndex, newIndex);
    })();

    // Update previewOrder to ensure it's in sync
    setPreviewOrder(finalOrder);

    // Get contacts in the new order
    const newContacts = finalOrder
      .map((id) => contacts.find((c) => c.id === id))
      .filter((c): c is KeyContact => c !== undefined);

    // Fill remaining contacts (those not in finalOrder)
    const remainingContacts = contacts.filter(
      (c) => !finalOrder.includes(c.id),
    );
    const allContactsInOrder = [...newContacts, ...remainingContacts];

    const contactsToUse = allContactsInOrder;

    prevSortedContactsRef.current = JSON.stringify(
      contactsToUse.map((c: KeyContact) => c.id),
    );

    justFinishedDragRef.current = true;

    setContacts(contactsToUse);

    const newDisplayOrder = contactsToUse.map((c) => c.id);
    const currentKeyContactsData = stepData.keyContacts || { contacts: [] };
    const updatedKeyContacts = {
      ...currentKeyContactsData,
      contacts: contactsToUse,
      contactDisplayOrder: newDisplayOrder,
    };

    const currentDataString = JSON.stringify(
      lastPersistedKeyContactsData.current,
    );
    const newDataString = JSON.stringify(updatedKeyContacts);

    if (currentDataString !== newDataString) {
      lastPersistedKeyContactsData.current = updatedKeyContacts;

      setTimeout(() => {
        saveStepDataLocally("keyContacts", updatedKeyContacts);
        // Save to server
        saveStepDataToServer("keyContacts", updatedKeyContacts).catch(
          (error) => {
            console.error("Failed to save key contacts to server:", error);
          },
        );
      }, 0);
    }

    setTimeout(() => {
      isDraggingRef.current = false;
      justFinishedDragRef.current = false;
    }, 300);
  };

  const handlePreviewDragCancel = () => {
    setPreviewOrder(
      placements.map((p) => p.contactId).filter((id) => id !== ""),
    );
    setActivePreviewId(null);
    isDraggingRef.current = false;
  };

  useEffect(() => {
    // Don't update if we're dragging or just finished a drag
    if (isDraggingRef.current || justFinishedDragRef.current) return;

    const currentKeyContactsData = stepData.keyContacts || { contacts: [] };

    if (
      lastPersistedKeyContactsData.current &&
      JSON.stringify(lastPersistedKeyContactsData.current) ===
      JSON.stringify(currentKeyContactsData)
    ) {
      return;
    }

    if (lastPersistedKeyContactsData.current !== null) {
      lastPersistedKeyContactsData.current = currentKeyContactsData;
    } else {
      lastPersistedKeyContactsData.current = currentKeyContactsData;
    }
  }, [stepData.keyContacts]);

  // Sync category portal visibility from stepData (e.g. when loading draft)
  const storedVisibility =
    (stepData.employeePortalPreview as any)?.previewData?.categoryPortalVisibility ??
    (stepData.employeePortalPreview as any)?.categoryPortalVisibility;
  useEffect(() => {
    if (storedVisibility != null && typeof storedVisibility === "object") {
      setCategoryPortalVisibility(getCategoryPortalVisibility(storedVisibility));
    }
  }, [storedVisibility]);

  const handleCategoryPortalVisibilityChange = useCallback(
    async (category: string, checked: boolean) => {
      const next = { ...categoryPortalVisibility, [category]: checked };
      const normalizedNext = getCategoryPortalVisibility(next);
      if (areAllCategoriesHiddenInPortal(normalizedNext)) {
        toast.error("At least one category must stay visible on the Benefits Hub.", {
          description: "Turn visibility back on for another category before hiding this one.",
        });
        return;
      }
      setCategoryPortalVisibility(normalizedNext);
      const previewContent =
        (stepData.employeePortalPreview as any)?.previewData ??
        (stepData.employeePortalPreview as any) ??
        {};
      const flatPayload = { ...previewContent, categoryPortalVisibility: normalizedNext };
      saveStepDataLocally("employeePortalPreview", flatPayload);
      try {
        await saveStepDataToServer("employeePortalPreview", flatPayload);
      } catch (err) {
        console.warn("Failed to save category visibility", err);
      }
    },
    [categoryPortalVisibility, stepData.employeePortalPreview, saveStepDataLocally, saveStepDataToServer]
  );

  // Handle company data changes
  const handleCompanyDataChange = (field: string, value: any) => {
    if (stepData.companyBasics) {
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        [field]: value,
      });
    }
  };

  // Handle logo modal save
  const handleModalSave = (value: string, cropData?: any) => {
    if (!modalStates.pendingLogoData) return;

    const existingLogo = stepData.companyBasics?.companyLogo;
    const logoData: CompanyLogoData = {
      url: value,
      originalUrl:
        cropData?.originalImage ||
        modalStates.pendingLogoData.originalUrl ||
        value,
      fileName: modalStates.pendingLogoData.fileName || "logo.png",
      fileSize: existingLogo?.fileSize || 0,
      width: existingLogo?.width || 0,
      height: existingLogo?.height || 0,
      hasTransparency: existingLogo?.hasTransparency || false,
      warnings: existingLogo?.warnings || [],
      cropData: cropData,
    };

    if (stepData.companyBasics) {
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        companyLogo: logoData,
      });
    }

    if (modalStates.logoModalHandlers) {
      modalStates.logoModalHandlers.onClose();
    }
  };


  // Render slots based on layout
  const currentDisplayStyle = layoutStyle === 4 ? 0 : layoutStyle;
  const previewContent = useMemo(() => {
    if (previewContacts.length === 0 || slots.length === 0) return null;

    // Get contacts in previewOrder
    const orderedContacts = previewOrder
      .map((id) => previewContacts.find((c) => c.id === id))
      .filter(Boolean) as typeof previewContacts;

    // Render contacts in order, assigning slots by index
    const slotElements = orderedContacts
      .slice(0, slots.length)
      .map((contact, index) => {
        const slot = slots[index];
        if (!slot) return null;

        return (
          <SortablePreviewCard
            key={contact.id}
            id={contact.id}
            isDragging={activePreviewId === contact.id}
            onClick={() => handleCardClick(contact.id)}
          >
            <RenderCardBySlot
              slot={slot}
              contact={contact}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              index={index}
              baselineBackgroundColor={keyContactsData.cardBackgroundColor}
              baselineLogoScale={
                typeof keyContactsData.logoScale === "number"
                  ? keyContactsData.logoScale
                  : undefined
              }
            />
          </SortablePreviewCard>
        );
      })
      .filter(Boolean);

    // Layout-specific JSX structure
    if (currentDisplayStyle === 0 || currentDisplayStyle === null) {
      // Default Layout: 1 primary + 4 small
      const primarySlot = slotElements[0];
      const smallSlots = slotElements.slice(1);
      return (
        <>
          <div className="w-full min-w-0">{primarySlot}</div>
          {smallSlots.length > 0 && (
            <div className="mt-3 w-full min-w-0">
              <div className="grid w-full min-w-0 grid-cols-4 gap-1">
                {smallSlots}
              </div>
            </div>
          )}
        </>
      );
    }

    if (currentDisplayStyle === 1) {
      // Layout 1: 2 large (top) + 3 small (bottom)
      const largeSlots = slotElements.slice(0, 2);
      const smallSlots = slotElements.slice(2);
      return (
        <>
          <div className="mt-11 grid w-full min-w-0 gap-8 md:grid-cols-2">
            {largeSlots}
          </div>
          {smallSlots.length > 0 && (
            <div className="mt-3 w-full min-w-0">
              <div className="grid w-full min-w-0 grid-cols-3 gap-8">
                {smallSlots}
              </div>
            </div>
          )}
        </>
      );
    }

    if (currentDisplayStyle === 2) {
      // Layout 2: All large
      return (
        <div className="mt-10 grid w-full min-w-0 gap-8 md:grid-cols-2">
          {slotElements}
        </div>
      );
    }

    if (currentDisplayStyle === 3) {
      // Layout 3: All small
      return (
        <div className="mt-10 w-full min-w-0">
          <div className="grid w-full min-w-0 grid-cols-4 gap-8">{slotElements}</div>
        </div>
      );
    }

    return null;
  }, [
    slots,
    previewOrder,
    previewContacts,
    currentDisplayStyle,
    brandColor,
    secondaryColor,
    appointmentLink,
    companyName,
    activePreviewId,
  ]);

  return (
    <div
      className="space-y-4 transition-all duration-200"
      style={{
        transition:
          "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out",
      }}
    >
      {/* Banner Preview (Header) */}
      <div ref={bannerPreviewSectionRef} data-preview-section="banner">
        <PortalHeader
          companyData={{
            companyLogo: stepData.companyBasics?.companyLogo?.url || "",
          }}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={stepData.companyBasics?.companyWebsite || ""}
        />
      </div>

      {/* My Benefits Team Preview */}
      <div data-preview-section="benefits-team">
        {/* Preview Content */}
        <div className="bg-[#F8F8F3] rounded-lg p-8 border border-gray-200">
          <div className="text-center mb-8">
            <h1
              className="text-4xl font-semibold"
              style={{
                fontFamily: '"DM Serif Display", serif',
                color: brandColor,
              }}
            >
              My Benefits Team
            </h1>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
            onDragStart={handlePreviewDragStart}
            onDragOver={handlePreviewDragOver}
            onDragEnd={handlePreviewDragEnd}
            onDragCancel={handlePreviewDragCancel}
          >
            <SortableContext
              items={previewOrder}
              strategy={rectSortingStrategy}
            >
              <div className="w-full min-w-0">{previewContent}</div>
            </SortableContext>
          </DndContext>

          {/* Add Contact Button */}
          <div className="flex justify-center mt-8">
            <Button
              onClick={() => setIsAddContactModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer brandColor={brandColor} />

      {/* Side editor panel */}
      <EditorPanelWrapper
        isOpen={editorState.isEditorOpen}
        isAnimating={editorState.isEditorAnimating}
        editorScrollContainerRef={editorScrollContainerRef}
        onClose={editorState.handleCloseEditor}
      >
        <div className="p-6 space-y-8">
          <div className="space-y-6">
            {/* Category Display (Portal Visibility) — autosave on toggle */}
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Category Display (Portal Visibility)
                </CardTitle>
                <p className="text-xs text-muted-foreground font-normal mt-1">
                  Show or hide each category in the portal and My Benefits Team. Changes apply automatically.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {PRIMARY_SERVICE_CATEGORY_OPTIONS.map((category) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="font-medium text-sm">{category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {categoryPortalVisibility[category] !== false ? "Show" : "Hide"}
                      </span>
                      <Switch
                        checked={categoryPortalVisibility[category] !== false}
                        onCheckedChange={(checked) =>
                          handleCategoryPortalVisibilityChange(category, checked)
                        }
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Benefits Categories */}
            <div
              className="space-y-2 flex flex-col"
              data-field="benefitsCategories"
            >
              <Label>
                Benefits Categories <span className="text-red-500">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-2">
                      <Input
                        value={getCategoryLabel(
                          benefitsCategories[0] ||
                          defaultBenefitsCategory ||
                          "Retirement",
                        )}
                        readOnly
                        className={cn(
                          "bg-gray-50 cursor-default",
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
                          <Label htmlFor="other-benefits-text-step3b">
                            Benefit Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="other-benefits-text-step3b"
                            type="text"
                            value={otherBenefitsText}
                            readOnly
                            className={cn(
                              "bg-gray-50 cursor-default",
                              shouldShowErrors &&
                              errorFields.includes("otherBenefitsText") &&
                              "border-red-500",
                            )}
                            disabled={contacts.length === 0}
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

            <div className="space-y-2">
              <CompanyNameSelector
                value={companyName}
                onChange={setCompanyName}
                logo={companyLogo}
                onLogoChange={setCompanyLogo}
                defaultCompanyName={defaultCompanyName}
                defaultCompanyLogo={defaultCompanyLogo}
                isInternalHR={false}
                companyNameRef={companyNameRef}
                disabled={contacts.length === 0}
                benefitsCategories={benefitsCategories}
                advisorOrgName={advisorOrgName}
                advisorOrgLogo={advisorOrgLogo}
                advisorOffersThisBenefit={advisorOffersThisBenefit}
                otherBenefitsText={otherBenefitsText}
                onOtherBenefitsTextChange={setOtherBenefitsText}
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
              firstNameRef={firstNameRef}
              lastNameRef={lastNameRef}
              titleRef={titleRef}
              errorFields={shouldShowErrors ? errorFields : []}
              disabled={contacts.length === 0}
            />

            {/* Email */}
            <div className="space-y-2" data-field="email">
              <Label>
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => {
                  if (contacts.length > 0) {
                    setEmail(e.target.value);
                  }
                }}
                placeholder="email@example.com"
                className={cn(
                  contacts.length === 0 && "opacity-50 cursor-not-allowed",
                  shouldShowErrors &&
                  errorFields.some((field) => field.includes("email")) &&
                  "border-red-500",
                )}
                disabled={contacts.length === 0}
              />
            </div>

            {/* Phone - Required */}
            <div className="space-y-2" data-field="phone">
              <Label>
                Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                ref={phoneRef}
                type="tel"
                value={phone ? formatPhoneNumber(phone) : ""}
                onChange={(e) => {
                  if (contacts.length > 0) {
                    handlePhoneChange(e.target.value);
                  }
                }}
                placeholder="(555) 123-4567"
                className={cn(
                  contacts.length === 0 && "opacity-50 cursor-not-allowed",
                  shouldShowErrors &&
                  errorFields.some((field) => field.includes("phone")) &&
                  "border-red-500",
                )}
                disabled={contacts.length === 0}
              />
            </div>

            {/* Benefits Access URL (optional) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Benefits Access URL (optional)</Label>
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
                className={cn(
                  contacts.length === 0 && "opacity-50 cursor-not-allowed",
                  websiteUrlError && "border-red-500 ring-2 ring-red-500",
                )}
                disabled={contacts.length === 0}
              />
              {websiteUrlError && (
                <p className="text-xs text-red-500">{websiteUrlError}</p>
              )}
            </div>

            {/* Scheduling URL (optional) */}
            <div className="space-y-2">
              <Label>Scheduling URL (optional)</Label>
              <Input
                ref={schedulingUrlRef}
                type="url"
                value={schedulingUrl}
                onChange={(e) => handleSchedulingUrlChange(e.target.value)}
                placeholder="https://calendar.example.com"
                className={cn(
                  contacts.length === 0 && "opacity-50 cursor-not-allowed",
                  schedulingUrlError && "border-red-500 ring-2 ring-red-500",
                )}
                disabled={contacts.length === 0}
              />
              {schedulingUrlError && (
                <p className="text-xs text-red-500">{schedulingUrlError}</p>
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
              disabled={contacts.length === 0}
            />
          </div>
        </div>
      </EditorPanelWrapper>

      {/* UniversalImageEditorModal for Company Logo */}
      {modalStates.isLogoModalOpen &&
        modalStates.pendingLogoData &&
        modalStates.logoModalHandlers && (
          <UniversalImageEditorModal
            type="normalizer"
            modalTitle="Company Logo"
            modalDescription="Upload and edit your company logo."
            value={modalStates.pendingLogoData.url || ""}
            originalValue={modalStates.pendingLogoData.originalUrl}
            fileName={modalStates.pendingLogoData.fileName || ""}
            existingCropData={modalStates.pendingLogoData.cropData}
            onChange={handleModalSave}
            onRemove={modalStates.logoModalHandlers.onClose}
            isOpen={modalStates.isLogoModalOpen}
            onClose={modalStates.logoModalHandlers.onClose}
            saveButtonText="Save Logo"
          />
        )}

      {/* Add Contact Modal */}
      <AddContactModal
        open={isAddContactModalOpen}
        onOpenChange={setIsAddContactModalOpen}
        benefitsCategory={newContactCategory}
        onBenefitsCategoryChange={setNewContactCategory}
        onCreateContact={handleCreateContact}
        contacts={contacts}
        otherBenefitsText={newContactOtherBenefitsText}
        onOtherBenefitsTextChange={setNewContactOtherBenefitsText}
        defaultCompanyLogo={stepData.companyBasics?.companyLogo?.url || ""}
      />
    </div>
  );
}
