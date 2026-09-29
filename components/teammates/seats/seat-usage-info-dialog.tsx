"use client";

/**
 * "How seats work" — the explanation behind the seat count.
 *
 * Extracted from `components/pages/settings/team-members-section.tsx` so the dashboard's
 * seats card and the Settings seats panel can show the *same* explanation. There is one
 * implementation on purpose: this copy is the only place the rules are written in prose, and
 * two copies would drift from each other and from the server.
 *
 * Every rule below is one the server actually enforces in
 * [`lib/teammates/seats.server.ts`](lib/teammates/seats.server.ts) — the 14-day invite hold
 * (`INVITE_SEAT_HOLD_DAYS`), the owner's seat (`OWNER_CONSUMES_SEAT`), and confirm-instead-of-
 * block at the limit (`assertSeatAvailable`) — and the figures come from the same
 * `getSeatUsage` payload the meter renders, so the explanation cannot drift from the numbers.
 */

import { useState } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SeatUsageSummary } from "@/components/pages/seat-meter";

export interface SeatUsageInfoDialogProps {
  seats: SeatUsageSummary;
  /** Display name of the ORGANIZATION owner, for the reserved-seat rule. */
  ownerName: string | null;
  /** True only when the signed-in user is that owner. */
  viewerIsOwner: boolean;
}

export function SeatUsageInfoDialog({
  seats,
  ownerName,
  viewerIsOwner,
}: SeatUsageInfoDialogProps) {
  const [open, setOpen] = useState(false);

  const countLabel = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`;

  const stats: { label: string; value: string }[] = [
    { label: "Seats used", value: `${seats.seatsUsed} of ${seats.seatsIncluded}` },
    { label: "Active members", value: countLabel(seats.seatsActive, "member") },
    { label: "Pending invites", value: String(seats.seatsPending) },
    { label: "Available", value: countLabel(seats.seatsAvailable, "seat") },
  ];

  /**
   * The reserved seat belongs to the ORGANIZATION's owner (`Organization.ownerUserId` — see
   * `OWNER_CONSUMES_SEAT` in seats.server.ts), not to whoever is reading the page. An Admin
   * reaches this without owning the organization, so "your own seat" would be a false
   * statement for them — and that matters more on the dashboard than in Settings, because
   * the dashboard is the more casually-browsed surface of the two. All three variants are
   * true for their reader; only the second person changes.
   */
  const ownerSeatRule = viewerIsOwner
    ? {
        title: "Your own seat is counted",
        body: "You are the organization owner and always the first Team Member, so one seat is always in use.",
      }
    : ownerName
      ? {
          title: "The owner's seat is always counted",
          body: `${ownerName} is the organization owner and always the first Team Member, so one seat is always in use.`,
        }
      : {
          title: "One seat is reserved for the organization owner",
          body: "The owner is always the first Team Member, so one seat is always in use.",
        };

  const rules: { title: string; body: string }[] = [
    {
      title: "Only Team Members hold a seat",
      body: "A Collaborator gets the same plan and category access without using one — they are listed under Collaborators and never counted here.",
    },
    ownerSeatRule,
    {
      title: "An invite reserves a seat for 14 days",
      body: "It shows as a pending invite. If it is not accepted in that window the hold is released automatically and the person returns to a Contact — their profile and history are kept.",
    },
    {
      title: "Deactivating someone frees their seat",
      body: "The profile is kept, so their past work stays attributable.",
    },
    {
      title: "At the limit you are not blocked",
      body: "Adding another Team Member asks you to confirm an upgrade instead of failing, and confirming raises your allowance by one. Only an Owner or Admin can confirm.",
    },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 rounded-full"
        aria-label="How seats are used"
        title="How seats are used"
        onClick={() => setOpen(true)}
      >
        <Info className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>How seats work</DialogTitle>
            <DialogDescription>
              Only Team Members use seats. Contacts and Collaborators are free.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-muted/40 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>

          {seats.atLimit ? (
            <p className="rounded-lg border border-amber-400/60 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
              You are at your limit — {seats.seatsUsed} of {seats.seatsIncluded}{" "}
              seats used. The next Team Member starts an upgrade.
            </p>
          ) : null}

          <ul className="space-y-3">
            {rules.map((rule) => (
              <li key={rule.title} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />
                <span className="text-sm">
                  <span className="font-medium">{rule.title}.</span>{" "}
                  <span className="text-muted-foreground">{rule.body}</span>
                </span>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
