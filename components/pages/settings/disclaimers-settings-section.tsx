"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Disclaimer } from "@/types/wizard";
import { fetchProfileOnce, invalidateProfileCache } from "@/lib/fetch-profile";
import {
  PLATFORM_DISCLOSURE_TEXT,
  DEFAULT_YOUR_DISCLOSURE_TEXT,
  BENEFITS_HUB_YOUR_DISCLOSURE_TEXT,
  FLYER_MARKETING_YOUR_DISCLOSURE_TEXT,
  combineDisclosureText,
  splitDisclosureText,
} from "@/lib/disclaimer-constants";
import { AddNowAttestationModal } from "@/components/wizard/steps/sections/attestation-modals/add-now-attestation-modal";

/**
 * Settings → Organization › Disclosures.
 *
 * Mirrors the Onboarding Step 5b (Compliance Disclosures) editor so the two
 * surfaces cannot drift: the two disclosure surfaces an advisor maintains —
 * **Benefits Hub Footer** and **Flyer & Marketing** — each shown as a locked
 * "Platform Disclosure" beside an editable "Your Disclosure" with the same
 * "Use Recommended" / "Add my own" choice, character limits and merge-field note.
 *
 * The one deliberate difference from 5b is WHEN it persists. 5b has no Save
 * button, so it writes on every change; Settings has a page-level Save bar, so
 * edits are held locally and committed by `save()` (the imperative handle the
 * page drives). Confirming then opens the same attestation dialog 5b uses
 * ("Confirm Your Disclosures"), which records the organization-level review (a
 * new immutable disclosure version + attestation row, context `settings`).
 *
 * Both surfaces are saved as their own `Disclaimer`, keyed by `location`, and any
 * other disclaimer already on the record (e.g. a plan-scoped one) is preserved
 * untouched.
 */

/** Flyer & Marketing uses a short platform attribution rather than the full boilerplate. */
const POWERED_BY_PLATFORM_TEXT = "Powered by PlanTelligence®";

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

export interface DisclaimersSettingsSectionHandle {
  /** Persist the current form. Returns false if the save failed. */
  save: (skipConfirm?: boolean) => Promise<boolean>;
  /** Restore the form to the last saved baseline. */
  reset: () => void;
  /** Whether the form has unsaved changes. */
  isDirty: () => boolean;
}

interface DisclaimersSettingsSectionProps {
  onDirtyChange?: (dirty: boolean) => void;
  /** Called after a save/attestation so the ledger can re-read the revision. */
  onSaved?: () => void;
}

export const DisclaimersSettingsSection = forwardRef<
  DisclaimersSettingsSectionHandle,
  DisclaimersSettingsSectionProps
>(function DisclaimersSettingsSection({ onDirtyChange, onSaved }, ref) {
  const { stepData, saveStepDataLocally, saveStepDataToServer } =
    useOnboardingWizardStore();

  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>([]);
  const [sections, setSections] = useState<Record<string, SectionState>>(() =>
    buildSections([]),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAttestation, setShowAttestation] = useState(false);
  const [orgName, setOrgName] = useState("");

  // Baseline snapshot used for "unsaved changes" detection.
  const baselineRef = useRef<Record<string, SectionState>>(buildSections([]));
  // The disclaimers array awaiting attestation, held until the dialog confirms.
  const pendingRef = useRef<Disclaimer[] | null>(null);

  const renderOrg = useCallback(
    (text: string) =>
      text
        .replace(
          /\[Organization Name\]/g,
          orgName || "[Organization Name]",
        )
        .replace(/\{Organization Name\}/g, orgName || "{Organization Name}"),
    [orgName],
  );

  const getIsDirty = useCallback(
    () => JSON.stringify(sections) !== JSON.stringify(baselineRef.current),
    [sections],
  );

  // Load from /api/profile (wizard session → User.disclaimer), then seed the two
  // section editors. Nothing is written on load — the Save bar owns persistence.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const profile: any = await fetchProfileOnce();
        const profileOrgName =
          profile?.organizationName ||
          profile?.wizardSessions?.[0]?.branding?.organizationName ||
          profile?.organizationType ||
          stepData.branding?.organizationName ||
          "";
        if (!cancelled) {
          setOrgName(profileOrgName || stepData.branding?.organizationName || "");
        }

        let arr: Disclaimer[] = [];
        const raw = profile?.wizardSessions?.[0]?.disclaimers;
        if (raw) {
          arr = Array.isArray(raw.disclaimers)
            ? raw.disclaimers
            : Array.isArray(raw)
              ? raw
              : [];
        }
        // After wizard completion, WizardDisclaimers is deleted and the data is
        // persisted as a JSON string on User.disclaimer.
        if (arr.length === 0 && profile?.disclaimer) {
          if (Array.isArray(profile.disclaimer)) {
            arr = profile.disclaimer;
          } else if (typeof profile.disclaimer === "string") {
            try {
              const parsed = JSON.parse(profile.disclaimer);
              if (Array.isArray(parsed)) arr = parsed;
            } catch {
              arr = [
                { id: "legacy", locations: ["Global"], text: profile.disclaimer },
              ] as Disclaimer[];
            }
          }
        }

        if (cancelled) return;
        setDisclaimers(arr);
        const built = buildSections(arr);
        setSections(built);
        baselineRef.current = built;
      } catch {
        // Best-effort pre-fill.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify the parent whenever the sections change.
  useEffect(() => {
    onDirtyChange?.(getIsDirty());
  }, [sections, getIsDirty, onDirtyChange]);

  const handleModeChange = (key: string, mode: SectionMode) => {
    const cfg = DISCLOSURE_SECTIONS.find((s) => s.key === key);
    const next: SectionState =
      mode === "recommended"
        ? { mode, text: cfg?.recommendedText || DEFAULT_YOUR_DISCLOSURE_TEXT }
        : { mode, text: "" };
    setSections((prev) => ({ ...prev, [key]: next }));
  };

  const handleTextChange = (key: string, value: string) => {
    const cfg = DISCLOSURE_SECTIONS.find((s) => s.key === key);
    // Hard-cap at the section's limit (guards pasted/programmatic values too).
    const capped = cfg ? value.slice(0, cfg.maxLength) : value;
    setSections((prev) => ({ ...prev, [key]: { mode: "custom", text: capped } }));
  };

  /** Merge both sections back into the full disclaimers array (preserving others). */
  const buildDisclaimers = (): Disclaimer[] => {
    const updated = [...disclaimers];
    for (const cfg of DISCLOSURE_SECTIONS) {
      const state =
        sections[cfg.key] ?? { mode: "recommended" as SectionMode, text: cfg.recommendedText };
      const yourText =
        state.mode === "recommended" ? cfg.recommendedText : state.text;
      const text = combineDisclosureText(yourText, cfg.platformText);
      const idx = updated.findIndex((d) =>
        (d.locations || []).includes(cfg.location),
      );
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
    return updated;
  };

  // Record the organization-level review: a new immutable disclosure version
  // plus the attestation row (context `settings`). Best-effort — the text is
  // already saved by the time this runs.
  const recordAttestation = (arr: Disclaimer[]) =>
    fetch("/api/organization/disclosures-reviewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "settings", disclosures: arr }),
    }).catch(() => {
      // Ignore — status is re-derivable from the stored disclosures.
    });

  // The edit needs re-attestation: clear the reviewed flag so the dashboard reads
  // "not reviewed" until the advisor confirms. Best-effort.
  const clearAttestation = () =>
    fetch("/api/organization/disclosures-reviewed", { method: "DELETE" }).catch(
      () => {
        // Ignore.
      },
    );

  const handleAttestationConfirm = async () => {
    setShowAttestation(false);
    const arr = pendingRef.current;
    pendingRef.current = null;
    if (arr) await recordAttestation(arr);
    onSaved?.();
    toast.success("Disclosures updated successfully!");
  };

  const handleAttestationClose = () => {
    setShowAttestation(false);
    pendingRef.current = null;
    // The text is saved, but the confirmation was declined — so the disclosures
    // are no longer "reviewed" and the Dashboard alert returns until they are.
    void clearAttestation();
    onSaved?.();
  };

  // ── Imperative save, driven by the page's Save bar ──────────────────────────
  const handleSave = async (skipConfirm = false): Promise<boolean> => {
    if (!getIsDirty()) return true;
    setIsSaving(true);
    try {
      const updated = buildDisclaimers();

      setDisclaimers(updated);
      await saveStepDataLocally("disclaimers", { disclaimers: updated });
      const serverSaved = await saveStepDataToServer("disclaimers", {
        disclaimers: updated,
      });
      if (!serverSaved) {
        toast.error("Failed to save disclosures. Please try again.");
        return false;
      }

      // Mirror onto User.disclaimer so the portal footer and this section agree.
      try {
        await fetch("/api/profile/update-disclaimer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disclaimer: JSON.stringify(updated) }),
        });
        invalidateProfileCache();
      } catch {
        // Non-critical — the wizard completion also persists these.
      }

      // Reset the dirty baseline (the text is now persisted).
      baselineRef.current = sections;
      onDirtyChange?.(false);

      if (skipConfirm) {
        // Leaving the tab — the explicit Save stands in for the dialog, which
        // could not be answered while navigating away.
        await recordAttestation(updated);
        onSaved?.();
        toast.success("Disclosures updated successfully!");
      } else {
        pendingRef.current = updated;
        setShowAttestation(true);
      }
      return true;
    } catch (error) {
      console.error("Error saving disclosures:", error);
      toast.error("Failed to save disclosures. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSections(baselineRef.current);
    onDirtyChange?.(false);
  };

  useImperativeHandle(
    ref,
    () => ({ save: handleSave, reset: handleReset, isDirty: getIsDirty }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleSave, handleReset, getIsDirty],
  );

  const attestationNotice = (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      Confirming opens a short attestation. Benefits Hubs can’t be published
      until your disclosures are reviewed and confirmed.
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                  <span className="font-medium text-foreground">
                    {"{Organization Name}"}
                  </span>{" "}
                  fills from your organization name;{" "}
                  <span className="font-medium text-foreground">
                    {"{Plan Sponsor Name}"}
                  </span>{" "}
                  is filled in automatically for each plan.
                  {cfg.key === "flyer_marketing" && (
                    <>
                      {" "}
                      <span className="font-medium text-foreground">
                        {"{Benefits Hub QR / link}"}
                      </span>{" "}
                      shows the Benefits Hub link — or “the Benefits Hub” when a QR
                      code is present.
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

      {/* The same attestation dialog Step 5b uses, opened on Confirm save. */}
      <AddNowAttestationModal
        isOpen={showAttestation}
        onClose={handleAttestationClose}
        onConfirm={handleAttestationConfirm}
      />
    </div>
  );
});
