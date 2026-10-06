"use client";

/**
 * The grid Contact Card shared by the plan's Key Contacts surfaces.
 *
 * It mirrors the Edit Benefit Contacts tab exactly (a vertical card: headshot and row
 * actions on top, name/title/email/phone stacked below, seat control at the bottom)
 * so the Edit Client Key Contacts tab and the Create Plan Category Explorer render the
 * same card instead of drifting apart.
 *
 * The seat control is optional (`showSeatControl`): the Create Plan wizard has no
 * persisted plan to grant a seat against, so it renders the card's identity + actions
 * only, while the saved plan shows the full seat ladder.
 */

import type { MouseEvent, ReactNode } from "react";
import { Armchair, BadgeCheck, Loader2, MailCheck, Pencil, Star, Trash2, UserCheck, UserRoundPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";
import { Headshot } from "@/components/ui/headshot";
import { cn } from "@/lib/utils";

/** Format a 10-digit phone as (XXX)-XXX-XXXX (e.g. 3333333333 → (333)-333-3333). */
export const formatContactPhone = (phone?: string): string => {
  const digits = (phone || "").replace(/\D/g, "");
  const national = digits.length > 10 ? digits.slice(1) : digits;
  if (national.length !== 10) return phone || "";
  return `(${national.slice(0, 3)})-${national.slice(3, 6)}-${national.slice(6, 10)}`;
};

export type SeatStatus = "owner" | "invited" | "active" | "deactivated" | null;

/** Full-width seat chrome for a grid card (mirrors the Edit Benefit Contacts tab exactly). */
const SEAT_STATUS_MUTED_CLASS =
  "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-gray-100 bg-gray-50 px-3 text-xs font-semibold text-muted-foreground dark:border-gray-700 dark:bg-gray-800/60";
const SEAT_STATUS_DONE_CLASS =
  "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400";
const SEAT_STATUS_PENDING_CLASS =
  "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-200 bg-gray-50/60 px-3 text-xs font-medium text-muted-foreground dark:border-gray-700 dark:bg-gray-800/40";

/**
 * The fields this card renders.
 *
 * Structural rather than `KeyContact` so the SAME card can render a Collaborator (an
 * assignment row) as well as a Key Contact — see `CollaboratorCard`. A `KeyContact`
 * satisfies it unchanged.
 */
export interface ContactCardSubject {
  contactType?: string | null;
  companyLogo?: string | null;
  headshot?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  displayName?: string | null;
  title?: string | null;
  customRole?: string | null;
  role?: string | null;
  phone?: string | null;
  phoneExtension?: string | null;
  email?: string | null;
}

export interface ContactCardProps {
  contact: ContactCardSubject;
  isPrimary?: boolean;
  seatStatus?: SeatStatus;
  seatStatusResolved?: boolean;
  /** Hide the seat control entirely (Create Plan — no plan to grant a seat against). */
  showSeatControl?: boolean;
  inviteDueDate?: string | null;
  onTogglePrimary?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onInvite?: () => void;
  onGiveSeat?: () => void;
  /**
   * Extra icon buttons for the card's action cluster (top-right, beside edit / delete).
   * The Collaborator card uses it for its "Resend" action.
   */
  actions?: ReactNode;
  /**
   * Replaces the seat ladder (including the "Give Team Seat" button) with your own
   * footer. Used by a Collaborator card, whose call to action is different: a
   * collaborator holds no seat, so the ladder would describe the wrong thing.
   */
  footer?: ReactNode;
}

export function ContactCard({
  contact,
  isPrimary,
  seatStatus = null,
  seatStatusResolved = true,
  showSeatControl = true,
  inviteDueDate,
  onTogglePrimary,
  onEdit,
  onDelete,
  onInvite,
  onGiveSeat,
  actions,
  footer,
}: ContactCardProps) {
  const displayName =
    contact.firstName || contact.lastName
      ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
      : contact.name || "Unnamed Contact";
  const role = contact.title || contact.customRole || contact.role || "";
  const formattedPhone = contact.phone
    ? `${formatContactPhone(contact.phone)}${
        contact.phoneExtension ? ` ext. ${contact.phoneExtension}` : ""
      }`
    : "";

  /**
   * A card can be a single click target — the Collaborator card wraps it in a
   * `role="button"` div that opens a modal — so its own buttons must not also fire the
   * surface click. Stopping here covers every action uniformly, and is a no-op wherever
   * the card is not clickable.
   */
  const actionHandler =
    (handler?: () => void) => (event: MouseEvent) => {
      event.stopPropagation();
      handler?.();
    };

  return (
    <Card className="overflow-hidden transition-all border-gray-100 bg-white hover:border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600">
      <CardContent className="space-y-3 p-4">
        {/* Photo and row actions only — the name sits below at full width so it stays legible
            at four-up, exactly as the Edit Benefit Contacts tab renders it. */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-100 bg-gray-100 dark:border-gray-700 dark:bg-gray-700">
            {contact.contactType === "team_support" && contact.companyLogo ? (
              <BrandingImage
                src={contact.companyLogo}
                alt={displayName}
                className="h-full w-full bg-white object-contain p-0.5 dark:bg-gray-800"
              />
            ) : (
              <Headshot
                src={contact.headshot || undefined}
                alt={displayName}
                monogramName={displayName}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {onTogglePrimary && (
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-7 w-7 shrink-0",
                  isPrimary
                    ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10"
                    : "text-muted-foreground hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-amber-500/10",
                )}
                onClick={actionHandler(onTogglePrimary)}
                title={isPrimary ? "Remove as primary" : "Mark as primary"}
                aria-label={isPrimary ? "Remove as primary" : "Mark as primary"}
              >
                <Star className={cn("h-3.5 w-3.5", isPrimary && "fill-amber-500")} />
              </Button>
            )}
            {onInvite && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={actionHandler(onInvite)}
                title="Invite this contact to complete their sections"
                aria-label="Invite this contact"
              >
                <UserRoundPlus className="h-3.5 w-3.5" />
              </Button>
            )}
            {onEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={actionHandler(onEdit)}
                title="Edit this contact"
                aria-label="Edit this contact"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                onClick={actionHandler(onDelete)}
                title="Delete this contact"
                aria-label="Delete this contact"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {actions}
          </div>
        </div>

        {/* Name over title, then the ways to reach them, as one left-aligned column at the
            card's full width — the same stack the Edit Benefit Contacts tab uses. */}
        <div className="min-w-0 space-y-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <p title={displayName} className="truncate text-sm font-semibold leading-tight text-foreground">
              {displayName}
            </p>
            {isPrimary && (
              <Badge
                variant="secondary"
                className="shrink-0 border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300"
              >
                Primary
              </Badge>
            )}
          </div>
          <p title={role || "No Title"} className="truncate text-xs leading-tight text-muted-foreground">
            {role || "No Title"}
          </p>
          {contact.email ? (
            <p title={contact.email} className="truncate text-xs leading-tight text-muted-foreground">
              {contact.email}
            </p>
          ) : null}
          {formattedPhone ? (
            <p title={formattedPhone} className="truncate text-xs leading-tight text-muted-foreground">
              {formattedPhone}
            </p>
          ) : null}
        </div>

        {/* Seat control — the same ladder the Edit Benefit Contacts tab renders, so one person
            never shows a different seat state on the two surfaces. */}
        {footer !== undefined ? footer : null}
        {footer === undefined &&
          showSeatControl &&
          (!seatStatusResolved ? (
            <div
              className={SEAT_STATUS_PENDING_CLASS}
              title="Checking whether this person already holds a seat…"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking…
            </div>
          ) : seatStatus === "owner" ? (
            <div
              className={SEAT_STATUS_MUTED_CLASS}
              title="This is the organization owner. They already have full access to every plan and every category."
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              Organization owner
            </div>
          ) : seatStatus === "invited" ? (
            <div
              className={SEAT_STATUS_DONE_CLASS}
              title={
                inviteDueDate
                  ? `Invitation sent · expires ${inviteDueDate}`
                  : "Invitation sent"
              }
            >
              <MailCheck className="h-3.5 w-3.5" />
              Invite sent
            </div>
          ) : seatStatus === "active" ? (
            <div
              className={SEAT_STATUS_DONE_CLASS}
              title="Already a Team Member of your organization."
            >
              <UserCheck className="h-3.5 w-3.5" />
              Team member
            </div>
          ) : seatStatus === "deactivated" ? (
            <div
              className={SEAT_STATUS_MUTED_CLASS}
              title="This person was deactivated. Reactivate them in Settings → People & Access rather than adding them again — the server refuses a re-add for a deactivated address."
            >
              <UserCheck className="h-3.5 w-3.5" />
              Deactivated
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 text-xs font-semibold"
              title={
                contact.email
                  ? "Give this contact a Team Member seat"
                  : "Add an email address for this contact first"
              }
              disabled={!contact.email}
              onClick={onGiveSeat}
            >
              <Armchair className="h-3.5 w-3.5" />
              Give Team Seat
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}
