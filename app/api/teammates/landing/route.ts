export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { createPermissionChecker } from "@/lib/teammates/permission-levels";
import { mayUsePath } from "@/lib/teammates/nav-access";
import { getViewerAccess } from "@/lib/teammates/viewer-access.server";

/**
 * GET /api/teammates/landing — where to send a viewer after they sign in.
 *
 * The sign-in forms used to default to `/dashboard`, which a Collaborator cannot use: the
 * chrome refuses that URL (`NAV_ACCESS_REQUIREMENTS`, `collaboratorHidden`), so their first
 * screen after signing in was the restricted notice. They were invited to work on benefits, so
 * `/benefits` — the plan list, already scoped to their assignments — is where they belong.
 *
 * **The rule is the chrome's own rule.** `mayUsePath("/dashboard", …)` is the same function the
 * sidebar hides entries with and the layout refuses pages with, so this cannot drift from what
 * the app will actually allow.
 *
 * That lands the roles the way they are meant to work: an **Owner, Admin or Editor** — anyone
 * holding a Team Member seat, whatever their permission preset, plus the organization owner — is
 * NOT a collaborator, so `/dashboard` is open to them and they go there. Only a **Collaborator**
 * is routed to `/benefits`, because `/dashboard` is `collaboratorHidden` in
 * `NAV_ACCESS_REQUIREMENTS`. (`isCollaborator` is the axis that decides this, not the role: a
 * seat's preset — Editor, Viewer — narrows what someone may DO, and only a collaborator's chrome
 * is narrowed at all.)
 *
 * Deliberately a REDIRECT rather than a page: `signIn("google")` is a full-page navigation, so
 * it can only be handed a URL — and the credentials form uses the same URL, so both flows share
 * one decision instead of two that can disagree. Deep links are unaffected: middleware puts the
 * page the user asked for in `callbackUrl`, which is used in preference to this route.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Nothing to decide without a session — the normal way in, with this route as the way back.
  if (!userId) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  let target = "/benefits";
  try {
    const access = await getViewerAccess(userId);
    const can = createPermissionChecker(access.functions);
    target = mayUsePath("/dashboard", {
      isCollaborator: access.isCollaborator,
      can,
    })
      ? "/dashboard"
      : "/benefits";
  } catch {
    // Fail open, like the access summary itself: an unreadable answer must not strand the
    // viewer, and `/benefits` is the destination every role can use.
    target = "/benefits";
  }

  return NextResponse.redirect(new URL(target, request.url));
}
