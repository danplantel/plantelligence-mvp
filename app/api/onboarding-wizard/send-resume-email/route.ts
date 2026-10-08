import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { sendOnboardingResumeEmail } from "@/lib/email";
import { createOnboardingResumeToken } from "@/lib/onboarding-resume-token.server";

/**
 * Send the [MEDIUM] onboarding "resume on a computer" email.
 *
 * Triggered from the client when a signed-in user opens `/onboarding` below the
 * desktop breakpoint (see `DesktopOnlyGate`). Best-effort: the caller ignores
 * failures, and client-side throttling keeps it to one send per account per day.
 *
 * This route lives under `/api`, so the auth + onboarding middleware does not
 * gate it — the session check below is the only guard.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    const userId = session?.user?.id;

    if (!email || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A signed, expiring token makes the emailed link open the wizard directly
    // (it establishes the session), instead of bouncing through sign-in.
    const token = await createOnboardingResumeToken(userId);
    const resumeUrl = new URL(
      `/api/onboarding-wizard/resume?token=${encodeURIComponent(token)}`,
      request.url,
    ).toString();

    await sendOnboardingResumeEmail(email, resumeUrl);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sending onboarding resume email:", error);
    return NextResponse.json(
      { error: "Failed to send resume email" },
      { status: 500 },
    );
  }
}
