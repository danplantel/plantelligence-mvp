export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  acceptInvitation,
  loadInvitation,
  type InvitationStatus,
} from "@/lib/teammates/invite-acceptance.server";

/**
 * T9 — the invitee's side of an invitation.
 *
 * Both verbs are **public on purpose**: the whole point is that this is the first thing
 * an invited collaborator can reach before they have an account. There is no session to
 * check, so the token is the credential — and the service re-reads the profile rather
 * than trusting it (see `invite-acceptance.server.ts`).
 *
 * The status vocabulary is shared between GET and POST so the page has one thing to
 * render, and the HTTP code carries the same meaning for anyone hitting the API directly:
 *   200 ok · 400 invalid · 409 already accepted · 410 expired, revoked or deactivated.
 */

/** Meaning per status, in one place so the page and the API cannot disagree. */
const STATUS_COPY: Record<InvitationStatus, string> = {
  ok: "This invitation is ready to accept.",
  invalid: "This invitation link is not valid. Ask the person who invited you for a new one.",
  expired:
    "This invitation has expired. Invitations are valid for 14 days — ask for a new one.",
  already_accepted:
    "This invitation has already been accepted. Sign in to continue.",
  deactivated:
    "Access for this invitation has been switched off by the organization.",
  revoked:
    "This invitation is no longer active. It may have been withdrawn, or the invitation was never sent.",
};

function statusCode(status: InvitationStatus): number {
  switch (status) {
    case "ok":
      return 200;
    case "invalid":
      return 400;
    case "already_accepted":
      return 409;
    default:
      return 410;
  }
}

/**
 * Best-effort throttle on the accept endpoint.
 *
 * Deliberately described as best-effort: this is an in-process Map, so it does not
 * survive a restart and is per-instance on a serverless deployment. It exists to blunt a
 * scripted guessing run against a signed token, not to be a rate-limit guarantee. A
 * durable limiter belongs in shared infrastructure this module does not have.
 */
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;
const attempts = new Map<string, number[]>();

function isThrottled(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter(
    (at) => now - at < ATTEMPT_WINDOW_MS,
  );
  recent.push(now);
  attempts.set(ip, recent);
  // Opportunistic cleanup so the Map cannot grow without bound.
  if (attempts.size > 500) {
    for (const [key, value] of attempts) {
      if (value.every((at) => now - at >= ATTEMPT_WINDOW_MS)) attempts.delete(key);
    }
  }
  return recent.length > MAX_ATTEMPTS;
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** GET → what is being offered, and whether it is still redeemable. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const view = await loadInvitation(token);
  return NextResponse.json(
    { status: view.status, message: STATUS_COPY[view.status], invitation: view },
    { status: statusCode(view.status) },
  );
}

/** POST → redeem it: create or reuse the login, link it, move the profile to `active`. */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    if (isThrottled(ip)) {
      return NextResponse.json(
        { status: "invalid", message: "Too many attempts. Try again shortly." },
        { status: 429 },
      );
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body.token !== "string" || !body.token.trim()) {
      return NextResponse.json(
        { status: "invalid", message: STATUS_COPY.invalid },
        { status: 400 },
      );
    }

    const result = await acceptInvitation({
      token: body.token,
      name: typeof body.name === "string" ? body.name : null,
      password: typeof body.password === "string" ? body.password : null,
    });

    if (!result.ok) {
      return NextResponse.json(
        { status: result.status, message: STATUS_COPY[result.status] },
        { status: statusCode(result.status) },
      );
    }

    return NextResponse.json({
      status: "accepted",
      createdAccount: result.createdAccount,
      email: result.email,
      landingUrl: result.landingUrl,
    });
  } catch (error) {
    // A short password is a user-fixable refusal, not a server fault.
    const status = (error as { status?: number }).status;
    const code = (error as { code?: string }).code;
    if (status === 400 && code) {
      return NextResponse.json(
        { status: "invalid", code, message: (error as Error).message },
        { status: 400 },
      );
    }
    console.error("[teammates/accept-invite]", error);
    return NextResponse.json(
      { status: "invalid", message: "Could not accept this invitation." },
      { status: 500 },
    );
  }
}
