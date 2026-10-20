/**
 * Portal banner helpers.
 *
 * Two rules used to live inline in `app/(portal)/[id]/layout.tsx`, where they
 * could only be exercised by rendering the whole chrome:
 *
 *  - **the CTA URL**, which has to be absolute for `target="_blank"` to behave
 *    but must not mangle a link that already carries a scheme (`mailto:`,
 *    `tel:`) or a same-site path;
 *  - **the countdown**, which splits the remaining time into the `d hh:mm:ss`
 *    the banner renders and reports when the target has passed.
 */

/** The banner's countdown, already split for rendering. */
export interface PortalCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

/**
 * Make a stored CTA usable as an `href`.
 *
 * Returns `undefined` when there is nothing to link to. A value that already
 * has a scheme (`https:`, `http:`, `mailto:`, `tel:`, …) or that points inside
 * the site (`/path`, `#anchor`) is returned unchanged; a bare host is assumed
 * to be `https://`.
 */
export function normalizePortalCtaUrl(
  raw: string | null | undefined,
): string | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
  const isSitePath = value.startsWith("/") || value.startsWith("#");
  if (hasScheme || isSitePath) return value;

  return `https://${value}`;
}

/**
 * Split the time between `target` and `now` into countdown parts.
 *
 * Returns `null` for a missing or unparseable target — the caller then leaves
 * the ticker off rather than rendering `NaN`. An expired target returns all
 * zeroes with `expired: true`, which is what the banner shows as **Expired**.
 */
export function getPortalCountdown(
  target: string | number | Date | null | undefined,
  now: number = Date.now(),
): PortalCountdown | null {
  if (target === null || target === undefined || target === "") return null;

  const targetMs =
    target instanceof Date ? target.getTime() : new Date(target).getTime();
  if (!Number.isFinite(targetMs)) return null;

  const diff = targetMs - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}
