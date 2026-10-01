"use client";

import { useEffect, useState } from "react";
import { Armchair, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
// The SAME access picker Settings → People & Access uses, so the two surfaces offer one
// set of controls and cannot drift into offering different roles or scopes.
import {
  AccessFields,
  EMPTY_ACCESS,
  categoriesForAccess,
  type AccessDraft,
  type PlanOption,
} from "@/components/teammates/access-fields";
import type { SeatUsageSummary } from "@/components/pages/seat-meter";
import { cn } from "@/lib/utils";
import type { KeyContact } from "@/types/new-client-wizard";

/**
 * "Give Team Seat" — promote a plan Contact into one of the organization's paid Team
 * Member seats.
 *
 * This is deliberately NOT the Invite Collaborator flow that sits beside it. A
 * Collaborator is external and free; a Team Member consumes a seat, appears in
 * Settings → People & Access, and is emailed an invitation. A seat has a cost, so
 * nothing is written until the advisor has read exactly what is being granted.
 *
 * It posts to the same endpoint the People & Access tab uses
 * (`POST /api/teammates/team`) with the same access picker, so a person added here and a
 * person added there are the same thing, granted the same way, by the same rules engine.
 */

/** The success half of the response. */
interface AddTeamMemberSuccess {
  member?: { profileId: string; state: string; assignmentCount: number };
  /** False when the invitation email was suppressed or could not be sent. */
  emailSent?: boolean;
  emailError?: string | null;
  seats?: SeatUsageSummary;
}

/** The failure half — `code` is what distinguishes the seat limit from a real error. */
interface ApiErrorBody {
  error?: string;
  code?: string;
}

export interface GiveTeamSeatDialogProps {
  /** The contact to promote. `null` keeps the dialog closed. */
  contact: KeyContact | null;
  onOpenChange: (open: boolean) => void;
  /** Runs after a successful add, so the caller can re-read what it displays. */
  onGranted?: () => void;
  /**
   * The Custom benefit this draft is creating (the wizard's Custom Category Name), when the
   * seat is being given from a Custom benefit.
   *
   * Passed down rather than read from the store here: it has no `Benefit` row yet, so the
   * organisation's own Custom title list does not contain it, and the access picker offers it
   * as its own pre-ticked row so the benefit being worked on is visibly among the grants.
   */
  currentCustomBenefit?: string | null;
}

/** The best name this contact shape can offer — the same precedence the card uses. */
function displayName(contact: KeyContact): string {
  const named = contact.displayName?.trim() || contact.name?.trim();
  if (named) return named;
  const parts = [contact.firstName, contact.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return parts || contact.email?.trim() || "This contact";
}

/** "1 seat" / "2 seats" — the wording the Settings seat meter already uses. */
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function GiveTeamSeatDialog({
  contact,
  onOpenChange,
  onGranted,
  currentCustomBenefit,
}: GiveTeamSeatDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  /**
   * Set from the server's 409 `seat_limit` refusal. It is NOT an error state: the
   * allowance can be raised, and confirming is what raises it — so it changes this
   * dialog's copy and its primary action rather than ending the attempt.
   */
  const [seatLimitMessage, setSeatLimitMessage] = useState<string | null>(null);
  /** Live seat headroom for the organization, or null when it cannot be read. */
  const [seats, setSeats] = useState<SeatUsageSummary | null>(null);
  /** Whether the seat read has finished, so the "not visible" note waits its turn. */
  const [seatsLoaded, setSeatsLoaded] = useState(false);
  /** The role and scope being granted, in the same shape People & Access edits. */
  const [access, setAccess] = useState<AccessDraft>(EMPTY_ACCESS);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  /** The organization's own Custom benefit titles, for the category picker. */
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const contactId = contact?.id ?? null;

  /**
   * Opening for a different contact starts clean — a seat-limit notice or a scope
   * inherited from the previous person would make the form claim something untrue, and
   * a leftover `isSaving` would leave the primary button disabled.
   *
   * Both reads are keyed on the same open edge. Seats are live (an invite accepted, or
   * released when its 14-day hold lapses, changes the answer) and the plan list decides
   * what "Certain Plans" can even offer, so fetching them once at page load would be
   * answering with a stale snapshot.
   */
  useEffect(() => {
    setSeatLimitMessage(null);
    setIsSaving(false);
    setSeats(null);
    setSeatsLoaded(false);
    setAccess({
      ...EMPTY_ACCESS,
      // The benefit this seat is being given for is ticked from the start. Everything else
      // follows EMPTY_ACCESS (Editor / All Plans / All Categories), so the default grant is
      // unchanged: the tick becomes the effective scope once Benefits access is narrowed to
      // Certain categories, where it is waiting rather than needing to be found.
      categories: currentCustomBenefit ? [currentCustomBenefit] : [],
    });
    setPlans([]);
    setCustomCategories([]);
    if (!contactId) return;

    let cancelled = false;
    (async () => {
      try {
        // One call for both the meter and the Custom category titles — the same pair
        // Settings reads, so the dialog cannot show a category list that differs from
        // the one the access rules were written against.
        const [teamResponse, plansResponse] = await Promise.all([
          fetch("/api/teammates/team", { cache: "no-store" }),
          fetch("/api/clients?status=all&limit=500&summary=1", { cache: "no-store" }),
        ]);

        // A 403 here means this caller cannot manage the team, so there is no meter and
        // no extra categories for them to see. The add is still gated server-side, which
        // is what actually matters.
        if (teamResponse.ok) {
          const body = (await teamResponse.json()) as {
            seats?: SeatUsageSummary;
            customCategories?: string[];
          };
          if (!cancelled) {
            setSeats(body.seats ?? null);
            setCustomCategories(body.customCategories ?? []);
          }
        }

        if (plansResponse.ok) {
          const body = (await plansResponse.json()) as {
            data?: { id: string; companyName: string }[];
          };
          if (!cancelled) {
            setPlans(
              (body.data ?? []).map((plan) => ({
                id: plan.id,
                companyName: plan.companyName,
              })),
            );
          }
        }
      } catch {
        /* the meter and the picker are informational — never surface a failure */
      } finally {
        if (!cancelled) setSeatsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contactId, currentCustomBenefit]);

  const name = contact ? displayName(contact) : "";
  const email = contact?.email?.trim() ?? "";
  const seatPercent =
    seats && seats.seatsIncluded > 0
      ? Math.min(100, Math.round((seats.seatsUsed / seats.seatsIncluded) * 100))
      : 0;

  // "Certain Plans" with nothing ticked would be refused by the server (there is nothing
  // to scope), so it is stopped here instead of after a round trip. Same for categories.
  const planScopeComplete =
    access.planScope === "all_plans" || access.planIds.length > 0;
  const categoryScopeComplete =
    access.categoryScope === "all" || access.categories.length > 0;
  const scopeComplete = planScopeComplete && categoryScopeComplete;

  const submit = async (confirmUpgrade: boolean) => {
    if (!contact || !scopeComplete) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/teammates/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // A seat, said explicitly. The endpoint otherwise guesses the person type
          // from the email domain, and an outside advisor would be filed as a free
          // Collaborator — the opposite of what this button promises.
          type: "team_member",
          role: access.role,
          planScope: access.planScope,
          // Only meaningful for `certain_plans`; omitted otherwise rather than sent as an
          // empty list, so the server falls back to its own All Plans behaviour.
          ...(access.planScope === "certain_plans"
            ? { planIds: access.planIds }
            : {}),
          categoryScope: access.categoryScope,
          // A chosen Custom title has to travel with the storage key behind it, or the
          // person is granted the benefit and then refused its page — see
          // `categoriesForAccess`.
          ...(access.categoryScope === "certain"
            ? {
                categories: categoriesForAccess(
                  access.categories,
                  customCategories,
                  currentCustomBenefit,
                ),
              }
            : {}),
          email,
          name,
          firstName: contact.firstName ?? undefined,
          lastName: contact.lastName ?? undefined,
          jobTitle: contact.title ?? undefined,
          phone: contact.phone || undefined,
          phoneExtension: contact.phoneExtension ?? undefined,
          headshot: contact.headshot ?? undefined,
          // Omitted on the first attempt: the server refuses with 409 `seat_limit` and
          // this dialog turns that into the confirm below. Sent only once confirmed,
          // which is exactly what the endpoint documents the flag for.
          ...(confirmUpgrade ? { confirmUpgrade: true } : {}),
        }),
      });

      const body = (await response.json().catch(() => ({}))) as AddTeamMemberSuccess &
        ApiErrorBody;

      if (response.status === 409 && body.code === "seat_limit") {
        setSeatLimitMessage(
          body.error || "Every seat in your plan is already in use.",
        );
        return;
      }

      if (!response.ok) {
        // Covers the org-settings permission refusal and 403 `seat_limit_owner_only`
        // (only an Owner or Admin may exceed the allowance). Both are the server
        // saying this person cannot do it, so the server's own wording is shown
        // rather than a guess made here.
        toast.error(body.error || "Could not give this contact a Team seat.");
        return;
      }

      const nextSeats = body.seats;
      const seatNote = nextSeats
        ? ` ${nextSeats.seatsUsed} of ${nextSeats.seatsIncluded} seats now in use.`
        : "";

      if (body.emailSent === false) {
        // The add itself succeeded, so this is not a failure — but saying "invitation
        // sent" would be a lie the advisor would act on.
        toast.warning(
          `${name} now has a Team seat, but the invitation email could not be sent.${
            body.emailError ? ` (${body.emailError})` : ""
          }${seatNote}`,
        );
      } else if (body.member?.state === "active") {
        // The address already belonged to somebody with an account, so no invitation
        // went out and none was needed.
        toast.success(
          `${name} already had an account and now has access to your plans.${seatNote}`,
        );
      } else {
        toast.success(`Invitation sent to ${name}.${seatNote}`);
      }

      onOpenChange(false);
      onGranted?.();
    } catch (error) {
      console.error("[GiveTeamSeatDialog] Failed to add a Team Member:", error);
      toast.error("Could not give this contact a Team seat.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!contact} onOpenChange={onOpenChange}>
      {/* A flex column rather than a scrolling box: the header and the footer stay put
          while the middle scrolls, so Cancel and the primary action are always reachable
          without scrolling past the access picker. */}
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Armchair className="h-4 w-4 shrink-0 text-accent-blue" />
            Give {name} a Team seat
          </DialogTitle>
          <DialogDescription>
            {name} becomes a Team Member of your organization. Choose what they can
            reach — the invitation goes out with that access.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-3">
          {/* Seat headroom, read from the same endpoint the Settings meter uses and shown
              before the decision rather than after it: whether a seat is open is what
              decides if this is a one-click action or a request to raise the allowance. */}
          {seats ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold">
                  {seats.seatsUsed} of {seats.seatsIncluded} seats used
                </p>
                <p
                  className={cn(
                    "text-xs font-medium",
                    seats.atLimit
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {seats.atLimit
                    ? "No seats open"
                    : `${plural(seats.seatsAvailable, "seat")} open`}
                </p>
              </div>
              <Progress value={seatPercent} className="h-1.5" />
              {/* The same phrasing the Settings seat meter uses, so the two surfaces
                  cannot describe one meter in two different ways. */}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {plural(seats.seatsActive, "active Team Member")}
                {seats.seatsPending > 0
                  ? ` · ${plural(seats.seatsPending, "pending invite")}`
                  : ""}
                {seats.atLimit
                  ? " · at limit — adding one asks for an upgrade"
                  : ` · ${plural(seats.seatsAvailable, "seat")} available`}
              </p>
            </div>
          ) : seatsLoaded ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Seat availability is only visible to an Owner or Admin.
            </p>
          ) : null}

          {/* The access picker, identical to People & Access. Access comes FIRST because
              role and scope are the decision; the seat meter above only says whether the
              decision can be afforded right now. */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Access
            </p>
            <AccessFields
              value={access}
              onChange={setAccess}
              plans={plans}
              customCategories={customCategories}
              currentCustomBenefit={currentCustomBenefit}
              disabled={isSaving}
            />
          </div>

          <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>
                Appears in Settings, under <b>People & Access</b>, as a Team Member — not
                as an external Collaborator.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>
                Uses <b>one paid seat</b>. The seat is held while the invitation is
                pending and released automatically after 14 days if it is never accepted.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>
                An invitation email is sent to <b>{email}</b>.
              </span>
            </li>
          </ul>

          {seatLimitMessage ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/20">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="space-y-1 text-[11px] leading-relaxed text-foreground/80">
                <p className="text-xs font-semibold text-foreground">
                  Every seat is in use
                </p>
                <p>{seatLimitMessage}</p>
                <p>
                  Confirming this raises your allowance by one seat. Only an Owner or
                  Admin can do that, and the server refuses it for anyone else.
                </p>
              </div>
            </div>
          ) : null}

          {!email ? (
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              This contact has no email address. It is what the invitation is sent to, and
              what identifies the person — add one in Step 1, then come back.
            </p>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => submit(Boolean(seatLimitMessage))}
            disabled={isSaving || !email || !scopeComplete}
            title={
              !email
                ? "This contact has no email address"
                : !scopeComplete
                  ? "Choose at least one plan or benefit category, or switch that scope back to All"
                  : undefined
            }
            className="bg-accent-blue hover:bg-accent-blue/90"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {seatLimitMessage ? "Raise allowance and add" : "Give Team Seat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
