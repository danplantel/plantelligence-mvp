"use client";

/**
 * The Disclosure editor shared by every wizard/step surface.
 *
 * Create Plan (Step 5), Create Benefits (Step 5) and Edit Benefit all need the same idea: the
 * advisor edits the disclosure INSIDE the footer that will render it, with the footer's colour
 * choices directly above the preview. That is the arrangement Edit Plan ships, and keeping one
 * component here is what stops the four surfaces from drifting.
 *
 * The two choices match Settings → Organization › Disclosures:
 *
 *  - **Use Default** writes the platform copy back into the field.
 *  - **Add my own** puts the caret in the editor (selecting the default copy when it is still
 *    there, so the first keystroke replaces it).
 *
 * The editor's border is drawn in the footer's own text colour — a light wash behind the field —
 * so "this is editable" is legible on a dark primary footer and a light custom one. Focus rings
 * the WRAPPER, never the textarea itself.
 */

import { useRef, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { PortalDisclaimers } from "@/components/pages/client-portal/sections/portal-disclaimers";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { bestTextColor } from "@/lib/color-utils";

export type DisclosureEditorMode = "default" | "custom";
export type FooterBackgroundMode = "primary" | "secondary" | "custom";

interface DisclosureFooterEditorProps {
  /**
   * Which real footer renders the preview:
   *  - `home` — the Home Page footer (`PortalDisclaimers`);
   *  - `benefit` — a benefit category page footer (`Footer`).
   */
  footer: "home" | "benefit";
  primaryColor: string;
  secondaryColor: string;
  footerBgMode: FooterBackgroundMode;
  footerBgCustomColor: string;
  onFooterBgModeChange: (mode: FooterBackgroundMode) => void;
  onFooterBgCustomColorChange: (value: string) => void;
  /** Editor value. */
  text: string;
  onTextChange: (value: string) => void;
  mode: DisclosureEditorMode;
  onModeChange: (mode: DisclosureEditorMode) => void;
  /** The copy "Use Default" inserts. */
  defaultText: string;
  companyName?: string;
  organizationName?: string;
  /** Small caption naming the page the footer belongs to, e.g. "Retirement — Employee Portal". */
  previewLabel?: string;
  /** Optional extra controls rendered under the editor (e.g. apply-to-all-categories). */
  children?: ReactNode;
}

export function DisclosureFooterEditor({
  footer,
  primaryColor,
  secondaryColor,
  footerBgMode,
  footerBgCustomColor,
  onFooterBgModeChange,
  onFooterBgCustomColorChange,
  text,
  onTextChange,
  mode,
  onModeChange,
  defaultText,
  companyName,
  organizationName,
  previewLabel,
  children,
}: DisclosureFooterEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resolvedFooterBgColor =
    footerBgMode === "secondary"
      ? secondaryColor
      : footerBgMode === "custom" && footerBgCustomColor.trim()
        ? footerBgCustomColor.trim()
        : primaryColor;
  // Same luminance rule the marketing cards use; safe while a custom hex is still being typed.
  const footerTextColor = bestTextColor(resolvedFooterBgColor);

  const handleModeChange = (value: string) => {
    if (value === "default") {
      onModeChange("default");
      onTextChange(defaultText);
      return;
    }
    const wasDefault = text.trim() === defaultText.trim();
    onModeChange("custom");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      if (wasDefault) el.select();
    });
  };

  const disclosureNode = (
    <div className="space-y-2">
      <Label
        htmlFor="disclosure-footer-text"
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: footerTextColor, opacity: 0.85 }}
      >
        <Pencil className="h-3 w-3" />
        Disclosure Text
      </Label>

      <RadioGroup
        value={mode}
        onValueChange={handleModeChange}
        className="flex items-center gap-6"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="default" id="disclosure-mode-default" />
          <Label
            htmlFor="disclosure-mode-default"
            className="cursor-pointer text-sm font-normal"
            style={{ color: footerTextColor }}
          >
            Use Default
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="disclosure-mode-custom" />
          <Label
            htmlFor="disclosure-mode-custom"
            className="cursor-pointer text-sm font-normal"
            style={{ color: footerTextColor }}
          >
            Add my own
          </Label>
        </div>
      </RadioGroup>

      <div
        className="rounded-md border p-2 transition-shadow focus-within:ring-2 focus-within:ring-current focus-within:ring-offset-0"
        style={{
          borderColor: `${footerTextColor}66`,
          backgroundColor: `${footerTextColor}0D`,
          color: footerTextColor,
        }}
      >
        <Textarea
          ref={textareaRef}
          id="disclosure-footer-text"
          value={text}
          onChange={(event) => {
            onModeChange("custom");
            onTextChange(event.target.value);
          }}
          placeholder="Enter legal disclosures to display in the portal footer..."
          rows={12}
          className="min-h-[200px] resize-y border-0 bg-transparent p-1 text-[13px] leading-relaxed shadow-none focus:border-0 focus:ring-0 focus-visible:outline-none dark:bg-transparent dark:text-inherit"
          style={{ color: footerTextColor, caretColor: footerTextColor }}
        />
      </div>

      <p className="text-[11px]" style={{ color: footerTextColor, opacity: 0.7 }}>
        This text renders exactly as employees will read it in the portal footer.
        The color buttons above repaint this footer.
      </p>

      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Footer background colour ── */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Select Background Color
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(["primary", "secondary", "custom"] as const).map((modeValue) => {
            const label =
              modeValue === "primary"
                ? "Primary"
                : modeValue === "secondary"
                  ? "Secondary"
                  : "Custom";
            const colorValue =
              modeValue === "primary"
                ? primaryColor
                : modeValue === "secondary"
                  ? secondaryColor
                  : footerBgCustomColor || "#888888";
            const isActive = footerBgMode === modeValue;
            return (
              <button
                key={modeValue}
                type="button"
                onClick={() => onFooterBgModeChange(modeValue)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "border-accent-blue bg-accent-blue/5 ring-1 ring-accent-blue dark:bg-accent-blue/10"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-gray-300"
                  style={{ background: colorValue }}
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
                onChange={(e) => onFooterBgCustomColorChange(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5"
              />
              <input
                type="text"
                value={footerBgCustomColor}
                onChange={(e) => onFooterBgCustomColorChange(e.target.value)}
                placeholder="#HEX or color name"
                className="w-36 rounded border border-gray-200 bg-transparent px-2 py-1.5 text-xs dark:border-gray-600"
              />
            </>
          )}
        </div>
      </div>

      {/* ── The real footer, with the editor living inside it ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {previewLabel ? (
          <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-2">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            <span className="ml-2 font-mono text-[10px] text-gray-400">
              {previewLabel}
            </span>
          </div>
        ) : null}

        {footer === "home" ? (
          <PortalDisclaimers
            companyData={{
              companyName,
              brandColor: resolvedFooterBgColor,
            }}
            brandColor={resolvedFooterBgColor}
            disclosureNode={disclosureNode}
          />
        ) : (
          <Footer
            brandColor={resolvedFooterBgColor}
            organizationName={organizationName}
            companyName={companyName}
            disclosureNode={disclosureNode}
          />
        )}
      </div>
    </div>
  );
}
