export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { describeOwnerDeletionImpact } from "@/lib/teammates/ownership.server";

/**
 * GET /api/profile/delete-impact
 *
 * What deleting this account would do to the organization behind it.
 *
 * The deletion dialog used to jump straight from a typed phrase to `DELETE /api/profile/delete`,
 * which is a branch: an Owner with teammates loses the whole organization, and one without loses
 * only themselves. The dialog cannot choose its next step without knowing which — and the warning
 * it shows in the first case is worthless if the numbers in it are invented. So this returns the
 * real ones, plus the list of people who could take over, in one read.
 *
 * Session-scoped rather than organization-scoped: the question is about the CALLER's own account,
 * which is the same identity `DELETE /api/profile/delete` acts on. Nobody can ask it about anybody
 * else, and a caller who owns nothing gets `ownsOrganization: false` rather than an error — that is
 * the answer, not a failure.
 *
 * Read-only, so it is also safe to call before the user has committed to anything: the picker and
 * the warning are both rendered from it while the account is still very much alive.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const impact = await describeOwnerDeletionImpact(session.user.id);
    return NextResponse.json(impact);
  } catch (error) {
    console.error("[profile/delete-impact] failed", error);
    return NextResponse.json(
      { error: "Could not read the deletion impact." },
      { status: 500 },
    );
  }
}
