/**
 * The Portal Header's single call to action.
 *
 * A plan's header used to have exactly one behaviour: a Login button on a Benefit
 * Hub page, which scrolled to that hub's "How Can We Help You Today?" section and
 * the Account Access card inside it. Section 1 of the editing panel now lets the
 * advisor pick between that, a booking button, or nothing — stored as ONE
 * plan-level value in `Client.employeePortalPreview.headerCta`:
 *
 *   { mode: "login" }                    → the original Login button (default)
 *   { mode: "schedule", url, label? }    → "Schedule a Call" (label overridable)
 *   { mode: "none" }                     → no header button at all
 *
 * An absent or unrecognized value means "login", which keeps every existing plan
 * rendering exactly what it renders today: the migration is a read-time default,
 * not a backfill.
 */

export type PortalHeaderCtaMode = "login" | "schedule" | "none";

export interface PortalHeaderCta {
  mode: PortalHeaderCtaMode;
  /** `schedule` only: the booking destination. */
  url?: string;
  /** `schedule` only: the button's own label. Defaults to [`DEFAULT_SCHEDULE_CTA_LABEL`]. */
  label?: string;
}

/** The wording the booking button carries when the advisor does not override it. */
export const DEFAULT_SCHEDULE_CTA_LABEL = "Schedule a Call";

/** What a plan with nothing stored renders — the pre-existing Login button. */
export const DEFAULT_PORTAL_HEADER_CTA: PortalHeaderCta = { mode: "login" };

const PORTAL_HEADER_CTA_MODES: PortalHeaderCtaMode[] = [
  "login",
  "schedule",
  "none",
];

/** The three choices, with the copy the editing panel prints for each. */
export const PORTAL_HEADER_CTA_OPTIONS: {
  value: PortalHeaderCtaMode;
  label: string;
  description: string;
}[] = [
  {
    value: "login",
    label: "Login",
    description:
      "A Login button that appears on your benefit pages and scrolls to the Account Access card.",
  },
  {
    value: "schedule",
    label: "Schedule a Call",
    description:
      "A booking button, shown on every portal page. Without a link it scrolls to your team's contact card instead.",
  },
  {
    value: "none",
    label: "None",
    description: "No button in the header.",
  },
];

/**
 * Read a stored value into the shape the header renders from.
 *
 * Every unrecognized input collapses to `login` rather than throwing, because this
 * value arrives from a JSON blob that older rows wrote with different shapes.
 */
export function normalizePortalHeaderCta(raw: unknown): PortalHeaderCta {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PORTAL_HEADER_CTA };

  const value = raw as Record<string, unknown>;
  const rawMode = value.mode as PortalHeaderCtaMode | undefined;
  const mode = PORTAL_HEADER_CTA_MODES.includes(rawMode as PortalHeaderCtaMode)
    ? (rawMode as PortalHeaderCtaMode)
    : "login";

  // `url` / `label` are kept on every mode, not just `schedule`: the header ignores
  // them unless the mode is `schedule`, and keeping them means an advisor who
  // switches back to Login and then to Schedule again still finds their booking
  // link where they left it.
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  return {
    mode,
    ...(url ? { url } : {}),
    ...(label ? { label } : {}),
  };
}

/** The button's text, or "" when the plan asked for no button. */
export function portalHeaderCtaLabel(cta: PortalHeaderCta): string {
  if (cta.mode === "none") return "";
  if (cta.mode === "login") return "Login";
  return (cta.label || "").trim() || DEFAULT_SCHEDULE_CTA_LABEL;
}

/**
 * Where a booking button points, and whether that leaves the portal.
 *
 * Mirrors the rules the help cards use for their CTAs: a leading "/" or "#" stays in
 * the portal, an explicit scheme is honoured, and a bare domain is treated as https
 * — so an advisor who types "calendly.com/me" still gets a working link.
 */
export function resolvePortalHeaderCtaHref(
  rawUrl?: string | null,
): { href: string; external: boolean } {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return { href: "", external: false };
  if (trimmed.startsWith("/")) return { href: trimmed, external: false };
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return { href: trimmed, external: false };
  }
  if (
    trimmed.startsWith("//") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
  ) {
    return { href: trimmed, external: true };
  }
  return { href: `https://${trimmed}`, external: true };
}
