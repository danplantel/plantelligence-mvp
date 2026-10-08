import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { listOrganizationDisclosureLedger } from "@/lib/organization-disclosures.server";

/**
 * GET /api/organization/disclosures-ledger → the disclosure revision ledger.
 *
 * Every immutable disclosure revision plus the confirmation (attestation) that
 * covers it, newest first. Drives Settings › Organization › Disclaimers' ledger.
 * A viewer who may not review receives the status only, with no entries.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ledger = await listOrganizationDisclosureLedger(session.user.id);
  return NextResponse.json(ledger);
}
