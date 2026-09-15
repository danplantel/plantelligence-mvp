import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import prisma from "@/lib/prisma";

export const PORTAL_ADVISOR_HEADER = "x-advisor-id";

/**
 * Resolve the advisor (User) that a public portal request belongs to, or
 * `undefined` when the request is NOT a verifiable public portal request.
 *
 * Portal URLs are slug-based at the environment root:
 *   https://plantel.pro/{plan-slug}        (production)
 *   https://dev.plantel.pro/{plan-slug}    (development)
 *
 * Employee-facing portals are anonymous, so the owning advisor is derived from
 * the plan's globally-unique `Client.slug`. Depending on the endpoint the plan
 * identifier comes from:
 *   • the request path      → /api/clients/{slug}/… , /api/documents/client/{id}
 *   • an explicit argument  → callers that already know the plan
 *   • a query param         → ?clientSlug= / ?slug= / ?clientId=
 *   • the R2 object key     → org/{userId}/… (portal image proxy)
 *
 * Requests with no resolvable plan (or without the portal flag) return
 * `undefined` so handlers fall back to the normal session flow — the dashboard
 * stays login-required.
 *
 * @param request        the incoming request
 * @param isPortal       force portal treatment when the route's own portal flag
 *                       differs from the `forPortal` query param (e.g. the
 *                       meetings hub uses `forHub=1`). Defaults to reading
 *                       `?forPortal=1`.
 * @param clientIdOrSlug explicit plan slug/ObjectId when the caller already
 *                       has it (e.g. `/api/profile?forPortal=1`).
 */
export async function resolvePortalAdvisorId(
  request: NextRequest,
  isPortal?: boolean,
  clientIdOrSlug?: string,
): Promise<string | undefined> {
  const forPortal =
    isPortal ?? request.nextUrl.searchParams.get("forPortal") === "1";
  if (!forPortal) return undefined;

  // 1) Header attached upstream (kept for compatibility).
  const headerId = request.headers.get(PORTAL_ADVISOR_HEADER)?.trim();
  if (headerId) return headerId;

  // 2) Plan identifier: explicit → query params → request path.
  const candidate =
    clientIdOrSlug?.trim() ||
    request.nextUrl.searchParams.get("clientSlug")?.trim() ||
    request.nextUrl.searchParams.get("slug")?.trim() ||
    request.nextUrl.searchParams.get("clientId")?.trim() ||
    planIdFromPath(request.nextUrl.pathname) ||
    "";

  if (candidate) {
    const client = await prisma.client.findFirst({
      where: ObjectId.isValid(candidate)
        ? { id: candidate }
        : { slug: candidate },
      select: { userId: true },
    });
    if (client?.userId) return client.userId;
  }

  return undefined;
}

/** Extract a plan identifier (slug or ObjectId) from the request path. */
function planIdFromPath(pathname: string): string | undefined {
  const patterns = [
    /\/api\/clients\/([^/]+)/,
    /\/api\/documents\/client\/([^/]+)/,
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return undefined;
}

/**
 * True when the request arrived over a loopback host in local development
 * (`next dev`). Used to allow a *development-only* anonymous portal preview on
 * plain `localhost`/`127.0.0.1` — mirroring the public portal flow without
 * needing a hosts entry. Never true in production builds or on a real host.
 */
export function isLocalDevLoopback(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const host = (request.headers.get("host") || "").toLowerCase();
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0") ||
    host.startsWith("[::1]")
  );
}
