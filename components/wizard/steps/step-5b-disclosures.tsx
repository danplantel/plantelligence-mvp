"use client";

import { useEffect, useRef, useState } from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import {
  PLATFORM_DISCLOSURE_TEXT,
  DEFAULT_YOUR_DISCLOSURE_TEXT,
  BENEFITS_HUB_YOUR_DISCLOSURE_TEXT,
  FLYER_MARKETING_YOUR_DISCLOSURE_TEXT,
  combineDisclosureText,
  splitDisclosureText,
} from "@/lib/disclaimer-constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Lock, Plus } from "lucide-react";
import { Disclaimer } from "@/types/wizard";
import { SkipAttestationModal } from "./sections/attestation-modals/skip-attestation-modal";

interface Step5bDisclosuresProps {
  onValidationChange?: (isValid: boolean) => void;
  errorFields: string[];
  companyName?: string;
  organizationName?: string;
  useNewClientStore?: boolean;
  disclaimerScopeFlag?: boolean;
  forceUniversalScope?: boolean;
  /**
   * Skip straight past this step — supplied by the ONBOARDING wizard, whose footer
   * skip action owns the "Skip Disclosures for now?" attestation and the advance
   * (to Step 5c, or to the Dashboard when the team step does not apply).
   *
   * Absent in the plan-level editor (Create Plan / Edit Client), which has no next
   * step — there the button keeps its local meaning and reveals the editor.
   */
  onSkipForNow?: () => void;
}

/**
 * Flyer & Marketing uses a short platform attribution instead of the full
 * PlanTelligence boilerplate that the Benefits Hub footer carries.
 */
const POWERED_BY_PLATFORM_TEXT = "Powered by PlanTelligence®";

/**
 * The two disclosure surfaces an advisor maintains, each saved as its own
 * `Disclaimer` (keyed by the location below) and paired with its own locked
 * platform text.
 */
const DISCLOSURE_SECTIONS = [
  {
    key: "benefits_hub",
    title: "1. Benefits Hub Footer",
    location: "Benefits Hub / Client Website",
    platformText: PLATFORM_DISCLOSURE_TEXT,
    recommendedText: BENEFITS_HUB_YOUR_DISCLOSURE_TEXT,
    maxLength: 2000,
  },
  {
    key: "flyer_marketing",
    title: "2. Flyer & Marketing",
    location: "Marketing Materials",
    platformText: POWERED_BY_PLATFORM_TEXT,
    recommendedText: FLYER_MARKETING_YOUR_DISCLOSURE_TEXT,
    maxLength: 250,
  },
] as const;

type SectionMode = "recommended" | "custom";

interface SectionState {
  mode: SectionMode;
  text: string;
}

/** Build the per-section editor state from the stored disclaimers. */
function buildSections(stored: Disclaimer[] | undefined): Record<string, SectionState> {
  const list = Array.isArray(stored) ? stored : [];
  const result: Record<string, SectionState> = {};
  for (const cfg of DISCLOSURE_SECTIONS) {
    const existing = list.find((d) => (d.locations || []).includes(cfg.location));
    if (existing) {
      // Split the stored text; if "your" equals the recommended copy, treat it
      // as "Use Recommended" so the radios reflect how it was saved.
      const { your } = splitDisclosureText(existing.text, cfg.platformText);
      const isRecommended = your.trim() === cfg.recommendedText.trim();
      result[cfg.key] = {
        mode: isRecommended ? "recommended" : "custom",
        text: isRecommended ? cfg.recommendedText : your,
      };
    } else {
      result[cfg.key] = { mode: "recommended", text: cfg.recommendedText };
    }
  }
  return result;
}

export function Step5bDisclosures({
  onValidationChange,
  onSkipForNow,
  organizationName,
  useNewClientStore = false,
  forceUniversalScope = false,
}: Step5bDisclosuresProps) {
  // Use appropriate store based on prop
  const onboardingStore = useOnboardingWizardStore();
  const newClientStore = useNewClientWizardStore();

  const store = useNewClientStore ? newClientStore : onboardingStore;
  const { stepData, saveStepDataLocally, saveStepDataToServer } = store;
  const saveAsDraft = (store as any).saveAsDraft;
  const loadStepData = (store as any).loadStepData;

  const initialDisclaimers: Disclaimer[] = stepData.disclaimers?.disclaimers || [];
  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>(initialDisclaimers);
  const [sections, setSections] = useState<Record<string, SectionState>>(() =>
    buildSections(initialDisclaimers),
  );
  // Intro (two buttons) is shown first; "Add Now" opens the editor.
  const [showEditor, setShowEditor] = useState(false);
  // Skip attestation — opened by the intro's "Confirm Disclosures / Skip for Now".
  const [showSkipAttestation, setShowSkipAttestation] = useState(false);

  // Once the user touches a section we stop re-syncing from the store, so a
  // late server refresh can never clobber an in-flight edit.
  const dirtyRef = useRef(false);
  const textTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const resolvedOrgName =
    organizationName ||
    (useNewClientStore
      ? (stepData as any).companyBasics?.companyName
      : (stepData as any).branding?.organizationName) ||
    "";

  const renderOrg = (text: string) =>
    text
      .replace(/\[Organization Name\]/g, resolvedOrgName || "[Organization Name]")
      .replace(/\{Organization Name\}/g, resolvedOrgName || "{Organization Name}");

  // Persist a full disclaimers array (local + server + User.disclaimer mirror).
  const persist = async (updated: Disclaimer[]) => {
    setDisclaimers(updated);
    saveStepDataLocally("disclaimers", { disclaimers: updated });
    const serverSaved = await saveStepDataToServer("disclaimers", { disclaimers: updated });
    if (!serverSaved) return;
    try {
      await fetch("/api/profile/update-disclaimer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disclaimer: JSON.stringify(updated) }),
      });
    } catch {
      // Non-critical — wizard completion also persists them.
    }
    if (forceUniversalScope) {
      try {
        const universal = updated.filter((d) => d.scope !== "plan");
        await fetch("/api/onboarding-wizard/disclaimers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disclaimers: universal }),
        });
      } catch {
        // Best-effort.
      }
    }
    if (saveAsDraft) {
      try {
        await saveAsDraft();
      } catch {
        // Best-effort.
      }
    }
  };

  // Upsert one section's disclaimer (matched by its location).
  const upsertSection = (key: string, next: SectionState) => {
    const cfg = DISCLOSURE_SECTIONS.find((s) => s.key === key);
    if (!cfg) return;
    const yourText =
      next.mode === "recommended" ? cfg.recommendedText : next.text;
    const text = combineDisclosureText(yourText, cfg.platformText);

    const base = disclaimers;
    const idx = base.findIndex((d) => (d.locations || []).includes(cfg.location));
    const updated =
      idx >= 0
        ? base.map((d, i) => (i === idx ? { ...d, text } : d))
        : [
            ...base,
            {
              id: `${cfg.key}-${Date.now()}`,
              text,
              locations: [cfg.location],
              customLocation: "",
            } as Disclaimer,
          ];
    void persist(updated);
  };

  /**
   * Accept the recommended "Your Disclosure" for both surfaces — used by the
   * "Confirm Disclosures / Skip for Now" intro action.
   */
  const acceptRecommendedDefaults = () => {
    const updated = [...disclaimers];
    for (const cfg of DISCLOSURE_SECTIONS) {
      const text = combineDisclosureText(cfg.recommendedText, cfg.platformText);
      const idx = updated.findIndex((d) => (d.locations || []).includes(cfg.location));
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], text };
      } else {
        updated.push({
          id: `${cfg.key}-${Date.now()}`,
          text,
          locations: [cfg.location],
          customLocation: "",
        } as Disclaimer);
      }
    }
    setSections(buildSections(updated));
    void persist(updated);
  };

  // Initial load + seed: pull any saved disclaimers, then make sure BOTH
  // sections exist (defaulting to "Use Recommended") so completing onboarding
  // always carries the platform + recommended language for each surface.
  useEffect(() => {
    if (typeof loadStepData !== "function") return;
    let cancelled = false;
    const run = async () => {
      let stored: Disclaimer[] = stepData.disclaimers?.disclaimers || [];
      try {
        const data: any = await loadStepData("disclaimers");
        if (Array.isArray(data?.disclaimers) && data.disclaimers.length > 0) {
          stored = data.disclaimers;
        }
      } catch {
        // Fall back to whatever the store already had.
      }
      if (cancelled) return;

      setDisclaimers(stored);
      setSections(buildSections(stored));

      const missing = DISCLOSURE_SECTIONS.filter(
        (cfg) => !stored.some((d) => (d.locations || []).includes(cfg.location)),
      );
      if (missing.length > 0) {
        const seeded: Disclaimer[] = [
          ...stored,
          ...missing.map((cfg) => ({
            id: `${cfg.key}-${Date.now()}`,
            text: combineDisclosureText(cfg.recommendedText, cfg.platformText),
            locations: [cfg.location],
            customLocation: "",
          })),
        ];
        await persist(seeded);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadStepData]);

  // Clean up any pending text debounce timers on unmount.
  useEffect(() => {
    return () => {
      Object.values(textTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // On the two-button intro the footer's "Confirm Disclosures" stays disabled
  // until the advisor goes through the attestation (which opens the editor);
  // once they're editing, the step is valid.
  useEffect(() => {
    onValidationChange?.(showEditor);
  }, [onValidationChange, showEditor]);

  const handleModeChange = (key: string, mode: SectionMode) => {
    dirtyRef.current = true;
    const cfg = DISCLOSURE_SECTIONS.find((s) => s.key === key);
    const next: SectionState =
      mode === "recommended"
        ? { mode, text: cfg?.recommendedText || DEFAULT_YOUR_DISCLOSURE_TEXT }
        : { mode, text: "" };
    setSections((prev) => ({ ...prev, [key]: next }));
    upsertSection(key, next);
  };

  const handleTextChange = (key: string, value: string) => {
    const cfg = DISCLOSURE_SECTIONS.find((s) => s.key === key);
    // Hard-cap at the section's limit (guards programmatic/pasted values too).
    const capped = cfg ? value.slice(0, cfg.maxLength) : value;
    dirtyRef.current = true;
    setSections((prev) => ({ ...prev, [key]: { mode: "custom", text: capped } }));
    if (textTimersRef.current[key]) clearTimeout(textTimersRef.current[key]);
    textTimersRef.current[key] = setTimeout(() => {
      upsertSection(key, { mode: "custom", text: capped });
    }, 500);
  };

  const header = (
    <div className="text-left space-y-1">
      <h2 className="text-lg font-semibold text-foreground">
        Compliance Disclosures
      </h2>
      <p className="text-sm text-muted-foreground">
        Provide compliance language for participant and client-facing materials
      </p>
    </div>
  );

  const attestationNotice = (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      Confirming opens a short attestation. Skipping is allowed, but Benefits
      Hubs can’t be published until your disclosures are reviewed and confirmed.
    </div>
  );

  // Intro — start with the two actions before revealing the editor.
  if (!showEditor) {
    return (
      <>
        <div className="max-w-2xl mx-auto space-y-4">
        {header}

        <Card className="shadow-none dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="pt-3 pb-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={() => setShowEditor(true)}
                className="w-full flex items-center justify-center gap-2 bg-accent-blue text-white hover:bg-[#3f797f] dark:bg-accent-blue-dark dark:hover:bg-accent-blue"
              >
                <Plus className="h-4 w-4" />
                Add Now
              </Button>
              <Button
                type="button"
                variant="outline"
                // Onboarding: hand off to the wizard's skip flow, which shows the
                // attestation and then advances to 5c (or finishes).
                // Plan-level editor (no next step): reveal the editor, as before.
                onClick={() =>
                  onSkipForNow ? onSkipForNow() : setShowSkipAttestation(true)
                }
                className="w-full flex items-center justify-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Confirm Disclosures / Skip for Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {attestationNotice}
        </div>

        <SkipAttestationModal
          isOpen={showSkipAttestation}
          onClose={() => setShowSkipAttestation(false)}
          onConfirm={() => {
            setShowSkipAttestation(false);
            acceptRecommendedDefaults();
            setShowEditor(true);
          }}
        />
      </>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {header}

      {DISCLOSURE_SECTIONS.map((cfg) => {
        const state = sections[cfg.key];

        return (
          <Card
            key={cfg.key}
            className="shadow-none dark:bg-gray-800 dark:border-gray-700"
          >
            <CardContent className="space-y-4 pt-4 pb-4">
              <h3 className="text-base font-semibold text-foreground">
                {cfg.title}
              </h3>

              {/* Locked platform language */}
              <div className="space-y-1.5">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <Lock className="h-3 w-3" />
                  Platform Disclosure
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400">
                  {renderOrg(cfg.platformText)}
                </div>
              </div>

              {/* Editable "Your Disclosure" */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Your Disclosure
                </p>

                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  Merge fields:{" "}
                  <span className="font-medium text-foreground">{"{Organization Name}"}</span>{" "}
                  fills from your organization name (Step 3);{" "}
                  <span className="font-medium text-foreground">{"{Plan Sponsor Name}"}</span>{" "}
                  is filled in automatically for each plan.
                  {cfg.key === "flyer_marketing" && (
                    <>
                      {" "}
                      <span className="font-medium text-foreground">{"{Benefits Hub QR / link}"}</span>{" "}
                      shows the Benefits Hub link — or “the Benefits Hub” when a QR code is present.
                    </>
                  )}
                </p>

                <RadioGroup
                  value={state?.mode || "recommended"}
                  onValueChange={(value) =>
                    handleModeChange(cfg.key, value as SectionMode)
                  }
                  className="flex items-center gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="recommended"
                      id={`${cfg.key}-recommended`}
                    />
                    <Label
                      htmlFor={`${cfg.key}-recommended`}
                      className="text-sm font-normal cursor-pointer dark:text-gray-300"
                    >
                      Use Recommended
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id={`${cfg.key}-custom`} />
                    <Label
                      htmlFor={`${cfg.key}-custom`}
                      className="text-sm font-normal cursor-pointer dark:text-gray-300"
                    >
                      Add my own
                    </Label>
                  </div>
                </RadioGroup>

                <Textarea
                  value={state?.text || ""}
                  rows={10}
                  onChange={(e) => handleTextChange(cfg.key, e.target.value)}
                  placeholder="Enter or paste your disclosure text here..."
                  maxLength={cfg.maxLength}
                  className="min-h-[140px] resize-none dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                />

                <div className="flex justify-end">
                  <span
                    className={`text-xs ${
                      (state?.text?.length || 0) >= cfg.maxLength
                        ? "text-amber-600 dark:text-amber-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {(state?.text?.length || 0).toLocaleString()} /{" "}
                    {cfg.maxLength.toLocaleString()} characters
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {attestationNotice}
    </div>
  );
}
