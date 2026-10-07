import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { sendOnboardingResumeEmail } from "@/lib/email";

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

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build the resume link from the request origin so it works across
    // environments (localhost, preview deploys, production).
    const resumeUrl = new URL("/onboarding", request.url).toString();

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
