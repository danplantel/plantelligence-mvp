import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { sendOnboardingResumeEmail } from "@/lib/email";
import { createOnboardingResumeToken } from "@/lib/onboarding-resume-token.server";

/**
 * Public, UNAUTHENTICATED "email me a link to continue setup".
 *
 * A user who left mid-onboarding (and lost their browser/session state) can ask
 * for a resume link from the sign-in / sign-up pages.
 *
 * Privacy: this ALWAYS returns `200 { ok: true }`, whether or not the address
 * exists and whether or not it has an unfinished onboarding — so it cannot be
 * used to enumerate accounts. When an unfinished wizard session DOES exist, the
 * existing resume email is sent; the recipient still signs in to open the link
 * (the link points at `/onboarding`, which restores their exact step).
 *
 * Lives under `/api`, so the auth + onboarding middleware does not gate it.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body?.email === "string" ? body.email.trim() : "";

    if (email) {
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, email: true },
      });

      if (user) {
        const unfinished = await prisma.wizardSession.findFirst({
          where: { userId: user.id, completed: false },
          select: { id: true },
        });

        if (unfinished) {
          const token = await createOnboardingResumeToken(user.id);
          const resumeUrl = new URL(
            `/api/onboarding-wizard/resume?token=${encodeURIComponent(token)}`,
            request.url,
          ).toString();
          try {
            await sendOnboardingResumeEmail(user.email, resumeUrl);
          } catch (error) {
            // Swallow: the caller must not learn whether a send happened.
            console.error("Failed to send onboarding resume email:", error);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error handling request-resume-link:", error);
    // Still a neutral success — never leak whether the address exists.
    return NextResponse.json({ ok: true });
  }
}
