"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { AlertTriangle, Loader2, Mail, MailCheck, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContactCard } from "@/components/contacts/contact-card";
import {
  PRESET_ROLE_LABELS,
  type TeammateAssignmentRole,
} from "@/types/teammate";
import type { CollaboratorDetailPerson } from "./collaborator-detail-dialog";

/**
 * A Collaborator, rendered with the SAME card the Contacts use.
 *
 * The chrome (photo, action row, name / second line / email stack, full-width footer)
 * comes from [`ContactCard`](../contacts/contact-card.tsx). Only two things differ from a
 * contact's card:
 *
 *  - the second line is their ROLE — or their company when the role is the default
 *    "Contributor", which the lists no longer show — and
 *  - the footer is a status chip rather than the seat ladder, because a collaborator
 *    holds no seat. The "Give Team Seat" action lives in the card's modal, so a seat is
 *    never granted from a single click on a list.
 *
 * The whole card is the click target: it opens the collaborator detail modal.
 */
export function CollaboratorCard({
  person,
  onOpen,
  onEdit,
  onDelete,
  onResendInvite,
  onConfirmDeletion,
  resending = false,
}: {
  person: CollaboratorDetailPerson;
  /** Clicking the card: open the detail modal. */
  onOpen: () => void;
  /**
   * The pencil. Opens the same detail modal as clicking the card — it exists so the
   * action is discoverable rather than hidden behind a whole-surface click.
   */
  onEdit?: () => void;
  /** The trash. Omitted for a viewer who may not manage the plan's people. */
  onDelete?: () => void;
  /** Omitted when there is nothing to resend (not pending, or no handler). */
  onResendInvite?: () => void;
  /**
   * The Owner/Admin's confirmation of a self-service account deletion.
   *
   * When the person deleted their OWN login this becomes the card's ONLY action, and it takes over
   * the whole card: the profile itself is what is being removed, so a plan-level removal, an
   * invitation resend or a seat grant would each be aimed at an account that no longer exists. See
   * `confirmSelfDeletedProfile`.
   */
  onConfirmDeletion?: () => void;
  /** A resend is in flight for this person — swaps the icon for a spinner. */
  resending?: boolean;
}) {
  /**
   * Checked FIRST, because it is the more specific state and it changes what the card IS: every
   * other action on this card addresses a live account, and there is none.
   */
  const isSelfDeleted = Boolean(person.selfDeletedAt);
  const isPending = !person.deactivatedAt && person.state === "invited";

  const statusLabel = isSelfDeleted
    ? "Profile deleted"
    : person.deactivatedAt
      ? "Deactivated"
      : isPending
        ? "Invite Pending"
        : person.state === "active"
          ? "Active"
          : "Contact";

  const roleLabel =
    PRESET_ROLE_LABELS[person.role as TeammateAssignmentRole] ?? person.role;
  /**
   * The card's second line: the person's OWN job title first, then the role, then the company.
   *
   * The title leads because it is the field the invitee fills in on the acceptance page, and it is
   * what employees would read on a portal card — the whole reason this card exists. Letting the
   * role lead (as this did) made somebody who had typed "Retirement Plan Advisor" render as
   * "No Title", because a default Contributor role deliberately says nothing.
   *
   * The fallbacks are unchanged: a non-default role still names itself (a Reviewer is worth
   * knowing about), and "Contributor" still falls through to the company.
   */
  const secondLine =
    (person.jobTitle ?? "").trim() ||
    (roleLabel !== "Contributor" ? roleLabel : (person.companyName ?? ""));

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      // Keyboard activation reaches the same target the pointer does, or the card would be
      // unreachable without a mouse for the one state that needs an action.
      if (isSelfDeleted) {
        onConfirmDeletion?.();
        return;
      }
      onOpen();
    }
  };

  /**
   * The footer is where this card states what condition somebody is in — and "deleted their own
   * account" is a condition with exactly one action attached, so the two are the same element
   * rather than a chip with a control beside it.
   */
  const footer = isSelfDeleted ? (
    <button
      type="button"
      onClick={(event) => {
        // The whole card is a click target; without this, confirming would also open the detail
        // modal underneath it.
        event.stopPropagation();
        onConfirmDeletion?.();
      }}
      disabled={!onConfirmDeletion}
      title={
        onConfirmDeletion
          ? "Confirm this deletion and remove their access"
          : "An Owner or Admin confirms this deletion"
      }
      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-default disabled:hover:bg-red-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {onConfirmDeletion ? "Confirm deletion" : statusLabel}
    </button>
  ) : (
    <div
      className={
        isPending
          ? "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-amber-300 bg-amber-50/70 px-3 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
          : person.deactivatedAt
            ? "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-gray-100 bg-gray-50 px-3 text-xs font-semibold text-muted-foreground dark:border-gray-700 dark:bg-gray-800/60"
            : "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
      }
    >
      {isPending ? (
        <MailCheck className="h-3.5 w-3.5" />
      ) : (
        <UserCheck className="h-3.5 w-3.5" />
      )}
      {statusLabel}
    </div>
  );

  // The card's top-right cluster. The click is stopped so resending never also opens the
  // detail modal underneath, exactly like the old list row's button.
  // Never offered on a self-deleted card: there is no open invitation to retry, and the account
  // the link would go to has been deleted.
  const actions: ReactNode = onResendInvite && !isSelfDeleted ? (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation();
        onResendInvite();
      }}
      disabled={resending}
      title="Resend this invitation"
      aria-label="Resend invitation"
    >
      {resending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Mail className="h-3.5 w-3.5" />
      )}
    </Button>
  ) : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      // A self-deleted card's one meaningful action IS the confirmation, so the whole surface
      // becomes that rather than opening a modal whose controls all assume a live account.
      // Without the handler — a viewer who may not manage people — it falls back to the modal,
      // which is the only thing left to offer them, and the copy below says so rather than
      // promising an action that is not there.
      onClick={isSelfDeleted ? (onConfirmDeletion ?? onOpen) : onOpen}
      onKeyDown={handleKeyDown}
      title={
        isSelfDeleted
          ? onConfirmDeletion
            ? "Confirm this deletion"
            : "This profile was deleted — an Owner or Admin confirms it"
          : "View collaborator details"
      }
      className="h-full cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ContactCard
        contact={{
          headshot: person.headshot,
          name: person.name,
          displayName: person.name,
          title: secondLine,
          email: person.email,
          // The ways to reach them, which `ContactCard` already knows how to draw — it was only
          // ever handed the email, so a collaborator's phone never appeared.
          phone: person.phone,
          phoneExtension: person.phoneExtension,
        }}
        showSeatControl={false}
        // Withheld while self-deleted: both the pencil's modal (which offers a seat grant) and the
        // trash (a plan-level removal) assume an account that still exists.
        onEdit={isSelfDeleted ? undefined : onEdit}
        onDelete={isSelfDeleted ? undefined : onDelete}
        actions={actions}
        footer={footer}
      />
    </div>
  );
}
