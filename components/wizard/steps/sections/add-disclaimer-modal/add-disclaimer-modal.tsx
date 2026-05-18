"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Disclaimer } from "@/types/wizard";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface AddDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (disclaimer: Omit<Disclaimer, "id">) => void;
  initialData?: Disclaimer | null;
  isBlocking?: boolean;
  companyName?: string;
  organizationName?: string;
  disclaimerScopeFlag?: boolean;
  forceUniversalScope?: boolean;
}

const DEFAULT_DISCLAIMER_TEXT = `The information and resources provided on this website are for educational and informational purposes only and are not intended as ERISA, tax, legal, investment, insurance, medical, or other professional advice. Each plan, employer, and participant situation is unique. Plan sponsors, employers, and participants should consult their qualified legal, tax, investment, insurance, medical, or other licensed professionals regarding their specific circumstances.

Nothing on this website should be construed as a solicitation, recommendation, or endorsement to buy, sell, or maintain any security, insurance product, or investment strategy. PlanTelligence does not provide investment advice, does not act as an ERISA fiduciary, and does not determine plan design, benefit eligibility, or coverage.

PlanTelligence is an independent technology platform and is not affiliated with any broker-dealer, registered investment advisor, insurance carrier, recordkeeper, or third-party administrator.

Links to external websites are provided for informational purposes only and do not constitute an endorsement or approval by PlanTelligence or any associated firms.

PlanTelligence, <Organization Name>, and <Company Name> are separate and unaffiliated entities.

© 2026 PlanTelligence. All rights reserved.`;

const LOCATION_OPTIONS = [
  { id: "benefits_hub", label: "Benefits Hub / Client Website" },
  { id: "retirement", label: "Retirement Plan" },
  { id: "health", label: "Group Health / Dental / Vision" },
  { id: "life", label: "Group Life / Disability" },
  { id: "wellness", label: "Wellness Programs" },
  { id: "open_enrollment_video", label: "Open Enrollment Video" },
  { id: "marketing_materials", label: "Marketing Materials" },
  { id: "global", label: "Global (all of the above)" },
];

export function AddDisclaimerModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  isBlocking = false,
  companyName = "[Company Name]",
  organizationName = "[Organization Name]",
  disclaimerScopeFlag = false,
  forceUniversalScope = false,
}: AddDisclaimerModalProps) {
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [disclaimerText, setDisclaimerText] = useState("");
  const [disclaimerScope, setDisclaimerScope] = useState<"plan" | "universal">("plan");
  const [useDefault, setUseDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUniversalConfirmDialog, setShowUniversalConfirmDialog] = useState(false);
  const [applyAllBenefitsCategories, setApplyAllBenefitsCategories] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(200, textarea.scrollHeight)}px`;
    }
  };

  const handleScopeChange = (value: "plan" | "universal") => {
    if (value === "universal") {
      setShowUniversalConfirmDialog(true);
    } else {
      setDisclaimerScope(value);
    }
  };

  // Adjust height when text changes or modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the modal is rendered and scrollHeight is accurate
      const timer = setTimeout(adjustHeight, 0);
      return () => clearTimeout(timer);
    }
  }, [disclaimerText, isOpen]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit mode - populate form with existing data
        const locations = initialData.locations.map((location) => {
          const platformOption = LOCATION_OPTIONS.find((opt) => opt.label === location);
          if (platformOption) return platformOption.id;
          return location === "Global (all of the above)" ? "global" : location;
        });

        setSelectedLocations(locations);
        setDisclaimerText(initialData.text);
        setDisclaimerScope(initialData.scope || "plan");
        setApplyAllBenefitsCategories(initialData.apply_all_benefits_categories || false);
      } else {
        // Add mode - reset form
        setSelectedLocations(LOCATION_OPTIONS.map((opt) => opt.id));
        setDisclaimerText("");
        setDisclaimerScope(forceUniversalScope ? "universal" : "plan");
        setApplyAllBenefitsCategories(false);
        setUseDefault(false);
      }
      setErrors({});
      setHasUnsavedChanges(false);
    }
  }, [isOpen, initialData]);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges =
      selectedLocations.length > 0 ||
      disclaimerText.trim().length > 0;
    setHasUnsavedChanges(hasChanges);
  }, [selectedLocations, disclaimerText]);

  const handleLocationToggle = (locationId: string) => {
    let newLocations: string[];
    const isChecking = !selectedLocations.includes(locationId);

    if (locationId === "global") {
      if (isChecking) {
        newLocations = LOCATION_OPTIONS.map((opt) => opt.id);
      } else {
        newLocations = [];
      }
    } else {
      if (isChecking) {
        newLocations = [...selectedLocations, locationId];
        // Handle global auto-check
        const nonGlobalPlatforms = LOCATION_OPTIONS.filter(o => o.id !== "global").map(o => o.id);
        const allPlatformsChecked = nonGlobalPlatforms.every(id => newLocations.includes(id));
        if (allPlatformsChecked && !newLocations.includes("global")) {
          newLocations.push("global");
        }
      } else {
        newLocations = selectedLocations.filter((id) => id !== locationId && id !== "global");
      }
    }

    setSelectedLocations(newLocations);

    // Clear errors
    setErrors((prev) => ({ ...prev, locations: "" }));
  };

  const handleDisclaimerTextChange = (value: string) => {
    if (value.length <= 2500) {
      setDisclaimerText(value);
      setErrors((prev) => ({ ...prev, text: "" }));

      // If user edits text, uncheck "Use Default" if it doesn't match anymore
      // But for simplicity, we can just leave it or uncheck it.
      // Let's uncheck it to indicate custom text.
      if (useDefault) setUseDefault(false);
    }
  };

  const handleUseDefaultChange = (checked: boolean) => {
    setUseDefault(checked);
    if (checked) {
      const year = new Date().getFullYear();
      const text = DEFAULT_DISCLAIMER_TEXT
        .replace(/[<\[]Organization Name[>\]]/g, organizationName)
        .replace(/[<\[]Company Name[>\]]/g, companyName);
      setDisclaimerText(text);
      setErrors((prev) => ({ ...prev, text: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate locations
    if (selectedLocations.length === 0) {
      newErrors.locations = "Please select at least one location";
    }

    // Validate disclaimer text
    if (!disclaimerText.trim()) {
      newErrors.text = "Please enter disclaimer text";
    } else if (disclaimerText.trim().length < 10) {
      newErrors.text = "Disclaimer text must be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const locations = selectedLocations
      .map((id) => {
        const platform = LOCATION_OPTIONS.find((opt) => opt.id === id);
        if (platform) return platform.label;
        return id;
      });

    onSave({
      locations,
      text: disclaimerText.trim(),
      scope: disclaimerScope,
      apply_all_benefits_categories: applyAllBenefitsCategories,
    });

    onClose();
  };

  const handleCancel = () => {
    if (isBlocking) return;

    if (hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmCancel = () => {
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (isBlocking) {
        e.preventDefault();
        return;
      }
      handleCancel();
    }
  };

  const isSaveDisabled =
    selectedLocations.length === 0 ||
    disclaimerText.trim().length < 10;

  const getCharacterCountColor = () => {
    const count = disclaimerText.length;
    if (count >= 2401) return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <Dialog open={isOpen} onOpenChange={isBlocking ? undefined : handleCancel}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
        onInteractOutside={(e) => {
          if (isBlocking) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isBlocking) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isBlocking
              ? "Action Required: Add Disclaimer"
              : (initialData ? "Edit Disclaimer" : "Add Disclaimer")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Multi-Select Checkboxes */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">
                Where will this disclaimer appear?{" "}
                <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Select all that apply
              </p>
            </div>

            <div className="flex justify-between">
              <div className="space-y-3">
                {LOCATION_OPTIONS.map((option) => (
                  <div key={option.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={option.id}
                      checked={selectedLocations.includes(option.id)}
                      onCheckedChange={() => handleLocationToggle(option.id)}
                    />
                    <div className="space-y-1 flex-1">
                      <Label
                        htmlFor={option.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>

              {disclaimerScopeFlag && !forceUniversalScope && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    Disclaimer Scope
                  </Label>
                  <RadioGroup
                    value={disclaimerScope}
                    onValueChange={(value) => handleScopeChange(value as "plan" | "universal")}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="plan" id="modal-scope-plan" />
                      <Label htmlFor="modal-scope-plan" className="text-sm font-normal cursor-pointer">
                        For this plan only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="universal" id="modal-scope-universal" />
                      <Label htmlFor="modal-scope-universal" className="text-sm font-normal cursor-pointer">
                        Modify my universal disclaimer
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
          </div>

          {/* Apply to All Benefits Categories Toggle */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label className="text-base font-medium">
                Apply to all benefits categories
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                If set to Yes, this disclaimer will appear across all benefits categories.
              </p>
            </div>
            <RadioGroup
              value={applyAllBenefitsCategories ? "yes" : "no"}
              onValueChange={(val) => setApplyAllBenefitsCategories(val === "yes")}
              className="flex items-center gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="apply-all-yes" />
                <Label htmlFor="apply-all-yes" className="font-normal cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="apply-all-no" />
                <Label htmlFor="apply-all-no" className="font-normal cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Disclaimer Text */}
          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-base font-medium">
                  Disclaimer Text <span className="text-red-500">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Minimum 10 characters required
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-default"
                  checked={useDefault}
                  onCheckedChange={handleUseDefaultChange}
                />
                <Label htmlFor="use-default" className="text-sm font-medium cursor-pointer">
                  Use Default
                </Label>
              </div>
            </div>
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={disclaimerText}
                onChange={(e) => handleDisclaimerTextChange(e.target.value)}
                placeholder="Enter or paste your disclaimer text here..."
                className="resize-none min-h-[200px] pr-20 overflow-hidden"
                maxLength={2500}
              />
              <div className="absolute bottom-2 right-2">
                <span className={`text-xs ${getCharacterCountColor()}`}>
                  {disclaimerText.length} / 2500 characters
                  {disclaimerText.length < 10 && disclaimerText.length > 0 && (
                    <span className="text-red-500 ml-1">(min 10)</span>
                  )}
                </span>
              </div>
            </div>
            {errors.text && (
              <p className="text-sm text-red-500">{errors.text}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          {!isBlocking && (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            {initialData ? "Update Disclaimer" : "Add Disclaimer"}
          </Button>
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmCancel}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to cancel?"
        confirmText="Discard Changes"
        cancelText="Go Back"
        variant="destructive"
      />

      {/* Universal Scope Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showUniversalConfirmDialog}
        onClose={() => {
          setShowUniversalConfirmDialog(false);
          // Revert to plan if cancelled, though strictly speaking we haven't changed it yet
          // But since the radio might visually update if we don't handle it carefully, 
          // we should rely on state not changing until confirmed.
        }}
        onConfirm={() => {
          setDisclaimerScope("universal");
          setShowUniversalConfirmDialog(false);
        }}
        title="Update Universal Disclaimer?"
        description="Important Note: This will update your existing universal default disclaimer on all plans."
        confirmText="Confirm"
        cancelText="Go Back"
      />
    </Dialog >
  );
}
