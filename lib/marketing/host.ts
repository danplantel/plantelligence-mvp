/**
 * Host and origin helpers for the public marketing site.
 *
 * The dashboard and participant portals live on the app origin (plantel.pro).
 * The marketing site lives on its own origin (plantel.ai) and is served by the
 * same Next.js deployment. Middleware uses these helpers so the two hosts can
 * never drift: one rule decides what counts as a marketing host, which host is
 * canonical, and where app links should point.
 */

const DEFAULT_APP_ORIGIN = "https://plantel.pro";
const DEFAULT_MARKETING_ORIGIN = "https://plantel.ai";

/** Paths that belong to the marketing site even though they are not `/`. */
export const MARKETING_ASSET_PATHS = [
  "/opengraph-image",
  "/twitter-image",
  "/icon",
  "/apple-icon",
] as const;

export type MarketingEnv = {
  NEXT_PUBLIC_APP_URL?: string;
  NEXTAUTH_URL?: string;
  NEXT_PUBLIC_MARKETING_URL?: string;
  MARKETING_URL?: string;
  MARKETING_HOSTS?: string;
};

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Normalise a host header or hostname.
 *
 * - takes the first value when a proxy appends a comma-separated list;
 * - lowercases the result;
 * - removes the port (`localhost:3000` → `localhost`);
 * - removes a trailing root dot (`plantel.ai.` → `plantel.ai`);
 * - leaves bracketed IPv6 hosts intact.
 */
export function normalizeHost(raw: string | null | undefined): string {
  if (!raw) return "";
  const first = raw.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "";

  if (first.startsWith("[")) {
    const closing = first.indexOf("]");
    return closing >= 0 ? first.slice(0, closing + 1) : first;
  }

  return first.replace(/:\d+$/, "").replace(/\.$/, "");
}

/** Resolve the visitor-facing host, preferring the proxy header. */
export function requestHostFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  return normalizeHost(
    headers.get("x-forwarded-host") ?? headers.get("host"),
  );
}

function originFromUrl(value: string | undefined | null): string {
  if (!value) return "";
  try {
    return stripTrailingSlash(new URL(value).origin);
  } catch {
    return "";
  }
}

function hostFromOrigin(origin: string): string {
  try {
    return normalizeHost(new URL(origin).hostname);
  } catch {
    return "";
  }
}

/** The origin that hosts sign-in, onboarding, the dashboard, and portals. */
export function getAppOrigin(env: MarketingEnv = process.env): string {
  return (
    originFromUrl(env.NEXT_PUBLIC_APP_URL) ||
    originFromUrl(env.NEXTAUTH_URL) ||
    DEFAULT_APP_ORIGIN
  );
}

/** The canonical public origin for the marketing site. */
export function getMarketingOrigin(env: MarketingEnv = process.env): string {
  return (
    originFromUrl(env.NEXT_PUBLIC_MARKETING_URL) ||
    originFromUrl(env.MARKETING_URL) ||
    DEFAULT_MARKETING_ORIGIN
  );
}

export function getAppHost(env: MarketingEnv = process.env): string {
  return hostFromOrigin(getAppOrigin(env));
}

function pickApexHost(hosts: string[]): string {
  const apex = hosts.find((host) => !host.startsWith("www."));
  if (apex) return apex;
  const www = hosts.find((host) => host.startsWith("www."));
  return www ? www.replace(/^www\./, "") : "";
}

/**
 * Every host that serves the marketing site.
 *
 * The host from `NEXT_PUBLIC_MARKETING_URL` is always included, so production
 * cannot accidentally lose its own domain when `MARKETING_HOSTS` is unset. The
 * `www.` variant is added for a two-label apex so `www.plantel.ai` redirects to
 * the canonical host rather than falling through to the portal catch-all.
 */
export function getMarketingHosts(env: MarketingEnv = process.env): string[] {
  const hosts = new Set<string>();

  const originHost = hostFromOrigin(getMarketingOrigin(env));
  if (originHost) hosts.add(originHost);

  for (const entry of (env.MARKETING_HOSTS || "").split(",")) {
    const host = normalizeHost(entry);
    if (host) hosts.add(host);
  }

  if (hosts.size === 0) {
    hosts.add("plantel.ai");
  }

  const apex = pickApexHost([...hosts]);
  if (apex && apex.split(".").length === 2) {
    hosts.add(`www.${apex}`);
  }

  return [...hosts];
}

/** The canonical marketing host (the non-`www` entry). */
export function getMarketingApexHost(
  env: MarketingEnv = process.env,
): string {
  return pickApexHost(getMarketingHosts(env));
}

export function isMarketingHost(
  host: string | null | undefined,
  env: MarketingEnv = process.env,
): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return getMarketingHosts(env).includes(normalized);
}

/** True only for the `www.` alias of the canonical marketing host. */
export function isWwwMarketingHost(
  host: string | null | undefined,
  env: MarketingEnv = process.env,
): boolean {
  const normalized = normalizeHost(host);
  const apex = getMarketingApexHost(env);
  return Boolean(apex) && normalized === `www.${apex}`;
}

export function isLocalHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".localhost")
  );
}

type HeaderSource = { get(name: string): string | null };

/**
 * The origin the browser used, but only for loopback hosts.
 *
 * Local development serves the marketing site and the app from a single origin
 * (`http://localhost:3000`). Reusing the configured production origins there
 * would send every CTA to plantel.pro, so on a loopback host the request origin
 * wins. Every other host returns `null` and keeps the configured origins.
 */
export function getLocalRequestOrigin(headers: HeaderSource): string | null {
  const rawHost = headers.get("host");
  if (!rawHost) return null;

  const hostWithPort = rawHost.split(",")[0]?.trim();
  if (!hostWithPort || !isLocalHost(hostWithPort)) return null;

  const forwardedProto = headers.get("x-forwarded-proto") ?? "";
  const proto = forwardedProto.split(",")[0]?.trim() || "http";

  return `${proto}://${hostWithPort}`;
}

export interface MarketingPageOrigins {
  appOrigin: string;
  marketingOrigin: string;
}

/**
 * The origins the marketing page should link to.
 *
 * Production keeps the split between the marketing origin and the app origin.
 * A local preview collapses both onto the origin the browser is already on, so
 * "Sign in" / "Go to dashboard" stay on localhost instead of jumping to the
 * deployed app.
 */
export function getMarketingPageOrigins(
  headers: HeaderSource,
  env: MarketingEnv = process.env,
): MarketingPageOrigins {
  const localOrigin = getLocalRequestOrigin(headers);

  return {
    appOrigin: localOrigin ?? getAppOrigin(env),
    marketingOrigin: localOrigin ?? getMarketingOrigin(env),
  };
}

/**
 * Metadata files and generated images must survive the marketing host's
 * "everything except `/` goes to the app" rule.
 */
export function isMarketingAssetPath(pathname: string): boolean {
  return MARKETING_ASSET_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
