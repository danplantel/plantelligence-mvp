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
  findLandingDisclosure,
  withFooterBackground,
  withLandingDisclosureText,
  type PortalDisclaimersEnvelope,
} from "@/lib/portal-disclosures";
import { cn } from "@/lib/utils";

export interface PortalDisclosureSectionProps {
  /** The plan's stored `disclaimers` value, exactly as the API returned it. */
  value: unknown;
  /**
   * What the footer shows while no disclosure is stored — the advisor's own
   * disclaimer, or a legacy plain-text row. Prefilling it means the advisor edits
   * the words participants actually read, not an empty box.
   */
  fallbackText?: string;
  /** Resolved names for the "use the default disclosure" button. */
  organizationName: string;
  companyName: string;
  brandColor: string;
  secondaryColor: string;
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
 * "Section N — Disclosure": the footer disclosure, edited where the advisor can
 * see it.
 *
 * This is the same record Create Plan's Step 5 and Edit Client's Disclosures tab
 * write (`Client.disclaimers` → the "Home Page" row), plus the footer background
 * preference that sits beside it. One difference in scope, and it is the reason
 * the notice below exists: that one row is the footer for the FOUR non-hub portal
 * pages at once, while each benefit hub keeps its own.
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
  onChange,
}: PortalDisclosureSectionProps) {
  const stored = findLandingDisclosure(value);
  // A stored (even empty) row wins over the fallback: otherwise clearing the
  // textarea would snap the box back to the advisor's text mid-typing.
  const text = stored ? String(stored.row.text ?? "") : fallbackText;

  const background = parseFooterBackgroundPreference(value) ?? {};
  const mode = (background.mode as PortalFooterBackgroundMode) || "primary";
  const customColor = background.customColor || "";
  const resolvedBackground = resolveFooterBackgroundColor(
    { mode, customColor },
    brandColor,
    secondaryColor,
  );

  const write = (next: PortalDisclaimersEnvelope) => onChange(next);

  const setBackground = (
    nextMode: PortalFooterBackgroundMode,
    nextCustomColor = customColor,
  ) => {
    write(
      withFooterBackground(value, {
        mode: nextMode,
        customColor: nextCustomColor,
      }),
    );
  };

  return (
    <div className="space-y-4">
      {/* Where this text lands. Required context: one record paints four footers. */}
      <div className="flex items-start gap-2 rounded-md border border-accent-blue/25 bg-accent-blue/5 p-3 text-xs leading-relaxed text-gray-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">Where this disclosure appears</p>
          <p>
            The band at the very bottom of the portal — the footer of{" "}
            <strong>the Landing Page</strong>, <strong>My Benefits Team</strong>,{" "}
            <strong>News & Events</strong> and{" "}
            <strong>Employee Resources</strong>. One disclosure covers all four, so
            editing it here changes every one of those footers.
          </p>
          <p className="text-gray-600">
            The benefit pages (Retirement, Group Health, Life and the Custom
            benefit) keep their own disclosure, set per benefit in that
            benefit&rsquo;s editor — this text does not change them.
          </p>
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
            The portal footer paints{" "}
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
            Footer disclosure
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {text.length} characters
          </span>
        </div>
        <Textarea
          id="portal-footer-disclosure"
          value={text}
          rows={8}
          onChange={(event) =>
            write(withLandingDisclosureText(value, event.target.value))
          }
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
              write(
                withLandingDisclosureText(
                  value,
                  resolveDefaultDisclosuresText(
                    organizationName,
                    companyName,
                    // These four pages use the organization name only — the same
                    // rule the portal layout applies to them.
                    false,
                  ),
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
