import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import {
  clearOrganizationDisclosuresReviewed,
  getOrganizationDisclosuresReview,
  isDisclosureAttestationContext,
  markOrganizationDisclosuresReviewed,
} from "@/lib/organization-disclosures.server";

/**
 * Organization disclosures-review status.
 *
 *   GET  → { reviewed, reviewedAt, canReview } for the signed-in user's org.
 *   POST → record a confirmation. Body: { context: "onboarding" | "settings" |
 *          "plan", planId?: string }. Writes the org flag + an audit row.
 *
 * Drives the dashboard "Disclosures not reviewed" alert and the confirmation
 * write from onboarding / Settings.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getOrganizationDisclosuresReview(session.user.id);
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — defaults below apply.
  }

  const context = isDisclosureAttestationContext(body?.context)
    ? body.context
    : "settings";
  const planId = typeof body?.planId === "string" ? body.planId : null;
  // When the caller supplies the disclosures, a new immutable version is
  // recorded before the confirmation is stored.
  const disclosures = Array.isArray(body?.disclosures)
    ? body.disclosures
    : undefined;

  const ok = await markOrganizationDisclosuresReviewed(session.user.id, {
    context,
    planId,
    disclosures,
  });
  if (!ok) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  return NextResponse.json({ success: true, reviewed: true });
}

/** Clear the reviewed flag (skip, or an edit that needs re-attestation). */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ok = await clearOrganizationDisclosuresReviewed(session.user.id);
  if (!ok) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  return NextResponse.json({ success: true, reviewed: false });
}
