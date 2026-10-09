"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Headshot } from "@/components/ui/headshot";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INVITABLE_TEAM_ROLES } from "@/components/teammates/access-fields";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import {
  PRESET_ROLE_LABELS,
  type TeammateAssignmentRole,
} from "@/types/teammate";
import type { TeamInvite } from "@/types/wizard";

/**
 * Step 5c — Invite Your Team.
 *
 * Shown only when the organization's team size is above "Just me" (the wizard's
 * sub-stepper gates it; a "Just me" org skips straight from 5b and can invite
 * anyone later from Settings › People & Access). There is deliberately NO
 * complete-it-yourself ("Add") path here — invites only.
 *
 * This is a pure STAGING screen: the row list is the single source of truth for
 * "who you will invite". Nothing is emailed until the footer's "Send Invites &
 * Finish", so there is no second list and no Resend/cancel — the tracked,
 * resendable view of pending members lives in Settings › People & Access.
 *
 * SEATS. Only Team Members hold a seat, and the owner is the first one
 * (`OWNER_CONSUMES_SEAT` in `lib/teammates/seats.server.ts`). The allowance is
 * `Organization.seatsIncluded` (5 by default until billing exists), so a fresh
 * organization shows the owner plus four OPEN seats — and this step accepts at
 * most that many invites. The cap is a staging limit, not a hard block: the
 * upgrade path to a bigger allowance stays in Settings › People & Access, where
 * T3's over-limit upgrade confirm lives.
 *
 * The list grows by typing into a trailing blank row (no "Add" button); a row is
 * only an invite once it carries input, and must have both a Name and a valid,
 * unique Email that is not the advisor's own address.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors `DEFAULT_SEATS_INCLUDED` in `lib/teammates/seats.server.ts`. */
const DEFAULT_SEATS_INCLUDED = 5;

function blankInvite(): TeamInvite {
  return {
    id: `invite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: "",
    email: "",
    // Everyone joins as an Editor unless the advisor picks another role.
    role: "editor",
    status: "pending",
  };
}

function isBlankInvite(row: TeamInvite): boolean {
  return row.fullName.trim() === "" && row.email.trim() === "";
}

/** First word of a name, for the small label under a staged seat. */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/**
 * Name and Email are validated SEPARATELY so a field only ever reddens itself.
 * A row with any input must have both, but the Name field must not flag the
 * Email field (and vice versa) just because its sibling is momentarily empty
 * while the advisor types.
 */
function nameError(row: TeamInvite): string | null {
  if (isBlankInvite(row)) return null;
  return row.fullName.trim() === "" ? "Add the teammate’s name." : null;
}

function emailError(
  row: TeamInvite,
  allRows: TeamInvite[],
  selfEmail: string | null,
): string | null {
  if (isBlankInvite(row)) return null;
  const email = row.email.trim();
  if (!email) return "Add the teammate’s email.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  if (selfEmail && email.toLowerCase() === selfEmail.toLowerCase()) {
    return "That’s your own email — you’re already on the team.";
  }
  const duplicate = allRows.some(
    (other) =>
      other.id !== row.id &&
      other.email.trim().toLowerCase() === email.toLowerCase(),
  );
  if (duplicate) return "This email is already in the list.";
  return null;
}

/** Combined row validity — used for the footer's disabled state. */
function inviteRowError(
  row: TeamInvite,
  allRows: TeamInvite[],
  selfEmail: string | null,
): string | null {
  return nameError(row) ?? emailError(row, allRows, selfEmail);
}

interface Step5cTeamProps {
  errorFields?: string[];
  onValidationChange?: (isValid: boolean) => void;
}

interface SeatMeter {
  seatsUsed: number;
  seatsIncluded: number;
  hasSeatLimit: boolean;
}

export function Step5cTeam({
  errorFields = [],
  onValidationChange,
}: Step5cTeamProps) {
  const { data: session } = useSession();
  const rows = useOnboardingWizardStore((s) => s.teamInvites);
  const setTeamInvites = useOnboardingWizardStore((s) => s.setTeamInvites);
  const ownerName = useOnboardingWizardStore(
    (s) => s.stepData.userSetup?.name ?? "",
  );
  const ownerHeadshot = useOnboardingWizardStore(
    (s) => s.stepData.userSetup?.headshot ?? null,
  );

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [seatMeter, setSeatMeter] = useState<SeatMeter | null>(null);

  const selfEmail = session?.user?.email ?? null;

  // Seat display (rule 7 / T3): read the meter so the open-seat count and the
  // invite cap come from the server, never a hard-coded 4.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/teammates/seats", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as {
          seats?: {
            seatsUsed?: number;
            seatsIncluded?: number | null;
            hasSeatLimit?: boolean;
          };
        };
        if (cancelled || !body.seats) return;
        setSeatMeter({
          seatsUsed: body.seats.seatsUsed ?? 0,
          seatsIncluded: body.seats.seatsIncluded ?? DEFAULT_SEATS_INCLUDED,
          hasSeatLimit: body.seats.hasSeatLimit === true,
        });
      } catch {
        // Best-effort; the strip falls back to the default allowance.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Open seats = the allowance minus what's already held (the owner, plus any
  // already-seated members). This is also the invite cap for this step.
  const openSeats = seatMeter
    ? Math.max(0, seatMeter.seatsIncluded - seatMeter.seatsUsed)
    : Math.max(1, DEFAULT_SEATS_INCLUDED - 1);
  const otherSeated = seatMeter ? Math.max(0, seatMeter.seatsUsed - 1) : 0;

  // Invite rows that already have a Name fill a seat, showing that person's
  // initials — the seat strip previews the team as it is typed. Capped at the
  // open-seat count; the rest stay as open placeholders.
  const stagedSeats = rows
    .filter((row) => row.fullName.trim() !== "")
    .slice(0, openSeats);
  const remainingOpenSeats = Math.max(0, openSeats - stagedSeats.length);

  const filledCount = useMemo(
    () => rows.filter((row) => !isBlankInvite(row)).length,
    [rows],
  );

  // Keep exactly one trailing blank row, but only while there is a seat left to
  // fill. At the cap the blank row is dropped, so the list simply cannot grow
  // past the allowance. Duplicate trailing blanks (from a cleared row) collapse.
  useEffect(() => {
    let next = rows;
    let end = next.length;
    while (
      end > 1 &&
      isBlankInvite(next[end - 1]) &&
      isBlankInvite(next[end - 2])
    ) {
      end -= 1;
    }
    if (end !== next.length) next = next.slice(0, end);

    const filled = next.filter((row) => !isBlankInvite(row)).length;
    const hasTrailingBlank =
      next.length > 0 && isBlankInvite(next[next.length - 1]);
    if (filled < openSeats && !hasTrailingBlank) {
      next = [...next, blankInvite()];
    } else if (filled >= openSeats && hasTrailingBlank) {
      next = next.slice(0, -1);
    }

    if (next !== rows) setTeamInvites(next);
  }, [rows, setTeamInvites, openSeats]);

  const updateRow = (id: string, field: "fullName" | "email", value: string) =>
    setTeamInvites(
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );

  const updateRole = (id: string, role: TeammateAssignmentRole) =>
    setTeamInvites(rows.map((row) => (row.id === id ? { ...row, role } : row)));

  const removeRow = (id: string) =>
    setTeamInvites(rows.filter((row) => row.id !== id));

  // Touch is tracked PER FIELD (`<rowId>:name` / `<rowId>:email`) so validating
  // one field never paints the other.
  const markTouched = (id: string, field: "name" | "email") =>
    setTouched((prev) => {
      const key = `${id}:${field}`;
      return prev[key] ? prev : { ...prev, [key]: true };
    });

  // Valid when every row that carries input is complete and unique.
  const isValid = useMemo(
    () => rows.every((row) => inviteRowError(row, rows, selfEmail) === null),
    [rows, selfEmail],
  );

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const forceErrors = errorFields.includes("teamInvites");
  const showNameError = (row: TeamInvite) =>
    nameError(row) !== null && (touched[`${row.id}:name`] || forceErrors);
  const showEmailError = (row: TeamInvite) =>
    emailError(row, rows, selfEmail) !== null &&
    (touched[`${row.id}:email`] || forceErrors);

  const atCap = openSeats > 0 && filledCount >= openSeats;

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-field="teamInvites">
      {/* Title + helper */}
      <div className="text-left space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Invite Your Team
        </h2>
        <p className="text-sm text-muted-foreground">
          Invite teammates from your organization. They’ll get an email to set
          up their own profile, and they share your organization’s branding and
          settings. Pick each person’s role now — you can change it anytime in
          Settings › People & Access.
        </p>
      </div>

      {/* Seat visualization — the owner, any already-seated members, then the
          open seats an invite can fill. Mirrors the dashboard team row and the
          Settings seat cards. */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-accent-blue" />
          <span className="text-sm font-semibold dark:text-gray-100">
            Team Members
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {seatMeter
              ? `${seatMeter.seatsUsed} of ${seatMeter.seatsIncluded} seats used`
              : "Loading seats…"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Owner — the account going through onboarding. */}
          <span className="flex flex-col items-center gap-1">
            <span className="size-10 overflow-hidden rounded-full border-2 border-accent-blue bg-muted">
              <Headshot
                src={ownerHeadshot ?? undefined}
                monogramName={ownerName || selfEmail || "Owner"}
                alt={ownerName || "Owner"}
              />
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              Owner
            </span>
          </span>

          {/* Any member already holding a seat (none on a first pass). */}
          {Array.from({ length: otherSeated }).map((_, index) => (
            <span
              key={`seated-${index}`}
              className="size-10 rounded-full border border-border bg-muted"
              title="Team Member"
            />
          ))}

          {/* Invites being staged — a filled seat per named row, initials-first. */}
          {stagedSeats.map((row) => (
            <span
              key={row.id}
              className="flex flex-col items-center gap-1"
              title={row.fullName.trim()}
            >
              <span className="size-10 overflow-hidden rounded-full border border-border bg-muted">
                <Headshot
                  monogramName={row.fullName.trim()}
                  alt={row.fullName.trim()}
                />
              </span>
              <span className="max-w-[3.5rem] truncate text-[10px] font-medium text-muted-foreground">
                {firstNameOf(row.fullName)}
              </span>
            </span>
          ))}

          {/* Still-open seats — the invites this step can still send. */}
          {Array.from({ length: remainingOpenSeats }).map((_, index) => (
            <span
              key={`open-${index}`}
              title="Open seat"
              className="flex size-10 items-center justify-center rounded-full border border-dashed text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
            </span>
          ))}
        </div>
      </div>

      {/* Invite rows — the list grows as you type while a seat remains. */}
      <div className="space-y-3">
        {rows.map((row) => {
          const nameErr = showNameError(row) ? nameError(row) : null;
          const emailErr = showEmailError(row)
            ? emailError(row, rows, selfEmail)
            : null;
          const canRemove = !isBlankInvite(row);
          return (
            <div key={row.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  value={row.fullName}
                  onChange={(e) => updateRow(row.id, "fullName", e.target.value)}
                  onBlur={() => markTouched(row.id, "name")}
                  placeholder="Full name"
                  aria-label="Full name"
                  aria-invalid={!!nameErr}
                  className={`dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 ${
                    nameErr
                      ? "border-red-500 focus-visible:ring-red-500 dark:border-red-500"
                      : ""
                  }`}
                />
                {nameErr && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {nameErr}
                  </p>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  type="email"
                  value={row.email}
                  onChange={(e) => updateRow(row.id, "email", e.target.value)}
                  onBlur={() => markTouched(row.id, "email")}
                  placeholder="name@company.com"
                  aria-label="Email"
                  aria-invalid={!!emailErr}
                  className={`dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 ${
                    emailErr
                      ? "border-red-500 focus-visible:ring-red-500 dark:border-red-500"
                      : ""
                  }`}
                />
                {emailErr && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {emailErr}
                  </p>
                )}
              </div>

              {/* The role this person joins with. Owner is not offered — an invite can
                  grant Admin, Editor or Viewer (see INVITABLE_TEAM_ROLES). */}
              <div className="w-32 shrink-0 space-y-1">
                <Select
                  value={row.role ?? "editor"}
                  onValueChange={(value) =>
                    updateRole(row.id, value as TeammateAssignmentRole)
                  }
                >
                  <SelectTrigger
                    aria-label="Role"
                    className="dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITABLE_TEAM_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {PRESET_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.id)}
                  className="mt-1 shrink-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                >
                  Remove
                </Button>
              )}
            </div>
          );
        })}

        {openSeats === 0 ? (
          <p className="text-xs text-muted-foreground">
            {"No seats are open right now. You can add Team Members in Settings > People & Access and assign their roles there."}
          </p>
        ) : atCap ? (
          <p className="text-xs text-muted-foreground">
            {`All ${openSeats} of your open seats are filled. You can add or change Team Members in Settings > People & Access and assign their roles there.`}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {`You can invite up to ${openSeats} ${
              openSeats === 1 ? "teammate" : "teammates"
            } now. We’ll email each of them an invite link when you finish. Pick a role for each person — you can change it anytime in Settings > People & Access.`}
          </p>
        )}
      </div>
    </div>
  );
}
