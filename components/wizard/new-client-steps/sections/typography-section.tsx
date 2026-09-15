"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Check,
  Globe,
  Loader2,
  Sparkles,
  Type as TypeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TYPOGRAPHY_THEMES,
  TYPOGRAPHY_THEME_LIST,
  getTypographyCssVars,
  isTypographyThemeId,
  resolveTypographyTheme,
  type TypographyThemeId,
} from "@/lib/typography-themes";

interface TypographySectionProps {
  /** Currently selected theme id (falls back to the Classic default when empty). */
  value?: string | null;
  onChange: (id: TypographyThemeId) => void;
  /** Optional heading override. */
  title?: string;
  /** Optional supporting copy override. */
  description?: string;
  className?: string;
  /** Renders the cards in a single column (useful inside narrow editor panels). */
  compact?: boolean;
  /**
   * Shows the "suggest from website" action. Only the Create Plan flow enables
   * this, so Edit Plan / Create Benefits stay purely manual.
   */
  enableAiSuggestion?: boolean;
  /** The plan's company website, used as the analysis target. */
  websiteUrl?: string;
  /** Company name, passed to the model as extra context. */
  companyName?: string;
}

interface SuggestionState {
  theme: TypographyThemeId;
  reason: string;
  confidence: "high" | "medium" | "low";
  source: "ai" | "heuristic";
}

/**
 * Portal typography theme picker.
 *
 * Each card previews its own headline/body fonts in place (using the CSS
 * variables registered by `next/font`), so the advisor sees the real fonts
 * before applying them. Shared by the Create Plan, Edit Plan, and Create
 * Benefits flows (all placed on Step 2 next to a live portal preview).
 */
export function TypographySection({
  value,
  onChange,
  title = "Typography",
  description,
  className,
  compact = false,
  enableAiSuggestion = false,
  websiteUrl,
  companyName,
}: TypographySectionProps) {
  const selectedId = resolveTypographyTheme(value).id;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const canAnalyze = !!websiteUrl?.trim();
  const websiteLabel = websiteUrl?.trim() || "";
  // The stored value is a clean domain (e.g. "example.com"), so add a scheme
  // before using it as a link — gives the advisor a one-click way to confirm
  // exactly which site the analysis reads.
  const websiteHref = websiteLabel
    ? /^https?:\/\//i.test(websiteLabel)
      ? websiteLabel
      : `https://${websiteLabel}`
    : "";

  const handleAnalyzeWebsite = async () => {
    if (!canAnalyze || isAnalyzing) return;
    setIsAnalyzing(true);
    setSuggestionError(null);
    try {
      const res = await fetch("/api/gemini/suggest-typography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl,
          organizationName: companyName || "",
        }),
      });
      const json: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSuggestionError(
          json?.error || "Could not analyze that website. Please try again.",
        );
        return;
      }

      if (!isTypographyThemeId(json?.theme)) {
        setSuggestionError("The analysis did not return a usable theme.");
        return;
      }

      // Apply the recommendation straight away — the live preview updates with it.
      onChange(json.theme);
      setSuggestion({
        theme: json.theme,
        reason: typeof json?.reason === "string" ? json.reason : "",
        confidence:
          json?.confidence === "high" ||
          json?.confidence === "medium" ||
          json?.confidence === "low"
            ? json.confidence
            : "medium",
        source: json?.source === "heuristic" ? "heuristic" : "ai",
      });
    } catch {
      setSuggestionError("Could not analyze that website. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className={cn("dark:bg-gray-800", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          <TypeIcon className="w-5 h-5 text-accent-blue" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          {description ??
            "Choose a style for this plan's portal. The headline and body fonts change together across every page."}
        </p>
      </CardHeader>
      <CardContent>
        {enableAiSuggestion && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Not sure which to choose?
                </p>
                {canAnalyze ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-gray-400">
                    Match this plan&rsquo;s typography to its company website:{" "}
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${websiteLabel}`}
                      className="inline-flex items-center gap-1 font-medium text-accent-blue hover:underline break-all"
                    >
                      <Globe className="h-3 w-3 shrink-0" />
                      {websiteLabel}
                    </a>
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                    Add the company website on Step 1 to enable this.
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAnalyzeWebsite}
                disabled={!canAnalyze || isAnalyzing}
                className="shrink-0 gap-1.5"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Suggest from your Company Website
                  </>
                )}
              </Button>
            </div>

            {suggestionError && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{suggestionError}</span>
              </p>
            )}

            {suggestion && !suggestionError && (
              <div className="mt-2 rounded-lg border border-accent-blue/30 bg-accent-blue/5 px-2.5 py-2 dark:border-accent-blue/40 dark:bg-accent-blue/10">
                <p className="text-[11px] text-gray-700 dark:text-gray-200">
                  <span className="font-semibold">
                    Suggested: {TYPOGRAPHY_THEMES[suggestion.theme].label}
                  </span>{" "}
                  <span className="text-muted-foreground dark:text-gray-400">
                    ({suggestion.source === "ai" ? "AI" : "detected"} ·{" "}
                    {suggestion.confidence} confidence)
                  </span>
                </p>
                {suggestion.reason && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-gray-400">
                    {suggestion.reason}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "grid gap-4",
            compact
              ? "grid-cols-1"
              : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
          )}
        >
          {TYPOGRAPHY_THEME_LIST.map((theme) => {
            const isSelected = selectedId === theme.id;
            // Activate this theme's fonts for the preview subtree only.
            const previewVars = getTypographyCssVars(theme.id);

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onChange(theme.id)}
                aria-pressed={isSelected}
                aria-label={`${theme.label} typography theme`}
                className={cn(
                  "relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all",
                  // Keyboard focus ring — visible in both light and dark themes
                  // without relying on a ring-offset colour that would differ
                  // between the editor panels this component is mounted in.
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue",
                  isSelected
                    ? "border-accent-blue bg-accent-blue/5 shadow-sm ring-1 ring-accent-blue dark:bg-accent-blue/10 dark:shadow-none"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500 dark:hover:bg-gray-700/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {theme.label}
                  </span>
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>

                {/* Live preview — rendered in this theme's fonts. */}
                <div
                  className="rounded-lg border border-gray-100 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-900/60"
                  style={previewVars as React.CSSProperties}
                >
                  <p
                    className="text-[22px] leading-tight font-semibold text-gray-900 dark:text-gray-100"
                    style={{ fontFamily: theme.headline }}
                  >
                    Benefits Hub
                  </p>
                  <p
                    className="mt-2 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300"
                    style={{ fontFamily: theme.body }}
                  >
                    Explore your benefits, find resources, and connect with your
                    team.
                  </p>
                  {/* UI sample — always Outfit via --font-ui. */}
                  <span
                    className="mt-3 inline-flex rounded-md bg-accent-blue px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
                    style={{ fontFamily: theme.ui }}
                  >
                    View Details
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Headline:
                    </span>{" "}
                    {theme.headlineName}
                  </p>
                  <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Body:
                    </span>{" "}
                    {theme.bodyName}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground dark:text-gray-400">
          Buttons, navigation, form labels, and other interface elements always
          use Outfit regardless of the selected theme.
        </p>
      </CardContent>
    </Card>
  );
}

export default TypographySection;
