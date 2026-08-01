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
import {
  Disclaimer,
  DisclaimersData,
  PortalDisclaimerCategory,
  PORTAL_DISCLAIMER_CATEGORIES,
} from "@/types/new-client-wizard";
import { DEFAULT_DISCLOSURES_TEXT } from "@/lib/disclaimer-constants";
import { Footer } from "@/components/footer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  FileText,
  Edit2,
  X,
} from "lucide-react";

/**
 * Benefits Step 5 – Per-Category Disclaimers
 *
 * Each benefit category (Retirement, Group Life, Group Health, Other) can have
 * its own disclaimer that appears in the Footer of that category's portal page.
 * The disclaimer being edited is implied by the category selected in Step 1,
 * and each category retains its own disclaimer in the plan record.
 *
 * Persisted to the plan/client record via `PUT /api/clients/[id]` as a
 * `DisclaimersData` object: `{ disclaimers: [], byCategory: { ... } }`.
 * The portal layout at `app/new/view/[id]/layout.tsx` reads `byCategory`,
 * matches the current category, and renders inside `<Footer disclosuresText={…} />`.
 */

// ── Map benefit-category labels to the portal page location strings ──
const CATEGORY_PORTAL_LABELS: Record<string, string> = {
  Retirement: "Retirement Plan",
  "Group Health": "Group Health / Dental / Vision",
  "Group Life": "Group Life / Disability",
  Custom: "Wellness Programs",
  Other: "Wellness Programs",
};

// Map a canonical category key to its portal page location string
function categoryKeyToPortalLabel(key: string): string {
  return CATEGORY_PORTAL_LABELS[key] || "Global";
}

// Map a canonical category key to its Hub page name (e.g. "Retirement Hub")
function categoryKeyToHubLabel(key: string): string {
  return `${key} Hub`;
}

// Map a benefit-category label (Step 1 selection) to a canonical disclaimer key
function benefitCategoryToKey(category: string): PortalDisclaimerCategory {
  const c = (category || "").trim().toLowerCase();
  if (c.includes("retirement")) return "Retirement";
  if (c.includes("health")) return "Group Health";
  if (c.includes("life")) return "Group Life";
  return "Other";
}

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
//  BenefitsStep5 — Per-Category Mandatory Disclaimers
// ═══════════════════════════════════════════════════════════════════════════

export function BenefitsStep5() {
  const { stepData, saveStepData } = useBenefitsWizardStore();

  const planId = stepData.step1?.planId;
  const benefitCategory = stepData.step1?.benefitCategory || "";

  // Canonical category for the benefit currently being created in Step 1a
  const currentCategoryKey = benefitCategoryToKey(benefitCategory);

  // Resolve organisation & company name from the selected plan
  const selectedPlan = stepData.step1?.selectedPlan;
  const organizationName =
    (selectedPlan as any)?.branding?.organizationName ||
    selectedPlan?.companyName ||
    "[Organization Name]";
  const companyName = selectedPlan?.companyName || "[Company Name]";

  // ── Fetch the User's disclaimer (same source as Settings > Team & Disclaimers) ──
  // The advisor's profile disclaimer is used as the default for new benefit
  // disclaimers. Returns a Disclaimer object (or null if none is saved).
  const getUserProfileDisclaimer = useCallback(async (): Promise<Disclaimer | null> => {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) return null;
      const profile = await res.json();
      const raw = profile?.disclaimer;
      if (!raw) return null;

      // User.disclaimer may be a JSON string (array of disclaimers) or an array.
      let arr: any[] = [];
      if (Array.isArray(raw)) {
        arr = raw;
      } else if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            arr = parsed;
          }
        } catch {
          // Not JSON — treat as plain text
          arr = [{ id: "profile", locations: [], text: raw }];
        }
      }

      const first = arr[0];
      if (!first || !first.text) return null;

      return {
        id: first.id || "profile",
        text: first.text,
        locations:
          Array.isArray(first.locations) && first.locations.length > 0
            ? first.locations
            : [categoryKeyToPortalLabel(currentCategoryKey)],
        customLocation: first.customLocation || "",
        scope: "plan",
        apply_all_benefits_categories: first.apply_all_benefits_categories ?? false,
      };
    } catch {
      return null;
    }
  }, [currentCategoryKey]);

  // ── State: one disclaimer per canonical category ──
  const [disclaimersByCategory, setDisclaimersByCategory] = useState<
    Partial<Record<PortalDisclaimerCategory, Disclaimer | null>>
  >(() => {
    const step5 = stepData.step5 as any;
    const map: Partial<Record<PortalDisclaimerCategory, Disclaimer | null>> = {};

    // Seed from persisted byCategory (per-category format)
    const byCat = step5?.byCategory || {};
    for (const key of PORTAL_DISCLAIMER_CATEGORIES) {
      if (byCat[key]) map[key] = byCat[key];
    }

    // Legacy: OLD-format clients store a flat disclaimers array (no byCategory).
    // Only fall back to it when there is no per-category data at all, so a
    // previously-configured category's disclaimer never leaks into another one.
    const hasByCategory = Object.keys(byCat).length > 0;
    if (!hasByCategory) {
      const arr = Array.isArray(step5?.disclaimers) ? step5.disclaimers : [];
      if (arr.length > 0 && !map[currentCategoryKey]) {
        map[currentCategoryKey] = arr[0];
      }
    }

    return map;
  });

  // The disclaimer is implied by the category selected in Step 1
  const disclaimer = disclaimersByCategory[currentCategoryKey] || null;

  const [hasInitialized, setHasInitialized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewFooterOpen, setPreviewFooterOpen] = useState(false);

  // The User's profile disclaimer text (Settings > Team & Disclaimers) — the
  // default inheritance source for every category.
  const [profileDisclaimerText, setProfileDisclaimerText] = useState<string | null>(null);

  // ── Load disclaimers from the plan record on first mount ──
  useEffect(() => {
    if (hasInitialized) return;
    if (Object.values(disclaimersByCategory).some(Boolean)) {
      setHasInitialized(true);
      return;
    }

    // Seed the map from a raw DisclaimersData value (plan record or API)
    const seedFromRaw = (raw: any): boolean => {
      if (!raw) return false;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const byCat = parsed?.byCategory || {};
        const next = { ...disclaimersByCategory };
        let seeded = false;
        for (const key of PORTAL_DISCLAIMER_CATEGORIES) {
          if (byCat[key]) {
            next[key] = byCat[key];
            seeded = true;
          }
        }
        // Legacy: only seed the current category from a flat disclaimers array
        // when there is no per-category data (old format), never from another
        // category's disclaimer.
        if (Object.keys(byCat).length === 0) {
          const arr: Disclaimer[] = Array.isArray(parsed?.disclaimers)
            ? parsed.disclaimers
            : Array.isArray(parsed)
              ? parsed
              : [];
          if (arr.length > 0 && !next[currentCategoryKey]) {
            next[currentCategoryKey] = arr[0];
            seeded = true;
          }
        }
        if (seeded) {
          setDisclaimersByCategory(next);
        }
        return seeded;
      } catch {
        return false;
      }
    };

    // 1. If we have a selectedPlan with embedded disclaimers, use them
    if (seedFromRaw((selectedPlan as any)?.disclaimers)) {
      setHasInitialized(true);
      return;
    }

    // 2. Fetch from API as fallback
    if (planId) {
      (async () => {
        try {
          const res = await fetch(`/api/clients/${planId}`);
          const result = await res.json();
          if (result.success && result.data) {
            if (seedFromRaw(result.data.disclaimers)) {
              setHasInitialized(true);
              return;
            }
          }
        } catch (err) {
          console.error("Failed to load disclaimer from plan:", err);
        }

        // 3. Prefer the User's profile disclaimer (Settings > Team & Disclaimers)
        //    as the default for the current category when the plan has none.
        const userProfileDisclaimer = await getUserProfileDisclaimer();
        if (userProfileDisclaimer) {
          const d: Disclaimer = {
            ...userProfileDisclaimer,
            text: userProfileDisclaimer.text
              .replace(/\[Organization Name\]/g, organizationName)
              .replace(/\[Company Name\]/g, companyName),
          };
          setDisclaimersByCategory((prev) => ({
            ...prev,
            [currentCategoryKey]: d,
          }));
          setHasInitialized(true);
          return;
        }

        setHasInitialized(true);
      })();
    } else {
      // Prefer the User's profile disclaimer even without a plan
      (async () => {
        const userProfileDisclaimer = await getUserProfileDisclaimer();
        if (userProfileDisclaimer) {
          const d: Disclaimer = {
            ...userProfileDisclaimer,
            text: userProfileDisclaimer.text
              .replace(/\[Organization Name\]/g, organizationName)
              .replace(/\[Company Name\]/g, companyName),
          };
          setDisclaimersByCategory((prev) => ({
            ...prev,
            [currentCategoryKey]: d,
          }));
          setHasInitialized(true);
          return;
        }
        setHasInitialized(true);
      })();
    }
  }, [hasInitialized, planId, selectedPlan, disclaimersByCategory, saveStepData, getUserProfileDisclaimer, organizationName, companyName, currentCategoryKey]);

  // ── Fetch the User's profile disclaimer text for the inherited default ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getUserProfileDisclaimer();
      if (!cancelled && d?.text) {
        setProfileDisclaimerText(
          d.text
            .replace(/\[Organization Name\]/g, organizationName)
            .replace(/\[Company Name\]/g, companyName),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getUserProfileDisclaimer, organizationName, companyName]);

  // ── Persist per-category disclaimers to plan/client record ──
  const persistToPlan = useCallback(
    async (next: Partial<Record<PortalDisclaimerCategory, Disclaimer | null>>) => {
      if (!planId) return;
      const all = Object.values(next).filter(Boolean) as Disclaimer[];
      // Strip null entries so byCategory only holds real disclaimers
      const cleanByCategory = Object.entries(next).reduce<
        Partial<Record<PortalDisclaimerCategory, Disclaimer>>
      >((acc, [key, value]) => {
        if (value) {
          (acc as Record<string, Disclaimer>)[key] = value;
        }
        return acc;
      }, {});
      const disclaimersData: DisclaimersData = {
        disclaimers: all,
        byCategory: cleanByCategory,
      };
      // Include Step 1 branding data so the uploaded header background image is persisted
      const step1Data = stepData.step1;
      const brandImages = step1Data?.brandImages;
      try {
        await fetch(`/api/clients/${planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disclaimers: disclaimersData,
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

  // ── Create / Update handler for the current category ──
  const handleSaveDisclaimer = async (data: Omit<Disclaimer, "id">) => {
    const d: Disclaimer = {
      ...data,
      id: disclaimer?.id || Date.now().toString(),
    };
    const next = { ...disclaimersByCategory, [currentCategoryKey]: d };
    setDisclaimersByCategory(next);
    saveStepData(5, {
      disclaimers: Object.values(next).filter(Boolean),
      byCategory: next,
    });
    await persistToPlan(next);
    setIsModalOpen(false);
  };

  // ── Inherited text for new disclaimers: every category inherits individually
  //    from the User's profile disclaimer (Settings > Team & Disclaimers) rather
  //    than from whichever category was configured first. ──
  const inheritedText =
    profileDisclaimerText || buildDefaultDisclaimerText(organizationName, companyName);

  // ── Build disclosure text for the current category ──
  const buildDisclosureText = useCallback((): string => {
    const d = disclaimersByCategory[currentCategoryKey];
    if (!d) {
      return inheritedText;
    }
    return d.text;
  }, [disclaimersByCategory, currentCategoryKey, inheritedText]);

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
                Footer Disclaimers
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#23919C]/10 text-[#23919C] text-xs font-medium">
                <FileText className="w-3 h-3" />
                Per benefit category
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a disclaimer for the benefit category you selected in
              Step 1. It will appear in the{" "}
              <strong className="text-gray-700 dark:text-gray-200">Footer</strong>{" "}
              of that category employee portal page — visible to all employees
              who access the portal. This is a <strong>required</strong> step.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

      {/* ── Disclaimer loading skeleton ── */}
      {!hasInitialized && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      )}

      {hasInitialized && (
        <>
          {/* ── Disclaimer summary — always shown. Uses the inherited disclaimer
               (User's profile disclaimer) when no disclaimer is saved for the
               current category yet. ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Applies to:
                </span>
                {disclaimer?.apply_all_benefits_categories ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                    All Categories
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#23919C]/10 text-[#23919C] text-[10px] font-semibold">
                    {categoryKeyToHubLabel(currentCategoryKey)}
                  </span>
                )}
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

            {/* Disclaimer card */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-card dark:bg-gray-800/50">
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                {disclaimer?.text || inheritedText}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Create / Edit Disclaimer Modal ── */}
      {isModalOpen && (
        <DisclaimerModal
          isOpen={isModalOpen}
          disclaimer={disclaimer}
          companyName={companyName}
          organizationName={organizationName}
          benefitCategory={currentCategoryKey}
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
                    {categoryKeyToPortalLabel(currentCategoryKey)}
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
                    {categoryKeyToPortalLabel(currentCategoryKey)} — Employee Portal
                  </div>
                </div>

                {/* Benefit page content mock */}
                <div className="px-8 py-12 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {categoryKeyToPortalLabel(currentCategoryKey)}
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
