import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

import prisma from "@/lib/prisma";
import { verifyOnboardingResumeToken } from "@/lib/onboarding-resume-token.server";

/** Session lifetime, mirroring `authOptions.session.maxAge` (8 hours). */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const isProd = process.env.NODE_ENV === "production";
/** Must match `authOptions.cookies.sessionToken.name` exactly. */
const SESSION_COOKIE_NAME = isProd
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

/**
 * Email "Continue setup" landing route.
 *
 *   GET /api/onboarding-wizard/resume?token=…
 *
 * Verifies the signed resume token, establishes the NextAuth session for that
 * user, and redirects to `/onboarding` (which restores their exact step). An
 * invalid/expired token falls back to the normal sign-in flow. The token is not
 * echoed into the redirect, so it does not linger in the address bar.
 *
 * Lives under `/api`, so the auth + onboarding middleware does not gate it.
 */
export async function GET(request: Request) {
  const fallback = NextResponse.redirect(
    new URL("/signin?callbackUrl=%2Fonboarding", request.url),
  );

  const { searchParams } = new URL(request.url);
  const userId = await verifyOnboardingResumeToken(searchParams.get("token"));

  const secret = process.env.NEXTAUTH_SECRET;
  if (!userId || !secret) return fallback;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return fallback;

  // Mint a session JWT and set it as the NextAuth session cookie. The jwt
  // callback backfills organization/onboarding fields on first session read.
  const sessionToken = await encode({
    token: {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      provider: "onboarding-resume",
    },
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const response = NextResponse.redirect(
    new URL("/onboarding", request.url),
  );
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProd,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
