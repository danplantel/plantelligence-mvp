"use client";

import { Info, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveDefaultDisclosuresText } from "@/lib/disclaimer-constants";
import {
  parseFooterBackgroundPreference,
  resolveFooterBackgroundColor,
  type PortalFooterBackgroundMode,
} from "@/lib/portal-footer-color";
import {
  findBenefitDisclosure,
  findLandingDisclosure,
  withBenefitDisclosureText,
  withFooterBackground,
  withLandingDisclosureText,
  type BenefitDisclosureCategory,
  type PortalDisclaimersEnvelope,
} from "@/lib/portal-disclosures";
import { cn } from "@/lib/utils";

/**
 * Which footer this section edits.
 *
 * - `landing` — the portal-wide row the four NON-hub pages render (Landing, My
 *   Benefits Team, News & Events, Employee Resources).
 * - `benefit` — one hub's `byCategory` row, which takes precedence on that page
 *   only.
 *
 * Both are the same record (`Client.disclaimers`) and the same envelope; only the
 * row differs, which is why the notice has to say which footers it paints.
 */
export type PortalDisclosureScope =
  | { kind: "landing" }
  | {
      kind: "benefit";
      category: BenefitDisclosureCategory;
      /** The page's own name, for the notice ("Retirement", "Wellness Programs", …). */
      label: string;
    };

export interface PortalDisclosureSectionProps {
  /** The plan's stored `disclaimers` value, exactly as the API returned it. */
  value: unknown;
  /**
   * What the footer shows while this scope has no disclosure stored — the
   * advisor's own disclaimer, or a legacy plain-text row. Prefilling it means the
   * advisor edits the words participants actually read, not an empty box.
   */
  fallbackText?: string;
  /** Resolved names for the "use the default disclosure" button. */
  organizationName: string;
  companyName: string;
  brandColor: string;
  secondaryColor: string;
  /** Defaults to the portal-wide (landing) row. */
  scope?: PortalDisclosureScope;
  /** Called with the next envelope on every edit — the host previews and queues it. */
  onChange: (next: PortalDisclaimersEnvelope) => void;
}

const BACKGROUND_CHOICES: {
  value: PortalFooterBackgroundMode;
  label: string;
}[] = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "custom", label: "Custom" },
];

/**
 * The text this scope's footer is showing, for a given stored envelope.
 *
 * A stored (even empty) row wins over the fallback: otherwise clearing the
 * textarea would snap the box back to the advisor's text mid-typing. Exported so
 * a footer PREVIEW (the full-width dialog that hosts this section) resolves the
 * exact same words the controls edit — the two can never disagree.
 */
export function resolvePortalDisclosureText(
  value: unknown,
  scope: PortalDisclosureScope = { kind: "landing" },
  fallbackText = "",
): string {
  const isBenefit = scope.kind === "benefit";
  const storedText = isBenefit
    ? findBenefitDisclosure(value, scope.category)
    : findLandingDisclosure(value);

  return storedText
    ? isBenefit
      ? (storedText as { text: string }).text
      : String((storedText as { row: { text?: unknown } }).row.text ?? "")
    : fallbackText;
}

/**
 * "Section N — Disclosure": a footer disclosure, edited where the advisor can see
 * it.
 *
 * The text is the same record Create Plan's Step 5 / Edit Client's Disclosures tab
 * write — the Home Page row for the portal-wide footer, or one benefit's
 * `byCategory` row for a hub. The footer background beside it is plan-wide and
 * paints every portal page, whichever panel it is changed from.
 *
 * Fully controlled: the text and the preference are read from `value` on every
 * render, so the host's Save/Cancel (and its refetch on Cancel) is the only state
 * there is.
 */
export function PortalDisclosureSection({
  value,
  fallbackText = "",
  organizationName,
  companyName,
  brandColor,
  secondaryColor,
  scope = { kind: "landing" },
  onChange,
}: PortalDisclosureSectionProps) {
  const isBenefit = scope.kind === "benefit";
  const text = resolvePortalDisclosureText(value, scope, fallbackText);

  const background = parseFooterBackgroundPreference(value) ?? {};
  const mode = (background.mode as PortalFooterBackgroundMode) || "primary";
  const customColor = background.customColor || "";
  const resolvedBackground = resolveFooterBackgroundColor(
    { mode, customColor },
    brandColor,
    secondaryColor,
  );

  const writeText = (next: string) =>
    onChange(
      isBenefit
        ? withBenefitDisclosureText(value, scope.category, next)
        : withLandingDisclosureText(value, next),
    );

  const setBackground = (
    nextMode: PortalFooterBackgroundMode,
    nextCustomColor = customColor,
  ) => {
    onChange(
      withFooterBackground(value, {
        mode: nextMode,
        customColor: nextCustomColor,
      }),
    );
  };

  return (
    <div className="space-y-4">
      {/* Where this text lands. One record, a specific set of footers. */}
      <div className="flex items-start gap-2 rounded-md border border-accent-blue/25 bg-accent-blue/5 p-3 text-xs leading-relaxed text-gray-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">
            Where this disclosure appears
          </p>
          {isBenefit ? (
            <>
              <p>
                The footer of <strong>the {scope.label} page</strong> only — the
                band at the very bottom, under &ldquo;Have Questions?&rdquo;.
              </p>
              <p className="text-gray-600">
                The Landing Page, My Benefits Team, News & Events and Employee
                Resources share a separate disclosure, set on the Landing
                Page&rsquo;s panel. Every other benefit keeps its own.
              </p>
            </>
          ) : (
            <>
              <p>
                The band at the very bottom of the portal — the footer of{" "}
                <strong>the Landing Page</strong>,{" "}
                <strong>My Benefits Team</strong>,{" "}
                <strong>News & Events</strong> and{" "}
                <strong>Employee Resources</strong>. One disclosure covers all
                four, so editing it here changes every one of those footers.
              </p>
              <p className="text-gray-600">
                The benefit pages (Retirement, Group Health, Life and the Custom
                benefit) keep their own disclosure, set per benefit in that
                benefit&rsquo;s editor — this text does not change them.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Footer background first: it paints the band the disclosure sits in. */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Footer background</Label>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUND_CHOICES.map((choice) => {
            const isSelected = mode === choice.value;
            const swatch =
              choice.value === "primary"
                ? brandColor
                : choice.value === "secondary"
                ? secondaryColor
                : customColor || brandColor;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setBackground(choice.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border-2 p-2 text-left transition-all cursor-pointer",
                  isSelected
                    ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300",
                )}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: swatch || "#ffffff" }}
                  aria-hidden
                />
                <span className="truncate text-[11px] font-semibold text-gray-900">
                  {choice.label}
                </span>
              </button>
            );
          })}
        </div>

        {mode === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Custom footer colour"
              value={customColor || "#1F3A60"}
              onChange={(event) => setBackground("custom", event.target.value)}
              className="h-9 w-10 cursor-pointer rounded border bg-white p-0.5"
            />
            <Input
              value={customColor}
              onChange={(event) => setBackground("custom", event.target.value)}
              placeholder="#1F3A60"
              className="h-9 flex-1 text-xs"
              aria-label="Custom footer colour hex"
            />
          </div>
        )}

        <div className="flex items-center gap-2 rounded-md border bg-white p-2.5">
          <span
            className="h-6 w-6 shrink-0 rounded"
            style={{ backgroundColor: resolvedBackground }}
            aria-hidden
          />
          <span className="text-[11px] text-muted-foreground">
            Every portal footer paints{" "}
            <span className="font-mono text-[11px] text-gray-700">
              {resolvedBackground}
            </span>
          </span>
        </div>
      </div>

      <div className="space-y-1.5 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="portal-footer-disclosure"
            className="text-xs font-medium"
          >
            {isBenefit ? "Benefit disclosure" : "Footer disclosure"}
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {text.length} characters
          </span>
        </div>
        <Textarea
          id="portal-footer-disclosure"
          value={text}
          rows={8}
          onChange={(event) => writeText(event.target.value)}
          placeholder="e.g. For educational and informational purposes only. Not intended as ERISA, tax, legal or investment advice…"
          className="min-h-[10rem] text-xs leading-relaxed"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-gray-400">
            Plain text. Line breaks are kept exactly as typed.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() =>
              writeText(
                resolveDefaultDisclosuresText(
                  organizationName,
                  companyName,
                  // A benefit page names the plan sponsor too; the four non-hub
                  // pages use the organization name only.
                  isBenefit,
                ),
              )
            }
          >
            <RotateCcw className="h-3 w-3" />
            Use the default
          </Button>
        </div>
      </div>
    </div>
  );
}
