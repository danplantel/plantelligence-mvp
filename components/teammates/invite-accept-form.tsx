"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviterFirmLabel } from "@/lib/teammates/invite-copy";

interface InvitationView {
  status:
    | "ok"
    | "invalid"
    | "expired"
    | "already_accepted"
    | "deactivated"
    | "revoked";
  email?: string;
  inviterName?: string | null;
  organizationName?: string | null;
  planName?: string | null;
  sectionName?: string | null;
  personType?: "team_member" | "collaborator";
  accountExists?: boolean;
  landingUrl?: string;
}

/**
 * T9 — accepting an invitation.
 *
 * Three things this form is careful about:
 *
 *  1. **It shows what is being asked before asking for anything.** An external person
 *     who has never heard of the product should see who invited them, which organization,
 *     and which plan and section — before typing a password.
 *  2. **The email is fixed.** It is displayed, not editable: the invitation is for one
 *     mailbox, and letting the field be changed would let an invite be redeemed by a
 *     different account than the one it was addressed to.
 *  3. **Linking is not access.** Accepting links a login to the profile; it grants the
 *     person nothing until they can actually sign in as that account. That is why an
 *     existing account keeps its own password and is never overwritten here — the
 *     security boundary is the account, not the link.
 */
export function InviteAcceptForm({ token }: { token: string }) {
  const [view, setView] = useState<InvitationView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<{
    landingUrl: string;
    email: string;
    createdAccount: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/teammates/accept-invite?token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => ({}))) as {
        invitation?: InvitationView;
        status?: InvitationView["status"];
        message?: string;
      };
      setView(
        body.invitation ??
          ({ status: body.status ?? "invalid" } as InvitationView),
      );
      setError(body.invitation?.status === "ok" ? null : body.message ?? null);
    } catch {
      setView({ status: "invalid" });
      setError("Could not load this invitation.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!view) return;
    if (!view.accountExists && password.trim().length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/teammates/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim() || null, password }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        status?: string;
        email?: string;
        landingUrl?: string;
        createdAccount?: boolean;
        message?: string;
      };
      if (!response.ok || body.status !== "accepted") {
        setError(body.message ?? "Could not accept this invitation.");
        return;
      }
      setAccepted({
        landingUrl: body.landingUrl ?? "/benefits",
        email: body.email ?? view.email ?? "",
        createdAccount: Boolean(body.createdAccount),
      });
    } catch {
      setError("Could not accept this invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading invitation…
        </CardContent>
      </Card>
    );
  }

  // ── Accepted ────────────────────────────────────────────────────────────────
  if (accepted) {
    const signInUrl = `/signin?callbackUrl=${encodeURIComponent(accepted.landingUrl)}`;
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Check className="h-5 w-5 text-emerald-500" />
            You&rsquo;re set up
          </CardTitle>
          <CardDescription>
            {accepted.createdAccount
              ? `Your account is ready for ${accepted.email}.`
              : `${accepted.email} is already registered — your access has been connected to it.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in with your password to see the plan you were invited to.
          </p>
          <Button asChild className="w-full">
            <Link href={signInUrl}>Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Anything that is not redeemable ─────────────────────────────────────────
  if (!view || view.status !== "ok") {
    const isAccepted = view?.status === "already_accepted";
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {isAccepted ? "Already accepted" : "This invitation can’t be used"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error ??
              "Ask the person who invited you to send a new invitation."}
          </p>
          {isAccepted ? (
            <Button asChild className="w-full">
              <Link href="/signin">Sign in</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // ── Redeemable ──────────────────────────────────────────────────────────────
  //
  // The firm is named only when it adds something. A solo advisor's organization mirrors
  // their own `User` row, so naming it unconditionally produced "Eddie Taliaferro invited
  // you on behalf of Eddie Taliaferro to help with …". `inviterFirmLabel` is the same rule
  // the invitation email applies, so the two cannot word one invitation differently.
  const inviterFirm = inviterFirmLabel(view.inviterName, view.organizationName);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">You&rsquo;ve been invited</CardTitle>
        <CardDescription>
          {view.inviterName
            ? `${view.inviterName} invited you`
            : "You have been invited"}
          {inviterFirm ? ` on behalf of ${inviterFirm}` : ""}
          {view.planName ? ` to help with ${view.planName}` : ""}
          {view.sectionName ? ` — ${view.sectionName}.` : "."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="invite-email"
              value={view.email ?? ""}
              readOnly
              disabled
              className="pl-9"
            />
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            This invitation is for this address, so it can&rsquo;t be changed here.
          </p>
        </div>

        {view.accountExists ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            You already have an account with this address. Accepting connects your
            access to it and keeps your existing password.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="invite-name">
                Your name{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password">Choose a password</Label>
              <Input
                id="invite-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          </>
        )}

        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <Button
          className="w-full"
          onClick={() => void submit()}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          {view.accountExists ? "Accept and continue" : "Accept invitation"}
        </Button>

        <p className="text-[11px] text-muted-foreground">
          You can never publish, invite, delete, or see organization settings.
        </p>
      </CardContent>
    </Card>
  );
}
