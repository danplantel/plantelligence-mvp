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
 * Portal links are slug-based at the environment root:
 *   https://{rootDomain}/{slug}
 *     • Production   (ROOT_DOMAIN=plantel.pro)     -> https://plantel.pro/acme-corp
 *     • Development  (ROOT_DOMAIN=dev.plantel.pro) -> https://dev.plantel.pro/acme-corp
 *
 * The root domain comes from NEXT_PUBLIC_ROOT_DOMAIN / ROOT_DOMAIN. When no
 * root domain is configured it falls back to NEXT_PUBLIC_APP_URL / NEXTAUTH_URL.
 */
export function getBenefitsHubAbsoluteUrl(clientIdOrSlug: string): string {
  const path = getBenefitsHubPath(clientIdOrSlug);
  const rootDomain = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    process.env.ROOT_DOMAIN ||
    ""
  )
    .replace(/^\./, "")
    .trim();

  if (rootDomain) {
    return `https://${rootDomain}${path}`;
  }

  // Fallback for local dev or when no root domain is configured.
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "";

  if (!base) {
    throw new Error(
      "Set NEXT_PUBLIC_ROOT_DOMAIN, NEXT_PUBLIC_APP_URL or NEXTAUTH_URL to build flyer Hub QR links",
    );
  }

  return `${base}${path}`;
}

/**
 * Absolute Benefits Hub URL for the in-app "Open Portal" / "View Portal"
 * buttons. The portal root is built against the ROOT_DOMAIN configured for the
 * current environment (NEXT_PUBLIC_ROOT_DOMAIN / ROOT_DOMAIN), so it opens the
 * portal that belongs to the deployment the advisor is using:
 *
 *   • local `next dev`                              -> {origin}/{slug}
 *   • Production project (ROOT_DOMAIN=plantel.pro)  -> https://plantel.pro/{slug}
 *   • Dev project (ROOT_DOMAIN=dev.plantel.pro)     -> https://dev.plantel.pro/{slug}
 *
 * Requires the browser (window.location) — call from client event handlers only.
 */
export function getBenefitsHubOpenPortalUrl(clientIdOrSlug: string): string {
  const path = getBenefitsHubPath(clientIdOrSlug);

  // Local development: open the current origin.
  if (process.env.NODE_ENV === "development") {
    return `${window.location.origin}${path}`;
  }

  const portalRoot = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    process.env.ROOT_DOMAIN ||
    "plantel.pro"
  )
    .replace(/^\./, "")
    .toLowerCase();

  return `https://${portalRoot}${path}`;
}
