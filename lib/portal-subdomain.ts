/**
 * Pure, Edge-safe helpers for parsing the advisor subdomain out of a request's
 * Host header. No Node APIs / Prisma here — safe to import from both the Edge
 * middleware and Node.js route handlers.
 *
 * Examples:
 *   "waypoint.plantel.pro"     → "waypoint"
 *   "www.waypoint.plantel.pro" → "waypoint"
 *   "plantel.pro"              → null (apex)
 *   "www.plantel.pro"          → null (www apex)
 *   "localhost:3000"           → null (local dev)
 *   "127.0.0.1:3000"           → null (local dev)
 *   "waypoint.localhost:3000"  → "waypoint" (local subdomain testing)
 *   "abc-123.vercel.app"       → null (preview host, not our root domain)
 */
export function extractSubdomain(
  host: string,
  rootDomain = "plantel.pro",
): string | null {
  if (!host) return null;
  let h = host.toLowerCase().trim();
  // Strip an optional port (handles "host:port" and "[::1]:port").
  h = h.replace(/\]?:\d+$/, "");
  h = h.replace(/^\[/, "").replace(/\]$/, "");
  if (!h) return null;

  // Loopback / local dev never carries a subdomain.
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1"
  ) {
    return null;
  }

  // Local testing subdomains: <sub>.localhost
  if (h.endsWith(".localhost")) {
    const last = h.slice(0, -".localhost".length).split(".").pop();
    return last && last !== "www" ? last : null;
  }

  const rd = (rootDomain || "plantel.pro").toLowerCase().replace(/^\./, "");
  if (!rd || h === rd) return null; // apex

  const suffix = `.${rd}`;
  if (h.endsWith(suffix)) {
    // Rightmost label before the root domain, minus any leading "www".
    const last = h.slice(0, -suffix.length).split(".").pop();
    return last && last !== "www" ? last : null;
  }
  // Unknown host (e.g. a preview domain) — do not guess a subdomain.
  return null;
}
