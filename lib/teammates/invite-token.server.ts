/**
 * invite-token.server — the signed token behind T9 (invite acceptance).
 *
 * The invitation email needs a link that proves "you are the person this invite was
 * for" **before** the invitee has an account. Until T9 the email carried no token at
 * all, so an invitee had nothing to redeem: the link pointed at an authenticated
 * dashboard route and a collaborator simply hit the sign-in wall.
 *
 * Design: HMAC-SHA256 over the payload, signed with `NEXTAUTH_SECRET`.
 *
 *  - **No schema change.** A stored random token would need `inviteTokenHash` +
 *    `inviteTokenExpiresAt` on `TeammateProfile`, a write on every invite, and the
 *    Mongo null-handling this module has already been bitten by (see the docs' notes on
 *    `{ field: null }` never matching absent fields).
 *  - **It expires with the invite, not on its own clock.** `INVITE_SEAT_HOLD_DAYS` is
 *    already the window in which an unaccepted invite holds a seat and after which
 *    `expireStaleInvites` returns the profile to `contact`. One concept rather than two:
 *    the token is dead exactly when the invite is.
 *  - **Revocation needs no bookkeeping.** The rule is *don't trust the token, trust the
 *    profile* — the caller must re-load the profile and refuse unless it is still
 *    `invited` and not deactivated. Remove the assignment, deactivate the person, or let
 *    the hold lapse, and the token stops working with nothing to clean up.
 *  - **Effectively single-use:** the first acceptance moves the state to `active`, so a
 *    replay fails that same state check.
 *
 * The token is not a capability to act *as* the person and grants nothing on its own: it
 * only permits moving one specific profile from `invited` to `active`, and only for the
 * mailbox it was sent to. Callers must enforce the email match too, because the token
 * travels by email and a forwarded invite must not be redeemable by someone else.
 *
 * Server-only.
 */

import crypto from "node:crypto";
import { INVITE_SEAT_HOLD_DAYS } from "./seats.server";

export interface InviteTokenPayload {
  /** The `TeammateProfile` being invited. */
  profileId: string;
  organizationId: string;
  /** The invited address. The token is only redeemable for this mailbox. */
  email: string;
  /** Epoch ms — mirrors the invite's seat hold. */
  exp: number;
}

export type InviteTokenFailure = "malformed" | "bad_signature" | "expired";

export type InviteTokenResult =
  | { ok: true; payload: InviteTokenPayload }
  | { ok: false; reason: InviteTokenFailure };

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) {
    // Loud rather than silent: a token signed with an empty secret would appear to work
    // in dev and be forgeable everywhere.
    throw new Error(
      "[invite-token] NEXTAUTH_SECRET is required to sign invite tokens.",
    );
  }
  return value;
}

function signatureFor(segment: string): string {
  return crypto.createHmac("sha256", secret()).update(segment).digest("base64url");
}

/** When a token minted at `invitedAt` stops being valid — the same window as the seat hold. */
export function inviteTokenExpiry(invitedAt: Date): Date {
  return new Date(
    invitedAt.getTime() + INVITE_SEAT_HOLD_DAYS * 24 * 60 * 60 * 1000,
  );
}

/**
 * Mint the token for an invite. Deliberately derived from `invitedAt` rather than
 * `Date.now()`, so the token's window IS the invite's window rather than a second,
 * independently-drifting one.
 *
 * Worth being exact about the consequences, because they match the seat hold rather than
 * being a bug: re-inviting someone who is already `invited` does **not** move
 * `invitedAt` (see `inviteCollaboratorToPlan`, which only transitions `contact →
 * invited`), so it does not extend the window and does not extend the token. A new window
 * begins only when the transition happens — the first invite, or a re-invite after the
 * previous one lapsed back to `contact`.
 */
export function signInviteToken(input: {
  profileId: string;
  organizationId: string;
  email: string;
  invitedAt: Date;
}): string {
  const payload: InviteTokenPayload = {
    profileId: input.profileId,
    organizationId: input.organizationId,
    email: input.email.trim().toLowerCase(),
    exp: inviteTokenExpiry(input.invitedAt).getTime(),
  };
  const segment = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${segment}.${signatureFor(segment)}`;
}

/**
 * Compare two signatures without an early exit, so a mismatch cannot be timed to learn
 * the expected value byte by byte.
 *
 * Written over UTF-8 bytes rather than `crypto.timingSafeEqual`, which takes
 * `ArrayBufferView` and objects to a Node `Buffer` under this project's type setup. The
 * length check is not secret — both signatures are base64url of a SHA-256 digest, so a
 * length difference only means the input was malformed.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let index = 0; index < aBytes.length; index += 1) {
    diff |= aBytes[index] ^ bBytes[index];
  }
  return diff === 0;
}

/**
 * Verify a token's signature and expiry.
 *
 * Says nothing about whether the invite is still *usable* — that needs the profile, and
 * every caller must load it. This function is the cheap half of the check.
 */
export function verifyInviteToken(token: string): InviteTokenResult {
  const raw = (token ?? "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "malformed" };
  }

  const [segment, provided] = parts;
  const expected = signatureFor(segment);

  if (!constantTimeEqual(provided, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: InviteTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8"),
    ) as InviteTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    !payload ||
    typeof payload.profileId !== "string" ||
    typeof payload.organizationId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (Date.now() >= payload.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}

/** The link the invite email leads with. */
export function inviteAcceptUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/accept-invite/${encodeURIComponent(token)}`;
}
