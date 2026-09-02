/**
 * Canonical Benefits Hub entry path (employee-facing portal root).
 * Must stay aligned with portal routing (portal header base path).
 *
 * Accepts both MongoDB ObjectIds and human-readable slugs — the [id] view route
 * resolves both via dual lookup in GET /api/clients/[id].
 */

export function getBenefitsHubPath(clientIdOrSlug: string): string {
  const id = String(clientIdOrSlug || "").trim();
  if (!id) {
    throw new Error("clientId is required for Benefits Hub URL");
  }
  return `/${id}`;
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
 * Absolute URL used in flyer QR codes, email links, and anywhere an
 * external-facing portal link is needed.
 *
 * When a subdomain is provided (the advisor's User.subdomain), the URL is built
 * as: https://{subdomain}.{rootDomain}/{slug}
 *
 * Example: https://waypoint.plantel.pro/gloomis
 *
 * When no subdomain is provided (local dev or advisor hasn't set one), falls
 * back to NEXT_PUBLIC_APP_URL or NEXTAUTH_URL.
 */
export function getBenefitsHubAbsoluteUrl(
  clientIdOrSlug: string,
  userSubdomain?: string,
): string {
  const path = getBenefitsHubPath(clientIdOrSlug);
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    process.env.ROOT_DOMAIN ||
    "plantel.pro";

  if (userSubdomain) {
    // Production: https://waypoint.plantel.pro/gloomis
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
