/**
 * Turn a DASHBOARD notification link into the PORTAL page that shows the same thing.
 *
 * This exists because push breaks an assumption the header bell could get away with. Every stored
 * notification `href` is dashboard-shaped — `/edit-client/{id}?comment=…`,
 * `/edit-benefit/{id}/{segment}?comment=…`, `/?messages=…` — which is correct in-app, where the only
 * reader is an advisor looking at the bell. A push is tapped on a phone, possibly by a participant
 * who has never opened the dashboard, so the same link would drop them into an advisor surface they
 * have no business seeing. `plans/web-push-notifications.md` calls this out as the one piece of
 * mapping the first release cannot skip.
 *
 * Two segment vocabularies have to be crossed, and they are NOT the same words:
 *
 *   dashboard (`lib/benefit-category-slug.ts`)   portal (`lib/comments/portal-surface.ts`)
 *   group-health                            →    health-insurance
 *   group-life                              →    life-insurance
 *   company-plan-sponsor                    →    wellness-programs (the Custom hub's legacy segment)
 *   retirement                              →    retirement
 *
 * `company-plan-sponsor` maps to the legacy portal segment on purpose: the advisor-chosen Custom hub
 * name is per plan and would need another query, while `wellness-programs` resolves to the same
 * "Other" surface and is always valid.
 *
 * Returning `null` is a real answer — "this notification has no portal destination". Callers fall
 * back to the portal root rather than guessing a page, because a wrong portal page is worse than the
 * homepage: it shows the participant a different benefit's conversation.
 */

/** Dashboard route segment → portal route segment. */
const DASHBOARD_SEGMENT_TO_PORTAL: Record<string, string> = {
  retirement: "retirement",
  "group-health": "health-insurance",
  "group-life": "life-insurance",
  "company-plan-sponsor": "wellness-programs",
};

export function portalSegmentForDashboardSegment(
  segment: string,
): string | null {
  return DASHBOARD_SEGMENT_TO_PORTAL[segment] ?? null;
}

function splitHref(href: string): { segments: string[]; search: string } {
  const queryAt = href.indexOf("?");
  const path = queryAt >= 0 ? href.slice(0, queryAt) : href;
  const search = queryAt >= 0 ? href.slice(queryAt) : "";
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  return { segments, search };
}

/**
 * The plan a dashboard notification is ABOUT, read from its own href.
 *
 * Both comment links carry the plan id in the path (`/edit-client/{planId}…`,
 * `/edit-benefit/{planId}/…`), which is why the sender does not need every caller to pass a plan:
 * the href already knows. Returns null for a link that names no plan (direct messages), and null is
 * handled by falling back to the notification's own href.
 */
export function planIdFromNotificationHref(
  href?: string | null,
): string | null {
  const { segments } = splitHref((href ?? "").trim());
  const [head, planId] = segments;
  if (!planId) return null;
  if (head === "edit-client" || head === "edit-benefit") return planId;
  return null;
}

/**
 * The conversation a notification belongs to: the `comment` or `messages` query parameter.
 *
 * Used as the collapse key so a thread of replies becomes ONE notification instead of a stack. The
 * same value carried both places it is needed — `tag` in the tray, `topic` at the push service.
 */
export function threadIdFromNotificationHref(
  href?: string | null,
): string | null {
  const value = (href ?? "").trim();
  const queryAt = value.indexOf("?");
  if (queryAt < 0) return null;
  try {
    const params = new URLSearchParams(value.slice(queryAt + 1));
    return params.get("comment") ?? params.get("messages") ?? null;
  } catch {
    return null;
  }
}

/**
 * The portal path for a dashboard notification, or null when it has none.
 *
 * `planSlug` is required: a portal URL is `/{slug}/…` and there is no way to invent that from the
 * href alone.
 */
export function portalHrefForNotification(input: {
  href?: string | null;
  planSlug?: string | null;
}): string | null {
  const planSlug = (input.planSlug ?? "").trim();
  if (!planSlug) return null;

  const href = (input.href ?? "").trim();
  // A notification with no href is informational; the portal root is the right landing.
  if (!href) return `/${planSlug}`;

  const { segments, search } = splitHref(href);
  if (segments.length === 0) {
    // `/?messages=…` and other dashboard-home links. Messages are a dashboard feature — the portal
    // has no rail for them — so this is "no portal destination", not "the portal home".
    return null;
  }

  // A benefit's comment thread.
  if (segments[0] === "edit-benefit" && segments.length >= 3) {
    const portalSegment = portalSegmentForDashboardSegment(segments[2]);
    if (!portalSegment) return `/${planSlug}`;
    return `/${planSlug}/${portalSegment}${search}`;
  }

  // A plan-level comment thread — the portal landing page is the same surface.
  if (segments[0] === "edit-client") {
    return `/${planSlug}${search}`;
  }

  // Anything else (settings, benefits, documents, dashboard…) is a dashboard surface with no portal
  // counterpart. Do not approximate it.
  return null;
}
