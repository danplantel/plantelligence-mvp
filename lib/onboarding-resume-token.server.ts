import { encode, decode } from "next-auth/jwt";

/**
 * Signed, expiring "resume onboarding" token (a magic-link credential).
 *
 * The resume email links to `/api/onboarding-wizard/resume?token=…`. That route
 * verifies this token, establishes the NextAuth session for the user, and
 * redirects to `/onboarding` — so the email's "Continue setup" button opens the
 * wizard directly instead of bouncing through the sign-in page.
 *
 * Security:
 *  - Signed with `NEXTAUTH_SECRET` (HMAC), so it cannot be forged.
 *  - Expires after 24 hours.
 *  - Carries a `purpose` claim so a token minted for another flow can never be
 *    replayed here.
 * It is a short-lived bearer credential delivered only to the account's own
 * email address; treat the email link like a password-reset link.
 */

const PURPOSE = "onboarding-resume";

/** How long a resume link stays valid. */
export const ONBOARDING_RESUME_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24; // 24h

function jwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

/** Mint a resume token for a user id. */
export async function createOnboardingResumeToken(
  userId: string,
): Promise<string> {
  return encode({
    token: { sub: userId, id: userId, purpose: PURPOSE },
    secret: jwtSecret(),
    maxAge: ONBOARDING_RESUME_TOKEN_MAX_AGE_SECONDS,
  });
}

/**
 * Verify a resume token. Returns the user id it was minted for, or null when
 * the token is missing, malformed, expired, or minted for another purpose.
 */
export async function verifyOnboardingResumeToken(
  token: string | null | undefined,
): Promise<string | null> {
  if (!token) return null;
  try {
    const payload = await decode({ token, secret: jwtSecret() });
    if (!payload) return null;
    if ((payload as { purpose?: string }).purpose !== PURPOSE) return null;
    const userId =
      (payload.id as string | undefined) ??
      (payload.sub as string | undefined);
    return userId ?? null;
  } catch {
    return null;
  }
}
