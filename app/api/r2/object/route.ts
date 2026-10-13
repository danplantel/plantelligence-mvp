import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getObjectFromR2, isR2Configured } from "@/lib/r2";
import { resolvePortalAdvisorId } from "@/lib/portal-access";
import { resolveCommentAttachmentAccess } from "@/lib/comments/comments.server";
import { resolveDirectAttachmentAccess } from "@/lib/messages/messages.server";
import { resolveObjectAccess } from "@/lib/teammates/access.server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** First path segment of the Referer — the plan slug on the public portal. */
function planSlugFromReferer(request: NextRequest): string | undefined {
  const referer = request.headers.get("referer");
  if (!referer) return undefined;
  try {
    const segment = new URL(referer).pathname.split("/").filter(Boolean)[0];
    return segment ? decodeURIComponent(segment) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * GET /api/r2/object?key=org/...
 * Streams the object body with same origin so canvas/Fabric can load it without R2 CORS.
 *
 * Auth:
 *  - Dashboard: a session is required and the key must start with org/{userId}/.
 *  - Public portal (anonymous): the request is scoped to the plan in the URL —
 *    the `?clientSlug=` query param or the Referer path (/{slug}/…) — so a key is
 *    only readable when it belongs to that plan's owning advisor.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let ownerId: string | undefined = session?.user?.id;

    if (!ownerId) {
      // Anonymous portal image load: scope to the plan slug in the query or the
      // Referer, then verify the requested key belongs to that plan's advisor.
      const planSlug =
        request.nextUrl.searchParams.get("clientSlug")?.trim() ||
        planSlugFromReferer(request);
      if (planSlug) {
        ownerId = await resolvePortalAdvisorId(request, true, planSlug);
      }
    }

    if (!ownerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "R2 storage is not configured" },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key")?.trim();
    if (!key) {
      return NextResponse.json(
        { error: "Missing query parameter: key" },
        { status: 400 },
      );
    }

    // Comment attachments answer to their THREAD's scope, which can be narrower than the plan's:
    // a Collaborator assigned to one benefit category must not read an attachment on a thread in
    // a category they do not hold. `null` means no message claims the key — an upload still in
    // flight, or residue — and the generic plan-level check below stays in charge, which is what
    // the composer's optimistic thumbnail needs while the comment is being posted.
    const commentAccess = await resolveCommentAttachmentAccess({
      userId: ownerId,
      key,
    });
    if (commentAccess && !commentAccess.allowed) {
      return NextResponse.json(
        { error: "Access denied to this object" },
        { status: 403 },
      );
    }

    // Direct-message attachments answer to THREAD PARTICIPATION, and this one cannot defer to the
    // generic check below. `parseR2Key` does not recognise a DM key's shape
    // (`org/{organizationId}/messages/{threadId}/…`), so it falls into the org-level fallback —
    // which authorizes the ORGANIZATION OWNER, the one third party expressly not allowed to read a
    // private conversation's files. `resolveDirectAttachmentAccess` therefore answers for every DM
    // key (refusing one that names no thread), and returns null only when the key is not a DM key.
    const directAccess = await resolveDirectAttachmentAccess({
      userId: ownerId,
      key,
    });
    if (directAccess && !directAccess.allowed) {
      return NextResponse.json(
        { error: "Access denied to this object" },
        { status: 403 },
      );
    }

    // T2 Part B item 3. `ownerId` is the session user on the dashboard, and the
    // plan's owning advisor on the anonymous portal path (resolved from the slug,
    // so the request is already scoped to that plan). Checking the key's plan
    // segment against them is strictly stronger than the old bare prefix match:
    // it also stops one plan's key being read through another plan's slug.
    const access = await resolveObjectAccess({
      userId: ownerId,
      key,
      level: "view",
    });
    if (!access.allowed) {
      return NextResponse.json(
        { error: "Access denied to this object" },
        { status: 403 },
      );
    }

    const result = await getObjectFromR2(key);
    if (!result) {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }

    return new Response(result.body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[R2 object]", error);
    return NextResponse.json(
      { error: "Failed to read object" },
      { status: 500 },
    );
  }
}
