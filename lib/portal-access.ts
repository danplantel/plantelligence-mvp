import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { extractSubdomain } from "@/lib/portal-subdomain";

export const PORTAL_ADVISOR_HEADER = "x-advisor-id";

/**
 * Resolve the advisor (User) that a public portal request is scoped to, or
 * `undefined` when the request is NOT a verifiable public portal request.
 *
 * WHY THIS EXISTS
 * Portal pages must be viewable by anonymous employees (people with no
 * Plantelligence session). Middleware already verifies an advisor subdomain and
 * attaches the `x-advisor-id` header — but only to the initial page document
 * and to `/api/r2/object` (the single /api path in the middleware matcher).
 * The page's subsequent browser `fetch()` calls to JSON APIs
 * (`/api/clients/...`, `/api/documents/...`, etc.) never run through
 * middleware, so they never carry the header. To let those calls load data
 * anonymously we re-derive the advisor from the Host subdomain here; API
 * handlers then skip the session check and scope lookups to that advisor.
 *
 * Requests that are not portal requests (no portal flag, no `x-advisor-id`, and
 * no recognized subdomain in Host) return `undefined` so handlers fall back to
 * the normal session flow — the dashboard stays login-required.
 *
 * @param request    the incoming request
 * @param isPortal   force portal treatment when the route's own portal flag
 *                   differs from the `forPortal` query param (e.g. the meetings
 *                   hub uses `forHub=1`, webinars have no flag). Defaults to
 *                   reading `?forPortal=1`.
 */
export async function resolvePortalAdvisorId(
  request: NextRequest,
  isPortal?: boolean,
): Promise<string | undefined> {
  const forPortal =
    isPortal ?? request.nextUrl.searchParams.get("forPortal") === "1";
  if (!forPortal) return undefined;

  // 1) Header attached by middleware (document loads / /api/r2/object).
  const headerId = request.headers.get(PORTAL_ADVISOR_HEADER)?.trim();
  if (headerId) return headerId;

  // 2) Browser JSON fetches on an advisor subdomain: derive from Host.
  const rootDomain = process.env.ROOT_DOMAIN || "plantel.pro";
  const subdomain = extractSubdomain(
    request.headers.get("host") || "",
    rootDomain,
  );
  if (subdomain) {
    const user = await prisma.user.findFirst({
      where: { subdomain },
      select: { id: true },
    });
    if (user) return user.id;
  }
  return undefined;
}
