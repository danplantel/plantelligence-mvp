"use client";

import { useState, useCallback } from "react";
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
  Loader2,
  Globe,
  Image as ImageIcon,
  Info,
  Search,
  Sparkles,
} from "lucide-react";
import {
  extractColorSets,
  type ColorSetSuggestion,
  type ExtractionConfidence,
} from "@/lib/brand-color-extraction";
import { getPresetName } from "@/lib/color-utils";

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

const confidenceConfig: Record<
  ExtractionConfidence,
  { label: string; color: string }
> = {
  high: { label: "High confidence", color: "text-green-600 dark:text-green-400" },
  medium: { label: "Medium confidence", color: "text-blue-600 dark:text-blue-400" },
  low: { label: "Low confidence", color: "text-amber-600 dark:text-amber-400" },
  "needs-review": { label: "Needs review", color: "text-red-600 dark:text-red-400" },
};

const setIcons: Record<ColorSetSuggestion["id"], typeof ImageIcon> = {
  logo: ImageIcon,
  website: Globe,
  ai: Sparkles,
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
  organizationName,
  errorFields = [],
  touchedFields = {},
  fieldErrors = {},
}: BrandColorsSectionProps) {
  const [colorSets, setColorSets] = useState<ColorSetSuggestion[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const handleExtract = useCallback(async () => {
    if (!logoDataUrl && !websiteUrl?.trim()) return;

    setIsExtracting(true);
    setExtractionError(null);
    setSelectedSetId(null);

    try {
      const sets = await extractColorSets(logoDataUrl, websiteUrl, organizationName);
      setColorSets(sets);
    } catch (err: any) {
      setExtractionError(err?.message || "Failed to extract colors");
    } finally {
      setIsExtracting(false);
    }
  }, [logoDataUrl, websiteUrl, organizationName]);

  const selectSet = (set: ColorSetSuggestion) => {
    if (!set.available) return;
    setSelectedSetId(set.id);
    onPrimaryChange(set.primary);
    onSecondaryChange(set.secondary);
  };

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

  const renderSwatch = (label: string, hex: string) => (
    <div className="flex items-center gap-2">
      <span
        className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 shrink-0"
        style={{ background: hex }}
      />
      <span className="font-mono text-xs">{hex}</span>
      <span className="text-xs text-muted-foreground truncate">
        {getPresetName(hex) || label}
      </span>
    </div>
  );

  return (
    <Card className="dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <Palette className="w-5 h-5 text-accent-blue" />
          Brand Colors
          {isExtracting && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-1" />
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Click <strong>Extract Colors</strong> to generate three brand color
          sets — from your <b>logo</b>, your <b>website</b>, and an{" "}
          <b>AI suggestion</b>. Select the set you want, or fine-tune the colors
          manually below.
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
                Upload a logo or enter a company website above to enable color
                extraction.
              </p>
            )}
          </div>
        )}

        {/* ── Loading state ─────────────────────────────────────────────── */}
        {isExtracting && (
          <div className="mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Extracting brand colors from logo, website & AI…</span>
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {colorSets.map((set) => {
                const Icon = setIcons[set.id];
                const conf = confidenceConfig[set.confidence];
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
                        {renderSwatch("Primary", set.primary)}
                        {set.secondary ? (
                          renderSwatch("Secondary", set.secondary)
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No distinct secondary color found
                          </p>
                        )}
                        <span className={`text-xs ${conf.color}`}>
                          {conf.label}
                        </span>
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

            <div className="mt-3 flex items-center gap-2">
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
          </div>
        )}

        {/* ── Color Pickers Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary Color */}
          <div className="space-y-3 relative">
            <Label className="dark:text-gray-300 flex items-center gap-2">
              Primary Color <span className="text-red-500">*</span>
              {primaryPresetName && (
                <span className="text-xs font-normal text-muted-foreground bg-muted dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {primaryPresetName}
                </span>
              )}
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
              {secondaryPresetName && (
                <span className="text-xs font-normal text-muted-foreground bg-muted dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {secondaryPresetName}
                </span>
              )}
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
