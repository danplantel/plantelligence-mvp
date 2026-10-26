/**
 * The portal's colour contract.
 *
 * An advisor picks two colours for a plan, and every portal surface has to agree
 * on what they mean:
 *
 *  - **primary** — identity. Headings, the plan's name, active navigation, card
 *    accents, the floating chat action.
 *  - **secondary** — emphasis. CTA fills, link text, icon chips, selected states,
 *    and the featured card's panel.
 *
 * `onPrimary` / `onSecondary` are the legible foregrounds for text and icons that
 * sit ON those two colours. They exist because most of the portal used to hard-code
 * white on the accent: with the product's own default accents (a pale gold, an
 * amber) white text lands around 1.6–2.0:1 — unreadable. Always paint on-colour
 * text from here instead of `text-white`.
 *
 * Before this module each page and component carried its own fallback pair
 * (`#1F3A60`/`#6B7280`, `#0D315F`/`#C89B5B`, `#002B5B`/`#E6C47A`, `#C5A15E`…), so a
 * plan with an empty palette rendered differently per page and per preview.
 *
 * Pure — no React, no fetching.
 */
import { readableColor } from "polished";

/** Used when a plan has not chosen a colour (or stored a blank one). */
export const PORTAL_DEFAULT_PRIMARY = "#1F3A60";
export const PORTAL_DEFAULT_SECONDARY = "#6B7280";

export interface PortalPalette {
  /** The plan's brand colour. */
  primary: string;
  /** The plan's accent colour. */
  secondary: string;
  /** Legible text/icon colour on `primary`. */
  onPrimary: string;
  /** Legible text/icon colour on `secondary`. */
  onSecondary: string;
}

/** `readableColor` that never throws on an odd value and always yields hex. */
export function onColor(color: string): string {
  try {
    return readableColor(color, "#ffffff", "#111827", false);
  } catch {
    return "#ffffff";
  }
}

/** Trim a stored colour; `""`/whitespace/non-strings count as unset. */
function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export interface PortalPaletteInput {
  brandColor?: string | null;
  secondaryColor?: string | null;
}

/**
 * Resolve a plan's palette, filling either colour independently so a plan that
 * set only one keeps the other.
 */
export function resolvePortalPalette(
  input?: PortalPaletteInput | Record<string, unknown> | null,
): PortalPalette {
  const raw = (input ?? {}) as PortalPaletteInput;
  const primary = normalize(raw.brandColor) || PORTAL_DEFAULT_PRIMARY;
  const secondary = normalize(raw.secondaryColor) || PORTAL_DEFAULT_SECONDARY;

  return {
    primary,
    secondary,
    onPrimary: onColor(primary),
    onSecondary: onColor(secondary),
  };
}
