/**
 * Where a webinar is published across the employee portal.
 *
 * A video can live on several pages at once: the News & Events page (where every
 * video appears by default) plus any of the four benefit hub pages. Kept in one
 * place so the dashboard checkboxes, the API defaults and the hub sections can't
 * drift apart.
 *
 * Deliberately separate from the benefit *category* (`benefitsCategory`): the
 * category describes what a video is about, this describes where it is shown, and
 * the two lists differ (there are four hub pages but five categories).
 */
export const WEBINAR_PLACEMENTS = [
  {
    key: "news-events",
    label: "News & Events",
    hint: "The News & Events page, where videos appear by default.",
  },
  {
    key: "retirement",
    label: "Retirement",
    hint: "The Retirement benefits page.",
  },
  {
    key: "health-insurance",
    label: "Health Insurance",
    hint: "The Health Insurance benefits page.",
  },
  {
    key: "life-insurance",
    label: "Life Insurance",
    hint: "The Life Insurance benefits page.",
  },
  {
    // Shown to the advisor as "Custom": this hub page is where the Custom benefit
    // category is published (`Custom: "Wellness Programs"` in the wizard), so the
    // label follows the benefit's name. The key stays `wellness-programs` — it is
    // the portal route segment and the value stored on every saved row, so renaming
    // it would strand existing placements.
    key: "wellness-programs",
    label: "Custom",
    hint: "The page for a Custom benefit.",
  },
] as const;

export type WebinarPlacementKey = (typeof WEBINAR_PLACEMENTS)[number]["key"];

/** Every video lives here unless the user says otherwise. */
export const DEFAULT_WEBINAR_PLACEMENT: WebinarPlacementKey = "news-events";

const PLACEMENT_KEYS: readonly string[] = WEBINAR_PLACEMENTS.map((p) => p.key);

/**
 * Coerce a stored value into a usable placement list.
 *
 * Unknown keys are dropped, and anything that resolves to nothing — a legacy row
 * saved before placements existed, or a malformed value — falls back to News &
 * Events, so no video can silently vanish from every page.
 */
export function normalizeWebinarPlacements(
  value: unknown,
): WebinarPlacementKey[] {
  if (!Array.isArray(value)) return [DEFAULT_WEBINAR_PLACEMENT];

  const keys = Array.from(
    new Set(
      value
        .filter((v): v is string => typeof v === "string")
        .filter((v) => PLACEMENT_KEYS.includes(v)),
    ),
  ) as WebinarPlacementKey[];

  return keys.length > 0 ? keys : [DEFAULT_WEBINAR_PLACEMENT];
}

/** True when `value` resolves to a placement that includes `key`. */
export function hasWebinarPlacement(
  value: unknown,
  key: WebinarPlacementKey,
): boolean {
  return normalizeWebinarPlacements(value).includes(key);
}

/**
 * Type guard for a placement key arriving untrusted — a query param (`?placement=`)
 * or a request body — so callers can narrow before using it.
 */
export function isWebinarPlacementKey(
  value: unknown,
): value is WebinarPlacementKey {
  return typeof value === "string" && PLACEMENT_KEYS.includes(value);
}
