"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Disclaimer } from "@/types/new-client-wizard";
import { DEFAULT_DISCLOSURES_TEXT } from "@/lib/disclaimer-constants";
import { Footer } from "@/components/footer";
import {
  AlertCircle,
  Eye,
  FileText,
  Edit2,
  X,
} from "lucide-react";

/**
 * Benefits Step 5 – Single Disclaimer Section
 *
 * The user creates exactly ONE disclaimer that appears in the Footer of the
 * benefit-category portal page selected in Step 1a. This is a required step.
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

// Resolve inherited disclaimer text from plan or onboarding data
function resolveInheritedDisclaimerText(
  selectedPlan: any,
  onboardingDisclaimers?: any,
  orgName?: string,
  compName?: string,
): string {
  // 1. Try plan's existing disclaimer
  const raw = selectedPlan?.disclaimers;
  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const arr: any[] = Array.isArray(parsed.disclaimers)
        ? parsed.disclaimers
        : Array.isArray(parsed)
          ? parsed
          : [];
      if (arr.length > 0 && arr[0]?.text) {
        return arr[0].text;
      }
    } catch { /* ignore */ }
  }

  // 2. Try onboarding disclaimer as fallback
  const onboardingArr = onboardingDisclaimers?.disclaimers;
  if (onboardingArr && onboardingArr.length > 0 && onboardingArr[0]?.text) {
    return onboardingArr[0].text;
  }

  // 3. Fall back to hardcoded default
  return buildDefaultDisclaimerText(orgName || "[Organization Name]", compName || "[Company Name]");
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
//  Single Disclaimer Modal
// ═══════════════════════════════════════════════════════════════════════════

interface DisclaimerModalProps {
  isOpen: boolean;
  disclaimer: Disclaimer | null;
  companyName: string;
  organizationName: string;
  benefitCategory: string;
  inheritedText?: string;
  onSave: (data: Omit<Disclaimer, "id">) => Promise<void>;
  onClose: () => void;
}

function DisclaimerModal({
  isOpen,
  disclaimer,
  companyName,
  organizationName,
  benefitCategory,
  inheritedText,
  onSave,
  onClose,
}: DisclaimerModalProps) {
  const defaultLocation =
    CATEGORY_PORTAL_LABELS[benefitCategory] || "Global";

  const [text, setText] = useState(
    disclaimer?.text ||
      inheritedText ||
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 h-[85vh] flex flex-col">
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
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  BenefitsStep5 — Single Mandatory Disclaimer
// ═══════════════════════════════════════════════════════════════════════════

export function BenefitsStep5() {
  const { stepData, saveStepData } = useBenefitsWizardStore();
  const { stepData: onboardingStepData } = useOnboardingWizardStore();

  const planId = stepData.step1?.planId;
  const benefitCategory = stepData.step1?.benefitCategory || "";

  // Resolve organisation & company name from the selected plan
  const selectedPlan = stepData.step1?.selectedPlan;
  const organizationName =
    (selectedPlan as any)?.branding?.organizationName ||
    selectedPlan?.companyName ||
    "[Organization Name]";
  const companyName = selectedPlan?.companyName || "[Company Name]";

  // ── State: single disclaimer (null = not yet created) ──
  const [disclaimer, setDisclaimer] = useState<Disclaimer | null>(() => {
    const arr = stepData.step5?.disclaimers;
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  });

  const [hasInitialized, setHasInitialized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInitialPrompt, setShowInitialPrompt] = useState(false);
  const [previewFooterOpen, setPreviewFooterOpen] = useState(false);

  // ── Load disclaimer from the plan record on first mount ──
  useEffect(() => {
    if (hasInitialized) return;
    if (disclaimer) {
      setHasInitialized(true);
      return;
    }

    // If we have a selectedPlan with embedded disclaimers, use the first one
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
          const d = arr[0];
          setDisclaimer(d);
          saveStepData(5, { disclaimers: [d] });
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
                  const d = arr[0];
                  setDisclaimer(d);
                  saveStepData(5, { disclaimers: [d] });
                  setHasInitialized(true);
                  return;
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        } catch (err) {
          console.error("Failed to load disclaimer from plan:", err);
        } finally {
          setHasInitialized(true);
          setShowInitialPrompt(true);
        }
      })();
    } else {
      setHasInitialized(true);
      setShowInitialPrompt(true);
    }
  }, [hasInitialized, planId, selectedPlan, disclaimer, saveStepData]);

  // ── If no disclaimer exists after initialisation, auto-show prompt ──
  useEffect(() => {
    if (
      hasInitialized &&
      !disclaimer &&
      !isModalOpen &&
      !showInitialPrompt
    ) {
      setShowInitialPrompt(true);
    }
  }, [hasInitialized, disclaimer, isModalOpen, showInitialPrompt]);

  // ── Persist single disclaimer to plan/client record ──
  const persistToPlan = useCallback(
    async (d: Disclaimer) => {
      if (!planId) return;
      // Include Step 1 branding data so the uploaded header background image is persisted
      const step1Data = stepData.step1;
      const brandImages = step1Data?.brandImages;
      try {
        await fetch(`/api/clients/${planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disclaimers: {
              disclaimers: [d],
            },
            // Persist brand images so the header background (uploaded in Step 2 Editor Panel)
            // appears on the live Benefit Hub pages
            ...(brandImages ? { brandImages } : {}),
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
        console.error("Failed to persist disclaimer to plan:", err);
      }
    },
    [planId, stepData.step1],
  );

  // ── Create / Update handler ──
  const handleSaveDisclaimer = async (data: Omit<Disclaimer, "id">) => {
    const d: Disclaimer = {
      ...data,
      id: disclaimer?.id || Date.now().toString(),
    };
    setDisclaimer(d);
    saveStepData(5, { disclaimers: [d] });
    await persistToPlan(d);
    setIsModalOpen(false);
  };

  // ── Derive the current benefit category label ──
  const portalCategory =
    CATEGORY_PORTAL_LABELS[benefitCategory] || benefitCategory || "this benefit";

  // ── Compute inherited text for new disclaimers ──
  const inheritedText = resolveInheritedDisclaimerText(
    selectedPlan,
    onboardingStepData.disclaimers,
    organizationName,
    companyName,
  );

  // ── Build disclosure text ──
  const buildDisclosureText = useCallback((): string => {
    if (!disclaimer) {
      return inheritedText;
    }
    return disclaimer.text;
  }, [disclaimer, inheritedText]);

  // ── Brand colour from the selected plan ──
  const brandColor =
    (selectedPlan as any)?.brandColor ||
    (selectedPlan as any)?.primaryColor ||
    "#1F3A60";

  return (
  <div className="space-y-6 max-w-4xl mx-auto pb-20">
    {/* ── Combined Header + Location Info ── */}
    <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-[#23919C]/10 shrink-0">
            <FileText className="w-6 h-6 text-[#23919C]" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Footer Disclaimer
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#23919C]/10 text-[#23919C] text-xs font-medium">
                <FileText className="w-3 h-3" />
                {portalCategory}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a disclaimer that will appear in the{" "}
              <strong className="text-gray-700 dark:text-gray-200">Footer</strong>{" "}
              of the{" "}
              <strong className="text-gray-700 dark:text-gray-200">
                {portalCategory}
              </strong>{" "}
              employee portal page — visible to all employees who access the
              portal. This is a <strong>required</strong> step.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

      {/* ── Disclaimer content (no wrapper card — same width as header) ── */}
      {!disclaimer && showInitialPrompt && (
        /* ── Initial prompt (no disclaimer yet) ── */
        <div className="space-y-6 py-4">
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
            onClick={() => {
              setShowInitialPrompt(false);
              setIsModalOpen(true);
            }}
            className="w-full h-12 text-base font-bold bg-[#23919C] hover:bg-[#1b727a] text-white rounded-xl shadow-lg shadow-[#23919C]/20"
          >
            <FileText className="w-5 h-5 mr-2" />
            Create Disclaimer for {portalCategory}
          </Button>
        </div>
      )}

      {disclaimer && (
        /* ── Single disclaimer summary ── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Disclaimer
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
                onClick={() => setIsModalOpen(true)}
                size="sm"
                className="bg-[#23919C] hover:bg-[#1b727a] text-white"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>

          {/* Single disclaimer card */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-card dark:bg-gray-800/50">
            <div className="flex items-center gap-2 flex-wrap mb-3">
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
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words border-t border-gray-100 dark:border-gray-700 pt-3">
              {disclaimer.text}
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Disclaimer Modal ── */}
      {isModalOpen && (
        <DisclaimerModal
          isOpen={isModalOpen}
          disclaimer={disclaimer}
          companyName={companyName}
          organizationName={organizationName}
          benefitCategory={benefitCategory}
          inheritedText={inheritedText}
          onSave={handleSaveDisclaimer}
          onClose={() => {
            setIsModalOpen(false);
          }}
        />
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

// ═══════════════════════════════════════════════════════════════════════════
//  Local helper used within the component above
// ═══════════════════════════════════════════════════════════════════════════

// (The setEditingDisclaimer helper is inlined in the JSX above)
