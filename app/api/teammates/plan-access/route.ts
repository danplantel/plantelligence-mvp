export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  NO_ACCESS_MESSAGE,
  resolvePlanAccess,
} from "@/lib/teammates/access.server";
import type { RequiredLevel } from "@/lib/teammates/permission-levels";
import {
  PERMISSION_FUNCTIONS,
  type PermissionFunction,
} from "@/types/teammate";

/**
 * GET /api/teammates/plan-access
 *   ?planId=<id|slug>&category=<label>&permission=<function>&level=view|edit|allowed
 *
 * Returns the caller's access decision for one plan (+ category + function).
 * This is the read-only mirror of the SAME `resolvePlanAccess` engine the
 * mutating routes enforce, so the UI can:
 *   - render `NoAccessNotice` instead of a restricted page (T2 Part A item 2),
 *   - hide or disable controls the user has no permission for (Part A item 1)
 *     using the returned `permissionSet`.
 *
 * It is NOT the enforcement point — the API routes are. A client that ignores
 * this response still gets refused by the server.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { allowed: false, reason: "unauthenticated", message: NO_ACCESS_MESSAGE },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId")?.trim();
  if (!planId) {
    return NextResponse.json(
      { error: "Missing query parameter: planId" },
      { status: 400 },
    );
  }

  // Only accept a known function name, so a typo can't silently become a
  // weaker (permission-less) check on the client.
  const rawPermission = searchParams.get("permission");
  const permission =
    rawPermission &&
    (PERMISSION_FUNCTIONS as readonly string[]).includes(rawPermission)
      ? (rawPermission as PermissionFunction)
      : undefined;

  const rawLevel = searchParams.get("level");
  const level: RequiredLevel =
    rawLevel === "edit" || rawLevel === "allowed" ? rawLevel : "view";

  const access = await resolvePlanAccess({
    userId,
    clientIdOrSlug: planId,
    category: searchParams.get("category"),
    permission,
    level,
  });

  if (access.allowed) {
    return NextResponse.json({
      allowed: true,
      kind: access.kind,
      role: access.kind === "teammate" ? access.role : "owner",
      categories: access.kind === "teammate" ? access.categories : "all",
      permissionSet: access.permissionSet,
      showOnBenefitsHub:
        access.kind === "teammate" ? access.showOnBenefitsHub : true,
    });
  }

  return NextResponse.json(
    { allowed: false, reason: access.reason, message: access.message },
    { status: access.reason === "plan_not_found" ? 404 : 403 },
  );
}
