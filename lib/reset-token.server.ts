import jwt from "jsonwebtoken";

/**
 * Short-lived proof that an email address completed the verification-code step.
 *
 * The reset password endpoint must never accept an email on its own — without
 * this token, the verification step is bypassable with a direct POST.
 */
const RESET_TOKEN_TTL = "10m";

function secret(): string | null {
  return (
    process.env.RESET_PASSWORD_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    null
  );
}

export function createResetToken(email: string): string {
  const key = secret();
  if (!key) {
    throw new Error("No secret configured for password-reset tokens");
  }

  return jwt.sign(
    { email: email.trim().toLowerCase(), purpose: "password-reset" },
    key,
    { expiresIn: RESET_TOKEN_TTL },
  );
}

/**
 * Returns the verified email, or null for a missing, malformed, expired, or
 * wrong-purpose token.
 */
export function verifyResetToken(token: unknown): string | null {
  const key = secret();
  if (!key || typeof token !== "string" || !token.trim()) return null;

  try {
    const payload = jwt.verify(token, key);
    if (
      typeof payload !== "object" ||
      payload === null ||
      payload.purpose !== "password-reset" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return payload.email.trim().toLowerCase();
  } catch {
    return null;
  }
}
