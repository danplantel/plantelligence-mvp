"use client";

import { useState } from "react";
import { Armchair, Building2, Mail, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Headshot } from "@/components/ui/headshot";
import {
  GiveTeamSeatDialog,
  type SeatGrantSubject,
} from "@/components/wizard/benefits-steps/give-team-seat-dialog";
import {
  PRESET_ROLE_LABELS,
  type TeammateAssignmentRole,
} from "@/types/teammate";

/**
 * A Collaborator, as both Collaborators lists render them (Edit Client's Contacts tab and
 * Edit Benefit's Contacts step). Structural on purpose: the two callers build this shape
 * from the same `/api/teammates/plan-assignments` read, so one modal serves both.
 */
export interface CollaboratorDetailPerson {
  assignmentId: string;
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  companyName?: string | null;
  role: string;
  categoryScope: "all" | "selected";
  categories: string[];
  /** "contact" | "invited" | "active". */
  state?: string;
  deactivatedAt?: string | null;
  inviteDueDate?: string | null;
}

/**
 * The status the row and this modal both show. A live invite reads "Invite Pending"
 * rather than the lifecycle word "Invited": what the advisor is looking at is an
 * unanswered invitation.
 */
function statusLabel(person: CollaboratorDetailPerson): string {
  if (person.deactivatedAt) return "Deactivated";
  if (person.state === "invited") return "Invite Pending";
  if (person.state === "active") return "Active";
  if (person.state === "contact") return "Contact";
  return "Collaborator";
}

/** "All benefit categories" or the named list. */
function scopeLabel(person: CollaboratorDetailPerson): string {
  if (person.categoryScope === "all") return "All benefit categories";
  if (person.categories.length === 0) return "No categories yet";
  return person.categories.join(", ");
}

export interface CollaboratorDetailDialogProps {
  /** The collaborator to show. `null` keeps the dialog closed. */
  person: CollaboratorDetailPerson | null;
  onOpenChange: (open: boolean) => void;
  /** The plan this list belongs to — the seat grant names it in the invitation. */
  planId?: string | null;
  /**
   * Whether the viewer may grant a seat. Owners and Admins only (see `useViewerAccess`);
   * the API refuses anyone else regardless of what is rendered here.
   */
  canManageSeats?: boolean;
  /** Runs after a successful seat grant, so the caller re-reads its list. */
  onGranted?: () => void;
  /** The Custom benefit being authored, when the list is inside that benefit's editor. */
  currentCustomBenefit?: string | null;
}

/**
 * Click a Collaborator → see who they are, and (for an Owner or Admin) give them a Team
 * seat on this organization.
 *
 * The seat itself is the SHARED [`GiveTeamSeatDialog`](../../components/wizard/benefits-steps/give-team-seat-dialog.tsx),
 * opened on top of this one: the same access picker, the same seat meter and the same
 * `POST /api/teammates/team` the People & Access tab uses, so a seat granted from a
 * Collaborators list is granted exactly as one granted anywhere else. Promoting an
 * already-active Collaborator reuses their profile (the endpoint matches by email), so
 * they keep their login and their assignments gain the wider access.
 */
export function CollaboratorDetailDialog({
  person,
  onOpenChange,
  planId,
  canManageSeats = false,
  onGranted,
  currentCustomBenefit,
}: CollaboratorDetailDialogProps) {
  const [seatOpen, setSeatOpen] = useState(false);

  const open = Boolean(person);
  const roleLabel = person
    ? (PRESET_ROLE_LABELS[person.role as TeammateAssignmentRole] ?? person.role)
    : "";

  // What the seat dialog needs about the person — see `SeatGrantSubject`.
  const seatSubject: SeatGrantSubject | null = person
    ? {
        id: person.profileId,
        name: person.name,
        email: person.email,
        headshot: person.headshot,
      }
    : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setSeatOpen(false);
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Collaborator</DialogTitle>
            <DialogDescription>
              An external person who helps with this plan. They use no seat and cannot
              publish, invite, delete or see organization settings.
            </DialogDescription>
          </DialogHeader>

          {person ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                  <Headshot
                    src={person.headshot}
                    alt={person.name}
                    monogramName={person.name}
                    wrapperClassName="rounded-full"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {person.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.email}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{roleLabel}</Badge>
                <Badge
                  variant="outline"
                  className={
                    statusLabel(person) === "Invite Pending"
                      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                      : person.deactivatedAt
                        ? "text-muted-foreground"
                        : undefined
                  }
                >
                  {statusLabel(person)}
                </Badge>
              </div>

              <dl className="grid gap-2 text-xs">
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <dt className="sr-only">Email</dt>
                    <dd className="truncate">{person.email}</dd>
                  </span>
                </div>
                {person.companyName ? (
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <dt className="sr-only">Company</dt>
                      <dd className="truncate">{person.companyName}</dd>
                    </span>
                  </div>
                ) : null}
                <div className="flex items-start gap-2">
                  <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <dt className="sr-only">Benefit access</dt>
                    <dd className="truncate">{scopeLabel(person)}</dd>
                  </span>
                </div>
              </dl>

              {person.inviteDueDate && statusLabel(person) === "Invite Pending" ? (
                <p className="text-[11px] text-muted-foreground">
                  Invitation expires{" "}
                  {new Date(person.inviteDueDate).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="shrink-0 gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canManageSeats ? (
              <Button
                onClick={() => setSeatOpen(true)}
                className="bg-accent-blue hover:bg-accent-blue/90"
              >
                <Armchair className="mr-2 h-4 w-4" />
                Give Team Seat
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The shared seat dialog, stacked on top. It owns the access picker, the seat meter
          and the confirm-upgrade path; this modal only hands it the person. */}
      <GiveTeamSeatDialog
        contact={seatOpen ? seatSubject : null}
        onOpenChange={(next) => {
          if (!next) setSeatOpen(false);
        }}
        planId={planId ?? null}
        currentCustomBenefit={currentCustomBenefit}
        onGranted={() => {
          onGranted?.();
          // A granted seat makes them a Team Member, so this Collaborator modal has
          // nothing left to show.
          setSeatOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
