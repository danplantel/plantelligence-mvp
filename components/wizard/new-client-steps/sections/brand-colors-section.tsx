"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Palette,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  Loader2,
  Globe,
  Image as ImageIcon,
  ShieldAlert,
  Info,
  ExternalLink,
  Search,
} from "lucide-react";
import {
  extractBrandColors,
  validateManualColors,
  type SafeColorResult,
  type ExtractionConfidence,
} from "@/lib/brand-color-extraction";
import {
  getContrastScores,
  getPresetName,
  WCAG_AA_NORMAL,
} from "@/lib/color-utils";

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
  errorFields?: string[];
  touchedFields?: Record<string, boolean>;
  fieldErrors?: Record<string, string | null>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const confidenceConfig: Record<
  ExtractionConfidence,
  { icon: typeof CheckCircle2; label: string; color: string; bgColor: string }
> = {
  high: {
    icon: CheckCircle2,
    label: "High confidence",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/30",
  },
  medium: {
    icon: CheckCircle2,
    label: "Medium confidence",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/30",
  },
  low: {
    icon: Info,
    label: "Low confidence",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
  },
  "needs-review": {
    icon: ShieldAlert,
    label: "Needs review",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/30",
  },
};

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
  errorFields = [],
  touchedFields = {},
  fieldErrors = {},
}: BrandColorsSectionProps) {
  // ── Extraction state ─────────────────────────────────────────────────────
  const [extractionResult, setExtractionResult] =
    useState<SafeColorResult | null>(null);
  const [isRunningExtraction, setIsRunningExtraction] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [showExtractionDetails, setShowExtractionDetails] = useState(false);
  const extractionRanRef = useRef(false);

  // ── Manual extraction trigger ────────────────────────────────────────────
  const handleExtract = useCallback(async () => {
    // Don't run if there's nothing to extract from
    if (!logoDataUrl && !websiteUrl?.trim()) return;

    extractionRanRef.current = true;
    setIsRunningExtraction(true);
    setExtractionError(null);

    try {
      const result = await extractBrandColors(logoDataUrl, websiteUrl);
      setExtractionResult(result);

      onPrimaryChange(result.primary);
      onSecondaryChange(result.secondary);
    } catch (err: any) {
      setExtractionError(err?.message || "Failed to extract colors");
    } finally {
      setIsRunningExtraction(false);
    }
  }, [logoDataUrl, websiteUrl, onPrimaryChange, onSecondaryChange]);

  // ── Manual color validation ─────────────────────────────────────────────
  const primaryContrast = primaryColor ? getContrastScores(primaryColor) : null;
  const secondaryContrast = secondaryColor
    ? getContrastScores(secondaryColor)
    : null;

  const primaryPresetName = primaryColor ? getPresetName(primaryColor) : null;
  const secondaryPresetName = secondaryColor
    ? getPresetName(secondaryColor)
    : null;

  const isFieldInvalid = (field: string): boolean => {
    return (
      errorFields.includes(field) ||
      (touchedFields[field] && !!fieldErrors[field])
    );
  };

  // ── Confidence badge config ──────────────────────────────────────────────
  const confidenceInfo = extractionResult
    ? confidenceConfig[extractionResult.extraction.confidence]
    : null;
  const ConfIcon = confidenceInfo?.icon;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Card className="dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <Palette className="w-5 h-5 text-accent-blue" />
          Brand Colors
          {isRunningExtraction && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-1" />
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Click <strong>Extract Colors</strong> to automatically detect your
          brand colors from your <b>uploaded logo</b> and <b>company website</b>. Colors are
          applied to buttons, headers, footers, and more. You can also set them
          manually using the swatches below.
        </p>
      </CardHeader>
      <CardContent>
        {/* ── Extract Button ────────────────────────────────────────────── */}
        {!extractionResult && !isRunningExtraction && (
          <div className="mb-4">
            <Button
              type="button"
              onClick={handleExtract}
              disabled={!logoDataUrl && !websiteUrl?.trim()}
              className="inline-flex items-center gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white"
            >
              {isRunningExtraction ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Extract Colors
                  {logoDataUrl && websiteUrl?.trim() ? (
                    <span className="text-xs opacity-75 font-normal">
                      from logo & website
                    </span>
                  ) : logoDataUrl ? (
                    <span className="text-xs opacity-75 font-normal">
                      from logo
                    </span>
                  ) : websiteUrl?.trim() ? (
                    <span className="text-xs opacity-75 font-normal">
                      from website
                    </span>
                  ) : null}
                </>
              )}
            </Button>
            {!logoDataUrl && !websiteUrl?.trim() && (
              <p className="text-xs text-muted-foreground mt-1.5">
                <Info className="w-3 h-3 inline mr-1" />
                Upload a logo or enter a company website above to enable color
                extraction.
              </p>
            )}
          </div>
        )}

        {/* Re-extract button (shown after initial extraction) */}
        {extractionResult && !isRunningExtraction && (
          <div className="mb-4 flex items-center gap-2">
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
            <span className="text-xs text-muted-foreground">
              from{" "}
              {logoDataUrl && websiteUrl?.trim()
                ? "logo & website"
                : logoDataUrl
                  ? "logo"
                  : "website"}
            </span>
          </div>
        )}

        {/* ── Extraction Status Banner ──────────────────────────────────── */}
        {extractionResult && !isRunningExtraction && (
          <div
            className={`mb-4 p-3 rounded-lg border text-sm ${confidenceInfo?.bgColor} ${confidenceInfo?.color.replace("text-", "border-").replace("dark:", "")}`}
          >
            <div className="flex items-start gap-2">
              {ConfIcon && <ConfIcon className="w-4 h-4 mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {confidenceInfo?.label}
                  </span>
                  {extractionResult.extraction.source === "both-agree" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                    >
                      Logo + Site agree
                    </Badge>
                  )}
                  {extractionResult.extraction.source === "logo" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300"
                    >
                      <ImageIcon className="w-3 h-3 mr-1" />
                      Logo only
                    </Badge>
                  )}
                  {extractionResult.extraction.source === "website" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300"
                    >
                      <Globe className="w-3 h-3 mr-1" />
                      Site extracted
                    </Badge>
                  )}
                </div>

                {/* Warnings */}
                {extractionResult.extraction.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {extractionResult.extraction.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-xs opacity-80"
                      >
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Needs review callout */}
                {extractionResult.extraction.needsManualReview && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Colors need manual review — logo and site disagree.
                  </div>
                )}

                {/* Expand details */}
                <button
                  type="button"
                  onClick={() =>
                    setShowExtractionDetails(!showExtractionDetails)
                  }
                  className="text-xs underline mt-2 hover:opacity-80"
                >
                  {showExtractionDetails ? "Hide details" : "Show details"}
                </button>

                {showExtractionDetails && (
                  <div className="mt-2 text-xs space-y-1 opacity-70">
                    {extractionResult.extraction.logoColor && (
                      <p>
                        Logo color:{" "}
                        <span className="font-mono">
                          {extractionResult.extraction.logoColor}
                        </span>
                      </p>
                    )}
                    {extractionResult.extraction.siteColor && (
                      <p>
                        Site color:{" "}
                        <span className="font-mono">
                          {extractionResult.extraction.siteColor}
                        </span>
                      </p>
                    )}
                    {extractionResult.extraction.deltaE != null && (
                      <p>
                        ΔE distance:{" "}
                        <span className="font-mono">
                          {extractionResult.extraction.deltaE}
                        </span>
                        {extractionResult.comparison?.isClose
                          ? " (close match)"
                          : " (divergent)"}
                      </p>
                    )}
                    {extractionResult.siteUrl && (
                      <p className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        <a
                          href={
                            extractionResult.siteUrl.startsWith("http")
                              ? extractionResult.siteUrl
                              : `https://${extractionResult.siteUrl}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:opacity-80 inline-flex items-center gap-0.5"
                        >
                          {extractionResult.siteUrl}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Loading state ─────────────────────────────────────────────── */}
        {isRunningExtraction && (
          <div className="mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                Extracting brand colors
                {websiteUrl?.trim()
                  ? " from your logo & website..."
                  : " from your logo..."}
              </span>
            </div>
          </div>
        )}

        {/* ── Extraction error ──────────────────────────────────────────── */}
        {extractionError && !isRunningExtraction && (
          <div className="mb-4 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{extractionError}</span>
            </div>
          </div>
        )}

        {/* ── Color Pickers Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary Color */}
          <div className="space-y-3 relative">
            <Label className="dark:text-gray-300">
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
                Primary color must be a valid hex color (e.g., #1F3A60)
              </p>
            )}

            {/* WCAG Contrast indicator */}
            {primaryContrast && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Contrast:</span>
                <span
                  className={
                    primaryContrast.passesWhite
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {primaryContrast.againstWhite}:1 on white
                  {primaryContrast.passesWhite ? (
                    <CheckCircle2 className="w-3 h-3 inline ml-0.5" />
                  ) : (
                    <AlertCircle className="w-3 h-3 inline ml-0.5" />
                  )}
                </span>
                {primaryPresetName && (
                  <span className="text-muted-foreground ml-auto">
                    {primaryPresetName}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Secondary Color */}
          <div className="space-y-3 relative">
            <Label className="dark:text-gray-300">
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
                Secondary color must be a valid hex color (e.g., #1F3A60)
              </p>
            )}

            {/* WCAG Contrast indicator */}
            {secondaryContrast && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Contrast:</span>
                <span
                  className={
                    secondaryContrast.passesWhite
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {secondaryContrast.againstWhite}:1 on white
                  {secondaryContrast.passesWhite ? (
                    <CheckCircle2 className="w-3 h-3 inline ml-0.5" />
                  ) : (
                    <AlertCircle className="w-3 h-3 inline ml-0.5" />
                  )}
                </span>
                {secondaryPresetName && (
                  <span className="text-muted-foreground ml-auto">
                    {secondaryPresetName}
                  </span>
                )}
              </div>
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
