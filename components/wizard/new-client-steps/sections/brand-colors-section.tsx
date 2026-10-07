"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Palette,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  Globe,
  Info,
  Search,
  Sparkles,
} from "lucide-react";
import {
  extractColorSets,
  type ColorSetSuggestion,
  type SiteTechInfo,
} from "@/lib/brand-color-extraction";

// ── Types ────────────────────────────────────────────────────────────────────

interface BrandColorsSectionProps {
  primaryColor: string;
  secondaryColor: string;
  onPrimaryChange: (color: string) => void;
  onSecondaryChange: (color: string) => void;
  isPrimaryPickerOpen: boolean;
  isSecondaryPickerOpen: boolean;
  onPrimaryPickerOpenChange: (open: boolean) => void;
  onSecondaryPickerOpenChange: (open: boolean) => void;
  logoDataUrl?: string | null;
  websiteUrl?: string;
  organizationName?: string;
  errorFields?: string[];
  touchedFields?: Record<string, boolean>;
  fieldErrors?: Record<string, string | null>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const setIcons: Record<ColorSetSuggestion["id"], typeof Sparkles> = {
  "ai-1": Sparkles,
  "ai-2": Sparkles,
  "ai-3": Sparkles,
};

/** One line of the extraction sequence: the logo, the website, then the palette. */
type ExtractionStage = "logo" | "website" | "palette";

/** How long each step of the sequence is on screen while the request is in flight. */
const EXTRACTION_STAGE_MS = 1100;
/** Client-facing floor for the whole sequence, so a fast response does not flicker. */
const EXTRACTION_MIN_MS = 2500;
/** How long the palette circles sit empty before the suggested colours fill them. */
const EXTRACTION_FILL_MS = 450;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

// ── Component ────────────────────────────────────────────────────────────────

export function BrandColorsSection({
  primaryColor,
  secondaryColor,
  onPrimaryChange,
  onSecondaryChange,
  isPrimaryPickerOpen,
  isSecondaryPickerOpen,
  onPrimaryPickerOpenChange,
  onSecondaryPickerOpenChange,
  logoDataUrl,
  websiteUrl,
  organizationName,
  errorFields = [],
  touchedFields = {},
  fieldErrors = {},
}: BrandColorsSectionProps) {
  const [colorSets, setColorSets] = useState<ColorSetSuggestion[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  // Detected website technology returned by the extraction (for debugging/rollout).
  const [siteType, setSiteType] = useState<SiteTechInfo | null>(null);
  // Tracks whether the user has clicked "Extract Colors" — switches the header
  // description to the "here are your suggestions" copy once extraction starts.
  const [hasExtracted, setHasExtracted] = useState(false);

  /**
   * The `errorFields` snapshot an extraction reset, so the styling it cleared stays
   * cleared until the wizard validates again.
   *
   * The wizard stores its error list and hands down the same array on every render, so a
   * change of reference means a new validation run — which is where a reset has to end.
   * That is what keeps a genuinely new error visible: pressing Next with the colours
   * still empty reports them again. It also means an extraction does not hide the red
   * borders the user arrived with, it only clears the state they chose to redo.
   */
  const [resetForSnapshot, setResetForSnapshot] = useState<string[] | null>(null);

  /** Whether a company website has been entered — step 2 of the sequence. */
  const hasWebsite = !!(websiteUrl || "").trim();

  /** The step of the extraction sequence currently on screen, or `null` when idle. */
  const [stage, setStage] = useState<ExtractionStage | null>(null);
  /** Suggested colours, shown filling the palette circles before the cards land. */
  const [palettePreview, setPalettePreview] = useState<ColorSetSuggestion[]>([]);
  /** Identifies the current run so a superseded or finished run stops touching state. */
  const runIdRef = useRef(0);

  const handleExtract = useCallback(async () => {
    if (!logoDataUrl && !hasWebsite) return;

    // Reset the validation state this extraction supersedes — both when it first runs and
    // on a re-extract, which is what "Re-extract Colors" means to the user.
    setResetForSnapshot(errorFields);

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const startedAt = Date.now();
    // The sequence has to at least reach its last step before the results land, so record
    // how long that is; the whole run is also floored at EXTRACTION_MIN_MS below.
    let stageBudget = EXTRACTION_STAGE_MS;
    const isStale = () => runIdRef.current !== runId;

    setIsExtracting(true);
    setHasExtracted(true);
    setExtractionError(null);
    setSelectedSetId(null);
    setSiteType(null);
    setPalettePreview([]);
    setStage("logo");

    // Advance the copy (and the website outline) while the request is in flight. The scan
    // line over the logo loops on its own via CSS, so only the steps move here.
    const runStages = async () => {
      await wait(EXTRACTION_STAGE_MS);
      if (isStale() || !hasWebsite) return;
      setStage("website");
      stageBudget += EXTRACTION_STAGE_MS;
      await wait(EXTRACTION_STAGE_MS);
    };

    const stages = runStages();

    try {
      const sets = await extractColorSets(
        logoDataUrl,
        websiteUrl,
        organizationName,
        setSiteType,
      );

      await stages;
      if (isStale()) return;

      // Hold the animation for the client's minimum so a fast response does not flash.
      const holdFor =
        Math.max(EXTRACTION_MIN_MS, stageBudget) - (Date.now() - startedAt);
      if (holdFor > 0) await wait(holdFor);
      if (isStale()) return;

      setColorSets(sets || []);

      const usable = (sets || []).filter((set) => set.available);
      if (usable.length === 0) return;

      // "Picking your palette…": the circles pop in empty, then fill a beat later.
      setStage("palette");
      await wait(EXTRACTION_FILL_MS);
      if (isStale()) return;

      setPalettePreview(usable);
    } catch (err: any) {
      if (isStale()) return;
      setExtractionError(err?.message || "Failed to extract colors");
    } finally {
      if (runIdRef.current === runId) {
        // Bump the id so a pending stage timer cannot revive this finished run.
        runIdRef.current += 1;
        setIsExtracting(false);
        setStage(null);
      }
    }
  }, [logoDataUrl, websiteUrl, organizationName, errorFields, hasWebsite]);

  /** The logo the last extraction was started for. */
  const extractionLogoRef = useRef<string | null>(null);

  // A logo already present on the first render came from a resumed draft (or an earlier
  // visit), not from an upload in this visit — record it as done so mounting does not fire
  // an AI run the user did not ask for. A logo that arrives later is an upload, and does
  // run.
  if (extractionLogoRef.current === null && logoDataUrl) {
    extractionLogoRef.current = logoDataUrl;
  }

  /**
   * Re-extract automatically when the logo is uploaded or replaced.
   *
   * The logo is the only trigger. The website is typed one character at a time, so
   * reacting to it would fire an AI request per keystroke; it is still required, because a
   * logo on its own has nothing to extract from — this is the "a logo *and* a website have
   * been provided" condition.
   *
   * A run never touches the chosen colors, only the suggestions, so re-uploading a logo
   * cannot overwrite what the user picked.
   */
  useEffect(() => {
    if (!logoDataUrl) return;
    if (extractionLogoRef.current === logoDataUrl) return;

    if (!(websiteUrl || "").trim()) {
      // Record it anyway: the run belongs to the logo, so a website typed afterwards must
      // not be the thing that fires it.
      extractionLogoRef.current = logoDataUrl;
      return;
    }

    // A run is already in flight — leave the logo unrecorded so this retries once it
    // settles rather than being dropped.
    if (isExtracting) return;

    extractionLogoRef.current = logoDataUrl;
    void handleExtract();
  }, [logoDataUrl, websiteUrl, isExtracting, handleExtract]);

  const selectSet = (set: ColorSetSuggestion) => {
    if (!set.available) return;
    setSelectedSetId(set.id);
    onPrimaryChange(set.primary);
    onSecondaryChange(set.secondary);
  };

  /**
   * True while the current error snapshot is the one an extraction reset.
   *
   * Compared by reference on purpose: the list is replaced on every validation run, so
   * this is true from the moment extraction starts until the wizard reports fresh errors
   * — covering the extraction itself and the window where its suggestions are on offer.
   * The locally-tracked half (`touchedFields`/`fieldErrors`) is deliberately left alone:
   * it is recomputed from the live value on every change, so it is never stale.
   */
  const validationWasReset =
    resetForSnapshot !== null && resetForSnapshot === errorFields;

  /**
   * Whether a field should show its error styling. Every red border, the swatch ring and
   * both messages read from here, so they clear together.
   */
  const isFieldInvalid = (field: string): boolean => {
    if (validationWasReset) return false;
    return (
      errorFields.includes(field) ||
      (touchedFields[field] && !!fieldErrors[field])
    );
  };

  const renderSwatch = (hex: string, label?: string) => (
    <div className="flex items-center gap-2">
      {label && (
        <span className="w-20 shrink-0 text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
      )}
      <span
        className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 shrink-0"
        style={{ background: hex }}
      />
      <span className="font-mono text-xs">{hex}</span>
    </div>
  );

  const stageLabel =
    stage === "logo"
      ? "Reading your logo…"
      : stage === "website"
        ? "Checking your website…"
        : stage === "palette"
          ? "Picking your palette…"
          : "Generating color suggestions…";

  return (
    <Card className="dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <Palette className="w-5 h-5 text-accent-blue" />
          Brand Colors
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          {isExtracting ? (
            stageLabel
          ) : hasExtracted && colorSets.length > 0 ? (
            "3 colors suggested. Select one, or fine-tune the colors manually below."
          ) : hasExtracted ? (
            "No color suggestions were found. Fine-tune the colors manually below."
          ) : (
            <>
              Click <strong>Extract Colors</strong> to generate three AI brand
              color suggestions based on your <b>logo</b> and <b>website</b>.
              Select the suggestion you want, or fine-tune the colors manually
              below.
            </>
          )}
        </p>
      </CardHeader>
      <CardContent>
        {/* ── Extract Button ────────────────────────────────────────────── */}
        {!isExtracting && colorSets.length === 0 && (
          <div className="mb-4">
            <Button
              type="button"
              onClick={handleExtract}
              disabled={!logoDataUrl && !websiteUrl?.trim()}
              className="inline-flex items-center gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white"
            >
              <Search className="w-4 h-4" />
              Extract Colors
            </Button>
            {!logoDataUrl && !websiteUrl?.trim() && (
              <p className="text-xs text-muted-foreground mt-1.5">
                <Info className="w-3 h-3 inline mr-1" />
                Upload a logo and enter a company website above to enable color
                extraction.
              </p>
            )}
          </div>
        )}

        {/* ── Loading state ─────────────────────────────────────────────── */}
        {isExtracting && (
          <div className="mx-auto mb-4 w-fit rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
            <div className="flex items-center justify-center gap-4 min-h-[72px]">
              {/* 1 — Reading your logo: a thin scan line sweeps the uploaded logo. */}
              <div
                className={`relative w-16 h-16 shrink-0 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 overflow-hidden flex items-center justify-center transition-opacity ${
                  stage === "logo" ? "opacity-100" : "opacity-60"
                }`}
              >
                {logoDataUrl ? (
                  <img
                    src={logoDataUrl}
                    alt="Your logo"
                    className="max-h-[80%] max-w-[80%] object-contain"
                  />
                ) : (
                  <Globe className="w-7 h-7 text-blue-400" />
                )}
                <span className="pointer-events-none absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-accent-blue to-transparent animate-logo-scan motion-reduce:animate-none" />
              </div>

              {/* 2 — Checking your website: the browser outline draws itself on. */}
              {hasWebsite && stage !== "logo" && (
                <div className="shrink-0 animate-fade-in-soft motion-reduce:animate-none">
                  <svg
                    width="56"
                    height="44"
                    viewBox="0 0 56 44"
                    fill="none"
                    className="text-blue-400"
                    aria-hidden="true"
                  >
                    {/* The frame draws itself on… */}
                    <rect
                      x="1"
                      y="1"
                      width="54"
                      height="42"
                      rx="4"
                      stroke="currentColor"
                      strokeWidth="2"
                      pathLength={1}
                      strokeDasharray="1"
                      className="animate-browser-draw motion-reduce:animate-none"
                    />
                    {/* …then the toolbar divider. */}
                    <path
                      d="M1 13h54"
                      stroke="currentColor"
                      strokeWidth="2"
                      pathLength={1}
                      strokeDasharray="1"
                      className="animate-browser-draw motion-reduce:animate-none"
                      style={{ animationDelay: "250ms" }}
                    />
                    {/* Traffic-light dots pop in one at a time. */}
                    <circle
                      cx="8"
                      cy="7"
                      r="1.5"
                      fill="currentColor"
                      className="animate-pop-in motion-reduce:animate-none"
                      style={{
                        animationDelay: "420ms",
                        transformBox: "fill-box",
                        transformOrigin: "center",
                      }}
                    />
                    <circle
                      cx="14"
                      cy="7"
                      r="1.5"
                      fill="currentColor"
                      className="animate-pop-in motion-reduce:animate-none"
                      style={{
                        animationDelay: "520ms",
                        transformBox: "fill-box",
                        transformOrigin: "center",
                      }}
                    />
                    <circle
                      cx="20"
                      cy="7"
                      r="1.5"
                      fill="currentColor"
                      className="animate-pop-in motion-reduce:animate-none"
                      style={{
                        animationDelay: "620ms",
                        transformBox: "fill-box",
                        transformOrigin: "center",
                      }}
                    />
                    {/* The URL bar keeps loading for as long as the request is in flight. */}
                    <line
                      x1="26"
                      y1="7"
                      x2="49"
                      y2="7"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      opacity="0.55"
                      pathLength={1}
                      strokeDasharray="1"
                      className="animate-browser-url motion-reduce:animate-none"
                    />
                    {/* Page content fills in behind it. */}
                    <rect
                      x="7"
                      y="20"
                      width="24"
                      height="3"
                      rx="1.5"
                      fill="currentColor"
                      opacity="0.35"
                      className="animate-fade-in-soft motion-reduce:animate-none"
                      style={{ animationDelay: "620ms" }}
                    />
                    <rect
                      x="7"
                      y="27"
                      width="42"
                      height="3"
                      rx="1.5"
                      fill="currentColor"
                      opacity="0.25"
                      className="animate-fade-in-soft motion-reduce:animate-none"
                      style={{ animationDelay: "760ms" }}
                    />
                    <rect
                      x="7"
                      y="34"
                      width="30"
                      height="3"
                      rx="1.5"
                      fill="currentColor"
                      opacity="0.2"
                      className="animate-fade-in-soft motion-reduce:animate-none"
                      style={{ animationDelay: "900ms" }}
                    />
                  </svg>
                </div>
              )}

              {/* 3 — Picking your palette: three dashed circles pop in, then fill. */}
              {stage === "palette" && (
                <div className="flex items-center gap-2 shrink-0">
                  {[0, 1, 2].map((index) => {
                    const set = palettePreview[index];
                    return (
                      <span
                        key={index}
                        className={`w-7 h-7 rounded-full border-2 animate-pop-in motion-reduce:animate-none ${
                          set
                            ? "border-transparent"
                            : "border-dashed border-blue-400/70"
                        }`}
                        style={{
                          animationDelay: `${index * 180}ms`,
                          background: set?.primary ?? "transparent",
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            <p className="mt-3 text-sm font-medium text-blue-700 dark:text-blue-400">
              {stageLabel}
            </p>
          </div>
        )}

        {/* ── Extraction error ──────────────────────────────────────────── */}
        {extractionError && !isExtracting && (
          <div className="mb-4 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{extractionError}</span>
            </div>
          </div>
        )}

        {/* ── Color Set Selection ───────────────────────────────────────── */}
        {colorSets.length > 0 && !isExtracting && (
          <div className="mb-4">
            {/* End state of the sequence: the circles stay and act as the picker. */}
            <div className="mb-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                {colorSets.map((set) => {
                  const isSelected = selectedSetId === set.id;
                  return (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => selectSet(set)}
                      disabled={!set.available}
                      title={set.label}
                      aria-label={`Select ${set.label}`}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        isSelected
                          ? "border-accent-blue ring-2 ring-accent-blue/40 scale-110"
                          : "border-gray-300 dark:border-gray-600"
                      } ${
                        set.available
                          ? "cursor-pointer hover:scale-110"
                          : "opacity-40 cursor-not-allowed"
                      }`}
                      style={{
                        background: set.available ? set.primary : "transparent",
                      }}
                    />
                  );
                })}
              </div>
              <span className="text-sm font-medium dark:text-gray-100">
                3 colors suggested
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {colorSets.map((set) => {
                const Icon = setIcons[set.id];
                const isSelected = selectedSetId === set.id;

                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => selectSet(set)}
                    disabled={!set.available}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? "border-accent-blue bg-accent-blue/10 ring-1 ring-accent-blue"
                        : set.available
                          ? "border-gray-300 dark:border-gray-600 hover:bg-muted/50 dark:hover:bg-gray-700"
                          : "border-dashed border-gray-300 dark:border-gray-600 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm flex items-center gap-1.5 dark:text-gray-100">
                        <Icon className="w-4 h-4" />
                        {set.label}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-accent-blue shrink-0" />
                      )}
                    </div>
                    {set.sourceUrl && (
                      <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1 truncate">
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="truncate">{set.sourceUrl}</span>
                      </p>
                    )}
                    {set.previewUrl && (
                      <div className="mb-2 flex items-center justify-center bg-muted/50 dark:bg-gray-900/40 rounded-md h-16 overflow-hidden">
                        <img
                          src={set.previewUrl}
                          alt={`${set.label} preview`}
                          className="max-h-full max-w-full object-contain p-1"
                        />
                      </div>
                    )}
                    {set.available ? (
                      <div className="space-y-2">
                        {renderSwatch(set.primary, "Primary")}
                        {set.secondary ? (
                          renderSwatch(set.secondary, "Secondary")
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No distinct secondary color found
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {set.unavailableReason}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExtract}
                  className="inline-flex items-center gap-1.5 text-xs"
                >
                  <Search className="w-3.5 h-3.5" />
                  Re-extract Colors
                </Button>
                {selectedSetId && (
                  <span className="text-xs text-muted-foreground">
                    Applied: {colorSets.find((s) => s.id === selectedSetId)?.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Re-runs extraction to generate fresh suggestions from your logo
                and website.
              </p>
            </div>
          </div>
        )}

        {/* ── Color Pickers Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary Color */}
          <div className="space-y-3 relative">
            <Label className="dark:text-gray-300 flex items-center gap-2">
              Primary Color <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  onPrimaryPickerOpenChange(!isPrimaryPickerOpen);
                  if (!isPrimaryPickerOpen && isSecondaryPickerOpen) {
                    onSecondaryPickerOpenChange(false);
                  }
                }}
                className={`w-9 h-9 border rounded cursor-pointer flex items-center justify-center ${
                  isFieldInvalid("primaryColor")
                    ? "border-red-500"
                    : primaryColor
                      ? "border-gray-300 dark:border-gray-600"
                      : "border-dashed border-gray-400 dark:border-gray-500"
                }`}
                style={{ background: primaryColor || "transparent" }}
              >
                <div
                  className={`w-4 h-4 rounded ${primaryColor ? "border border-white/20" : "border border-gray-400 dark:border-gray-500"}`}
                />
              </button>
              <Input
                icon={<Palette className="h-4 w-4" />}
                type="text"
                value={primaryColor}
                onChange={(e) => onPrimaryChange(e.target.value)}
                placeholder="#..."
                data-field="primaryColor"
                className="flex-1"
                destructive={isFieldInvalid("primaryColor")}
              />
              {primaryColor && !isFieldInvalid("primaryColor") && (
                <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400 shrink-0" />
              )}
            </div>
            <ColorPicker
              value={primaryColor}
              onChange={onPrimaryChange}
              isOpen={isPrimaryPickerOpen}
              onOpenChange={onPrimaryPickerOpenChange}
              title="Primary Color"
            />
            {isFieldInvalid("primaryColor") && (
              <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {primaryColor && primaryColor.trim()
                  ? "Primary color must be a valid hex color (e.g., #1F3A60)"
                  : "Primary color is required"}
              </p>
            )}

          </div>

          {/* Secondary Color */}
          <div className="space-y-3 relative">
            <Label className="dark:text-gray-300 flex items-center gap-2">
              Secondary Color <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  onSecondaryPickerOpenChange(!isSecondaryPickerOpen);
                  if (!isSecondaryPickerOpen && isPrimaryPickerOpen) {
                    onPrimaryPickerOpenChange(false);
                  }
                }}
                className={`w-9 h-9 border rounded cursor-pointer flex items-center justify-center ${
                  isFieldInvalid("secondaryColor")
                    ? "border-red-500"
                    : secondaryColor
                      ? "border-gray-300 dark:border-gray-600"
                      : "border-dashed border-gray-400 dark:border-gray-500"
                }`}
                style={{ background: secondaryColor || "transparent" }}
              >
                <div
                  className={`w-4 h-4 rounded ${secondaryColor ? "border border-white/20" : "border border-gray-400 dark:border-gray-500"}`}
                />
              </button>
              <Input
                icon={<Palette className="h-4 w-4" />}
                type="text"
                value={secondaryColor}
                onChange={(e) => onSecondaryChange(e.target.value)}
                placeholder="#..."
                data-field="secondaryColor"
                className="flex-1"
                destructive={isFieldInvalid("secondaryColor")}
              />
              {secondaryColor && !isFieldInvalid("secondaryColor") && (
                <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400 shrink-0" />
              )}
            </div>
            <ColorPicker
              value={secondaryColor}
              onChange={onSecondaryChange}
              isOpen={isSecondaryPickerOpen}
              onOpenChange={onSecondaryPickerOpenChange}
              title="Secondary Color"
            />
            {isFieldInvalid("secondaryColor") && (
              <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {secondaryColor && secondaryColor.trim()
                  ? "Secondary color must be a valid hex color (e.g., #1F3A60)"
                  : "Secondary color is required"}
              </p>
            )}

          </div>
        </div>

        {/* ── Swap Colors ────────────────────────────────────────────────── */}
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const prim = primaryColor;
              const sec = secondaryColor;
              onPrimaryChange(sec);
              onSecondaryChange(prim);
            }}
            className="inline-flex items-center gap-2 text-xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Swap Colors
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
