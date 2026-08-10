"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Monitor,
  Smartphone,
  Check,
  Palette,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveContactCompanyName } from "@/lib/resolve-contact-company-name";
import type { KeyContact } from "@/types/new-client-wizard";
import { LargeHorizontalCard } from "@/components/pages/my-benefits-team/large-horizontal-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { PrimaryContactCard } from "@/components/pages/my-benefits-team/primary-contact-card";

// ── Slot system (mirrors step-3d.tsx) ──

type CardSlotType = "primary" | "large" | "small";

interface CardSlot {
  id: string;
  type: CardSlotType;
}

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

// ── Render card by slot (mirrors step-3d.tsx's RenderCardBySlot) ──

function RenderCardBySlot({
  slot,
  contact,
  brandColor,
  index,
  compact,
  companyName,
}: {
  slot: CardSlot;
  contact: any;
  brandColor: string;
  index?: number;
  compact?: boolean;
  /** Plan/company name fallback shown under the title when the contact has none */
  companyName?: string;
}) {
  const contactWithProps = {
    ...contact,
    isPrimary: index === 0,
  };
  const resolvedCompanyName = contact.companyName || companyName || "";

  switch (slot.type) {
    case "primary":
      return (
        <PrimaryContactCard
          contact={contactWithProps}
          brandColor={brandColor}
          secondaryColor={brandColor}
          appointmentLink=""
          companyName={resolvedCompanyName}
          compact={true}
        />
      );
    case "large":
      return (
        <LargeHorizontalCard
          contact={contactWithProps}
          brandColor={brandColor}
          secondaryColor={brandColor}
          appointmentLink=""
          companyName={resolvedCompanyName}
          index={index}
          disableAnimation={true}
        />
      );
    case "small":
      return (
        <SmallVerticalCard
          contact={contactWithProps}
          brandColor={brandColor}
          secondaryColor={brandColor}
          appointmentLink=""
          companyName={resolvedCompanyName}
          index={index}
          disableAnimation={true}
          compact={compact}
        />
      );
    default:
      return null;
  }
}

// ── Preview contact transformer (mirrors step-3d.tsx's previewContacts) ──

function transformContactToPreview(
  contact: KeyContact,
  companyName: string,
  currentUserEmail?: string | null,
  currentUserOrgName?: string | null,
): any {
  const displayName =
    contact.name ||
    (contact.contactType === "individual"
      ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
      : contact.displayName) ||
    "Unnamed Contact";

  const rawBenefitsCategory =
    contact.benefitsCategories?.[0] || contact.benefitsCategory || "Other";

  const categoryLabel =
    rawBenefitsCategory === "Group Health"
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
    companyLogo: "",
    // Show the company name under the title on the card. If this contact is the
    // logged-in user, use their Organization Name (same behavior as step-3d and
    // the My Benefits Team page); otherwise prefer the contact's own companyName
    // (e.g. advisor firm / recordkeeper), else fall back to the plan/company name
    // passed into the preview modal.
    companyName:
      resolveContactCompanyName(contact, currentUserEmail, currentUserOrgName) ||
      companyName,
    showOnPortal: contact.showOnPortal !== false,
    benefitsCategory: rawBenefitsCategory,
    categoryLabel,
    contactType: contact.contactType,
    displayName: contact.displayName,
    isPrimary: contact.isPrimary || false,
    isPrimaryOverall: contact.isPrimaryOverall || false,
    phoneExtension: contact.phoneExtension,
    displayEmail: contact.displayEmail,
    displayPhone: contact.displayPhone,
    displayUrl: contact.displayUrl,
    displayScheduleAppointment: contact.displayScheduleAppointment,
    schedulingUrl: contact.schedulingUrl,
    websiteUrl: contact.websiteUrl,
    enableContactButton: contact.enableContactButton,
    contactButtonType: contact.contactButtonType,
  };
}

// ── Layout option thumbnail definition (matches step-3d.tsx's layoutOptions) ──

interface LayoutThumbDef {
  id: number;
  name: string;
  description: string;
  thumbnail: React.ReactNode;
}

const DESKTOP_LAYOUT_THUMBS: LayoutThumbDef[] = [
  {
    id: 1,
    name: "Layout 1 (Default)",
    description: "1 primary + 4 small vertical (default)",
    thumbnail: (
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
    thumbnail: (
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
    thumbnail: (
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
    description: "2 large horizontal (top row) + 3 small vertical (bottom row)",
    thumbnail: (
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

const MOBILE_LAYOUT_THUMBS: LayoutThumbDef[] = [
  {
    id: 0,
    name: "Stacked",
    description: "All cards stacked vertically (single column)",
    thumbnail: (
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
    thumbnail: (
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
    thumbnail: (
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

// ── Props ──

export interface ContactCardLayoutPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Currently selected desktop display style (0, 2, 3, 4, or null for default) */
  currentDisplayStyle: number | null;
  /** Currently selected mobile layout (0 = Stacked, 1 = 2-Column Grid, 2 = Hero + Grid) */
  mobileDisplayStyle?: number | null;
  /** Called when user confirms layout — returns desktop display style + mobile layout */
  onConfirm: (
    displayStyle: number | null,
    mobileDisplayStyle: number | null,
  ) => void;
  /** Contacts to show in the preview */
  contacts: KeyContact[];
  /** Brand color for preview accents */
  brandColor?: string;
  /** Company name for preview */
  companyName?: string;
  /** Logged-in user's email — used to show their Organization Name on their own card */
  currentUserEmail?: string | null;
  /** Logged-in user's Organization Name — shown on the user's own card */
  currentUserOrgName?: string | null;
}

// ── Component ──

export function ContactCardLayoutPreviewModal({
  isOpen,
  onClose,
  currentDisplayStyle,
  mobileDisplayStyle,
  onConfirm,
  contacts,
  brandColor,
  companyName,
  currentUserEmail,
  currentUserOrgName,
}: ContactCardLayoutPreviewModalProps) {
  // Convert persisted displayStyle (0 = default) to layout index (1 = default in step-3d)
  const initialDesktopLayout =
    currentDisplayStyle === null || currentDisplayStyle === 0 ? 1 : currentDisplayStyle;

  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [selectedDesktopLayout, setSelectedDesktopLayout] =
    useState<number>(initialDesktopLayout);
  const [selectedMobileLayout, setSelectedMobileLayout] = useState<number>(
    mobileDisplayStyle ?? 0,
  );
  const [isLayoutSectionCollapsed, setIsLayoutSectionCollapsed] =
    useState(true);

  // Reset internal state when modal opens
  useEffect(() => {
    if (isOpen) {
      const resetLayout =
        currentDisplayStyle === null || currentDisplayStyle === 0 ? 1 : currentDisplayStyle;
      setSelectedDesktopLayout(resetLayout);
      setSelectedMobileLayout(mobileDisplayStyle ?? 0);
      setPreviewMode("desktop");
      setIsLayoutSectionCollapsed(true);
    }
  }, [isOpen, currentDisplayStyle, mobileDisplayStyle]);

  const hasContacts = contacts.length > 0;

  const handleConfirm = () => {
    // Convert layout style back to displayStyle (1 → 0)
    const displayStyleValue = selectedDesktopLayout === 1 ? 0 : selectedDesktopLayout;
    onConfirm(displayStyleValue, selectedMobileLayout);
    onClose();
  };

  // ── Preview contact transformation (same as step-3d.tsx) ──

  const previewContacts = useMemo(() => {
    return contacts.map((contact) =>
      transformContactToPreview(
        contact,
        companyName || "",
        currentUserEmail,
        currentUserOrgName,
      ),
    );
  }, [contacts, companyName, currentUserEmail, currentUserOrgName]);

  const currentDisplayStyleValue =
    selectedDesktopLayout === 1 ? 0 : selectedDesktopLayout;

  const slots = useMemo(() => {
    return getSlotsForLayout(currentDisplayStyleValue, previewContacts.length);
  }, [currentDisplayStyleValue, previewContacts.length]);

  // ── Preview content (same rendering logic as step-3d.tsx) ──

  const previewContent = useMemo(() => {
    if (previewContacts.length === 0 || slots.length === 0) return null;

    const slotElements = previewContacts
      .slice(0, slots.length)
      .map((contact, index) => {
        const slot = slots[index];
        if (!slot) return null;

        // Mobile: all cards render as "small" type
        const mobileSlot =
          previewMode === "mobile"
            ? ({ ...slot, type: "small" as const })
            : slot;

        // Desktop Layout 2 & 4: render large cards as compact small
        const largeAsCompact =
          previewMode !== "mobile" &&
          (currentDisplayStyleValue === 2 || currentDisplayStyleValue === 4) &&
          slot.type === "large";

        const effectiveSlot = largeAsCompact
          ? ({ ...slot, type: "small" as const })
          : mobileSlot;

        const isCompact = previewMode === "mobile" || largeAsCompact;

        return (
          <div key={contact.id} className="w-full min-w-0">
            <RenderCardBySlot
              slot={effectiveSlot}
              contact={contact}
              brandColor={brandColor || "#1F3A60"}
              index={index}
              compact={isCompact}
              companyName={companyName || ""}
            />
          </div>
        );
      })
      .filter(Boolean);

    // Mobile layout wrappers
    if (previewMode === "mobile") {
      if (selectedMobileLayout === 0) {
        return (
          <div className="w-full min-w-0 max-w-none space-y-2">
            {slotElements}
          </div>
        );
      }
      if (selectedMobileLayout === 1) {
        return (
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
            {slotElements}
          </div>
        );
      }
      if (selectedMobileLayout === 2) {
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

    // Desktop layout wrappers
    if (currentDisplayStyleValue === 0 || currentDisplayStyleValue === null) {
      const primarySlot = slotElements[0];
      const smallSlots = slotElements.slice(1);
      return (
        <div className="w-full min-w-0 max-w-none space-y-4">
          <div className="w-full min-w-0 shrink-0 -mt-10">{primarySlot}</div>
          {smallSlots.length > 0 && (
            <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-4 gap-4 [&>*]:min-w-0">
              {smallSlots}
            </div>
          )}
        </div>
      );
    }

    if (currentDisplayStyleValue === 4) {
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

    if (currentDisplayStyleValue === 2) {
      return (
        <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
          {slotElements}
        </div>
      );
    }

    if (currentDisplayStyleValue === 3) {
      return (
        <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 [&>*]:min-w-0">
          {slotElements}
        </div>
      );
    }

    return null;
  }, [
    slots,
    previewContacts,
    currentDisplayStyleValue,
    brandColor,
    previewMode,
    selectedMobileLayout,
  ]);

  const currentThumbs = previewMode === "desktop"
    ? DESKTOP_LAYOUT_THUMBS
    : MOBILE_LAYOUT_THUMBS;

  const currentSelected =
    previewMode === "desktop" ? selectedDesktopLayout : selectedMobileLayout;

  const handleLayoutClick = (id: number) => {
    if (previewMode === "desktop") {
      setSelectedDesktopLayout(id);
    } else {
      setSelectedMobileLayout(id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle>Contact Card Layout Preview</DialogTitle>
          <DialogDescription>
            Choose how contact cards appear on the employee portal. Switch
            between Desktop and Mobile to see both views.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
          {/* Desktop / Mobile Toggle */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden dark:border-gray-600">
              <button
                onClick={() => setPreviewMode("desktop")}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all cursor-pointer",
                  previewMode === "desktop"
                    ? "bg-accent-blue text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                )}
              >
                <Monitor className="w-4 h-4" />
                Desktop
              </button>
              <button
                onClick={() => setPreviewMode("mobile")}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all cursor-pointer",
                  previewMode === "mobile"
                    ? "bg-accent-blue text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                )}
              >
                <Smartphone className="w-4 h-4" />
                Mobile
              </button>
            </div>
          </div>

          {/* Live Preview — matches step-3d.tsx rendering */}
          {hasContacts && (
            <Card className="space-y-4 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-accent-blue" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Preview
                    </h2>
                  </div>
                  <button
                    onClick={() =>
                      setIsLayoutSectionCollapsed(!isLayoutSectionCollapsed)
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer text-sm dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-700"
                  >
                    <LayoutGrid className="w-4 h-4 text-accent-blue" />
                    <span className="text-gray-700 dark:text-gray-300 hidden sm:inline">
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
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Collapsible Layout Section */}
                {!isLayoutSectionCollapsed && (
                  <div className="space-y-4 pb-6 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {previewMode === "mobile"
                        ? "Mobile Layout Style"
                        : "Card Layout Style"}
                    </h4>

                    <div
                      className={cn(
                        "grid gap-2",
                        previewMode === "desktop"
                          ? "grid-cols-2 sm:grid-cols-4"
                          : "grid-cols-3",
                      )}
                    >
                      {currentThumbs.map((layout) => {
                        const isSelected = currentSelected === layout.id;
                        return (
                          <Card
                            key={layout.id}
                            className={cn(
                              "cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden",
                              isSelected
                                ? "ring-2 ring-accent-blue border-accent-blue shadow-sm"
                                : "border border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500",
                              previewMode === "desktop"
                                ? "h-[120px]"
                                : "h-[110px]",
                            )}
                            onClick={() => handleLayoutClick(layout.id)}
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
                                  {layout.thumbnail}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Preview Content — matches step-3d.tsx exactly */}
                <div className="bg-[#F8F8F3] rounded-lg p-8 border border-gray-200">
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
                            previewMode === "mobile" ? "text-2xl" : "text-4xl",
                          )}
                          style={{
                            fontFamily: '"DM Serif Display", serif',
                            color: brandColor || "#1F3A60",
                          }}
                        >
                          My Benefits Team
                        </h1>
                      </div>

                      <div className="w-full min-w-0 max-w-none">
                        {previewContent}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!hasContacts && (
            <div className="text-center py-12 text-muted-foreground text-sm bg-[#F8F8F3] rounded-lg border border-gray-200">
              Add contacts to preview the card layout.
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} className="min-w-[100px]">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="min-w-[100px] bg-accent-blue hover:opacity-90 text-white transition-opacity"
          >
            Save Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
