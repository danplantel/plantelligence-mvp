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
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Disclaimer } from "@/types/new-client-wizard";
import {
  resolveDefaultDisclosuresText,
  ensurePlanTelligenceTrademark,
} from "@/lib/disclaimer-constants";
import { PortalDisclaimers } from "@/components/pages/client-portal/sections/portal-disclaimers";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Eye, FileText, Edit2, X } from "lucide-react";

/**
 * New Client Step 5a – Home Page Footer Disclaimer
 *
 * The user creates exactly ONE disclaimer that appears in the Footer of the
 * **Home Page** (`app/(portal)/[id]/page.tsx`). This is **not** a benefit
 * category portal page (e.g. Retirement Plan) — it is the main client landing
 * page that employees see first.
 *
 * Persisted to the client record via the New Client Wizard store so the
 * home page layout can read and render the disclaimer inside
 * `<PortalDisclaimers disclosuresText={…} />`.
 */

// ── Location options for the Home Page disclaimer ──
const LOCATION_OPTIONS = [
  { value: "Home Page", label: "Home Page (main landing page)" },
  { value: "Global", label: "Global (all pages)" },
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
      resolveDefaultDisclosuresText(organizationName, companyName, true),
  );
  const [locations, setLocations] = useState<string[]>(
    disclaimer?.locations || ["Home Page"],
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
    : locations[0] || "Home Page";

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
                Home Page
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
              onChange={(e) =>
                setText(ensurePlanTelligenceTrademark(e.target.value))
              }
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
//  NewClientStep5a — Single Disclaimer for the Home Page
// ═══════════════════════════════════════════════════════════════════════════

interface NewClientStep5aProps {
  errorFields?: string[];
  onValidationChange?: (isValid: boolean) => void;
}

export function NewClientStep5a({
  errorFields = [],
  onValidationChange,
}: NewClientStep5aProps) {
  const {
    stepData: newClientStepData,
    saveStepDataLocally,
    saveStepDataToServer,
    saveAsDraft,
    loadStepData,
    draftClientId,
    advisorProfile,
  } = useNewClientWizardStore();

  const { stepData: onboardingStepData, loadAllWizardData, loadStepData: loadOnboardingStepData } =
    useOnboardingWizardStore();

  // ── Resolve organisation & company name ──
  // [Organization Name] is resolved from the advisor's organization (onboarding
  // branding, falling back to the user's profile organization name, and finally
  // the plan's company name), while [Company Name] is populated with the Plan's
  // company name from Step 1 (Company Basics).
  const organizationName =
    onboardingStepData.branding?.organizationName ||
    (advisorProfile as any)?.organizationName ||
    newClientStepData.companyBasics?.companyName ||
    "[Organization Name]";
  const companyName =
    newClientStepData.companyBasics?.companyName || "[Company Name]";

  // DEBUG: confirm what [Organization Name] resolves to.
  console.log("[step5a] org/company resolve:", JSON.stringify({
    onboardingBrandingOrg: onboardingStepData.branding?.organizationName ?? null,
    advisorProfileOrg: (advisorProfile as any)?.organizationName ?? null,
    planCompany: newClientStepData.companyBasics?.companyName ?? null,
    resolvedOrganizationName: organizationName,
    resolvedCompanyName: companyName,
  }));

  // Resolve both placeholders in the disclaimer text.
  const resolveDisclaimerText = useCallback(
    (text: string): string =>
      text
        .replace(/\[Organization Name\]/g, organizationName)
        .replace(/\[Company Name\]/g, companyName),
    [organizationName, companyName],
  );

  // ── Fetch the onboarding disclaimer text to use as default for new plans ──
  const getOnboardingDisclaimerText = useCallback(async (): Promise<string | null> => {
    try {
      // Try in-memory store first
      const onboardingDisclaimers = onboardingStepData.disclaimers?.disclaimers;
      if (onboardingDisclaimers && onboardingDisclaimers.length > 0) {
        return onboardingDisclaimers[0].text;
      }
      // Fall back to server
      const data = await loadOnboardingStepData("disclaimers");
      if (data?.disclaimers?.length > 0) {
        return data.disclaimers[0].text;
      }
    } catch {
      // Silently fail
    }
    return null;
  }, [onboardingStepData.disclaimers, loadOnboardingStepData]);

  // ── Fetch the User's disclaimer (same source as Settings > Team & Disclaimers) ──
  // The disclaimer text the advisor saved on their profile. Returns the first
  // disclaimer as a Disclaimer object so it can be used directly on the Home
  // Page footer.
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
          arr = [{ id: "profile", locations: ["Home Page"], text: raw }];
        }
      }

      const first = arr[0];
      if (!first || !first.text) return null;

      return {
        id: first.id || "profile",
        text: first.text,
        locations: Array.isArray(first.locations) && first.locations.length > 0
          ? first.locations
          : ["Home Page"],
        customLocation: first.customLocation || "",
        scope: "plan",
        apply_all_benefits_categories: first.apply_all_benefits_categories ?? false,
      };
    } catch {
      return null;
    }
  }, []);

  // ── Derive brand colours ──
  const primaryColor =
    newClientStepData.companyBasics?.primaryColor ||
    "#1F3A60";
  const secondaryColor =
    newClientStepData.companyBasics?.secondaryColor || "#6B7280";

  // ── State: single disclaimer (null = not yet created) ──
  const existingDisclaimers = newClientStepData.disclaimers?.disclaimers || [];

  // ── Footer background color mode ──
  // Stored in disclaimers meta so it persists alongside the disclaimer data.
  const storedFooterBg = (newClientStepData.disclaimers as any)?.footerBackground ?? {};
  const [footerBgMode, setFooterBgMode] = useState<"primary" | "secondary" | "custom">(
    storedFooterBg.mode || "primary",
  );
  const [footerBgCustomColor, setFooterBgCustomColor] = useState(
    storedFooterBg.customColor || "",
  );
  const resolvedFooterBgColor =
    footerBgMode === "secondary"
      ? secondaryColor
      : footerBgMode === "custom" && footerBgCustomColor.trim()
        ? footerBgCustomColor.trim()
        : primaryColor;

  const [disclaimer, setDisclaimer] = useState<Disclaimer | null>(() => {
    return existingDisclaimers.length > 0 ? existingDisclaimers[0] : null;
  });

  const [hasInitialized, setHasInitialized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInitialPrompt, setShowInitialPrompt] = useState(false);
  const [previewFooterOpen, setPreviewFooterOpen] = useState(false);

  // Load onboarding data if needed
  useEffect(() => {
    if (!onboardingStepData.branding?.organizationName && loadAllWizardData) {
      loadAllWizardData();
    }
  }, [onboardingStepData.branding?.organizationName, loadAllWizardData]);

  // ── Load disclaimer from draft/API on first mount ──
  useEffect(() => {
    const initializeDisclaimers = async () => {
      if (hasInitialized) return;
      if (disclaimer) {
        setHasInitialized(true);
        return;
      }

      try {
        // If it's a draft with existing disclaimers, use them — but resolve any
        // leftover [Organization Name] / [Company Name] placeholders first.
        if (draftClientId && existingDisclaimers.length > 0) {
          const resolved = {
            ...existingDisclaimers[0],
            text: resolveDisclaimerText(existingDisclaimers[0].text),
          };
          setDisclaimer(resolved);
          setHasInitialized(true);
          return;
        }

        // Try to load from the New Client Wizard API (session/draft) — resolve
        // placeholders so a previously-persisted template gets populated too.
        const data = await loadStepData("disclaimers");
        if (data?.disclaimers?.length > 0) {
          const d = data.disclaimers[0];
          const resolved = { ...d, text: resolveDisclaimerText(d.text) };
          setDisclaimer(resolved);
          saveStepDataLocally("disclaimers", { disclaimers: [resolved] });
          setHasInitialized(true);
          return;
        }

        // Prefer the User's profile disclaimer (Settings > Team & Disclaimers),
        // which is what should appear on the Home Page footer.
        const userProfileDisclaimer = await getUserProfileDisclaimer();
        if (userProfileDisclaimer) {
          const d: Disclaimer = {
            ...userProfileDisclaimer,
            text: resolveDisclaimerText(userProfileDisclaimer.text),
            locations: ["Home Page"],
            customLocation: "",
          };
          setDisclaimer(d);
          saveStepDataLocally("disclaimers", { disclaimers: [d] });
          setHasInitialized(true);
          return;
        }

        // Try to inherit from Onboarding disclaimers before showing the prompt
        const onboardingText = await getOnboardingDisclaimerText();
        if (onboardingText) {
          const inheritedDisclaimer: Disclaimer = {
            id: Date.now().toString(),
            text: resolveDisclaimerText(onboardingText),
            locations: ["Home Page"],
            customLocation: "",
            scope: "plan",
            apply_all_benefits_categories: false,
          };
          setDisclaimer(inheritedDisclaimer);
          saveStepDataLocally("disclaimers", { disclaimers: [inheritedDisclaimer] });
          setHasInitialized(true);
          return;
        }

        // No disclaimer found yet — show the prompt
        setHasInitialized(true);
        setShowInitialPrompt(true);
      } catch (error) {
        console.error("❌ Error initializing disclaimers:", error);
        // Prefer the User's profile disclaimer even on error
        try {
          const userProfileDisclaimer = await getUserProfileDisclaimer();
          if (userProfileDisclaimer) {
            const d: Disclaimer = {
              ...userProfileDisclaimer,
              text: resolveDisclaimerText(userProfileDisclaimer.text),
              locations: ["Home Page"],
              customLocation: "",
            };
            setDisclaimer(d);
            saveStepDataLocally("disclaimers", { disclaimers: [d] });
            setHasInitialized(true);
            return;
          }
        } catch {
          // fall through
        }
        // Try onboarding fallback even on error
        try {
          const onboardingText = await getOnboardingDisclaimerText();
          if (onboardingText) {
            const inheritedDisclaimer: Disclaimer = {
              id: Date.now().toString(),
              text: resolveDisclaimerText(onboardingText),
              locations: ["Home Page"],
              customLocation: "",
              scope: "plan",
              apply_all_benefits_categories: false,
            };
            setDisclaimer(inheritedDisclaimer);
            saveStepDataLocally("disclaimers", { disclaimers: [inheritedDisclaimer] });
            setHasInitialized(true);
            return;
          }
        } catch {
          // fall through
        }
        setHasInitialized(true);
        setShowInitialPrompt(true);
      }
    };

    initializeDisclaimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // ── Re-resolve placeholders when the org/company name becomes available ──
  // If the disclaimer was loaded/inherited while [Organization Name] was still
  // unresolved (e.g. the org name loaded asynchronously), patch the text so the
  // placeholder is populated. Only touches text that still contains placeholders.
  useEffect(() => {
    if (!disclaimer) return;
    const hasPlaceholders =
      disclaimer.text.includes("[Organization Name]") ||
      disclaimer.text.includes("[Company Name]");
    if (!hasPlaceholders) return;
    const resolvedText = resolveDisclaimerText(disclaimer.text);
    // Guard against a no-op resolve (e.g. org name still unresolved) to avoid
    // an infinite re-render loop.
    if (resolvedText === disclaimer.text) return;
    setDisclaimer((prev) =>
      prev ? { ...prev, text: resolvedText } : prev,
    );
  }, [organizationName, companyName, resolveDisclaimerText, disclaimer]);

  // ── Notify parent about validation status ──
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(!!disclaimer);
    }
  }, [disclaimer, onValidationChange]);

  // ── Persist footer background preference alongside the disclaimer ──
  const persistFooterBg = useCallback(
    async (mode: string, customColor: string) => {
      const d = disclaimer;
      saveStepDataLocally("disclaimers", {
        disclaimers: d ? [d] : [],
        footerBackground: { mode, customColor },
      });
      try {
        await saveStepDataToServer("disclaimers", {
          disclaimers: d ? [d] : [],
          footerBackground: { mode, customColor },
        });
        await saveAsDraft();
      } catch (error) {
        console.error("Failed to save draft when persisting footer background:", error);
      }
    },
    [disclaimer, saveStepDataLocally, saveStepDataToServer, saveAsDraft],
  );

  // ── Persist disclaimer to client record ──
  const persistDisclaimer = useCallback(
    async (d: Disclaimer) => {
      saveStepDataLocally("disclaimers", {
        disclaimers: [d],
        footerBackground: { mode: footerBgMode, customColor: footerBgCustomColor },
      });
      try {
        await saveStepDataToServer("disclaimers", {
          disclaimers: [d],
          footerBackground: { mode: footerBgMode, customColor: footerBgCustomColor },
        });
        await saveAsDraft();
      } catch (error) {
        console.error("Failed to save draft when persisting disclaimer:", error);
      }
    },
    [saveStepDataLocally, saveStepDataToServer, saveAsDraft, footerBgMode, footerBgCustomColor],
  );

  // ── Create / Update handler ──
  const handleSaveDisclaimer = async (data: Omit<Disclaimer, "id">) => {
    const d: Disclaimer = {
      ...data,
      id: disclaimer?.id || Date.now().toString(),
    };
    setDisclaimer(d);
    setShowInitialPrompt(false);
    setIsModalOpen(false);
    // Fire-and-forget server persistence — the local store is already updated
    // so the UI reflects the disclaimer immediately.
    persistDisclaimer(d).catch(() => {});
  };

  // ── Build disclosure text for the preview ──
  const buildDisclosureText = useCallback((): string => {
    if (!disclaimer) {
      // Try to use onboarding disclaimer as preview fallback
      const onboardingDisclaimers = onboardingStepData.disclaimers?.disclaimers;
      if (onboardingDisclaimers && onboardingDisclaimers.length > 0) {
        return resolveDisclaimerText(onboardingDisclaimers[0].text);
      }
      return resolveDefaultDisclosuresText(organizationName, companyName, true);
    }
    return disclaimer.text;
  }, [
    disclaimer,
    organizationName,
    companyName,
    onboardingStepData.disclaimers,
    resolveDisclaimerText,
  ]);

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
                  Home Page
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Create a disclaimer that will appear in the{" "}
                <strong className="text-gray-700 dark:text-gray-200">Footer</strong>{" "}
                of the{" "}
                <strong className="text-gray-700 dark:text-gray-200">
                  Home Page
                </strong>{" "}
                — the main landing page that employees see when they first visit. This is not a benefit
                category portal page (e.g. Retirement Plan, Health Insurance).
                This is a <strong>required</strong> step.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Footer Background Color ── */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded border border-gray-300"
              style={{ background: resolvedFooterBgColor }}
            />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Footer Background Color
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose which brand color the Footer section uses.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["primary", "secondary", "custom"] as const).map((mode) => {
              const label =
                mode === "primary"
                  ? "Primary"
                  : mode === "secondary"
                    ? "Secondary"
                    : "Custom";
              const colorVal =
                mode === "primary"
                  ? primaryColor
                  : mode === "secondary"
                    ? secondaryColor
                    : footerBgCustomColor || "#888888";
              const isActive = footerBgMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setFooterBgMode(mode);
                    persistFooterBg(mode, footerBgCustomColor).catch(() => {});
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                    isActive
                      ? "border-accent-blue ring-1 ring-accent-blue bg-accent-blue/5"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                    style={{ background: colorVal }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
          {footerBgMode === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={footerBgCustomColor || primaryColor}
                onChange={(e) => {
                  const v = e.target.value;
                  setFooterBgCustomColor(v);
                  persistFooterBg("custom", v).catch(() => {});
                }}
                className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0.5"
              />
              <input
                type="text"
                value={footerBgCustomColor}
                onChange={(e) => {
                  const v = e.target.value;
                  setFooterBgCustomColor(v);
                  persistFooterBg("custom", v).catch(() => {});
                }}
                placeholder="#HEX or color name"
                className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-transparent"
              />
            </div>
          )}
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

      {/* ── Disclaimer content ── */}
      {hasInitialized && !disclaimer && showInitialPrompt && (
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
                Home Page
              </strong>
              .
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
            Create Disclaimer for Home Page
          </Button>
        </div>
      )}

      {hasInitialized && disclaimer && (
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
          onSave={handleSaveDisclaimer}
          onClose={() => {
            setIsModalOpen(false);
            // If no disclaimer was saved, restore the initial prompt so the
            // "Disclaimer Required" UI doesn't vanish when user cancels.
            if (!disclaimer) {
              setShowInitialPrompt(true);
            }
          }}
        />
      )}

      {/* ── Footer Preview Modal ── */}
      {previewFooterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl">
              <div className="space-y-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Footer Preview
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    How the disclaimer will appear on the{" "}
                    <strong className="text-gray-600 dark:text-gray-300">
                      Home Page
                    </strong>
                  </p>
                </div>
                {/* Footer Background Color in header */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-1">
                    Footer Color:
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                    Controls the background color of the portal footer on all pages.
                  </span>
                  {(["primary", "secondary", "custom"] as const).map((mode) => {
                    const label =
                      mode === "primary"
                        ? "Primary"
                        : mode === "secondary"
                          ? "Secondary"
                          : "Custom";
                    const colorVal =
                      mode === "primary"
                        ? primaryColor
                        : mode === "secondary"
                          ? secondaryColor
                          : footerBgCustomColor || "#888888";
                    const isActive = footerBgMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setFooterBgMode(mode);
                          persistFooterBg(mode, footerBgCustomColor).catch(() => {});
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all ${
                          isActive
                            ? "border-accent-blue ring-1 ring-accent-blue bg-accent-blue/5"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                          style={{ background: colorVal }}
                        />
                        {label}
                      </button>
                    );
                  })}
                  {footerBgMode === "custom" && (
                    <>
                      <input
                        type="color"
                        value={footerBgCustomColor || primaryColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFooterBgCustomColor(v);
                          persistFooterBg("custom", v).catch(() => {});
                        }}
                        className="w-6 h-6 rounded cursor-pointer border border-gray-300 p-0.5"
                      />
                      <input
                        type="text"
                        value={footerBgCustomColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFooterBgCustomColor(v);
                          persistFooterBg("custom", v).catch(() => {});
                        }}
                        placeholder="#HEX"
                        className="w-20 text-[11px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-1 bg-transparent"
                      />
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFooterOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Preview content – actual PortalDisclaimers component */}
            <div className="p-0">
              <div className="bg-black min-h-[200px]">
                {/* Home page content mock */}
                <div className="px-8 py-12 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Welcome to the Benefits Hub!
                  </h2>
                  <p className="text-gray-400 text-sm max-w-xl mx-auto">
                    This is where the home page content would appear. Scroll
                    down to see the Footer with your disclaimer.
                  </p>
                </div>

                {/* The actual PortalDisclaimers with disclaimer text */}
                <PortalDisclaimers
                  companyData={{
                    disclaimers: buildDisclosureText(),
                    brandColor: resolvedFooterBgColor,
                    companyName: companyName,
                  }}
                  brandColor={resolvedFooterBgColor}
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
