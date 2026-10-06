"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { Loader2, Mail, MailCheck, UserCheck } from "lucide-react";

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
  /** A resend is in flight for this person — swaps the icon for a spinner. */
  resending?: boolean;
}) {
  const isPending = !person.deactivatedAt && person.state === "invited";

  const statusLabel = person.deactivatedAt
    ? "Deactivated"
    : isPending
      ? "Invite Pending"
      : person.state === "active"
        ? "Active"
        : "Contact";

  const roleLabel =
    PRESET_ROLE_LABELS[person.role as TeammateAssignmentRole] ?? person.role;
  // "Contributor" is the default every invited collaborator gets, so it says nothing —
  // the company is more useful on that line, and the lists already hide the label.
  const secondLine =
    roleLabel !== "Contributor" ? roleLabel : (person.companyName ?? "");

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  const footer = (
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
  const actions: ReactNode = onResendInvite ? (
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
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      title="View collaborator details"
      className="h-full cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ContactCard
        contact={{
          headshot: person.headshot,
          name: person.name,
          displayName: person.name,
          title: secondLine,
          email: person.email,
        }}
        showSeatControl={false}
        onEdit={onEdit}
        onDelete={onDelete}
        actions={actions}
        footer={footer}
      />
    </div>
  );
}
