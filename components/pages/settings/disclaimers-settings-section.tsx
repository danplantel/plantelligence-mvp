"use client";

import { useState, useEffect, useRef } from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Disclaimer } from "@/types/wizard";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

const LOCATION_OPTIONS = [
  { id: "benefits_hub", label: "Benefits Hub / Client Website" },
  { id: "open_enrollment_video", label: "Open Enrollment Video" },
  { id: "marketing_materials", label: "Marketing Materials" },
  { id: "other", label: "Other (please specify)" },
];

interface DisclaimerCardProps {
  disclaimer: Disclaimer;
  onEdit: () => void;
  onDelete: () => void;
}

function DisclaimerCard({ disclaimer, onEdit, onDelete }: DisclaimerCardProps) {
  const truncatedText = (() => {
    if (disclaimer.text.length <= 150) {
      return disclaimer.text;
    }
    const text = disclaimer.text.substring(0, 150);
    const lastSpaceIndex = text.lastIndexOf(" ");
    const cutIndex = lastSpaceIndex > 120 ? lastSpaceIndex : 150;
    return text.substring(0, cutIndex) + "...";
  })();

  return (
    <div className="border border-gray-200 rounded p-4 bg-white relative">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 pr-2">
          <span className="text-xs font-semibold text-gray-700">
            {[
              ...disclaimer.locations,
              ...(disclaimer.customLocation ? [disclaimer.customLocation] : []),
            ].join(", ")}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 px-2 text-gray-600 hover:text-accent-blue text-xs font-medium"
          >
            <Edit2 className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-gray-500 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
        {truncatedText}
      </div>
    </div>
  );
}

export function DisclaimersSettingsSection() {
  const { stepData, saveStepDataLocally, loadStepData, saveStepData } =
    useOnboardingWizardStore();

  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>(
    stepData.disclaimers?.disclaimers || [],
  );
  const [editingDisclaimer, setEditingDisclaimer] = useState<Disclaimer | null>(
    null,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [disclaimerToDelete, setDisclaimerToDelete] =
    useState<Disclaimer | null>(null);

  // Form state
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [customLocation, setCustomLocation] = useState("");
  const [disclaimerText, setDisclaimerText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track whether we've already pre-filled the form with the Onboarding disclaimer,
  // so we don't overwrite the user's own edits.
  const prefillDoneRef = useRef(false);

  // Load data when component mounts — use a direct fetch to /api/profile
  // which includes wizardSessions[0].disclaimers, bypassing the zustand
  // store cache which may hold stale empty data from a previous page load.
  useEffect(() => {
    const loadFromProfile = async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const profile = await res.json();
        const raw = profile?.wizardSessions?.[0]?.disclaimers;
        if (!raw) return;

        // The disclaimers field may come as a WizardDisclaimers record
        // ({ disclaimers: [...] }) or directly as an array.
        const arr: Disclaimer[] = Array.isArray(raw.disclaimers)
          ? raw.disclaimers
          : Array.isArray(raw)
            ? raw
            : [];

        if (arr.length > 0) {
          setDisclaimers(arr);

          // Pre-fill the form with the first disclaimer
          if (!prefillDoneRef.current && !editingDisclaimer && !disclaimerText) {
            const first = arr[0];
            if (first?.text) {
              const locs: string[] = (first.locations || []).map((location: string) => {
                const option = LOCATION_OPTIONS.find((opt) => opt.label === location);
                return option ? option.id : "other";
              });
              setSelectedLocations(locs);
              setCustomLocation(first.customLocation || "");
              setDisclaimerText(first.text);
              setErrors({});
              prefillDoneRef.current = true;
            }
          }
        }
      } catch {
        // Silent — profile fetch is best-effort for pre-fill
      }
    };
    loadFromProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Also sync from stepData when the store is updated (e.g. after editing in same session)
  useEffect(() => {
    if (stepData.disclaimers?.disclaimers) {
      const arr = stepData.disclaimers.disclaimers;
      setDisclaimers(arr);
    }
  }, [stepData.disclaimers]);

  // Populate form when editing
  useEffect(() => {
    if (editingDisclaimer) {
      const locations = editingDisclaimer.locations.map((location) => {
        const option = LOCATION_OPTIONS.find((opt) => opt.label === location);
        return option ? option.id : "other";
      });
      setSelectedLocations(locations);
      setCustomLocation(editingDisclaimer.customLocation || "");
      setDisclaimerText(editingDisclaimer.text);
      setErrors({});
    }
  }, [editingDisclaimer]);

  const handleLocationToggle = (locationId: string) => {
    const newLocations = selectedLocations.includes(locationId)
      ? selectedLocations.filter((id) => id !== locationId)
      : [...selectedLocations, locationId];

    setSelectedLocations(newLocations);

    if (locationId === "other" && !newLocations.includes("other")) {
      setCustomLocation("");
    }

    setErrors((prev) => ({ ...prev, locations: "" }));
  };

  const handleDisclaimerTextChange = (value: string) => {
    if (value.length <= 2500) {
      setDisclaimerText(value);
      setErrors((prev) => ({ ...prev, text: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (selectedLocations.length === 0) {
      newErrors.locations = "Please select at least one location";
    }

    if (selectedLocations.includes("other") && !customLocation.trim()) {
      newErrors.customLocation = "Please specify the location";
    }

    if (!disclaimerText.trim()) {
      newErrors.text = "Please enter disclaimer text";
    } else if (disclaimerText.trim().length < 10) {
      newErrors.text = "Disclaimer text must be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveForm = async () => {
    if (!validateForm()) return;

    const locations = selectedLocations
      .filter((id) => id !== "other")
      .map((id) => LOCATION_OPTIONS.find((opt) => opt.id === id)?.label || id);

    if (selectedLocations.includes("other") && customLocation.trim()) {
      locations.push(customLocation.trim());
    }

    const disclaimerData = {
      locations,
      customLocation: selectedLocations.includes("other")
        ? customLocation
        : undefined,
      text: disclaimerText.trim(),
    };

    if (editingDisclaimer) {
      await handleUpdateDisclaimer(editingDisclaimer.id, disclaimerData);
    } else {
      await handleAddDisclaimer(disclaimerData);
    }

    // Clear form after save
    setEditingDisclaimer(null);
    setSelectedLocations([]);
    setCustomLocation("");
    setDisclaimerText("");
    setErrors({});
  };

  const handleCancelEdit = () => {
    setEditingDisclaimer(null);
    setSelectedLocations([]);
    setCustomLocation("");
    setDisclaimerText("");
    setErrors({});
  };

  const handleAddDisclaimer = async (disclaimer: Omit<Disclaimer, "id">) => {
    const newDisclaimer: Disclaimer = {
      ...disclaimer,
      id: Date.now().toString(),
    };

    const updatedDisclaimers = [...disclaimers, newDisclaimer];
    setDisclaimers(updatedDisclaimers);
    await saveStepDataLocally("disclaimers", {
      disclaimers: updatedDisclaimers,
    });
    await saveStepData(
      "disclaimers",
      { disclaimers: updatedDisclaimers },
      true,
    );

    toast.success("Disclaimer added successfully");
  };

  const handleUpdateDisclaimer = async (
    id: string,
    updatedDisclaimer: Omit<Disclaimer, "id">,
  ) => {
    const updatedDisclaimers = disclaimers.map((d) =>
      d.id === id ? { ...updatedDisclaimer, id } : d,
    );
    setDisclaimers(updatedDisclaimers);
    await saveStepDataLocally("disclaimers", {
      disclaimers: updatedDisclaimers,
    });
    await saveStepData(
      "disclaimers",
      { disclaimers: updatedDisclaimers },
      true,
    );

    toast.success("Disclaimer updated successfully");
  };

  const handleDeleteDisclaimer = (disclaimer: Disclaimer) => {
    setDisclaimerToDelete(disclaimer);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (disclaimerToDelete) {
      const updatedDisclaimers = disclaimers.filter(
        (d) => d.id !== disclaimerToDelete.id,
      );
      setDisclaimers(updatedDisclaimers);
      await saveStepDataLocally("disclaimers", {
        disclaimers: updatedDisclaimers,
      });
      await saveStepData(
        "disclaimers",
        { disclaimers: updatedDisclaimers },
        true,
      );

      toast.success("Disclaimer deleted successfully");
    }
    setDeleteConfirmOpen(false);
    setDisclaimerToDelete(null);
  };

  const isSaveDisabled =
    selectedLocations.length === 0 ||
    disclaimerText.trim().length < 10 ||
    (selectedLocations.includes("other") && !customLocation.trim());

  const getCharacterCountColor = () => {
    const count = disclaimerText.length;
    if (count >= 2401) return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Form - Always visible */}
      <div className="space-y-4">
        {editingDisclaimer && (
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Editing disclaimer</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              className="h-8 text-xs"
            >
              Cancel Edit
            </Button>
          </div>
        )}

        {/* Multi-Select Checkboxes */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">
              Where will this disclaimer appear?{" "}
              <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Select all that apply
            </p>
          </div>

          <div className="space-y-2">
            {LOCATION_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-start space-x-2">
                <Checkbox
                  id={option.id}
                  checked={selectedLocations.includes(option.id)}
                  onCheckedChange={() => handleLocationToggle(option.id)}
                />
                <Label
                  htmlFor={option.id}
                  className="text-sm font-normal leading-none cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>

          {errors.locations && (
            <p className="text-sm text-red-500">{errors.locations}</p>
          )}

          {/* Custom Location Input */}
          {selectedLocations.includes("other") && (
            <div className="space-y-2">
              <Input
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Specify location"
                maxLength={100}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {customLocation.length}/100 characters
                </p>
                {errors.customLocation && (
                  <p className="text-xs text-red-500">
                    {errors.customLocation}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer Text */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Disclaimer Text <span className="text-red-500">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Minimum 10 characters required
          </p>
          <div className="relative">
            <Textarea
              value={disclaimerText}
              onChange={(e) => handleDisclaimerTextChange(e.target.value)}
              placeholder="Enter or paste your disclaimer text here..."
              rows={6}
              className="resize-none pr-20"
              maxLength={2500}
            />
            <div className="absolute bottom-2 right-2">
              <span className={`text-xs ${getCharacterCountColor()}`}>
                {disclaimerText.length} / 2500
                {disclaimerText.length < 10 && disclaimerText.length > 0 && (
                  <span className="text-red-500 ml-1">(min 10)</span>
                )}
              </span>
            </div>
          </div>
          {errors.text && <p className="text-sm text-red-500">{errors.text}</p>}
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveForm} disabled={isSaveDisabled}>
            {editingDisclaimer ? "Update Disclaimer" : "Add Disclaimer"}
          </Button>
        </div>
      </div>

      {/* Disclaimer List */}
      {disclaimers.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <p className="text-sm font-medium text-gray-700">
            Added Disclaimers ({disclaimers.length})
          </p>
          {disclaimers.map((disclaimer) => (
            <DisclaimerCard
              key={disclaimer.id}
              disclaimer={disclaimer}
              onEdit={() => {
                setEditingDisclaimer(disclaimer);
              }}
              onDelete={() => handleDeleteDisclaimer(disclaimer)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDisclaimerToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Disclaimer?"
        description={
          disclaimerToDelete
            ? `This will remove the disclaimer for ${disclaimerToDelete.locations.join(
                ", ",
              )}. This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
