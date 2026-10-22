/**
 * The plan's footer background preference — resolved in ONE place.
 *
 * The choice is saved on `Client.disclaimers` as `footerBackground`
 * (`{ mode: "primary" | "secondary" | "custom", customColor?: string }`), and every
 * portal page has to render the SAME colour: the Landing page, the four Benefit
 * Hubs, My Benefits Team and News & Events. Before this module each surface had its
 * own copy of the resolution rule (the portal layout, `ClientPortal`'s own footer,
 * the landing page's payload, the Benefits wizard's preview), which is how a
 * preference saved in one wizard could show up on some pages and not others.
 *
 * Readers should call `resolvePortalFooterColor` with the raw `disclaimers` value —
 * it accepts the JSON envelope, the JSON string some rows still hold, and legacy
 * plain text — so the precedence and the defaults can never drift again.
 */

export type PortalFooterBackgroundMode = "primary" | "secondary" | "custom";

export interface PortalFooterBackgroundPreference {
  mode?: string;
  customColor?: string;
}

/** Portal default primary colour (same as the layout and `ClientPortal`). */
export const PORTAL_DEFAULT_BRAND_COLOR = "#1F3A60";
/** Portal default secondary colour (same as the layout and `ClientPortal`). */
export const PORTAL_DEFAULT_SECONDARY_COLOR = "#6B7280";

const DEFAULT_BRAND_COLOR = PORTAL_DEFAULT_BRAND_COLOR;
const DEFAULT_SECONDARY_COLOR = PORTAL_DEFAULT_SECONDARY_COLOR;

/**
 * Pull `footerBackground` out of whatever shape `Client.disclaimers` was stored in.
 *
 * Returns `null` when the plan has no preference yet (legacy plain-text disclaimers,
 * a missing envelope, an unparseable string), so callers fall back to the primary
 * brand colour.
 */
export function parseFooterBackgroundPreference(
  raw: unknown,
): PortalFooterBackgroundPreference | null {
  let envelope: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Legacy plain-text disclaimers carry no envelope — nothing to read.
    if (!trimmed.startsWith("{")) return null;
    try {
      envelope = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return null;
  }

  const preference = (envelope as { footerBackground?: unknown })
    .footerBackground;
  if (!preference || typeof preference !== "object") return null;

  return preference as PortalFooterBackgroundPreference;
}

/**
 * Resolve a preference object to the colour the footer paints.
 *
 * `primary` (and anything unrecognised) is the brand colour, `secondary` the plan's
 * secondary colour, and `custom` its saved hex — falling back to the brand colour
 * when a custom mode has no usable value.
 */
export function resolveFooterBackgroundColor(
  preference: PortalFooterBackgroundPreference | null | undefined,
  brandColor?: string | null,
  secondaryColor?: string | null,
): string {
  const brand = brandColor?.trim() || DEFAULT_BRAND_COLOR;
  const secondary = secondaryColor?.trim() || DEFAULT_SECONDARY_COLOR;

  if (!preference) return brand;
  if (preference.mode === "secondary") return secondary;
  if (preference.mode === "custom") {
    const custom = preference.customColor?.trim();
    if (custom) return custom;
  }
  return brand;
}

/**
 * Resolve the portal footer colour straight from a plan's stored `disclaimers`
 * value. The one call every portal surface should make.
 */
export function resolvePortalFooterColor(
  disclaimers: unknown,
  brandColor?: string | null,
  secondaryColor?: string | null,
): string {
  return resolveFooterBackgroundColor(
    parseFooterBackgroundPreference(disclaimers),
    brandColor,
    secondaryColor,
  );
}
