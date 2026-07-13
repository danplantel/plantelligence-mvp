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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyContact } from "@/types/new-client-wizard";

// ── Compact card placeholder previews ──

function CompactCardPlaceholder({
  variant = "small",
  brandColor,
}: {
  variant?: "primary" | "large" | "small";
  brandColor?: string;
}) {
  const bg = brandColor || "#23919C";

  if (variant === "primary") {
    return (
      <div
        className="rounded-lg p-3 flex items-center gap-3 border"
        style={{ backgroundColor: `${bg}10`, borderColor: `${bg}30` }}
      >
        <div
          className="w-8 h-8 rounded-full flex-shrink-0"
          style={{ backgroundColor: `${bg}40` }}
        />
        <div className="flex-1 space-y-1.5">
          <div
            className="h-2 w-16 rounded"
            style={{ backgroundColor: `${bg}30` }}
          />
          <div
            className="h-1.5 w-12 rounded"
            style={{ backgroundColor: `${bg}20` }}
          />
          <div
            className="h-5 w-full rounded flex items-center justify-center text-[8px] font-semibold text-white"
            style={{ backgroundColor: bg }}
          >
            Contact
          </div>
        </div>
      </div>
    );
  }

  if (variant === "large") {
    return (
      <div
        className="rounded-lg p-2 flex items-center gap-2 border"
        style={{ backgroundColor: `${bg}08`, borderColor: `${bg}20` }}
      >
        <div
          className="w-6 h-6 rounded-full flex-shrink-0"
          style={{ backgroundColor: `${bg}40` }}
        />
        <div className="flex-1 space-y-1">
          <div
            className="h-2 w-14 rounded"
            style={{ backgroundColor: `${bg}30` }}
          />
          <div
            className="h-1 w-10 rounded"
            style={{ backgroundColor: `${bg}20` }}
          />
          <div
            className="h-4 w-full rounded flex items-center justify-center text-[7px] font-semibold text-white"
            style={{ backgroundColor: bg }}
          >
            Contact
          </div>
        </div>
      </div>
    );
  }

  // small variant
  return (
    <div
      className="rounded-lg p-1.5 flex flex-col items-center border"
      style={{ backgroundColor: `${bg}08`, borderColor: `${bg}20` }}
    >
      <div
        className="w-5 h-5 rounded-full mb-1"
        style={{ backgroundColor: `${bg}40` }}
      />
      <div
        className="h-1.5 w-10 rounded mb-0.5"
        style={{ backgroundColor: `${bg}30` }}
      />
      <div
        className="h-1 w-8 rounded mb-1"
        style={{ backgroundColor: `${bg}20` }}
      />
      <div
        className="h-3.5 w-full rounded flex items-center justify-center text-[6px] font-semibold text-white"
        style={{ backgroundColor: bg }}
      >
        Contact
      </div>
    </div>
  );
}

// ── Layout option thumbnail ──

interface LayoutOptionDef {
  id: number;
  name: string;
  renderPreview: (brandColor?: string) => React.ReactNode;
}

const DESKTOP_LAYOUTS: LayoutOptionDef[] = [
  {
    id: 0,
    name: "Default",
    renderPreview: (c) => (
      <div className="space-y-1.5">
        <CompactCardPlaceholder variant="primary" brandColor={c} />
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <CompactCardPlaceholder key={i} brandColor={c} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 2,
    name: "Large Cards",
    renderPreview: (c) => (
      <div className="grid grid-cols-2 gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <CompactCardPlaceholder key={i} variant="large" brandColor={c} />
        ))}
      </div>
    ),
  },
  {
    id: 3,
    name: "Small Cards",
    renderPreview: (c) => (
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <CompactCardPlaceholder key={i} brandColor={c} />
        ))}
      </div>
    ),
  },
  {
    id: 4,
    name: "Mixed",
    renderPreview: (c) => (
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <CompactCardPlaceholder variant="large" brandColor={c} />
          <CompactCardPlaceholder variant="large" brandColor={c} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <CompactCardPlaceholder key={i} brandColor={c} />
          ))}
        </div>
      </div>
    ),
  },
];

const MOBILE_LAYOUTS: LayoutOptionDef[] = [
  {
    id: 0,
    name: "Stacked",
    renderPreview: (c) => (
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <CompactCardPlaceholder key={i} variant="large" brandColor={c} />
        ))}
      </div>
    ),
  },
  {
    id: 1,
    name: "2-Column Grid",
    renderPreview: (c) => (
      <div className="grid grid-cols-2 gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <CompactCardPlaceholder key={i} brandColor={c} />
        ))}
      </div>
    ),
  },
  {
    id: 2,
    name: "Hero + Grid",
    renderPreview: (c) => (
      <div className="space-y-1">
        <CompactCardPlaceholder variant="primary" brandColor={c} />
        <div className="grid grid-cols-2 gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <CompactCardPlaceholder key={i} brandColor={c} />
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
  /** Called when user confirms a new display style */
  onConfirm: (displayStyle: number | null) => void;
  /** Contacts to show in the preview */
  contacts: KeyContact[];
  /** Brand color for preview accents */
  brandColor?: string;
}

// ── Component ──

export function ContactCardLayoutPreviewModal({
  isOpen,
  onClose,
  currentDisplayStyle,
  onConfirm,
  contacts,
  brandColor,
}: ContactCardLayoutPreviewModalProps) {
  // Convert persisted displayStyle to layout index
  const initialDesktopIndex = currentDisplayStyle ?? 0;

  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [selectedDesktopLayout, setSelectedDesktopLayout] =
    useState<number>(initialDesktopIndex);
  const [selectedMobileLayout, setSelectedMobileLayout] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // Reset internal state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDesktopLayout(initialDesktopIndex);
      setSelectedMobileLayout(0);
      setPreviewMode("desktop");
      setShowPreview(false);
    }
  }, [isOpen, initialDesktopIndex]);

  const hasContacts = contacts.length > 0;

  const handleConfirm = () => {
    // Desktop layout is what we persist as displayStyle
    // Mobile layout is stored separately (not persisted to displayStyle)
    onConfirm(selectedDesktopLayout);
    onClose();
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

          {/* Layout Options */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 dark:text-gray-100">
              {previewMode === "desktop"
                ? "Desktop Layout"
                : "Mobile Layout"}
            </h4>

            {previewMode === "desktop" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DESKTOP_LAYOUTS.map((layout) => {
                  const isSelected = selectedDesktopLayout === layout.id;
                  return (
                    <Card
                      key={layout.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden",
                        isSelected
                          ? "ring-2 ring-accent-blue border-accent-blue shadow-sm"
                          : "border border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500",
                      )}
                      onClick={() => setSelectedDesktopLayout(layout.id)}
                    >
                      <div className="p-2 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            {layout.name}
                          </span>
                          {isSelected && (
                            <div className="bg-accent-blue rounded-full p-0.5 flex-shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-full scale-[0.55] origin-top">
                            {layout.renderPreview(brandColor)}
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1 leading-tight text-center">
                          {layout.id === 0 && "1 primary + 4 small"}
                          {layout.id === 2 && "4 large horizontal cards"}
                          {layout.id === 3 && "8 small vertical cards"}
                          {layout.id === 4 && "2 large + 3 small"}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {MOBILE_LAYOUTS.map((layout) => {
                  const isSelected = selectedMobileLayout === layout.id;
                  return (
                    <Card
                      key={layout.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden",
                        isSelected
                          ? "ring-2 ring-accent-blue border-accent-blue shadow-sm"
                          : "border border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500",
                      )}
                      onClick={() => setSelectedMobileLayout(layout.id)}
                    >
                      <div className="p-2 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            {layout.name}
                          </span>
                          {isSelected && (
                            <div className="bg-accent-blue rounded-full p-0.5 flex-shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-full scale-[0.55] origin-top">
                            {layout.renderPreview(brandColor)}
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1 leading-tight text-center">
                          {layout.id === 0 && "Single column, stacked"}
                          {layout.id === 1 && "2-column grid"}
                          {layout.id === 2 && "Hero card + 2-column grid"}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Preview Section */}
          {hasContacts && (
            <div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 text-sm text-accent-blue hover:text-accent-blue/80 font-medium transition-colors"
              >
                {showPreview ? (
                  <>
                    <ChevronLeft className="w-4 h-4" />
                    Hide live preview
                  </>
                ) : (
                  <>
                    <Monitor className="w-4 h-4" />
                    Show live preview with contacts
                  </>
                )}
              </button>

              {showPreview && (
                <div className="mt-3 bg-[#F8F8F3] rounded-lg p-4 border border-gray-200">
                  {/* Mobile frame wrapper */}
                  <div
                    className={cn(
                      previewMode === "mobile" &&
                        "max-w-[320px] mx-auto rounded-[2rem] border-[4px] border-gray-800 bg-white dark:bg-gray-950 shadow-xl overflow-hidden transition-all",
                    )}
                  >
                    {/* Notch bar for mobile frame */}
                    {previewMode === "mobile" && (
                      <div className="flex items-center justify-center py-1.5 bg-gray-800">
                        <div className="w-12 h-1 rounded-full bg-gray-600" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "space-y-2",
                        previewMode === "mobile" ? "px-2 py-3" : "p-2",
                      )}
                    >
                      {/* "My Benefits Team" heading */}
                      <div
                        className={cn(
                          "text-center font-semibold",
                          previewMode === "mobile" ? "text-base mb-2" : "text-lg mb-3",
                        )}
                        style={{
                          fontFamily: '"DM Serif Display", serif',
                          color: brandColor || "#1F3A60",
                        }}
                      >
                        My Benefits Team
                      </div>

                      {/* Render preview cards based on layout */}
                      {previewMode === "desktop" &&
                        renderDesktopPreview(selectedDesktopLayout, brandColor)}
                      {previewMode === "mobile" &&
                        renderMobilePreview(selectedMobileLayout, brandColor)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasContacts && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Add contacts to see a live preview of the layout.
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

// ── Preview renderers ──

function renderDesktopPreview(
  layoutId: number,
  brandColor?: string,
): React.ReactNode {
  const c = brandColor || "#23919C";

  switch (layoutId) {
    case 0: // Default: 1 primary + 4 small
      return (
        <div className="space-y-3">
          <CompactCardPlaceholder variant="primary" brandColor={c} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <CompactCardPlaceholder key={i} brandColor={c} />
            ))}
          </div>
        </div>
      );
    case 2: // All large
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CompactCardPlaceholder key={i} variant="large" brandColor={c} />
          ))}
        </div>
      );
    case 3: // All small
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <CompactCardPlaceholder key={i} brandColor={c} />
          ))}
        </div>
      );
    case 4: // 2 large + 3 small
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <CompactCardPlaceholder variant="large" brandColor={c} />
            <CompactCardPlaceholder variant="large" brandColor={c} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <CompactCardPlaceholder key={i} brandColor={c} />
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function renderMobilePreview(
  layoutId: number,
  brandColor?: string,
): React.ReactNode {
  const c = brandColor || "#23919C";

  switch (layoutId) {
    case 0: // Stacked
      return (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CompactCardPlaceholder key={i} variant="large" brandColor={c} />
          ))}
        </div>
      );
    case 1: // 2-Column Grid
      return (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CompactCardPlaceholder key={i} brandColor={c} />
          ))}
        </div>
      );
    case 2: // Hero + Grid
      return (
        <div className="space-y-2">
          <CompactCardPlaceholder variant="primary" brandColor={c} />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <CompactCardPlaceholder key={i} brandColor={c} />
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}
