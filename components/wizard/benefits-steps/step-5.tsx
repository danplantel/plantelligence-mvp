"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { Disclaimer } from "@/types/new-client-wizard";
import { DEFAULT_DISCLOSURES_TEXT } from "@/lib/disclaimer-constants";

/**
 * Benefits Step 5 – Disclaimer Section
 *
 * Allows the user to manage disclaimers that will appear in the Footer of the
 * employee portal pages. Disclaimers are stored in the wizard store (step5) and
 * persisted to the plan/client record via the API so that the portal layout at
 * `app/new/view/[id]/layout.tsx` can read, filter by benefit category, and
 * render them inside <Footer disclosuresText={…} />.
 *
 * Category filtering is handled automatically by the layout – each disclaimer
 * carries a `locations` array and an `apply_all_benefits_categories` flag that
 * the layout's getDisclosuresText() function respects.
 *
 * Mirrors the pattern of `<NewClientStep5a>` from the Create a Plan wizard.
 */

// ── Map benefit-category labels to the category strings used in the portal ──
const CATEGORY_PORTAL_LABELS: Record<string, string> = {
  Retirement: "Retirement Plan",
  "Group Health": "Group Health / Dental / Vision",
  "Group Life": "Group Life / Disability",
  Custom: "Wellness Programs",
};

// ── Default disclaimer text with placeholders for organisation / company ──
function buildDefaultDisclaimerText(
  orgName: string,
  compName: string,
): string {
  return DEFAULT_DISCLOSURES_TEXT
    .replace("[Organization Name]", orgName)
    .replace("[Company Name]", compName);
}

// ── Location options for the disclaimer modal ──
const LOCATION_OPTIONS = [
  { value: "Global", label: "Global (all pages)" },
  { value: "Retirement Plan", label: "Retirement Plan page" },
  { value: "Group Health / Dental / Vision", label: "Health Insurance page" },
  { value: "Group Life / Disability", label: "Life Insurance page" },
  { value: "Wellness Programs", label: "Wellness Programs page" },
  { value: "Benefits Hub / Client Website", label: "Benefits Hub main page" },
  { value: "custom", label: "Custom location..." },
];

// ═══════════════════════════════════════════════════════════════════════════
//  Inline Disclaimer Modal (store-agnostic, uses passed callbacks)
// ═══════════════════════════════════════════════════════════════════════════

interface DisclaimerModalProps {
  isOpen: boolean;
  disclaimer: Disclaimer | null;
  companyName: string;
  organizationName: string;
  onSave: (data: Omit<Disclaimer, "id">) => Promise<void>;
  onClose: () => void;
}

function DisclaimerModal({
  isOpen,
  disclaimer,
  companyName,
  organizationName,
  onSave,
  onClose,
}: DisclaimerModalProps) {
  const [text, setText] = useState(
    disclaimer?.text ||
      buildDefaultDisclaimerText(organizationName, companyName),
  );
  const [locations, setLocations] = useState<string[]>(
    disclaimer?.locations || ["Global"],
  );
  const [customLocation, setCustomLocation] = useState(
    disclaimer?.customLocation || "",
  );
  const [applyAll, setApplyAll] = useState(
    disclaimer?.apply_all_benefits_categories ?? false,
  );
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const selectedLocation = locations.includes("custom")
    ? "custom"
    : locations[0] || "Global";

  const handleLocationChange = (value: string) => {
    if (value === "custom") {
      setLocations(["custom"]);
    } else {
      setLocations([value]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        text,
        locations:
          selectedLocation === "custom" && customLocation.trim()
            ? [customLocation.trim()]
            : locations.filter((l) => l !== "custom"),
        customLocation:
          selectedLocation === "custom" ? customLocation : "",
        scope: disclaimer?.scope || "plan",
        apply_all_benefits_categories: applyAll,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {disclaimer ? "Edit Disclaimer" : "Add Disclaimer"}
          </h3>

          {/* Disclaimer Text */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Disclaimer Text <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="min-h-[200px] resize-y text-sm"
              placeholder="Enter disclaimer text..."
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Location / Page <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedLocation}
              onValueChange={handleLocationChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLocation === "custom" && (
              <Input
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Enter custom location..."
                className="mt-2"
              />
            )}
          </div>

          {/* Apply to all benefit categories */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <Label className="text-sm font-semibold cursor-pointer">
                Apply to all benefit categories
              </Label>
              <p className="text-xs text-muted-foreground">
                Show this disclaimer on every benefit category page
              </p>
            </div>
            <Switch checked={applyAll} onCheckedChange={setApplyAll} />
          </div>

          {/* Preview hint */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> Disclaimers with "Apply to all benefit
              categories" enabled will appear on every portal page.
              Otherwise, only pages matching the selected location will display
              this disclaimer.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="bg-[#23919C] hover:bg-[#1b727a] text-white"
            >
              {saving
                ? "Saving..."
                : disclaimer
                  ? "Save Changes"
                  : "Add Disclaimer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  BenefitsStep5 — Disclaimer Section
// ═══════════════════════════════════════════════════════════════════════════

export function BenefitsStep5() {
  const { stepData, saveStepData } = useBenefitsWizardStore();

  const planId = stepData.step1?.planId;
  const benefitCategory = stepData.step1?.benefitCategory || "";

  // Resolve organisation & company name from the selected plan
  const selectedPlan = stepData.step1?.selectedPlan;
  const organizationName =
    (selectedPlan as any)?.branding?.organizationName ||
    selectedPlan?.companyName ||
    "[Organization Name]";
  const companyName = selectedPlan?.companyName || "[Company Name]";

  // Local disclaimer array – initialised from store or plan data
  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>(() => {
    return stepData.step5?.disclaimers || [];
  });

  const [hasInitialized, setHasInitialized] = useState(false);

  // ── Load disclaimers from the plan record on first mount ──
  useEffect(() => {
    if (hasInitialized) return;
    if (stepData.step5?.disclaimers && stepData.step5.disclaimers.length > 0) {
      setHasInitialized(true);
      return;
    }

    // If we have a selectedPlan with embedded disclaimers, use those
    const raw = (selectedPlan as any)?.disclaimers;
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const arr: Disclaimer[] = Array.isArray(parsed.disclaimers)
          ? parsed.disclaimers
          : Array.isArray(parsed)
            ? parsed
            : [];
        if (arr.length > 0) {
          setDisclaimers(arr);
          saveStepData(5, { disclaimers: arr });
          setHasInitialized(true);
          return;
        }
      } catch {
        // Not valid JSON – ignore
      }
    }

    // Fetch from API as fallback
    if (planId) {
      (async () => {
        try {
          const res = await fetch(`/api/clients/${planId}`);
          const result = await res.json();
          if (result.success && result.data) {
            const rawData = result.data.disclaimers;
            if (rawData) {
              try {
                const parsed =
                  typeof rawData === "string" ? JSON.parse(rawData) : rawData;
                const arr: Disclaimer[] = Array.isArray(parsed.disclaimers)
                  ? parsed.disclaimers
                  : Array.isArray(parsed)
                    ? parsed
                    : [];
                if (arr.length > 0) {
                  setDisclaimers(arr);
                  saveStepData(5, { disclaimers: arr });
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        } catch (err) {
          console.error("Failed to load disclaimers from plan:", err);
        } finally {
          setHasInitialized(true);
        }
      })();
    } else {
      setHasInitialized(true);
    }
  }, [hasInitialized, planId, selectedPlan, stepData.step5, saveStepData]);

  // ── Persist disclaimers to the plan/client record ──
  const persistToPlan = useCallback(
    async (updatedDisclaimers: Disclaimer[]) => {
      if (!planId) return;
      try {
        await fetch(`/api/clients/${planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disclaimers: {
              disclaimers: updatedDisclaimers,
            },
          }),
        });

        // Dispatch event so the portal layout can re-fetch if it's open
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("benefits-updated", {
              detail: { clientId: planId },
            }),
          );
        }
      } catch (err) {
        console.error("Failed to persist disclaimers to plan:", err);
      }
    },
    [planId],
  );

  // ── Modal / timing state ──
  const [addTiming, setAddTiming] = useState<"now" | "later" | null>(() =>
    disclaimers.length > 0 ? "now" : null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisclaimer, setEditingDisclaimer] =
    useState<Disclaimer | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [disclaimerToDelete, setDisclaimerToDelete] =
    useState<Disclaimer | null>(null);

  // ── CRUD helpers ──

  const syncAndPersist = async (updated: Disclaimer[]) => {
    setDisclaimers(updated);
    saveStepData(5, { disclaimers: updated });
    await persistToPlan(updated);
  };

  const openAddModal = () => {
    setEditingDisclaimer(null);
    setIsModalOpen(true);
  };

  const openEditModal = (d: Disclaimer) => {
    setEditingDisclaimer(d);
    setIsModalOpen(true);
  };

  const requestDelete = (d: Disclaimer) => {
    setDisclaimerToDelete(d);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!disclaimerToDelete) return;
    const updated = disclaimers.filter((d) => d.id !== disclaimerToDelete.id);
    await syncAndPersist(updated);
    setDeleteConfirmOpen(false);
    setDisclaimerToDelete(null);
  };

  const handleSaveDisclaimer = async (data: Omit<Disclaimer, "id">) => {
    const newDisclaimer: Disclaimer = { ...data, id: Date.now().toString() };
    await syncAndPersist([...disclaimers, newDisclaimer]);
    if (!addTiming) setAddTiming("now");
    setIsModalOpen(false);
  };

  const handleUpdateDisclaimer = async (
    id: string,
    data: Omit<Disclaimer, "id">,
  ) => {
    const updated = disclaimers.map((d) =>
      d.id === id ? { ...data, id } : d,
    );
    await syncAndPersist(updated);
    setIsModalOpen(false);
    setEditingDisclaimer(null);
  };

  const handleAddTimingChange = async (value: string) => {
    if (value === "now") {
      setAddTiming("now");
      openAddModal();
    } else {
      setAddTiming("later");
      // Create a default disclaimer when user chooses "Add Later"
      if (disclaimers.length === 0) {
        const defaultText = buildDefaultDisclaimerText(
          organizationName,
          companyName,
        );
        const defaultDisclaimer: Disclaimer = {
          id: Date.now().toString(),
          text: defaultText,
          locations: ["Global"],
          customLocation: "",
        };
        await syncAndPersist([defaultDisclaimer]);
      }
    }
  };

  // ── Derive the current benefit category label for the portal ──
  const portalCategoryLabel =
    CATEGORY_PORTAL_LABELS[benefitCategory] || "Benefits Hub / Client Website";

  const showSummaryView = disclaimers.length > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Disclaimers
        </h1>
        <p className="text-muted-foreground">
          {showSummaryView
            ? "Review and manage your disclaimers for this plan"
            : "Add necessary disclaimers that will appear in the footer of your employee portal"}
        </p>
        {benefitCategory && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Benefit category:{" "}
            <span className="font-semibold">{benefitCategory}</span>
            {" — "}
            Disclaimers with "Apply to all categories" or matching
            "{portalCategoryLabel}" will appear in the portal footer.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {!showSummaryView ? (
            /* ── Initial landing state ── */
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="text-left space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Add Disclaimers <span className="text-red-500">*</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Provide compliance language that will appear in the footer of
                  your employee portal pages.
                </p>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
                  Note: can be added later or modified in client builds
                </p>
              </div>

              {/* Radio Group – Add Now / Add Later */}
              <Card className="shadow-none dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="pt-3 pb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleAddTimingChange("now")}
                      className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer dark:border-gray-600 text-left"
                    >
                      <div className="size-4 rounded-full border-2 border-primary shrink-0 flex items-center justify-center">
                        {addTiming === "now" && (
                          <div className="size-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="text-sm font-medium cursor-pointer flex-1 dark:text-gray-300">
                        Add Now
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTimingChange("later")}
                      className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer dark:border-gray-600 text-left"
                    >
                      <div className="size-4 rounded-full border-2 border-primary shrink-0 flex items-center justify-center">
                        {addTiming === "later" && (
                          <div className="size-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="text-sm font-medium cursor-pointer flex-1 dark:text-gray-300">
                        Add Later
                      </span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* ── Summary view with existing disclaimers ── */
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="text-left space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Added Disclaimers ({disclaimers.length})
                </h2>
              </div>

              {/* Disclaimer cards */}
              <div className="space-y-2">
                {disclaimers.map((disclaimer) => (
                  <div
                    key={disclaimer.id}
                    className="border border-gray-200 rounded p-3 bg-card relative dark:bg-gray-800 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 pr-2">
                        <h5 className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">
                          Disclaimer Types:
                        </h5>
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          {[
                            ...disclaimer.locations,
                            ...(disclaimer.customLocation
                              ? [disclaimer.customLocation]
                              : []),
                          ]
                            .map((loc) => `[${loc}]`)
                            .join(" ")}
                        </span>
                      </div>
                      <div className="flex gap-1 items-center">
                        <button
                          type="button"
                          onClick={() => openEditModal(disclaimer)}
                          className="inline-flex items-center h-7 px-1.5 text-green-600 hover:text-accent-blue text-[11px] font-medium dark:text-green-700 dark:hover:text-green-500"
                        >
                          <svg
                            className="h-3 w-3 mr-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(disclaimer)}
                          className="inline-flex items-center h-7 px-1.5 text-red-600 hover:text-accent-blue text-[11px] font-medium dark:text-red-700 dark:hover:text-red-500"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {disclaimer.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Another button */}
              <button
                type="button"
                onClick={openAddModal}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Another Disclaimer
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Disclaimer Modal ── */}
      {isModalOpen && (
        <DisclaimerModal
          isOpen={isModalOpen}
          disclaimer={editingDisclaimer}
          companyName={companyName}
          organizationName={organizationName}
          onSave={async (data: Omit<Disclaimer, "id">) => {
            if (editingDisclaimer) {
              await handleUpdateDisclaimer(editingDisclaimer.id, data);
            } else {
              await handleSaveDisclaimer(data);
            }
          }}
          onClose={() => {
            setIsModalOpen(false);
            setEditingDisclaimer(null);
            // If user chose "Add Now" but closed without adding, clear selection
            if (addTiming === "now" && disclaimers.length === 0) {
              setAddTiming(null);
            }
          }}
        />
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Delete Disclaimer?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {disclaimerToDelete
                ? `This will remove the disclaimer for ${disclaimerToDelete.locations.join(", ")}. This action cannot be undone.`
                : ""}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDisclaimerToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
