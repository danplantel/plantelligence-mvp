"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GripVertical,
  LayoutGrid,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Palette,
  Monitor,
  Smartphone,
} from "lucide-react";
import { BenefitsCategory, KeyContact } from "@/types/new-client-wizard";
import { cn } from "@/lib/utils";
import { useContactStyles } from "../sections/hooks/use-contact-styles";
import { EditorPanelWrapper } from "../sections/components/editor-panel-wrapper";
import { ContactSectionEditor } from "../sections/components/contact-section-editor";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LargeHorizontalCard } from "@/components/pages/my-benefits-team/large-horizontal-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { PrimaryContactCard } from "@/components/pages/my-benefits-team/primary-contact-card";
import { ContactAvatar } from "@/components/pages/my-benefits-team/contact-avatar";

interface NewClientStep3dProps {
  errorFields?: string[];
  onNext?: () => void;
  /** Called when user clicks Back to return to Category Explorer */
  onBack?: () => void;
}

interface LayoutOption {
  id: number;
  name: string;
  description: string;
  preview: React.ReactNode;
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

  if (layoutId === 0 || layoutId === 1) {
    // Default Layout: 1 primary + 4 small
    slots.push({ id: "slot-0", type: "primary" });
    for (let i = 1; i < Math.min(5, maxContacts); i++) {
      slots.push({ id: `slot-${i}`, type: "small" });
    }
  } else if (layoutId === 4) {
    // Layout 4: 2 large (top row) + 3 small (bottom row)
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
        "relative w-full min-w-0 h-full group cursor-grab active:cursor-grabbing",
        (isDragging || externalIsDragging) && "cursor-grabbing",
      )}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only trigger click if not clicking on the drag handle
        const target = e.target as HTMLElement;
        if (!target.closest('[title="Drag to reorder"]')) {
          onClick?.();
        }
      }}
    >
      {/* Gray drag handle - visible on hover and when dragging */}
      <div
        {...dragHandleListeners}
        className={cn(
          "absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing",
          "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md p-1.5 transition-all shadow-sm",
          "opacity-70 group-hover:opacity-100",
          (isDragging || externalIsDragging) && "opacity-100 bg-gray-300 dark:bg-gray-600",
        )}
        style={{
          touchAction: "none",
        }}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-gray-700 dark:text-gray-300" />
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
  logoScale,
  index,
  baselineBackgroundColor,
  compact,
}: {
  slot: CardSlot;
  contact: any;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  logoScale?: number;
  index?: number;
  baselineBackgroundColor?: string;
  /** When true, SmallVerticalCard uses compact sizing (reduced padding, avatar, text) */
  compact?: boolean;
}) {
  // Use index to determine visual primary status (first item is always primary)
  const isPrimaryContact = index === 0;
  const contactWithProps = {
    ...contact,
    isPrimary: isPrimaryContact,
  };

  // Category badge for the card
  const categoryBadge = contact.categoryLabel ? (
    <div className="absolute top-2 right-2 z-10">
      <Badge
        variant="secondary"
        className="text-[10px] px-2 py-0.5 font-medium bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-600 shadow-sm"
      >
        {contact.categoryLabel}
      </Badge>
    </div>
  ) : null;

  switch (slot.type) {
    case "primary":
      return (
        <div className="relative w-full h-full">
          {categoryBadge}
          <PrimaryContactCard
            contact={contactWithProps}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            logoScale={logoScale}
            baselineBackgroundColor={baselineBackgroundColor}
            compact={true}
          />
        </div>
      );
    case "large":
      return (
        <div className="relative w-full h-full">
          {categoryBadge}
          <LargeHorizontalCard
            contact={contactWithProps}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={index}
            disableAnimation={true}
            baselineBackgroundColor={baselineBackgroundColor}
          />
        </div>
      );
    case "small":
      return (
        <div className="relative w-full h-full">
          {categoryBadge}
          <SmallVerticalCard
            contact={contactWithProps}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={index}
            disableAnimation={true}
            baselineBackgroundColor={baselineBackgroundColor}
            compact={compact}
          />
        </div>
      );
    default:
      return null;
  }
}

// ==================== MAIN COMPONENT ====================

export function NewClientStep3d({
  errorFields = [],
  onNext,
  onBack,
}: NewClientStep3dProps) {
  const {
    stepData,
    saveStepDataLocally,
    saveStepDataToServer,
    saveAsDraft,
    currentStep,
  } = useNewClientWizardStore();

  // Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditorAnimating, setIsEditorAnimating] = useState(false);
  const editorScrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync editor state with window events
  useEffect(() => {
    const handleOpenEditor = () => {
      setIsEditorOpen(true);
      setTimeout(() => setIsEditorAnimating(true), 10);
    };
    const handleCloseEditor = () => {
      setIsEditorAnimating(false);
      setTimeout(() => setIsEditorOpen(false), 200);
    };

    window.addEventListener("openStep3Editor", handleOpenEditor);
    window.addEventListener("closeStep3Editor", handleCloseEditor);

    return () => {
      window.removeEventListener("openStep3Editor", handleOpenEditor);
      window.removeEventListener("closeStep3Editor", handleCloseEditor);
    };
  }, []);

  // Dispatch state change events for WizardStepper
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("step3EditorStateChange", {
        detail: { isOpen: isEditorOpen },
      }),
    );
  }, [isEditorOpen]);

  const { styles } = useContactStyles();

  // Get brand colors and appointment link
  const brandColor = styles.cardPrimaryColor;
  const secondaryColor = styles.cardSecondaryColor;
  const globalBackgroundColor = "#ffffff";

  const appointmentLink =
    stepData?.companyBasics?.appointmentLink ||
    "https://go.oncehub.com/WFAParticipantInquiry";
  const companyName = stepData?.companyBasics?.companyName || "";
  const planCompanyLogo = stepData?.companyBasics?.companyLogo?.url || "";

  // Get contacts
  const keyContactsData = stepData.keyContacts || { contacts: [] };
  const existingContacts = keyContactsData.contacts || [];
  const contactDisplayOrder =
    keyContactsData.contactDisplayOrder ||
    existingContacts.map((c: KeyContact) => c.id);
  const displayStyle = keyContactsData.displayStyle ?? null;
  const initialLayoutStyle =
    displayStyle === null || displayStyle === 0 ? 1 : displayStyle;

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

  // Handle card click to open editor and focus contact
  const handleCardClick = useCallback(
    (contactId: string | number) => {
      // Open editor if it's not open
      if (!isEditorOpen) {
        setIsEditorOpen(true);
        setTimeout(() => setIsEditorAnimating(true), 10);
      }
      // Dispatch focus event for the specific contact
      window.dispatchEvent(
        new CustomEvent("focusContact", { detail: { contactId } }),
      );
    },
    [isEditorOpen],
  );

  const [contacts, setContacts] = useState<KeyContact[]>(sortedContacts);
  const [layoutStyle, setLayoutStyle] = useState<number>(initialLayoutStyle);
  const [activePreviewId, setActivePreviewId] = useState<
    string | number | null
  >(null);
  const [isLayoutSectionCollapsed, setIsLayoutSectionCollapsed] =
    useState(true);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [mobileLayoutStyle, setMobileLayoutStyle] = useState<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const justFinishedDragRef = useRef<boolean>(false);

  // Track previous values
  const prevSortedContactsRef = useRef<string>("");
  const prevLayoutStyleRef = useRef<number>(initialLayoutStyle);
  const displayStyleRef = useRef(displayStyle);

  useEffect(() => {
    displayStyleRef.current = displayStyle;
  }, [displayStyle]);

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

  // Get slots for current layout — use sortedContacts.length (store-derived) for consistency
  const slots = useMemo(() => {
    const currentDisplayStyle = layoutStyle === 1 ? 0 : layoutStyle;
    return getSlotsForLayout(currentDisplayStyle, sortedContacts.length);
  }, [layoutStyle, sortedContacts.length]);

  // Derived placements state — use sortedContacts (store-derived) for consistency with previewContacts
  const placements = useMemo(() => {
    return initializePlacements(sortedContacts, slots);
  }, [sortedContacts, slots]);

  // Preview order for sortable list (separate from placements)
  const [previewOrder, setPreviewOrder] = useState<(string | number)[]>(() => {
    return placements.map((p) => p.contactId).filter((id) => id !== "");
  });

  // Sync previewOrder with placements when they change.
  // Guard against infinite loop: placements is a useMemo derived from
  // sortedContacts (which always gets a new reference from Zustand), so
  // the effect would fire every render and setPreviewOrder with a fresh
  // array → another render → another placements reference → …
  const prevPlacementsOrderRef = useRef<string>("");

  useEffect(() => {
    if (isDraggingRef.current || justFinishedDragRef.current) return;

    const newOrder = placements
      .map((p) => p.contactId)
      .filter((id) => id !== "");
    const newOrderKey = JSON.stringify(newOrder);

    if (prevPlacementsOrderRef.current === newOrderKey) return;
    prevPlacementsOrderRef.current = newOrderKey;

    setPreviewOrder(newOrder);
  }, [placements]);

  // Update placements when contacts or layout changes
  useEffect(() => {
    // Don't update if we're dragging or just finished a drag
    if (isDraggingRef.current || justFinishedDragRef.current) return;

    // Compare full content, not just IDs, to detect property changes (names, role, colors)
    const sortedContactsFull = JSON.stringify(sortedContacts);
    const currentContactsFull = JSON.stringify(contacts);
    const contactsChanged =
      prevSortedContactsRef.current !== sortedContactsFull;
    const localContactsChanged = sortedContactsFull !== currentContactsFull;

    const currentDisplayStyle = displayStyleRef.current ?? null;
    const currentLayoutStyle =
      currentDisplayStyle === null || currentDisplayStyle === 0
        ? 1
        : currentDisplayStyle;
    const layoutChanged = prevLayoutStyleRef.current !== currentLayoutStyle;

    if (layoutChanged) {
      prevLayoutStyleRef.current = currentLayoutStyle;
      setLayoutStyle(currentLayoutStyle);
    }

    // If store data changed and it differs from local state, sync it
    if (contactsChanged && localContactsChanged) {
      prevSortedContactsRef.current = sortedContactsFull;
      setContacts(sortedContacts);
    } else if (contactsChanged) {
      // Data changed in store but already reflected in local (e.g. from a drag)
      prevSortedContactsRef.current = sortedContactsFull;
    }
  }, [sortedContacts, contacts]);

  // Transform KeyContact to Contact format — memoized on a stable JSON key so new
  // object references from the store don't force downstream re-renders, BUT also
  // captures field-level changes (firstName, email, phone, etc.) so that edits in
  // the side panel produce real-time preview updates.
  // Derives from sortedContacts (always reflects current store data) instead of local contacts state
  // which can be stale due to sync-effect guards. Visual order is driven by previewOrder, not by this array.
  const previewContactsKey = useMemo(
    () => JSON.stringify(sortedContacts),
    [sortedContacts],
  );
  const previewContacts = useMemo(() => {
    return sortedContacts.map((contact, index) => {
      const displayName =
        contact.name ||
        (contact.contactType === "individual"
          ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
          : contact.displayName) ||
        "Unnamed Contact";

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
        if (category === "Third Party Contact") return "Other";
        return "Other";
      };

      const rawBenefitsCategory =
        contact.benefitsCategories?.[0] || contact.benefitsCategory || "Other";

      // Display-friendly label for the category badge
      const categoryLabel = rawBenefitsCategory === "Group Health"
        ? "Group Health"
        : rawBenefitsCategory === "Group Life"
        ? "Group Life"
        : rawBenefitsCategory === "Retirement"
        ? "Retirement"
        : rawBenefitsCategory === "Other Benefits"
        ? "Other Benefits"
        : rawBenefitsCategory === "Company / Plan Sponsor"
        ? "Company / Plan Sponsor"
        : rawBenefitsCategory === "Third Party Contact"
        ? "External HR / Administrator"
        : rawBenefitsCategory || "Other";

      return {
        id: contact.id,
        name: displayName,
        firstName: contact.firstName,
        lastName: contact.lastName,
        title: contact.title,
        customRole: contact.customRole || contact.role,
        email: contact.email,
        phone: contact.phone,
        headshot: contact.headshot,
        logo: contact.companyLogo || planCompanyLogo,
        companyLogo: contact.companyLogo || planCompanyLogo,
        showOnPortal: contact.showOnPortal !== false,
        benefitsCategory: mapBenefitsCategory(rawBenefitsCategory),
        benefitsCategoryOther: contact.benefitsCategoryOther,
        categoryLabel,
        companyName: contact.companyName || "",
        contactType: contact.contactType,
        displayName: contact.displayName,
        teamImage: contact.teamImage,
        isPrimary: contact.isPrimary || false,
        isPrimaryOverall: contact.isPrimaryOverall || false,
        cardPrimaryColor: contact.cardPrimaryColor,
        cardSecondaryColor: contact.cardSecondaryColor,
        cardBackgroundColor: undefined,
        logoScale: contact.logoScale,
        phoneExtension: contact.phoneExtension,
        displayEmail: contact.displayEmail,
        displayPhone: contact.displayPhone,
        displayUrl: contact.displayUrl,
        displayScheduleAppointment: contact.displayScheduleAppointment,
        schedulingUrl: contact.schedulingUrl,
        websiteUrl: contact.websiteUrl,
        enableContactButton: contact.enableContactButton,
        contactButtonType: contact.contactButtonType,
        contactInfoOrder: contact.contactInfoOrder,
        actionButtonOrder: contact.actionButtonOrder,
      };
    });
  }, [previewContactsKey, companyName]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleLayoutChange = async (layoutId: number) => {
    setLayoutStyle(layoutId);
    const displayStyleValue = layoutId === 1 ? 0 : layoutId;
    const updatedKeyContacts = {
      ...keyContactsData,
      contacts: contacts, // Ensure current contacts are included
      contactDisplayOrder: contacts.map((c) => c.id), // Ensure display order is included
      displayStyle: displayStyleValue,
    };
    lastPersistedKeyContactsData.current = updatedKeyContacts;
    await saveStepDataLocally("keyContacts", updatedKeyContacts);

    // Save to server and draft
    try {
      await saveStepDataToServer("keyContacts", updatedKeyContacts);
      await saveAsDraft();
    } catch (error) {
      console.error("Failed to save draft when changing layout:", error);
    }
  };

  // Function to save current state before next step
  const saveCurrentState = useCallback(async () => {
    const currentKeyContactsData = stepData.keyContacts || { contacts: [] };
    const updatedKeyContacts = {
      ...currentKeyContactsData,
      contacts: contacts, // Use current local contacts state
      contactDisplayOrder: contacts.map((c) => c.id), // Use current display order
      displayStyle: layoutStyle === 1 ? 0 : layoutStyle, // Use current layout style
    };

    await saveStepDataLocally("keyContacts", updatedKeyContacts);
    try {
      await saveStepDataToServer("keyContacts", updatedKeyContacts);
      await saveAsDraft();
    } catch (error) {
      console.error("Failed to save draft in saveCurrentState:", error);
    }
  }, [
    contacts,
    layoutStyle,
    stepData.keyContacts,
    saveStepDataLocally,
    saveStepDataToServer,
    saveAsDraft,
  ]);

  // Expose saveCurrentState function to parent/window for use before next step
  useEffect(() => {
    (window as any).__step3dSaveCurrentState = saveCurrentState;
    return () => {
      delete (window as any).__step3dSaveCurrentState;
    };
  }, [saveCurrentState]);

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

    // Calculate final order after drag
    const finalOrder = (() => {
      const oldIndex = previewOrder.indexOf(active.id);
      const newIndex = previewOrder.indexOf(over?.id || "");

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

    // Only update order, don't change primary status data
    const contactsToUse = allContactsInOrder;

    // Update ref to prevent useEffect from overwriting
    prevSortedContactsRef.current = JSON.stringify(
      contactsToUse.map((c: KeyContact) => c.id),
    );

    // Mark that we just finished a drag
    justFinishedDragRef.current = true;

    // Update contacts (placements will update via useMemo)
    setContacts(contactsToUse);

    // Save to store only if there are changes
    const newDisplayOrder = contactsToUse.map((c) => c.id);
    const currentKeyContactsData = stepData.keyContacts || { contacts: [] };
    const updatedKeyContacts = {
      ...currentKeyContactsData,
      contacts: contactsToUse,
      contactDisplayOrder: newDisplayOrder,
    };

    // Check if data actually changed before saving
    const currentDataString = JSON.stringify(
      lastPersistedKeyContactsData.current,
    );
    const newDataString = JSON.stringify(updatedKeyContacts);

    if (currentDataString !== newDataString) {
      // Update lastPersistedKeyContactsData before saving to prevent infinite loop
      lastPersistedKeyContactsData.current = updatedKeyContacts;

      // Use setTimeout to defer the save and prevent immediate re-render
      setTimeout(async () => {
        await saveStepDataLocally("keyContacts", updatedKeyContacts);

        // Save to server and draft
        try {
          await saveStepDataToServer("keyContacts", updatedKeyContacts);
          await saveAsDraft();
        } catch (error) {
          console.error(
            "Failed to save draft when reordering contacts:",
            error,
          );
        }
      }, 0);
    }

    // Reset dragging flag after state updates with longer delay to ensure useEffect doesn't trigger
    setTimeout(() => {
      isDraggingRef.current = false;
      justFinishedDragRef.current = false;
    }, 300);
  };

  const handlePreviewDragCancel = () => {
    // Reset previewOrder to placements order
    setPreviewOrder(
      placements.map((p) => p.contactId).filter((id) => id !== ""),
    );
    setActivePreviewId(null);
    isDraggingRef.current = false;
  };

  // Sync contacts from store — use a stable JSON key so the effect only
  // fires when the actual data changes, NOT when the store returns a new
  // object reference with identical content (Zustand always creates fresh
  // slices). Without this guard, any store write (e.g. from the editor
  // panel) would cause a new `stepData.keyContacts` reference, triggering
  // this effect → comparing → returning early → but still counting as a
  // re-render cycle, which can cascade into the Radix Checkbox setRef loop.
  const keyContactsFingerprint = useMemo(
    () =>
      stepData.keyContacts
        ? JSON.stringify(stepData.keyContacts)
        : null,
    [stepData.keyContacts],
  );

  useEffect(() => {
    // Don't update if we're dragging or just finished a drag
    if (isDraggingRef.current || justFinishedDragRef.current) return;

    // Keep existing contacts when the store hasn't hydrated yet (skipHydration: true).
    // This prevents the local contacts state from being cleared on initial page load
    // before the Zustand persist middleware has rehydrated from localStorage.
    if (!keyContactsFingerprint) return;

    const currentKeyContactsData = stepData.keyContacts;
    if (!currentKeyContactsData) return;

    if (
      lastPersistedKeyContactsData.current &&
      JSON.stringify(lastPersistedKeyContactsData.current) ===
        keyContactsFingerprint
    ) {
      return;
    }

    lastPersistedKeyContactsData.current = currentKeyContactsData;

    // Actually update the local state when store changes
    const newContacts = currentKeyContactsData.contacts || [];
    setContacts(newContacts);

    const newStyle = currentKeyContactsData.displayStyle ?? null;
    setLayoutStyle(newStyle === null || newStyle === 0 ? 1 : newStyle);

    // Sync preview order if needed
    const newOrder =
      currentKeyContactsData.contactDisplayOrder ||
      newContacts.map((c: any) => c.id);
    setPreviewOrder(newOrder);
  }, [keyContactsFingerprint]);

  // Layout previews
  const layoutOptions: LayoutOption[] = [
    {
      id: 1,
      name: "Layout 1 (Default)",
      description: "1 primary + 4 small vertical (default)",
      preview: (
        <div className="space-y-2">
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 2,
      name: "Layout 2",
      description: "4 large horizontal cards",
      preview: (
        <div className="grid grid-cols-2 gap-2">
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ),
    },
    {
      id: 3,
      name: "Layout 3",
      description: "8 small vertical cards",
      preview: (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      ),
    },
    {
      id: 4,
      name: "Layout 4",
      description:
        "2 large horizontal (top row) + 3 small vertical (bottom row)",
      preview: (
        <div className="grid grid-cols-6 gap-1.5">
          <div className="col-span-3 h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="col-span-3 h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="col-span-2 h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="col-span-2 h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="col-span-2 h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ),
    },
  ];

  // Mobile layout options
  const mobileLayoutOptions: LayoutOption[] = [
    {
      id: 0,
      name: "Stacked",
      description: "All cards stacked vertically (single column)",
      preview: (
        <div className="space-y-1.5">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ),
    },
    {
      id: 1,
      name: "2-Column Grid",
      description: "All cards in a 2-column grid",
      preview: (
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      ),
    },
    {
      id: 2,
      name: "Hero + Grid",
      description: "First card full width, remaining in 2-column grid",
      preview: (
        <div className="space-y-1.5">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      ),
    },
  ];

  const currentDisplayStyle = layoutStyle === 1 ? 0 : layoutStyle;
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

        // In mobile preview, use "small" card type for all cards so the main
        // contact renders with a vertical layout (headshot above info) matching
        // the other cards, instead of the desktop horizontal PrimaryContactCard.
        const mobileSlot =
          previewMode === "mobile"
            ? ({ ...slot, type: "small" as const })
            : slot;

        // For desktop Layout 2 & 4, render "large" horizontal cards as compact
        // SmallVerticalCard to match the mobile hero card appearance (vertical layout,
        // reduced padding/avatar/text) instead of the wide horizontal card.
        const largeAsCompact =
          previewMode !== "mobile" &&
          (currentDisplayStyle === 2 || currentDisplayStyle === 4) &&
          slot.type === "large";

        const effectiveSlot = largeAsCompact
          ? ({ ...slot, type: "small" as const })
          : mobileSlot;

        // Use compact sizing for all mobile layouts so stacked cards have the same
        // reduced padding, avatar, and text proportions as the Hero card in the
        // Hero + Grid layout. Also use compact when large cards are converted.
        const isCompact = previewMode === "mobile" || largeAsCompact;

        return (
          <SortablePreviewCard
            key={contact.id}
            id={contact.id}
            isDragging={activePreviewId === contact.id}
            onClick={() => handleCardClick(contact.id)}
          >
            <RenderCardBySlot
              slot={effectiveSlot}
              contact={contact}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              logoScale={contact.logoScale}
              index={index}
              baselineBackgroundColor={globalBackgroundColor}
              compact={isCompact}
            />
          </SortablePreviewCard>
        );
      })
      .filter(Boolean);

    // Mobile layout-specific JSX structure — compact card overrides use a data attribute
    // so the wizard preview can shrink padding, margins, avatar, and text for the narrow
    // phone frame without affecting the real SmallVerticalCard component used elsewhere.
    if (previewMode === "mobile") {
      if (mobileLayoutStyle === 0) {
        // Stacked: all cards in a single column (uniform layout, no special first card)
        return (
          <div className="w-full min-w-0 max-w-none space-y-2">
            {slotElements.map((el, i) => (
              <div key={i} className="w-full min-w-0">
                {el}
              </div>
            ))}
          </div>
        );
      }

      if (mobileLayoutStyle === 1) {
        // 2-Column Grid: all cards in a 2-column grid (compact spacing)
        return (
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
            {slotElements.map((el, i) => (
              <div key={i} className="w-full min-w-0">
                {el}
              </div>
            ))}
          </div>
        );
      }

      if (mobileLayoutStyle === 2) {
        // Hero + Grid: first card full-width hero, remaining in 2-column grid
        const heroSlot = slotElements[0];
        const gridSlots = slotElements.slice(1);
        return (
          <div className="w-full min-w-0 max-w-none space-y-2">
            <div className="w-full min-w-0">{heroSlot}</div>
            {gridSlots.length > 0 && (
              <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
                {gridSlots}
              </div>
            )}
          </div>
        );
      }
    }

    // Desktop layout-specific JSX structure
    if (currentDisplayStyle === 0 || currentDisplayStyle === null) {
      // Default Layout: 1 primary + 4 small
      const primarySlot = slotElements[0];
      const smallSlots = slotElements.slice(1);
      return (
        <div className="w-full min-w-0 max-w-none space-y-4">
          {/* Primary card — compensate for PrimaryContactCard's built-in mt-10 */}
          <div className="w-full min-w-0 shrink-0 -mt-10">{primarySlot}</div>
          {smallSlots.length > 0 && (
            <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-4 gap-4 [&>*]:min-w-0">
              {smallSlots}
            </div>
          )}
        </div>
      );
    }

    if (currentDisplayStyle === 4) {
      // Layout 4: 2 large (top) + 3 small (bottom)
      const largeSlots = slotElements.slice(0, 2);
      const smallSlots = slotElements.slice(2);
      return (
        <div className="w-full min-w-0 max-w-none space-y-4">
          <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
            {largeSlots}
          </div>
          {smallSlots.length > 0 && (
            <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-3 gap-4 [&>*]:min-w-0">
              {smallSlots}
            </div>
          )}
        </div>
      );
    }

    if (currentDisplayStyle === 2) {
      // Layout 2: All large
      return (
        <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
          {slotElements}
        </div>
      );
    }

    if (currentDisplayStyle === 3) {
      // Layout 3: All small
      return (
        <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 [&>*]:min-w-0">
          {slotElements}
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
    handleCardClick,
    mobileLayoutStyle,
    previewMode,
  ]);

  return (
    <div
      className="space-y-8 transition-all duration-200"
      style={{
        transition:
          "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out",
      }}
    >
      {/* Side editor panel */}
      <EditorPanelWrapper
        isOpen={isEditorOpen}
        isAnimating={isEditorAnimating}
        editorScrollContainerRef={editorScrollContainerRef}
        onClose={() => {
          setIsEditorAnimating(false);
          setTimeout(() => setIsEditorOpen(false), 200);
        }}
      >
        <ContactSectionEditor />
      </EditorPanelWrapper>

      {/* Combined Preview Section with Collapsible Layout */}
      {sortedContacts.length > 0 && (
        <Card className="space-y-4 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2 dark:text-gray-100">
                  <Palette className="w-5 h-5 text-accent-blue" />
                  Preview
                </h2>
                <p className="text-sm max-w-[700px] text-muted-foreground">
                  Choose a layout style for your contact cards. Drag and drop to
                  reorder contacts directly in the preview.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Desktop / Mobile Toggle */}
                <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden dark:border-gray-600">
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-sm transition-all cursor-pointer",
                      previewMode === "desktop"
                        ? "bg-accent-blue text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                    )}
                  >
                    <Monitor className="w-4 h-4" />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-sm transition-all cursor-pointer",
                      previewMode === "mobile"
                        ? "bg-accent-blue text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                    )}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="hidden sm:inline">Mobile</span>
                  </button>
                </div>

                {/* Collapsible Layout Button */}
                <button
                  onClick={() =>
                    setIsLayoutSectionCollapsed(!isLayoutSectionCollapsed)
                  }
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer text-sm dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-700"
                >
                  <LayoutGrid className="w-4 h-4 text-accent-blue" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {isLayoutSectionCollapsed
                      ? "Show Layout Options"
                      : "Hide Layout Options"}
                  </span>
                  {isLayoutSectionCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Collapsible Layout Section */}
            {!isLayoutSectionCollapsed && (
              <div className="space-y-4 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 mb-2 dark:text-gray-100">
                    {previewMode === "mobile"
                      ? "Mobile Layout Style"
                      : "Card Layout Style"}
                  </h4>

                  {/* Desktop Layout Options */}
                  {previewMode === "desktop" && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {layoutOptions.map((layout) => {
                        const isSelected = layoutStyle === layout.id;
                        return (
                          <Card
                            key={layout.id}
                            className={cn(
                              "cursor-pointer transition-all duration-200 hover:shadow-md h-[120px] overflow-hidden",
                              isSelected
                                ? "border-2 border-accent-blue shadow-sm"
                                : "border border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500",
                            )}
                            onClick={() => handleLayoutChange(layout.id)}
                          >
                            <CardContent className="p-1 h-full flex flex-col">
                              <div className="flex items-center justify-between mb-0.5">
                                <h4 className="text-[9px] font-semibold text-gray-900 leading-tight dark:text-gray-100">
                                  {layout.name}
                                </h4>
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex-1 flex items-center justify-center overflow-hidden">
                                <div className="scale-[0.5] origin-center w-full">
                                  {layout.preview}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Mobile Layout Options */}
                  {previewMode === "mobile" && (
                    <div className="grid grid-cols-3 gap-2">
                      {mobileLayoutOptions.map((layout) => {
                        const isSelected = mobileLayoutStyle === layout.id;
                        return (
                          <Card
                            key={layout.id}
                            className={cn(
                              "cursor-pointer transition-all duration-200 hover:shadow-md h-[110px] overflow-hidden",
                              isSelected
                                ? "border-2 border-accent-blue shadow-sm"
                                : "border border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500",
                            )}
                            onClick={() => setMobileLayoutStyle(layout.id)}
                          >
                            <CardContent className="p-1 h-full flex flex-col">
                              <div className="flex items-center justify-between mb-0.5">
                                <h4 className="text-[9px] font-semibold text-gray-900 leading-tight dark:text-gray-100">
                                  {layout.name}
                                </h4>
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex-1 flex items-center justify-center overflow-hidden">
                                <div className="scale-[0.5] origin-center w-full">
                                  {layout.preview}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview Content */}
            <div className="bg-[#F8F8F3] rounded-lg p-8 border border-gray-200">
              {/* Mobile frame wrapper */}
              <div
                className={cn(
                  previewMode === "mobile" &&
                    "max-w-[375px] mx-auto rounded-[3rem] border-[6px] border-gray-800 dark:border-gray-600 bg-white dark:bg-gray-950 shadow-xl overflow-hidden",
                )}
              >
                {/* Notch bar for mobile frame */}
                {previewMode === "mobile" && (
                  <div className="flex items-center justify-center py-2 bg-gray-800 dark:bg-gray-600">
                    <div className="w-16 h-1.5 rounded-full bg-gray-600 dark:bg-gray-400" />
                  </div>
                )}

                <div
                  className={cn(
                    previewMode === "mobile" ? "px-3 py-4" : undefined,
                  )}
                >
                  <div
                    className={cn(
                      "text-center",
                      previewMode === "mobile" ? "mb-4" : "mb-16",
                    )}
                  >
                    <h1
                      className={cn(
                        "font-semibold",
                        previewMode === "mobile"
                          ? "text-2xl"
                          : "text-4xl",
                      )}
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
                      key={`layout-${currentDisplayStyle}`}
                      items={previewOrder}
                      strategy={rectSortingStrategy}
                    >
                      <div className="w-full min-w-0 max-w-none">{previewContent}</div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back button to return to Category Explorer */}
      {onBack && (
        <div className="flex justify-center pt-4 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Categories
          </Button>
        </div>
      )}
    </div>
  );
}
