"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Disclaimer } from "@/types/wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { DisclaimerUpdateConfirmDialog } from "@/components/pages/settings/disclaimer-update-confirm-dialog";
import { fetchProfileOnce } from "@/lib/fetch-profile";

const LOCATION_OPTIONS = [
  { id: "benefits_hub", label: "Benefits Hub / Client Website" },
  { id: "open_enrollment_video", label: "Open Enrollment Video" },
  { id: "marketing_materials", label: "Marketing Materials" },
  { id: "global", label: "Global" },
  { id: "retirement", label: "Retirement Plan" },
  { id: "home_page", label: "Home Page" },
  { id: "other", label: "Other (please specify)" },
];

export interface DisclaimersSettingsSectionHandle {
  /** Persist the current form. Returns false if validation failed / save failed. */
  save: (skipConfirm?: boolean) => Promise<boolean>;
  /** Restore the form to the last saved baseline. */
  reset: () => void;
  /** Whether the form has unsaved changes. */
  isDirty: () => boolean;
}

interface DisclaimersSettingsSectionProps {
  onDirtyChange?: (dirty: boolean) => void;
}

interface Baseline {
  form: {
    selectedLocations: string[];
    customLocation: string;
    disclaimerText: string;
  };
  editingDisclaimer: Disclaimer | null;
}

const EMPTY_BASELINE: Baseline = {
  form: { selectedLocations: [], customLocation: "", disclaimerText: "" },
  editingDisclaimer: null,
};

export const DisclaimersSettingsSection = forwardRef<
  DisclaimersSettingsSectionHandle,
  DisclaimersSettingsSectionProps
>(function DisclaimersSettingsSection({ onDirtyChange }, ref) {
  const { stepData, saveStepDataLocally, loadStepData, saveStepData } =
    useOnboardingWizardStore();

  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>(
    stepData.disclaimers?.disclaimers || [],
  );
  const [editingDisclaimer, setEditingDisclaimer] = useState<Disclaimer | null>(
    null,
  );
  const [showUpdateConfirmDialog, setShowUpdateConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [customLocation, setCustomLocation] = useState("");
  const [disclaimerText, setDisclaimerText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track whether we've already pre-filled the form with the Onboarding disclaimer,
  // so we don't overwrite the user's own edits.
  const prefillDoneRef = useRef(false);

  // Internal loading state — shows a skeleton until the disclaimer data (from
  // /api/profile or the wizard store) has populated the textarea.
  const [isLoading, setIsLoading] = useState(true);

  // Organization name for resolving the [Organization Name] placeholder in the
  // stored disclaimer text at render time. [Company Name] is intentionally left
  // as a literal placeholder — it's only populated once a plan is created.
  // Derived from the wizard store and/or the user profile so it's available even
  // before the store's branding step has been hydrated.
  const orgNameRef = useRef<string>(
    stepData.branding?.organizationName || "",
  );
  const normalizeDisclaimerText = (text: string): string =>
    text.replace(
      /\[Organization Name\]/g,
      orgNameRef.current || "[Organization Name]",
    );

  // Baseline snapshot used for "unsaved changes" detection.
  const baselineRef = useRef<Baseline>(EMPTY_BASELINE);

  // Map a disclaimer's stored locations back to the form's checkbox ids. Any
  // stored location that isn't a known option (e.g. "Global" on older records)
  // is preserved through the "Other" input, so an existing disclaimer never
  // renders with an empty, disabled form.
  const formFromDisclaimer = (disclaimer: Disclaimer): Baseline["form"] => {
    const knownIds: string[] = [];
    const unknownLocations: string[] = [];
    (disclaimer.locations || []).forEach((location) => {
      const option = LOCATION_OPTIONS.find((opt) => opt.label === location);
      if (option && option.id !== "other") {
        knownIds.push(option.id);
      } else {
        unknownLocations.push(location);
      }
    });
    const custom = disclaimer.customLocation || unknownLocations.join(", ");
    return {
      selectedLocations: [...knownIds, ...(custom ? ["other"] : [])],
      customLocation: custom,
      disclaimerText: normalizeDisclaimerText(disclaimer.text || ""),
    };
  };

  const applyDisclaimerToForm = (disclaimer: Disclaimer) => {
    const form = formFromDisclaimer(disclaimer);
    setSelectedLocations(form.selectedLocations);
    setCustomLocation(form.customLocation);
    setDisclaimerText(form.disclaimerText);
    setErrors({});
  };

  // Pre-fill the form AND mark the disclaimer as being edited. Without setting
  // editingDisclaimer, the action button would read "Add Disclaimer" and save a
  // duplicate instead of updating the existing disclaimer.
  const prefillFromDisclaimer = (disclaimer: Disclaimer) => {
    if (prefillDoneRef.current) return;
    applyDisclaimerToForm(disclaimer);
    setEditingDisclaimer(disclaimer);
    baselineRef.current = {
      form: formFromDisclaimer(disclaimer),
      editingDisclaimer: disclaimer,
    };
    prefillDoneRef.current = true;
  };

  // Load data when component mounts — use a direct fetch to /api/profile
  // which includes wizardSessions[0].disclaimers, bypassing the zustand
  // store cache which may hold stale empty data from a previous page load.
  useEffect(() => {
    const loadFromProfile = async () => {
      try {
        const profile = await fetchProfileOnce();
        if (!profile) return;

        // Resolve the organization name from the profile (User record or
        // completed wizard branding) as a fallback for the store value, so the
        // [Organization Name] placeholder is populated even if the wizard
        // store's branding step hasn't been loaded on this page.
        const profileOrgName =
          profile?.organizationName ||
          profile?.wizardSessions?.[0]?.branding?.organizationName ||
          profile?.company ||
          stepData.branding?.organizationName ||
          "";
        if (profileOrgName) {
          orgNameRef.current = profileOrgName;
        }

        // Primary source: wizardSessions[0].disclaimers (WizardDisclaimers record)
        let raw = profile?.wizardSessions?.[0]?.disclaimers;

        // The disclaimers field may come as a WizardDisclaimers record
        // ({ disclaimers: [...] }) or directly as an array.
        let arr: Disclaimer[] = [];
        if (raw) {
          arr = Array.isArray(raw.disclaimers)
            ? raw.disclaimers
            : Array.isArray(raw)
              ? raw
              : [];
        }

        // Fallback: after wizard completion, WizardDisclaimers is deleted
        // and the data is persisted as a JSON string on User.disclaimer
        if (arr.length === 0 && profile?.disclaimer) {
          if (Array.isArray(profile.disclaimer)) {
            // Some flows may save the array directly
            if (profile.disclaimer.length > 0) {
              arr = profile.disclaimer;
            }
          } else if (typeof profile.disclaimer === "string") {
            try {
              const parsed = JSON.parse(profile.disclaimer);
              if (Array.isArray(parsed) && parsed.length > 0) {
                arr = parsed;
              }
            } catch {
              // If parsing fails, treat as raw text
              arr = [{
                id: "legacy",
                locations: ["Global"],
                text: profile.disclaimer,
              }];
            }
          }
        }

        if (arr.length > 0) {
          setDisclaimers(arr);

          // Pre-fill the form with the first disclaimer — resolve only the
          // [Organization Name] placeholder so it matches the onboarding view.
          if (!prefillDoneRef.current && !editingDisclaimer && !disclaimerText) {
            prefillFromDisclaimer(arr[0]);
          }
        }
      } catch {
        // Silent — profile fetch is best-effort for pre-fill
      } finally {
        setIsLoading(false);
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
      setIsLoading(false);

      // Pre-fill the form + editing state from store data if the profile fetch
      // hasn't populated it yet (avoids the button staying "Add Disclaimer" and
      // disabled because locations were never selected).
      if (
        !prefillDoneRef.current &&
        !editingDisclaimer &&
        !disclaimerText &&
        arr.length > 0
      ) {
        prefillFromDisclaimer(arr[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepData.disclaimers]);

  // Populate form when editing
  useEffect(() => {
    if (editingDisclaimer) {
      applyDisclaimerToForm(editingDisclaimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDisclaimer]);

  // ── Dirty detection: notify parent whenever the form changes ────────────
  useEffect(() => {
    const current = { selectedLocations, customLocation, disclaimerText };
    const dirty =
      JSON.stringify(current) !== JSON.stringify(baselineRef.current.form);
    onDirtyChange?.(dirty);
  }, [selectedLocations, customLocation, disclaimerText, onDirtyChange]);

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

  const buildDisclaimerData = () => {
    const locations = selectedLocations
      .filter((id) => id !== "other")
      .map((id) => LOCATION_OPTIONS.find((opt) => opt.id === id)?.label || id);

    if (selectedLocations.includes("other") && customLocation.trim()) {
      locations.push(customLocation.trim());
    }

    return {
      locations,
      customLocation: selectedLocations.includes("other")
        ? customLocation
        : undefined,
      text: disclaimerText.trim(),
    };
  };

  const clearForm = () => {
    setEditingDisclaimer(null);
    setSelectedLocations([]);
    setCustomLocation("");
    setDisclaimerText("");
    setErrors({});
    baselineRef.current = EMPTY_BASELINE;
  };

  // Keep User.disclaimer (Prisma User record) in sync so the portal footer and
  // the settings section always reflect the current disclaimers.
  const persistToUserProfile = async (disclaimersArr: Disclaimer[]) => {
    try {
      const json = JSON.stringify(disclaimersArr);
      await fetch("/api/profile/update-disclaimer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disclaimer: json }),
      });
    } catch {
      // Non-critical — the wizard completion also persists these.
    }
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

    // Keep User.disclaimer in sync
    await persistToUserProfile(updatedDisclaimers);

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

    // Keep User.disclaimer in sync
    await persistToUserProfile(updatedDisclaimers);
  };

  // Persist an update and re-prefill the form with the updated disclaimer so
  // the user sees the persisted content rather than a blank "Add Disclaimer"
  // state.
  const performUpdateDisclaimer = async (
    id: string,
    data: Omit<Disclaimer, "id">,
  ) => {
    await handleUpdateDisclaimer(id, data);
    prefillDoneRef.current = false;
    const updatedDisclaimer: Disclaimer = { ...data, id };
    prefillFromDisclaimer(updatedDisclaimer);
  };

  const handleConfirmUpdateDisclaimer = async () => {
    if (!editingDisclaimer) return;
    setIsSaving(true);
    try {
      const data = buildDisclaimerData();
      await performUpdateDisclaimer(editingDisclaimer.id, data);
      // Only close the dialog + show success once the update has succeeded.
      setShowUpdateConfirmDialog(false);
      toast.success("Disclaimer updated successfully");
    } catch (error) {
      console.error("Error updating disclaimer:", error);
      toast.error("Failed to update disclaimer. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Save handler — called by the parent's "Save Changes" bottom bar.
  const handleSaveForm = async (skipConfirm = false) => {
    if (!validateForm()) return false;

    // If editing an existing disclaimer, show the confirmation dialog first so
    // the user can confirm that the disclaimer will be changed/updated — unless
    // we're saving while switching tabs (skipConfirm).
    if (editingDisclaimer) {
      if (!skipConfirm) {
        setShowUpdateConfirmDialog(true);
        return true;
      }

      setIsSaving(true);
      try {
        await performUpdateDisclaimer(
          editingDisclaimer.id,
          buildDisclaimerData(),
        );
        toast.success("Disclaimer updated successfully");
        return true;
      } catch (error) {
        console.error("Error updating disclaimer:", error);
        toast.error("Failed to update disclaimer. Please try again.");
        return false;
      } finally {
        setIsSaving(false);
      }
    }

    await handleAddDisclaimer(buildDisclaimerData());
    clearForm();
    return true;
  };

  const handleResetForm = () => {
    const baseline = baselineRef.current;
    setSelectedLocations(baseline.form.selectedLocations);
    setCustomLocation(baseline.form.customLocation);
    setDisclaimerText(baseline.form.disclaimerText);
    setEditingDisclaimer(baseline.editingDisclaimer);
    setErrors({});
  };

  const getIsDirty = () => {
    const current = { selectedLocations, customLocation, disclaimerText };
    return JSON.stringify(current) !== JSON.stringify(baselineRef.current.form);
  };

  useImperativeHandle(
    ref,
    () => ({
      save: handleSaveForm,
      reset: handleResetForm,
      isDirty: getIsDirty,
    }),
    [handleSaveForm, handleResetForm, getIsDirty],
  );

  const getCharacterCountColor = () => {
    const count = disclaimerText.length;
    if (count >= 2401) return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="space-y-4">
          {/* Disclaimer form skeleton while data loads */}
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-64" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">

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
              rows={25}
              className="pr-20"
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

        </div>
      )}

      {/* Update Disclaimer Confirmation Dialog */}
      <DisclaimerUpdateConfirmDialog
        open={showUpdateConfirmDialog}
        onOpenChange={setShowUpdateConfirmDialog}
        onConfirm={handleConfirmUpdateDisclaimer}
        submitting={isSaving}
      />
    </div>
  );
});
