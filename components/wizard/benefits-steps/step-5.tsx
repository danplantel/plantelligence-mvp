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
import { Footer } from "@/components/footer";
import {
  AlertCircle,
  Eye,
  FileText,
  Info,
  Plus,
  Trash2,
  Edit2,
  X,
} from "lucide-react";

/**
 * Benefits Step 5 – Disclaimer Section
 *
 * REQUIRED step: the user MUST create at least one disclaimer before
 * proceeding. The disclaimer text appears in the **Footer** of the
 * benefit-category portal page (e.g. Retirement, Group Health, etc.)
 * selected in Step 1a.
 *
 * Persisted to the plan/client record via `PUT /api/clients/[id]` so the
 * portal layout at `app/new/view/[id]/layout.tsx` can read, filter by
 * category, and render inside `<Footer disclosuresText={…} />`.
 */

// ── Map benefit-category labels to the portal page location strings ──
const CATEGORY_PORTAL_LABELS: Record<string, string> = {
  Retirement: "Retirement Plan",
  "Group Health": "Group Health / Dental / Vision",
  "Group Life": "Group Life / Disability",
  Custom: "Wellness Programs",
};

// ── Default disclaimer text with placeholders ──
function buildDefaultDisclaimerText(
  orgName: string,
  compName: string,
): string {
  return DEFAULT_DISCLOSURES_TEXT
    .replace("[Organization Name]", orgName)
    .replace("[Company Name]", compName);
}

// ── Location options ──
const LOCATION_OPTIONS = [
  { value: "Retirement Plan", label: "Retirement Plan page" },
  { value: "Group Health / Dental / Vision", label: "Health Insurance page" },
  { value: "Group Life / Disability", label: "Life Insurance page" },
  { value: "Wellness Programs", label: "Wellness Programs page" },
  { value: "Global", label: "Global (all pages)" },
  { value: "Benefits Hub / Client Website", label: "Benefits Hub main page" },
  { value: "custom", label: "Custom location..." },
];

// ═══════════════════════════════════════════════════════════════════════════
//  Disclaimer Modal
// ═══════════════════════════════════════════════════════════════════════════

interface DisclaimerModalProps {
  isOpen: boolean;
  disclaimer: Disclaimer | null;
  companyName: string;
  organizationName: string;
  benefitCategory: string;
  onSave: (data: Omit<Disclaimer, "id">) => Promise<void>;
  onClose: () => void;
}

function DisclaimerModal({
  isOpen,
  disclaimer,
  companyName,
  organizationName,
  benefitCategory,
  onSave,
  onClose,
}: DisclaimerModalProps) {
  const defaultLocation =
    CATEGORY_PORTAL_LABELS[benefitCategory] || "Global";

  const [text, setText] = useState(
    disclaimer?.text ||
      buildDefaultDisclaimerText(organizationName, companyName),
  );
  const [locations, setLocations] = useState<string[]>(
    disclaimer?.locations || [defaultLocation],
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* ── Fixed header ── */}
        <div className="flex items-start gap-3 p-6 pb-0 shrink-0">
          <div className="p-2 rounded-lg bg-[#23919C]/10 text-[#23919C] shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {disclaimer ? "Edit Disclaimer" : "Create Disclaimer"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              This disclaimer will appear in the{" "}
              <strong className="text-gray-700 dark:text-gray-200">
                Footer
              </strong>{" "}
              of the{" "}
              <strong className="text-gray-700 dark:text-gray-200">
                {CATEGORY_PORTAL_LABELS[benefitCategory] ||
                  benefitCategory ||
                  "portal"}{" "}
                page
              </strong>
              .
            </p>
          </div>
        </div>

        {/* ── Scrollable content area ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
          {/* Disclaimer Text */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Disclaimer Text <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="min-h-[120px] resize-y text-sm"
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
        </div>

        {/* ── Fixed footer with actions ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-800 rounded-b-xl">
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
                : "Create Disclaimer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  BenefitsStep5 — Mandatory Disclaimer Section
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisclaimer, setEditingDisclaimer] =
    useState<Disclaimer | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [disclaimerToDelete, setDisclaimerToDelete] =
    useState<Disclaimer | null>(null);
  const [showInitialPrompt, setShowInitialPrompt] = useState(false);
  const [previewFooterOpen, setPreviewFooterOpen] = useState(false);

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
          setShowInitialPrompt(false);
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
                  setHasInitialized(true);
                  setShowInitialPrompt(false);
                  return;
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
          // Show the initial prompt to create a disclaimer
          setShowInitialPrompt(true);
        }
      })();
    } else {
      setHasInitialized(true);
      setShowInitialPrompt(true);
    }
  }, [hasInitialized, planId, selectedPlan, stepData.step5, saveStepData]);

  // ── If no disclaimers exist after initialisation, auto-show prompt ──
  useEffect(() => {
    if (
      hasInitialized &&
      disclaimers.length === 0 &&
      !isModalOpen &&
      !showInitialPrompt
    ) {
      setShowInitialPrompt(true);
    }
  }, [hasInitialized, disclaimers.length, isModalOpen, showInitialPrompt]);

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

  // ── CRUD helpers ──

  const syncAndPersist = async (updated: Disclaimer[]) => {
    setDisclaimers(updated);
    saveStepData(5, { disclaimers: updated });
    await persistToPlan(updated);
  };

  const openCreateModal = () => {
    setEditingDisclaimer(null);
    setShowInitialPrompt(false);
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

    // If last disclaimer was deleted, show the initial prompt
    if (updated.length === 0) {
      setShowInitialPrompt(true);
    }
  };

  const handleSaveDisclaimer = async (data: Omit<Disclaimer, "id">) => {
    const newDisclaimer: Disclaimer = { ...data, id: Date.now().toString() };
    await syncAndPersist([...disclaimers, newDisclaimer]);
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

  // ── Derive the current benefit category label for the portal ──
  const portalCategory =
    CATEGORY_PORTAL_LABELS[benefitCategory] || benefitCategory || "this benefit";

  // ── Build the combined disclosure text (same logic as layout.tsx) ──
  const buildDisclosureText = useCallback((): string => {
    const defaultDisclaimer = buildDefaultDisclaimerText(
      organizationName,
      companyName,
    );

    if (disclaimers.length === 0) return defaultDisclaimer;

    // Match the layout's priority: category-specific > all-categories > universal
    const portalLabel = CATEGORY_PORTAL_LABELS[benefitCategory] || "";
    const categorySpecific = disclaimers.filter(
      (d) =>
        !d.apply_all_benefits_categories &&
        (d.locations?.includes(portalLabel) ||
          d.locations?.includes("Global")),
    );

    const allCategories = disclaimers.filter(
      (d) => d.apply_all_benefits_categories === true,
    );

    const texts = [
      ...categorySpecific.map((d) => d.text),
      ...allCategories.map((d) => d.text),
    ];

    if (texts.length === 0) return defaultDisclaimer;

    const unique = Array.from(
      new Set(texts.map((t) => t?.trim()).filter(Boolean)),
    );
    return unique.join("\n\n");
  }, [disclaimers, benefitCategory, organizationName, companyName]);

  // ── Brand colour from the selected plan ──
  const brandColor =
    (selectedPlan as any)?.brandColor ||
    (selectedPlan as any)?.primaryColor ||
    "#1F3A60";

  // ── Validation: at least one disclaimer is required ──
  const hasDisclaimers = disclaimers.length > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* ── Header ── */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="p-3 rounded-2xl bg-[#23919C]/10">
            <FileText className="w-8 h-8 text-[#23919C]" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Footer Disclaimer
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Create a disclaimer that will appear in the{" "}
          <strong className="text-gray-700 dark:text-gray-200">Footer</strong>{" "}
          of the{" "}
          <strong className="text-gray-700 dark:text-gray-200">
            {portalCategory}
          </strong>{" "}
          employee portal page. This is a <strong>required</strong> step — you
          must provide at least one disclaimer before proceeding.
        </p>
      </div>

      {/* ── Portal Footer Visual Indicator ── */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                Where does this appear?
              </h3>
              <p className="text-sm text-muted-foreground">
                Your disclaimer text is rendered in the Footer section at the
                very bottom of the{" "}
                <strong className="text-gray-600 dark:text-gray-300">
                  {portalCategory}
                </strong>{" "}
                portal page — visible to all employees who access the benefits
                portal. You can target specific pages or apply it globally.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#23919C]/10 text-[#23919C] text-xs font-medium">
                  <FileText className="w-3 h-3" />
                  {portalCategory}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Footer Section
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  </svg>
                  Employee-facing
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Disclaimer Editor Card ── */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6">
          {/* ── Initial prompt (no disclaimers yet) ── */}
          {!hasDisclaimers && showInitialPrompt && (
            <div className="max-w-xl mx-auto space-y-6 py-4">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="p-3 rounded-full bg-red-50 dark:bg-red-900/20">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Disclaimer Required
                </h2>
                <p className="text-sm text-muted-foreground">
                  You must create a disclaimer before proceeding. This legal
                  notice will appear in the footer of your{" "}
                  <strong className="text-gray-700 dark:text-gray-200">
                    {portalCategory}
                  </strong>{" "}
                  portal page.
                </p>
              </div>

              <Button
                onClick={openCreateModal}
                className="w-full h-12 text-base font-bold bg-[#23919C] hover:bg-[#1b727a] text-white rounded-xl shadow-lg shadow-[#23919C]/20"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Disclaimer for {portalCategory}
              </Button>
            </div>
          )}

          {/* ── Summary view (disclaimers exist) ── */}
          {hasDisclaimers && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Disclaimers ({disclaimers.length})
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setPreviewFooterOpen(true)}
                    size="sm"
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview Footer
                  </Button>
                  <Button
                    onClick={openCreateModal}
                    size="sm"
                    className="bg-[#23919C] hover:bg-[#1b727a] text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Disclaimer cards */}
              <div className="space-y-3">
                {disclaimers.map((disclaimer) => (
                  <div
                    key={disclaimer.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-card dark:bg-gray-800/50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Applies to:
                          </span>
                          {disclaimer.apply_all_benefits_categories ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                              All Categories
                            </span>
                          ) : (
                            [
                              ...disclaimer.locations,
                              ...(disclaimer.customLocation
                                ? [disclaimer.customLocation]
                                : []),
                            ].map((loc) => (
                              <span
                                key={loc}
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#23919C]/10 text-[#23919C] text-[10px] font-semibold"
                              >
                                {loc}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 items-center shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(disclaimer)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          title="Edit disclaimer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(disclaimer)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete disclaimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words border-t border-gray-100 dark:border-gray-700 pt-3">
                      {disclaimer.text}
                    </div>
                  </div>
                ))}
              </div>
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
          benefitCategory={benefitCategory}
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
                ? `This will remove the disclaimer for ${disclaimerToDelete.locations.join(", ")}. A disclaimer is required to proceed — you will need to create a new one.`
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

      {/* ── Footer Preview Modal ── */}
      {previewFooterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Footer Preview
                </h3>
                <p className="text-sm text-muted-foreground">
                  How the disclaimer will appear on the{" "}
                  <strong className="text-gray-600 dark:text-gray-300">
                    {portalCategory}
                  </strong>{" "}
                  page
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFooterOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Preview content – actual Footer component */}
            <div className="p-0">
              {/* Portal page mock chrome */}
              <div className="bg-black min-h-[200px]">
                <div className="bg-gray-900 h-16 flex items-center px-6 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="ml-4 text-xs text-gray-400 font-mono">
                    {portalCategory} — Employee Portal
                  </div>
                </div>

                {/* Benefit page content mock */}
                <div className="px-8 py-12 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {portalCategory}
                  </h2>
                  <p className="text-gray-400 text-sm max-w-xl mx-auto">
                    This is where the benefit content would appear. Scroll down
                    to see the Footer with your disclaimer.
                  </p>
                </div>

                {/* The actual Footer with disclaimer */}
                <Footer
                  brandColor={brandColor}
                  disclosuresText={buildDisclosureText()}
                />
              </div>
            </div>

            {/* Close button */}
            <div className="flex justify-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <Button
                onClick={() => setPreviewFooterOpen(false)}
                variant="outline"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
