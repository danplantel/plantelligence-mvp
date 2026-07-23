/**
 * Canonical Benefits Hub entry path (employee-facing portal root).
 * Must stay aligned with portal routing (e.g. portal-plan-header base path).
 *
 * Accepts both MongoDB ObjectIds and human-readable slugs — the [id] view route
 * resolves both via dual lookup in GET /api/clients/[id].
 */

export function getBenefitsHubPath(clientIdOrSlug: string): string {
  const id = String(clientIdOrSlug || "").trim();
  if (!id) {
    throw new Error("clientId is required for Benefits Hub URL");
  }
  return `/new/view/${id}`;
}

/**
 * Convenience wrapper that constructs a portal path from a plan slug.
 * Equivalent to getBenefitsHubPath — exists for semantic clarity when
 * you know you're passing a slug.
 */
export function getBenefitsHubPathFromSlug(slug: string): string {
  return getBenefitsHubPath(slug);
}

/**
 * Absolute URL used in flyer QR codes. Requires server env configuration.
 *
 * When a subdomain is provided (the advisor's User.subdomain), the URL is built
 * as: https://{subdomain}.{rootDomain}/new/view/{slug}
 *
 * Example: https://waypoint.plantel.pro/new/view/gloomis
 */
export function getBenefitsHubAbsoluteUrl(
  clientIdOrSlug: string,
  userSubdomain?: string,
): string {
  const path = getBenefitsHubPath(clientIdOrSlug);
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || "plantelligence-mvp.vercel.app";

  if (userSubdomain) {
    // Production / subdomain: https://waypoint.plantel.pro/new/view/gloomis
    return `https://${userSubdomain}.${rootDomain}${path}`;
  }

  // Fallback for local dev or when no subdomain is configured
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "";

  if (!base) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL to build flyer Hub QR links",
    );
  }

  return `${base}${path}`;
}
