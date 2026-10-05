"use client";

import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  HelpCircle,
  Loader2,
  Mail,
  MailPlus,
  Pencil,
  Plus,
  Search,
  UserRound,
  UserRoundMinus,
  UserRoundPlus,
} from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Headshot } from "@/components/ui/headshot";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import type { SeatUsageSummary } from "@/components/pages/seat-meter";
// The access picker (Role / Plan access / Benefits access) is shared with the benefits
// wizard's "Give Team Seat" dialog, so both surfaces offer exactly the same controls.
import {
  AccessFields,
  EMPTY_ACCESS,
  RoleCapabilityBody,
  TEAM_MEMBER_ROLES,
  categoriesForAccess,
  type AccessDraft,
  type PlanOption,
} from "@/components/teammates/access-fields";
import { PersonAccessScreen } from "@/components/teammates/person-access-screen";
// Shared with the dashboard's seats card, so the seat rules are written down once.
import { SeatUsageInfoDialog } from "@/components/teammates/seats/seat-usage-info-dialog";
import {
  describeAllRoles,
  type RoleCapability,
} from "@/lib/teammates/role-summary";
import {
  PRESET_ROLE_LABELS,
  PROFILE_STATE_LABELS,
  type TeammateAssignmentRole,
  type TeammatePresetRole,
} from "@/types/teammate";
import { cn } from "@/lib/utils";

/** Matches the shapes returned by /api/teammates/team. */
interface TeamMemberRow {
  id: string;
  isOwner: boolean;
  profileId: string | null;
  userId: string | null;
  name: string;
  email: string;
  /** R2 key or absolute URL — resolved to a loadable URL by <Headshot>. */
  headshot: string | null;
  role: TeammateAssignmentRole;
  status: keyof typeof PROFILE_STATE_LABELS;
  personType: "team_member" | "collaborator";
  /** Partner/Provider company (T1); null for the owner and people without one. */
  companyName?: string | null;
  planAccess: {
    scope: "all" | "certain" | "none";
    planIds: string[];
    planNames: string[];
    /** Selected plans cover every plan in the organisation (display-only; see the server type). */
    coversAll?: boolean;
  };
  categoryAccess: { scope: "all" | "certain" | "none"; categories: string[] };
  allPlans: boolean;
  /** ISO timestamp while deactivated; null/absent for a live profile. */
  deactivatedAt?: string | null;
  /**
   * ISO timestamp when the person deleted their OWN login. Their profile — and therefore
   * their seat — is deliberately kept until an Owner/Admin confirms the deletion from this
   * card, so this is both the state to render and the precondition for that action.
   */
  selfDeletedAt?: string | null;
}


function planAccessLabel(row: TeamMemberRow): string {
  if (row.isOwner || row.planAccess.scope === "all") return "All Plans";
  if (row.planAccess.scope === "none") return "No plan access";
  // Chosen plan-by-plan but covering every available plan still reads as "All Plans".
  if (row.planAccess.coversAll) return "All Plans";
  if (row.planAccess.planNames.length <= 2) {
    return row.planAccess.planNames.join(", ");
  }
  return `${row.planAccess.planNames.length} plans`;
}

function categoryAccessLabel(row: TeamMemberRow): string {
  if (row.isOwner || row.categoryAccess.scope === "all") return "All categories";
  if (row.categoryAccess.categories.length === 0) return "No categories";
  return row.categoryAccess.categories.join(", ");
}

/* ──────────────── Roles & permissions explainer ──────────────── */


/**
 * A stable left-edge colour per role. Kept as literal class strings (never
 * built dynamically) so Tailwind can see them, and applied only while an item
 * is open so the accent reads as "this is the row you opened".
 */
const ROLE_ACCENT_BORDER: Record<TeammatePresetRole, string> = {
  owner: "data-[state=open]:border-l-amber-500",
  admin: "data-[state=open]:border-l-sky-500",
  editor: "data-[state=open]:border-l-emerald-500",
  contributor: "data-[state=open]:border-l-violet-500",
  reviewer: "data-[state=open]:border-l-cyan-500",
  viewer: "data-[state=open]:border-l-slate-400",
};


/** A one-line gist for the accordion header, so the list scans without expanding. */
function capabilityTeaser(capability: RoleCapability): string {
  if (capability.isReadOnly) return "Read-only";
  const parts = [`Edits ${capability.edit.length}`];
  if (capability.view.length > 0) parts.push(`views ${capability.view.length}`);
  if (capability.allowed.length > 0) {
    parts.push(`can ${capability.allowed.join(", ").toLowerCase()}`);
  }
  return parts.join(" · ");
}


/**
 * One role row. Closed, it is a compact line — role chip plus a one-line gist.
 * Open, it tints its own background, grows a coloured left edge and reveals the
 * full capability list, so the details always read as belonging to that row.
 *
 * `badgeVariant` comes from the SECTION the row is rendered in, not from the
 * role: Viewer exists in both lists and must look like its neighbours in each
 * one (solid under Team Members, muted under Collaborators).
 */
function RoleAccordionRow({
  capability,
  badgeVariant = "default",
}: {
  capability: RoleCapability;
  badgeVariant?: ComponentProps<typeof Badge>["variant"];
}) {
  return (
    <AccordionItem
      value={capability.role}
      className={cn(
        // A transparent left border is always reserved, so opening a row never
        // shifts the layout — the accent simply fades in.
        "rounded-lg border border-border/70 border-l-2 border-l-transparent bg-card px-3 transition-all",
        "data-[state=open]:bg-primary/[0.04] data-[state=open]:shadow-sm",
        "dark:data-[state=open]:bg-primary/[0.10]",
        ROLE_ACCENT_BORDER[capability.role],
      )}
    >
      <AccordionTrigger className="gap-2 py-3 text-left hover:no-underline hover:opacity-90 [&[data-state=open]>svg]:text-foreground">
        <span className="flex flex-1 flex-wrap items-center gap-2 pr-2 text-left">
          <Badge variant={badgeVariant}>{capability.label}</Badge>
          <span className="text-xs font-normal text-muted-foreground">
            {capabilityTeaser(capability)}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="mb-3 mt-0 rounded-md border border-border/50 bg-muted/60 p-3 dark:bg-muted/25">
        <RoleCapabilityBody capability={capability} />
      </AccordionContent>
    </AccordionItem>
  );
}

/** The full matrix, for anyone comparing roles before choosing one. */
function RolesPermissionsDialog() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({ team: "", collaborators: "" });
  const { teamMembers, collaborators } = describeAllRoles();

  /**
   * Every role starts collapsed each time the dialog opens, so the reader always
   * lands on the same scannable list rather than a half-remembered expansion.
   * Empty string is Radix's "nothing open".
   */
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setExpanded({ team: "", collaborators: "" });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <HelpCircle className="mr-2 h-4 w-4" />
        Roles & permissions
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {/* <DialogHeader>
            <DialogTitle>Roles & permissions</DialogTitle>
            <DialogDescription>
              What each role can do. These are the rules the API enforces, not just
              what the interface hides — a role that says &ldquo;No access&rdquo;
              is refused by the server even if the control were reachable.
            </DialogDescription>
          </DialogHeader> */}

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3 mt-8">
              <div>
                <h4 className="text-sm font-semibold">Team Members</h4>
                <p className="text-xs text-muted-foreground">
                  People inside your organization. Each one uses a paid seat.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {teamMembers.length} roles
              </span>
            </div>
            <Accordion
              type="single"
              collapsible
              value={expanded.team}
              onValueChange={(value) =>
                setExpanded((prev) => ({ ...prev, team: value }))
              }
              className="space-y-2"
            >
              {teamMembers.map((capability) => (
                <RoleAccordionRow
                  key={capability.role}
                  capability={capability}
                  badgeVariant="default"
                />
              ))}
            </Accordion>
          </section>

          <div className="h-px bg-border" />

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">Collaborators</h4>
                <p className="text-xs text-muted-foreground">
                  External people — free, no seat. Whatever role they hold, they can
                  never publish, invite, delete, or see org settings or billing.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {collaborators.length} roles
              </span>
            </div>
            <Accordion
              type="single"
              collapsible
              value={expanded.collaborators}
              onValueChange={(value) =>
                setExpanded((prev) => ({ ...prev, collaborators: value }))
              }
              className="space-y-2"
            >
              {collaborators.map((capability) => (
                <RoleAccordionRow
                  key={capability.role}
                  capability={capability}
                  badgeVariant="secondary"
                />
              ))}
            </Accordion>
          </section>

          {/* <p className="text-xs text-muted-foreground">
            Viewer exists for both groups. Need something narrower than these presets?
            Custom roles are planned for a later release.
          </p> */}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ───────────────────────── Seat cards ───────────────────────── */

// The "How seats work" dialog used to live here. It now comes from
// `components/teammates/seats/seat-usage-info-dialog` so this panel and the dashboard's
// seats card explain the rules from one implementation rather than two copies that drift.

/**
 * A filled seat: an existing Team Member. The main surface opens the T6 management
 * screen; the footer gives the seat up.
 *
 * The card is a plain `div` wrapping two separate buttons rather than one big
 * `<button>`, because a button inside a button is invalid HTML and the seat genuinely
 * has two actions. `onRemove` is omitted for the Owner: their seat is reserved and
 * their row is synthesized from the Organization + User, so it carries no `profileId`
 * to address (see `listOrgPeople`).
 */
function FilledSeatCard({
  row,
  onEdit,
  onRemove,
  onResend,
  onConfirmDeletion,
  isResending,
  isConfirmingDeletion,
  resendCooldownSeconds,
  isViewer,
}: {
  row: TeamMemberRow;
  /**
   * Opens the management dialog. Absent for a reader who may not manage — a teammate without
   * `org_settings`, i.e. an Editor or a Viewer — and the card then renders as plain content.
   */
  onEdit?: (row: TeamMemberRow) => void;
  onRemove?: (row: TeamMemberRow) => void;
  /**
   * Re-sends the invitation this seat is holding.
   *
   * Supplied only while that invitation is still OPEN, which the caller decides: the card cannot
   * tell an unanswered invite from one nobody has accepted yet, and the server refuses the
   * states a resend cannot mean anything in anyway (already accepted, deactivated, a Contact).
   * Absent for the Owner — their row is synthesized, so there is no profile to address.
   */
  onResend?: (row: TeamMemberRow) => void;
  /**
   * Confirms a self-service account deletion — the person deleted their own login, so there
   * is nobody left to invite or remove. Supplied only for a manager, and only while the
   * profile actually carries the self-deleted marker.
   */
  onConfirmDeletion?: (row: TeamMemberRow) => void;
  /** This card's invitation is in flight, so only its own button shows the wait. */
  isResending?: boolean;
  /** This card's deletion is being confirmed, so only its own button shows the wait. */
  isConfirmingDeletion?: boolean;
  /** Seconds left of the resend cooldown; the button counts down and locks while it is above 0. */
  resendCooldownSeconds?: number;
  /** This seat belongs to the reader — see `viewerUserId`. */
  isViewer?: boolean;
}) {
  /**
   * The profile's login was deleted by its owner. The marker is what keeps the seat counted
   * until a manager confirms; it also changes what this card offers — there is no login to
   * invite and no member to remove, only a deletion to acknowledge.
   */
  const isSelfDeleted = Boolean(row.selfDeletedAt);
  return (
    <div
      className={`group relative flex h-full flex-col items-center gap-2.5 rounded-xl border shadow-md bg-card p-4 text-center transition hover:border-primary/60 hover:shadow-sm${
        /**
         * The highlight is the BORDER, never a `ring`.
         *
         * `ring-1` paints a 1px shadow OUTSIDE the card's box, and this grid sits in a Radix
         * `AccordionContent` that is `overflow-hidden` with `pt-0`
         * (components/ui/accordion.tsx), so the first row starts exactly at the content's own
         * top edge. That top pixel was clipped — while the bottom (the content's `pb-4`) and the
         * sides (the item's `px-4`) had room for it — which is why the highlight drew on three
         * sides and looked like it was missing its top edge. A border paints inside the box, so
         * no ancestor can clip it.
         *
         * Full-strength accent colour rather than `/60`: without the ring's extra pixel the
         * softer tone read as a hover state rather than as "this one is you".
         */
        isSelfDeleted
          ? " border-destructive/60"
          : isViewer
            ? " border-accent-blue"
            : ""
      }`}
    >
      <button
        type="button"
        onClick={onEdit ? () => onEdit(row) : undefined}
        disabled={!onEdit}
        aria-label={`Manage ${row.name}`}
        className="flex w-full flex-1 flex-col items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
      >
        {onEdit ? (
          <Pencil className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        ) : null}

        {/* Headshot falls back to a monogram of the name, so an owner who has not
            uploaded a photo still renders something rather than a blank circle. */}
        <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
          <Headshot
            src={row.headshot}
            alt={row.name}
            monogramName={row.name}
            wrapperClassName="rounded-full"
          />
        </span>

        {/* Identity, top to bottom: the "You" sticker, the name, the address.
         *
         * The sticker row exists on EVERY card — empty on the cards that are not the reader —
         * because the grid lays its columns out from each card's own boxes: an extra line on
         * one card pushed that card's name down and left the row visibly mis-set. A fixed
         * `h-[18px]` means the badge cannot change the card's height when it does appear, so
         * the names stay on one line across the row either way.
         *
         * The label is on its own line rather than beside the name so a long name cannot
         * squeeze it: the name truncates, the sticker never does. */}
        <span className="flex w-full flex-col items-center gap-0.5">
          <span className="flex h-[18px] items-center justify-center">
            {isViewer ? (
              <span className="rounded-full bg-accent-blue px-2 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-wide text-white">
                You
              </span>
            ) : null}
          </span>
          <span className="block w-full truncate text-sm font-medium">{row.name}</span>
          <span className="block w-full truncate text-xs text-muted-foreground">
            {row.email}
          </span>
        </span>

        <span className="flex flex-wrap items-center justify-center gap-1">
          <Badge variant={row.isOwner ? "default" : "secondary"}>
            {row.isOwner ? "Owner" : PRESET_ROLE_LABELS[row.role]}
          </Badge>
          {isSelfDeleted ? (
            // Deliberately NOT `PROFILE_STATE_LABELS[row.status]`: the profile is still
            // `active` in the data (that is what keeps the seat counted), so the card says
            // what actually happened rather than repeating a now-misleading stored state.
            <Badge
              variant="outline"
              className="border-destructive/60 text-destructive"
            >
              Profile deleted
            </Badge>
          ) : (
            <Badge variant="outline">
              {PROFILE_STATE_LABELS[row.status] ?? row.status}
            </Badge>
          )}
        </span>

        <span className="mt-auto w-full space-y-0.5 text-[11px] leading-tight text-muted-foreground">
          <span className="block truncate">{planAccessLabel(row)}</span>
          <span className="block truncate">{categoryAccessLabel(row)}</span>
        </span>
      </button>

      {onConfirmDeletion || onRemove || onResend ? (
        <span className="mt-auto flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
          {/* The ONE action a self-deleted seat offers: acknowledge that the person deleted
              their own login, which removes the profile and releases the seat. It replaces
              Resend / Remove from seat rather than sitting beside them — neither of those can
              mean anything for a person who no longer has an account. */}
          {onConfirmDeletion ? (
            <button
              type="button"
              onClick={() => onConfirmDeletion(row)}
              disabled={isConfirmingDeletion}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-destructive transition hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConfirmingDeletion ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UserRoundMinus className="h-3 w-3" />
              )}
              {isConfirmingDeletion ? "Confirming…" : "Confirm deletion"}
            </button>
          ) : null}
          {/* Chasing an unanswered invitation and giving the seat up are both reactions to the
              SAME card state ("Invited"), so they sit together at the foot of the card. The
              resend label is kept as short as the action is narrow; the pair may wrap to two
              lines on a narrow card, which is why `mt-auto` moved to this wrapper. */}
          {onResend ? (
            <button
              type="button"
              onClick={() => onResend(row)}
              // Locked while the cooldown runs, exactly as the server would refuse it. Only the
              // in-flight case gets the spinner: a countdown is a wait, not work in progress.
              disabled={isResending || (resendCooldownSeconds ?? 0) > 0}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent-blue transition hover:bg-accent-blue/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MailPlus className="h-3 w-3" />
              )}
              {isResending
                ? "Sending…"
                : (resendCooldownSeconds ?? 0) > 0
                  ? `Resend in ${resendCooldownSeconds}s`
                  : "Resend invite"}
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(row)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserRoundMinus className="h-3 w-3" />
              Remove from seat
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/** An open seat. Clicking opens the Add modal. */
function EmptySeatCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex h-full min-h-[11rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-4 text-center transition hover:border-primary/60 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed text-muted-foreground">
        <Plus className="h-5 w-5" />
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-medium">Open seat</span>
        <span className="block text-xs text-muted-foreground">
          Add a Team Member
        </span>
      </span>
    </button>
  );
}

/**
 * `(555) 123-4567` from whatever the advisor types.
 *
 * The digits are what get stored; the punctuation is presentation. Mirrors how Create Plan →
 * Key Contacts handles the same field, so a phone number looks the same wherever it is
 * entered.
 */
function formatPhoneInput(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * A person returned by the "add an existing contact" search.
 *
 * Declared here rather than imported from `lib/teammates/contacts.server`, which is
 * server-only — the shape crosses the wire as JSON, exactly like the invite dialog's own
 * `CollaboratorSearchRow`.
 */
interface PromotableContactRow {
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  jobTitle: string | null;
  companyName: string | null;
  planCount: number;
}

/**
 * The width of the section header's "Add Team Member" action. A fixed width rather than
 * `min-w`, so the label gets room without the button growing with it; `justify-center` keeps
 * the icon+label pair centred in the fixed box.
 */
const SECTION_ACTION_CLASS = "w-[9rem] justify-center";

/* ───────────────────────── Section ───────────────────────── */

export function TeamMembersSection() {
  const [team, setTeam] = useState<TeamMemberRow[]>([]);
  const [seats, setSeats] = useState<SeatUsageSummary | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  /**
   * The organisation's Custom benefit titles, read with the team list so the access picker
   * does not render an incomplete category list and then shift.
   */
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  /**
   * The New Contact slide's fields. These are exactly the Key Contact fields the profile
   * can store — nothing here is collected only to be dropped on the way in. The card-only
   * fields (contact type, CTA button, topic list, email/phone visibility) are deliberately
   * absent until the profile has somewhere to put them.
   */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneExtension, setPhoneExtension] = useState("");
  const [headshot, setHeadshot] = useState("");
  const [headshotFileName, setHeadshotFileName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [addAccess, setAddAccess] = useState<AccessDraft>(EMPTY_ACCESS);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);

  // ── The "add an existing contact" picker ──────────────────────────────────────
  //
  // A Contact is somebody the organization already knows — mirrored from a plan's Key
  // Contacts — but has never given access to. Promoting one instead of retyping a name is
  // the point, so the chosen profile travels to the server as `profileId` and the server
  // promotes exactly that person rather than whatever address is in the form.
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<PromotableContactRow[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  /**
   * Kept separate from an empty result set on purpose. "We could not ask" and "there is
   * nobody" look identical in a bare array, and telling an advisor there are no contacts
   * when the request actually failed would be a claim about their data that we cannot
   * support.
   */
  const [contactSearchError, setContactSearchError] = useState(false);
  const [pickedContact, setPickedContact] = useState<PromotableContactRow | null>(
    null,
  );
  /**
   * Slide 1 asks HOW the person is being added; slide 2 is the form for that answer.
   *
   * Two questions asked one at a time rather than one long form with half its fields
   * irrelevant to what the advisor is actually doing. "Is this somebody we already know?"
   * is a real question with a real answer, and answering it first is what lets slide 2 show
   * only the fields that apply.
   */
  const [addStep, setAddStep] = useState<"choose" | "new" | "existing">("choose");

  /**
   * T6 Assignment Management screen (spec T6). Opened for anyone who HAS a profile;
   * the synthesized owner row does not, so it keeps the read-only dialog below.
   */
  const [managingProfileId, setManagingProfileId] = useState<string | null>(null);

  // Read-only dialog for the owner (no profile of their own to manage).
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editAccess, setEditAccess] = useState<AccessDraft>(EMPTY_ACCESS);

  /** The seat holder awaiting a "remove from seat" confirmation. */
  const [removing, setRemoving] = useState<TeamMemberRow | null>(null);
  /** The self-deleted profile awaiting an Owner/Admin's confirmation. */
  const [confirmingSelfDeletion, setConfirmingSelfDeletion] =
    useState<TeamMemberRow | null>(null);

  /**
   * Whether this reader may change the roster.
   *
   * Reported by the server (`/api/teammates/team` returns `canManage`, resolved from the same
   * `org_settings` grid its write verbs enforce) and never inferred here. An Editor can read
   * People & Access but may not add, edit, deactivate or remove anyone, so this is what decides
   * whether the tab renders a control or just the information. False until the read answers,
   * which also means nothing actionable is on screen during the first paint.
   */
  const [canManage, setCanManage] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  /**
   * The profile whose invitation is being re-sent.
   *
   * Its own state rather than `isSubmitting`, which belongs to the dialogs: the roster is on
   * screen the whole time, and a resend must put exactly ONE card's button into its waiting
   * state. It also stops a double click from sending two emails.
   */
  const [resendingProfileId, setResendingProfileId] = useState<string | null>(null);
  /**
   * When each profile's next resend becomes possible (epoch ms), and the clock the countdowns are
   * measured against.
   *
   * The SERVER owns the rule and refuses inside the window (`INVITE_RESEND_COOLDOWN_SECONDS`);
   * this is the honest mirror of it, so the button can be disabled with a countdown instead of
   * inviting a click that comes back as a refusal. Nothing here decides anything: the successful
   * response and the refusal each hand over the seconds, and `startResendCooldown` is the only
   * writer — there is deliberately no copy of the duration in this file to drift from the API's.
   */
  const [resendCooldownUntil, setResendCooldownUntil] = useState<Record<string, number>>({});
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());

  const startResendCooldown = useCallback((profileId: string, seconds: number) => {
    if (seconds <= 0) return;
    // The clock is refreshed here rather than left at its last tick: a stale `cooldownNow` would
    // make the countdown OPEN at more than the server's window, since it measures `until - now`.
    setCooldownNow(Date.now());
    setResendCooldownUntil((prev) => ({
      ...prev,
      [profileId]: Date.now() + seconds * 1000,
    }));
  }, []);

  /** True while some row is inside its cooldown — the only time the ticker needs to run. */
  const resendCooldownActive = useMemo(
    () => Object.values(resendCooldownUntil).some((until) => until > cooldownNow),
    [resendCooldownUntil, cooldownNow],
  );

  // A second is the right granularity for a wait measured in seconds, and the interval exists
  // only while one is running — an always-on timer on a settings tab would be a render a second
  // for nothing.
  useEffect(() => {
    if (!resendCooldownActive) return;
    const id = setInterval(() => setCooldownNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendCooldownActive]);

  /** Seconds before this profile may be re-sent; 0 when it may be re-sent now. */
  const resendCooldownSecondsLeft = (profileId: string | null): number => {
    const until = profileId ? resendCooldownUntil[profileId] : undefined;
    return until ? Math.max(0, Math.ceil((until - cooldownNow) / 1000)) : 0;
  };

  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);

  // Used only to answer "is the signed-in user the organization owner?" for the
  // seat dialog. The session callback always populates `user.id`.
  const { data: session } = useSession();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [teamResponse, plansResponse] = await Promise.all([
        fetch("/api/teammates/team", { cache: "no-store" }),
        fetch("/api/clients?status=all&limit=500&summary=1", { cache: "no-store" }),
      ]);

      if (teamResponse.ok) {
        const body = (await teamResponse.json()) as {
          team?: TeamMemberRow[];
          seats?: SeatUsageSummary;
          customCategories?: string[];
          canManage?: boolean;
        };
        setTeam(body.team ?? []);
        setSeats(body.seats ?? null);
        // Read with the same response so the category list is complete on first paint.
        setCustomCategories(body.customCategories ?? []);
        setCanManage(body.canManage === true);
      } else {
        // A refused read (or a failed one) leaves the tab in its read-only shape rather than
        // offering controls whose requests would be refused.
        setTeam([]);
        setCanManage(false);
      }

      if (plansResponse.ok) {
        const body = (await plansResponse.json()) as {
          data?: { id: string; companyName: string }[];
        };
        setPlans(
          (body.data ?? []).map((plan) => ({
            id: plan.id,
            companyName: plan.companyName,
          })),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh ONE person's row after the Manage Access screen changes their access.
   *
   * Calling `load()` here re-set `isLoading` and re-rendered every seat card and collaborator row
   * for a change that touches a single person. This asks the list endpoint for just that profile
   * (`?profileId=`), then swaps only the matching row in place — every other row keeps its
   * identity and no loading state is shown.
   *
   * A failure is non-fatal: the save already succeeded, so the row simply keeps its previous
   * summary until the tab is next opened.
   */
  const refreshPerson = useCallback(async (profileId: string) => {
    try {
      const response = await fetch(
        `/api/teammates/team?profileId=${encodeURIComponent(profileId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const body = (await response.json()) as {
        team?: TeamMemberRow[];
        seats?: SeatUsageSummary;
      };
      const fresh =
        body.team?.find((row) => row.profileId === profileId) ?? null;
      if (fresh) {
        setTeam((prev) =>
          prev.map((row) => (row.profileId === profileId ? fresh : row)),
        );
      }
      if (body.seats) setSeats(body.seats);
    } catch {
      // Non-fatal — the modal's save already succeeded.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── "Add an existing contact" search ──────────────────────────────────────────
  //
  // This runs on an EMPTY query too, which is the one thing it does differently from the
  // invite dialog's picker. The server treats "" as "show me the most recent", because a
  // search box that shows nothing until you type is invisible to an advisor who does not
  // already know that a contact exists — and that is exactly who this is for.
  //
  // Debounced, and aborted on every keystroke: without the abort, a slow response for
  // "jan" can land after a fast one for "jane" and repopulate the list with the wrong
  // results.
  useEffect(() => {
    if (!isAddOpen) return;

    const term = contactQuery.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingContacts(true);
      try {
        const response = await fetch(
          `/api/teammates/contacts/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) {
          if (!controller.signal.aborted) {
            setContactResults([]);
            setContactSearchError(true);
          }
          return;
        }
        const body = (await response.json()) as {
          results?: PromotableContactRow[];
        };
        if (!controller.signal.aborted) {
          setContactResults(body.results ?? []);
          setContactSearchError(false);
        }
      } catch {
        // An aborted request also lands here; leaving the previous results in place is
        // correct, because the next keystroke will replace them anyway.
        if (!controller.signal.aborted) {
          setContactResults([]);
          setContactSearchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingContacts(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [contactQuery, isAddOpen]);

  /**
   * Clear every field the Add modal owns, so it always opens empty.
   *
   * Always returns to the chooser, never to whichever slide was used last.
   */
  const resetAddForm = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setJobTitle("");
    setPhone("");
    setPhoneExtension("");
    setHeadshot("");
    setHeadshotFileName("");
    setCompanyName("");
    setContactQuery("");
    setContactResults([]);
    setPickedContact(null);
    setAddStep("choose");
  };

  const openAdd = () => {
    setAddAccess(EMPTY_ACCESS);
    setConfirmUpgrade(false);
    resetAddForm();
    setIsAddOpen(true);
  };

  /**
   * Apply a picked contact to the form.
   *
   * Fills the two fields an advisor would otherwise retype — which is the entire feature —
   * and then stops. Role, plan scope and category scope are deliberately left alone:
   * promoting a contact is still a decision about ACCESS, and inferring that from the
   * person would be inventing a grant nobody chose.
   */
  const applyPickedContact = (contact: PromotableContactRow) => {
    setPickedContact(contact);
    setEmail(contact.email);
    setContactQuery("");
    setContactResults([]);
  };

  /** Unlink the picked contact and start the manual fields from empty. */
  const clearPickedContact = () => {
    setPickedContact(null);
    setEmail("");
    setContactQuery("");
  };

  const openEdit = (row: TeamMemberRow) => {
    // Spec T6 supersedes the old edit form for anyone with a profile: access is
    // per-assignment, which a single form cannot express. The owner is the one
    // exception — their access is the Organization itself, not an assignment.
    if (row.profileId) {
      setManagingProfileId(row.profileId);
      return;
    }
    setEditing(row);
    setEditName(row.name);
    setEditAccess({
      role: row.isOwner ? "owner" : row.role,
      planScope:
        row.planAccess.scope === "all" ? "all_plans" : "certain_plans",
      planIds: row.planAccess.planIds,
      categoryScope: row.categoryAccess.scope === "all" ? "all" : "certain",
      categories: row.categoryAccess.categories,
    });
  };

  const submitAdd = async (confirmed: boolean) => {
    // "Certain Plans" with nothing ticked would 400 on the server; catch it here so
    // the message points at the field instead of the request.
    if (addAccess.planScope === "certain_plans" && addAccess.planIds.length === 0) {
      toast.error("Select at least one plan for this person.");
      return;
    }

    const categoriesToSend = categoriesForAccess(
      addAccess.categories,
      customCategories,
    );

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/teammates/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          // Always a Team Member: Settings → People & Access no longer creates Collaborators
          // at all — those are invited from inside a plan (Create Benefits / Key Contacts),
          // per the spec. `type` is still sent explicitly rather than left to the server's
          // email-domain guess, which would file an off-domain address (a gmail one, a
          // spouse's) as a Collaborator under a button that says "Add Team Member".
          type: "team_member",
          ...(pickedContact
            ? {
                profileId: pickedContact.profileId,
                // The picked contact's own name, so the record matches what the advisor
                // just chose. Its parts are not sent: the server keeps the stored first and
                // last names rather than re-splitting this single string.
                name: pickedContact.name,
              }
            : {
                firstName,
                lastName,
                jobTitle,
                phone,
                phoneExtension,
                headshot,
                companyName,
              }),
          role: addAccess.role,
          planScope: addAccess.planScope,
          planIds: addAccess.planIds,
          categoryScope: addAccess.categoryScope,
          categories: categoriesToSend,
          ...(confirmed ? { confirmUpgrade: true } : {}),
        }),
      });

      const body = (await response.json()) as {
        error?: string;
        code?: string;
        member?: { personType: string; state: string; assignmentCount: number };
        emailSent?: boolean;
        emailError?: string | null;
      };

      if (response.status === 409 && body.code === "seat_limit") {
        // Spec T3 item 3: an upgrade confirm, not a hard block.
        setShowUpgradeConfirm(true);
        return;
      }
      if (!response.ok) {
        toast.error(body.error ?? "Could not add the Team Member");
        return;
      }

      const personLabel =
        body.member?.personType === "collaborator" ? "Collaborator" : "Team Member";
      const summary = `${email} added as a ${personLabel} with ${
        body.member?.assignmentCount ?? 0
      } plan assignment(s).`;

      // The add succeeded either way; what varies is whether the person was told. Claiming
      // an invitation was sent when it was not would leave the advisor waiting for an
      // email that does not exist, and calling the whole thing a failure would send them
      // to retry a write that already happened.
      if (body.emailSent) {
        toast.success(`${summary} An invitation email is on its way to them.`);
      } else if (body.emailError) {
        toast.warning(`${summary} The invitation email could not be sent.`);
      } else if (body.member?.state === "active") {
        toast.success(
          `${summary} They already have an account, so no invitation was needed.`,
        );
      } else if (body.member?.state === "invited") {
        // Reachable only when the invite window was ALREADY open: `startedInviteWindow` is
        // false for an `invited` profile, so the server neither moved the state nor sent
        // anything. The advisor sees a success with no email and would otherwise wait for
        // one — and the link they would go looking for is the one already in their inbox.
        toast.success(
          `${summary} Their invitation was already open, so no new email was sent.`,
        );
      } else {
        toast.success(summary);
      }
      setIsAddOpen(false);
      setShowUpgradeConfirm(false);
      await load();
    } catch {
      toast.error("Could not add the Team Member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!editing?.profileId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/teammates/team/${editing.profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          role: editAccess.role,
          planScope: editAccess.planScope,
          planIds: editAccess.planIds,
          categoryScope: editAccess.categoryScope,
          // Through the same helper the Add path uses. This previously sent the array raw,
          // so ticking a Custom title in the Edit dialog granted the benefit but not its
          // page — the Custom hub is keyed on `Company / Plan Sponsor`.
          categories: categoriesForAccess(
            editAccess.categories,
            customCategories,
          ),
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(body.error ?? "Could not save the Team Member");
        return;
      }

      toast.success(`${editName || editing.email} updated.`);
      setEditing(null);
      await load();
    } catch {
      toast.error("Could not save the Team Member");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Re-send an invitation that is still open.
   *
   * Reports what the server actually did rather than assuming: a LAPSED hold is re-opened, so
   * the email carries a fresh link and a full window, while a live one is redelivered with the
   * window it has left. The message says which, so an advisor does not tell the recipient to
   * expect a fortnight that is not there.
   *
   * The invitation itself is never rolled back by a mail failure — the server reports it in
   * `emailError` — so that is shown as a delivery problem (a warning) rather than an error that
   * invites the reader to retry a write that already happened.
   *
   * Deliberately does NOT re-read the roster. `load()` blanks BOTH lists behind their loading
   * spinners, and a resend changes nothing either list renders: the person already has a row
   * reading "Invited" — the state the server holds for a live hold AND for a lapsed one that no
   * sweep has reached yet — no assignment moves, and the role, plan and category access are
   * untouched. The one thing that CAN change is the meter, when a lapsed hold is re-taken, and
   * that arrives in this response as `seats`. Refetching the world to learn it would trade a
   * visible jolt across both sections for no new information.
   */
  const submitResendInvite = async (row: TeamMemberRow) => {
    if (!row.profileId) return;
    setResendingProfileId(row.profileId);
    try {
      const response = await fetch(`/api/teammates/team/${row.profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend_invite" }),
      });

      const body = (await response.json()) as {
        error?: string;
        seats?: SeatUsageSummary;
        emailSent?: boolean;
        emailError?: string | null;
        retryAfterSeconds?: number;
        member?: {
          refreshedWindow?: boolean;
          expiresInDays?: number;
          cooldownSeconds?: number;
        };
      };

      if (!response.ok) {
        // A cooldown refusal is a "not yet" rather than a failure: the server names the seconds it
        // would enforce, so the same countdown a successful resend starts runs from here — which
        // means the NEXT click is prevented rather than refused again.
        if (
          row.profileId &&
          typeof body.retryAfterSeconds === "number" &&
          body.retryAfterSeconds > 0
        ) {
          startResendCooldown(row.profileId, body.retryAfterSeconds);
        }
        toast.error(body.error ?? "Could not resend the invitation");
        return;
      }

      if (body.seats) setSeats(body.seats);

      const days = body.member?.expiresInDays;
      const windowNote =
        typeof days === "number"
          ? body.member?.refreshedWindow
            ? ` A fresh invitation was issued and expires in ${days} day${days === 1 ? "" : "s"}.`
            : ` Their invitation has ${days} day${days === 1 ? "" : "s"} left.`
          : "";

      if (body.emailSent) {
        // Locked the moment the mail leaves, from the server's own number — so the countdown on
        // screen IS the window the API will enforce.
        if (row.profileId && typeof body.member?.cooldownSeconds === "number") {
          startResendCooldown(row.profileId, body.member.cooldownSeconds);
        }
        toast.success(`Invitation re-sent to ${row.email}.${windowNote}`);
      } else {
        // No cooldown on a failure: the server does not start one either, because the rule
        // protects the recipient's inbox and nothing reached it. Locking the button here would
        // take the button away at exactly the moment mail is broken.
        toast.warning(
          body.emailError
            ? `Could not send the invitation: ${body.emailError}`
            : "The invitation was not sent.",
        );
      }

      // No `load()` here on purpose — see the note on this handler. The meter was already folded
      // in from the response above, and nothing else in either list changed.
    } catch {
      toast.error("Could not resend the invitation");
    } finally {
      setResendingProfileId(null);
    }
  };

  /**
   * Free the seat this person occupies, without deleting them.
   *
   * There is no single server-side meaning for this, and the UI must not imply one:
   * the state machine forbids `active → contact`, so an un-accepted invite returns to
   * being a Contact while an accepted member can only be deactivated. The confirm
   * dialog below names whichever one applies, and the response's `outcome` decides the
   * wording here, so the reader is told what actually happened rather than what they
   * might have assumed.
   */
  const submitRemoveFromSeat = async (row: TeamMemberRow) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/teammates/team/${row.profileId ?? row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remove_from_seat" }),
        },
      );

      const body = (await response.json()) as {
        error?: string;
        seats?: SeatUsageSummary;
        releasedSeats?: number;
        member?: { outcome?: "returned_to_contact" | "deactivated" };
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not remove the seat");
        return;
      }

      if (body.seats) setSeats(body.seats);
      setRemoving(null);

      const freed = body.releasedSeats ?? 0;
      const suffix =
        freed > 0 && body.seats
          ? ` Seat released — ${body.seats.seatsUsed} of ${body.seats.seatsIncluded} now in use.`
          : "";
      toast.success(
        body.member?.outcome === "deactivated"
          ? `${row.name} deactivated.${suffix}`
          : `${row.name} is a Contact again.${suffix}`,
      );
      await load();
    } catch {
      toast.error("Could not remove the seat");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Confirm that a member deleted their own profile.
   *
   * The member deleted their login, not their membership: their profile was flagged and its
   * seat deliberately kept, so this is the Owner/Admin's side of that deletion. Confirming
   * removes the person and their assignments and releases the seat. The server refuses a
   * profile that was not self-deleted, so this button cannot be used as a second, quieter
   * "remove person".
   */
  const submitConfirmSelfDeletion = async (row: TeamMemberRow) => {
    if (!row.profileId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/teammates/team/${row.profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_self_deletion" }),
      });

      const body = (await response.json()) as {
        error?: string;
        seats?: SeatUsageSummary;
        releasedSeats?: number;
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not confirm the deletion");
        return;
      }

      if (body.seats) setSeats(body.seats);
      setConfirmingSelfDeletion(null);

      const freed = body.releasedSeats ?? 0;
      const suffix =
        freed > 0 && body.seats
          ? ` Seat released — ${body.seats.seatsUsed} of ${body.seats.seatsIncluded} now in use.`
          : "";
      toast.success(`${row.name}'s deletion confirmed.${suffix}`);
      await load();
    } catch {
      toast.error("Could not confirm the deletion");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * The rows that actually occupy a seat — which is what this grid is a picture of.
   *
   * `listOrgPeople` filters on `type` alone, so a `contact`-state profile still comes back
   * in the team list and would render as a FILLED card claiming a seat nobody holds (the
   * meter reading "1 of 5 used" beside a full grid). That is exactly what "remove from
   * seat" produces, and what `expireStaleInvites` produces when a 14-day hold lapses: a
   * person on the roster with no seat and no access. They belong in neither list, so they
   * are dropped here rather than shown as a card the reader cannot account for.
   *
   * Deactivated members are kept: this grid is the only place their Reactivate path lives.
   */
  const seatHolders = useMemo(
    () => team.filter((row) => row.status !== "contact"),
    [team],
  );

  /**
   * One card per seat. Occupied cards are the people already on the team; the
   * rest are open. If the organization is over its allowance (a confirmed
   * over-limit add), the grid grows so no member is hidden.
   */
  const emptyCards = useMemo(() => {
    const total = Math.max(seats?.seatsIncluded ?? 0, seatHolders.length);
    return Math.max(0, total - seatHolders.length);
  }, [seats?.seatsIncluded, seatHolders.length]);

  const pendingCount = seats?.seatsPending ?? 0;

  /** Self-deleted profiles still holding their seat, awaiting a manager's confirmation. */
  const selfDeletedCount = useMemo(
    () => seatHolders.filter((row) => row.selfDeletedAt).length,
    [seatHolders],
  );

  /**
   * The reserved seat is a property of the ORGANIZATION, not of the viewer: an
   * Admin can open this tab without owning the organization, so the dialog must
   * not claim the reader's own seat is the reserved one. The team list's owner row
   * supplies both the id (to compare against the session) and the name (so the
   * copy can name them instead of saying "you"). While either the list or the
   * session is still resolving this is false, and the dialog names the owner
   * generically rather than guessing at the reader's role.
   */
  const ownerRow = useMemo(() => team.find((row) => row.isOwner) ?? null, [team]);
  const viewerIsOwner = Boolean(
    ownerRow?.userId && session?.user?.id && ownerRow.userId === session.user.id,
  );

  /**
   * The reader's own login id, for the "You" sticker on their seat card.
   *
   * Matched against the `userId` each row reports, which every signed-in person has — the
   * synthesized owner row included, so the sticker appears for the owner as well as for a
   * teammate looking at their own seat. Those are exactly the two cases where "which of these
   * is me?" is a question the grid otherwise leaves the reader to answer from the photo. A
   * seat whose person has never signed in has no `userId` and so cannot be the reader.
   */
  const viewerUserId = session?.user?.id ?? null;

  /**
   * The Team Member seat grid — shared by the accordion (managers, Editors) and the plain,
   * non-collapsible section a read-only Viewer gets, so the two cannot drift.
   */
  const teamCardsContent = isLoading ? (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading team…
    </div>
  ) : (
    /* One card per seat. Occupied cards are the people already on the team; the rest are
       open. If the organization is over its allowance (a confirmed over-limit add), the
       grid grows so no member is hidden. */
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {seatHolders.map((row) => {
        // A self-deleted profile holds its seat on purpose and offers exactly one action —
        // confirming the deletion — so every other control is withheld from it.
        const isSelfDeleted = Boolean(row.selfDeletedAt);
        return (
          <FilledSeatCard
            key={row.id}
            row={row}
            isViewer={Boolean(viewerUserId) && row.userId === viewerUserId}
            // Both actions are withheld from a reader who may not manage, which is also what
            // turns the card into plain content. A self-deleted profile has no login left to
            // edit, so its management screen would offer changes it cannot keep.
            onEdit={canManage && !isSelfDeleted ? openEdit : undefined}
            // The Owner's seat is reserved, and their row is synthesized rather than stored,
            // so there is no seat to give back and no profileId to address. A deactivated
            // member holds nothing either, and their removal is undone from their own screen.
            // A self-deleted profile is confirmed, not removed — see onConfirmDeletion.
            onRemove={
              !canManage || row.isOwner || row.deactivatedAt || isSelfDeleted
                ? undefined
                : (target) => setRemoving(target)
            }
            // Only for an invitation that has not been answered yet: the badge on the card
            // says "Invited", and an accepted member has no email to chase. The Owner has no
            // profile to address at all.
            onResend={
              canManage &&
              !row.isOwner &&
              !row.deactivatedAt &&
              !isSelfDeleted &&
              row.status === "invited" &&
              row.profileId
                ? submitResendInvite
                : undefined
            }
            // The Owner/Admin's confirmation of the member's own deletion. Manager-only, and
            // only while the marker is actually set.
            onConfirmDeletion={
              canManage && isSelfDeleted
                ? (target) => setConfirmingSelfDeletion(target)
                : undefined
            }
            isResending={resendingProfileId === row.profileId}
            isConfirmingDeletion={
              isSubmitting && confirmingSelfDeletion?.profileId === row.profileId
            }
            resendCooldownSeconds={resendCooldownSecondsLeft(row.profileId)}
          />
        );
      })}
      {/* Open seats are an invitation to add somebody, so they are the manager's view of
          this grid — a reader without the permission sees the people who hold seats and
          nothing suggesting they could fill one. */}
      {canManage
        ? Array.from({ length: emptyCards }).map((_, index) => (
            <EmptySeatCard key={`empty-${index}`} onAdd={openAdd} />
          ))
        : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Spec T3 Part A item 3: usage, with pending invites called out.
          The meter is the TAB's summary rather than a section's: it counts seats, and
          only Team Members hold one, so it belongs above both lists instead of inside
          either of them. */}
      {seats ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-1">
            <p className="text-sm text-muted-foreground">
              {seats.seatsUsed} of {seats.seatsIncluded} seats used
              {pendingCount > 0
                ? ` · ${pendingCount} pending invite${pendingCount === 1 ? "" : "s"}`
                : ""}
            </p>
            <SeatUsageInfoDialog
              seats={seats}
              ownerName={ownerRow?.name ?? null}
              viewerIsOwner={viewerIsOwner}
            />
          </div>
          <RolesPermissionsDialog />
        </div>
      ) : null}

      {/* A reader who cannot manage is told what the tab is for. Without this the tab would
          simply have no buttons where the owner sees them, which reads as a broken page rather
          than as a permission — and the reason is worth stating once, above both lists. */}
      {!canManage && !isLoading ? (
        <p className="text-xs text-muted-foreground">
          You can see who is in your organization and what they can reach. Only the owner and
          admins can change access.
        </p>
      ) : null}

      {/* A member who deleted their own profile keeps their seat until somebody acknowledges
          it. Without this line the seat would simply look used by an Active member, and the
          only way to discover the confirmation would be to inspect every card. Manager-only,
          because only a manager has the action this points at. */}
      {canManage && selfDeletedCount > 0 && !isLoading ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50/50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {selfDeletedCount === 1
              ? "1 Team Member deleted their own profile. Their seat is still held — confirm the deletion from their seat card to release it."
              : `${selfDeletedCount} Team Members deleted their own profiles. Their seats are still held — confirm each deletion from its seat card to release them.`}
          </span>
        </p>
      ) : null}

      {/* Team Members is the tab's only list, so it is plain content rather than an
          accordion: a one-item accordion is chrome that hides the thing it exists to show. */}
      <div className="rounded-xl border bg-card px-4">
        <div className="flex flex-wrap items-center gap-2 py-4 text-left">
          <UserRound className="h-4 w-4 shrink-0 text-accent-blue" />
          <span className="text-base font-medium">Team Members</span>
          <Badge variant="secondary">{seatHolders.length}</Badge>
          <span className="text-xs font-normal text-muted-foreground">
            Your organization&rsquo;s own people — each one holds a seat.
          </span>
          {/* The section's own action, in its header so it is reachable without scrolling
              the grid. Rendered only for a reader who may manage. */}
          {canManage ? (
            <span className="ml-auto shrink-0">
              <Button
                size="sm"
                className={SECTION_ACTION_CLASS}
                onClick={openAdd}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Team Member
              </Button>
            </span>
          ) : null}
        </div>
        <div className="pb-4">{teamCardsContent}</div>
      </div>

      {/* ── Add Team Member ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        {/* A flex column rather than a scrolling box: the header and the footer stay put
            while the middle scrolls, so Back / Cancel / Add are always reachable without
            scrolling to the bottom of a long form. `overflow-y-auto` on DialogContent
            itself was what pushed the buttons off-screen behind the fields. */}
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {addStep === "choose"
                ? "Add Team Member"
                : addStep === "new"
                  ? "New contact"
                  : "Existing contact"}
            </DialogTitle>
            <DialogDescription>
              {/* Settings → People & Access only ever adds Team Members. Collaborators are
                  invited from inside a plan (Create Benefits / Key Contacts), per the spec,
                  so this is not a place to create one. */}
              {addStep === "choose"
                ? "One of your organization's own people. They hold a seat — scope them to the plans and benefit categories they should reach."
                : addStep === "new"
                  ? "Enter their details, then scope them to the plans and benefit categories they should reach. They are added as a Team Member and hold a seat."
                  : "Pick somebody already on one of your plans. Their name and email come from the contact, so there is nothing to retype."}
            </DialogDescription>
          </DialogHeader>

          {/* The only scrollable region. `min-h-0` is load-bearing: a flex child defaults to
              `min-height: auto`, which lets a tall child grow the column instead of
              scrolling inside it — and then the footer is pushed out again.

              `pr-3` is the gap between the content and the scrollbar. A scroll container's
              content otherwise runs flush to the bar, which is what put the bordered access
              boxes against it: on Windows the bar takes layout space (~15px) rather than
              overlaying, so the box border and the scrollbar track read as a single edge. */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-3">
          {addStep === "choose" ? (
            /* ── Slide 1: how is this person being added? ──────────────────────
                Two square targets instead of one form with the other path buried in it.
                The advisor's first question really is "is this somebody we already know?",
                and asking it first is what lets slide 2 show only the fields that apply. */
            <div className="grid grid-cols-2 gap-4 py-2">
              <button
                type="button"
                onClick={() => setAddStep("new")}
                className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border bg-card p-4 text-center transition hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <UserRoundPlus className="h-6 w-6" />
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-medium">New Contact</span>
                  <span className="block text-xs text-muted-foreground">
                    Type their details by hand
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAddStep("existing")}
                className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border bg-card p-4 text-center transition hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Search className="h-6 w-6" />
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Existing Contact</span>
                  <span className="block text-xs text-muted-foreground">
                    Pick somebody already on your plans
                  </span>
                </span>
              </button>

            </div>
          ) : (
          <div className="space-y-4">
            {/* Access comes FIRST on both slides — above the New Contact fields and above
                the Existing Contact search. Role and scope are the decision the advisor has
                already made by the time they open this modal; working out *who* the person
                is, is the lookup that serves that decision, not the other way round. */}
            <AccessFields
              value={addAccess}
              onChange={setAddAccess}
              plans={plans}
              roles={TEAM_MEMBER_ROLES}
              allowAllPlans
              customCategories={customCategories}
            />

            {/* ── Add an existing contact (slide 2, "Existing Contact") ─────
                Only rendered on its own slide. It previously sat above the manual
                name/email fields on a single form, which put a search box directly on top
                of two inputs that invited the advisor to retype somebody the system
                already held — the exact duplication this feature exists to remove.

                Once a contact is picked the search is replaced by a card naming them, so
                the form always says who it is about — and can be cleared if the wrong
                person was picked. */}
            {addStep !== "existing" ? null : pickedContact ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {pickedContact.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pickedContact.email}
                    {pickedContact.planCount > 0
                      ? ` · already on ${pickedContact.planCount} plan${
                          pickedContact.planCount === 1 ? "" : "s"
                        }`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearPickedContact}
                  disabled={isSubmitting}
                >
                  Clear
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="add-existing-contact">
                  Add an existing contact
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="add-existing-contact"
                    value={contactQuery}
                    onChange={(event) => setContactQuery(event.target.value)}
                    placeholder="Search contacts already on your plans…"
                    className="pl-9"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </div>

                {isSearchingContacts ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Searching contacts…
                  </p>
                ) : contactResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {contactSearchError
                      ? "Could not load your contacts just now. Go back to add somebody new instead."
                      : contactQuery.trim()
                        ? "No contacts match that. Go back to add somebody new instead."
                        : "Nobody to promote yet — contacts from your plans will appear here."}
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    <ul className="divide-y">
                      {contactResults.map((contact) => (
                        <li key={contact.profileId}>
                          <button
                            type="button"
                            onClick={() => applyPickedContact(contact)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/60 focus:outline-none focus-visible:bg-muted/60"
                          >
                            <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                              <Headshot
                                src={contact.headshot}
                                alt={contact.name}
                                monogramName={contact.name}
                                wrapperClassName="rounded-full"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {contact.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[contact.jobTitle, contact.companyName]
                                  .filter(Boolean)
                                  .join(" · ") || contact.email}
                              </span>
                            </span>
                            {contact.planCount > 0 ? (
                              <Badge variant="outline" className="shrink-0">
                                {contact.planCount} plan
                                {contact.planCount === 1 ? "" : "s"}
                              </Badge>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {addStep === "new" ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="team-member-first-name">First Name</Label>
                    <Input
                      id="team-member-first-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Jane"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-member-last-name">Last Name</Label>
                    <Input
                      id="team-member-last-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-member-company">
                    Company / Organization
                  </Label>
                  <Input
                    id="team-member-company"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="e.g. Benefits Provider Inc."
                  />
                  <p className="text-xs text-muted-foreground">
                    A company you have not used before is added to your Partner /
                    Provider list.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-member-title">Job Title</Label>
                  <Input
                    id="team-member-title"
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    placeholder="e.g. HR Director"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-member-email">Email</Label>
                  <Input
                    id="team-member-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="jane@yourfirm.com"
                  />
                </div>

                {/* Phone and extension share a row: the extension is meaningless without the
                    number, and giving it its own row would overstate its importance. */}
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem]">
                  <div className="space-y-2">
                    <Label htmlFor="team-member-phone">Phone</Label>
                    <Input
                      id="team-member-phone"
                      type="tel"
                      value={phone ? formatPhoneInput(phone) : ""}
                      onChange={(event) =>
                        setPhone(
                          event.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-member-ext">Ext.</Label>
                    <Input
                      id="team-member-ext"
                      value={phoneExtension}
                      onChange={(event) =>
                        setPhoneExtension(
                          event.target.value.replace(/\D/g, "").slice(0, 8),
                        )
                      }
                      placeholder="123"
                    />
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <Label>Headshot (optional)</Label>
                  <UniversalImageEditorModal
                    value={headshot || ""}
                    fileName={headshotFileName || ""}
                    onChange={(value, fileName) => {
                      setHeadshot(value);
                      setHeadshotFileName(fileName || "");
                    }}
                    onRemove={() => {
                      setHeadshot("");
                      setHeadshotFileName("");
                    }}
                    placeholder="Upload Headshot"
                    modalTitle="Edit Headshot"
                    modalDescription="Upload a clear, front-facing photo. Keep the face inside the circle guide for best results."
                    saveButtonText="Save Headshot"
                    type="headshot"
                    autoSizeOnOpen={true}
                    forceCircularGuidelines={true}
                  />
                </div>

              </div>
            ) : null}
          </div>
          )}

          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            {addStep === "choose" ? null : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddStep("choose")}
                disabled={isSubmitting}
                className="sm:mr-auto"
              >
                Back
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setIsAddOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {/* No submit on the chooser: there is nothing to submit yet, and a disabled
                button would only invite the advisor to wonder what is missing. */}
            {addStep === "choose" ? null : (
              <Button
                onClick={() => void submitAdd(confirmUpgrade)}
                disabled={isSubmitting || !email.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Add Team Member
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── T6: Manage access — the per-person Assignment Management screen ── */}
      <PersonAccessScreen
        open={managingProfileId !== null}
        onOpenChange={(open) => {
          if (!open) setManagingProfileId(null);
        }}
        profileId={managingProfileId}
        onChanged={() => {
          // Only this person's row — not the whole roster.
          if (managingProfileId) void refreshPerson(managingProfileId);
        }}
        // Deleting the profile removes the row entirely, which the in-place refresh cannot
        // express, so that one action still reloads the list.
        onDeleted={() => void load()}
      />

      {/* ── Read-only dialog for the owner (no profile to manage) ── */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.personType === "collaborator"
                ? "Edit Collaborator"
                : "Edit Team Member"}
            </DialogTitle>
            <DialogDescription>
              {editing?.isOwner
                ? "The account owner's own details are edited in the Profile tab. Their access always covers every plan."
                : editing?.personType === "collaborator"
                  ? "Update this person's name, role, and access. No seat is used, and they can never publish, invite, delete, or see organization settings."
                  : "Update this person's name, role, and access. Their profile is shared across every plan."}
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                  <Headshot
                    src={editing.headshot}
                    alt={editing.name}
                    monogramName={editing.name}
                    wrapperClassName="rounded-full"
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{editing.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {editing.email}
                  </p>
                </div>
                <Badge variant="outline" className="ml-auto">
                  {PROFILE_STATE_LABELS[editing.status] ?? editing.status}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-team-member-name">Name</Label>
                <Input
                  id="edit-team-member-name"
                  value={editName}
                  disabled={editing.isOwner}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>

              <AccessFields
                value={editAccess}
                onChange={setEditAccess}
                plans={plans}
                roles={TEAM_MEMBER_ROLES}
                allowAllPlans
                disabled={editing.isOwner}
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              disabled={isSubmitting}
            >
              {editing?.isOwner ? "Close" : "Cancel"}
            </Button>
            {editing?.isOwner ? null : (
              <Button onClick={() => void submitEdit()} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserRound className="mr-2 h-4 w-4" />
                )}
                Save changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spec T3 item 3: the upgrade confirm. Not a hard block. */}
      <AlertDialog open={showUpgradeConfirm} onOpenChange={setShowUpgradeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>All seats are in use</AlertDialogTitle>
            <AlertDialogDescription>
              {seats
                ? `You are using ${seats.seatsUsed} of ${seats.seatsIncluded} seats. Adding another Team Member increases your seat allowance.`
                : "Adding another Team Member increases your seat allowance."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                setConfirmUpgrade(true);
                void submitAdd(true);
              }}
            >
              {isSubmitting ? "Adding…" : "Add and increase seats"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Removing a seat means one of two different things depending on whether the
          invite was ever accepted, so the copy names the one that applies instead of
          leaving the reader to guess — and unlike the Collaborator dialog above, this
          one changes the seat count. */}
      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removing?.name} from this seat?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.status === "invited"
                ? "They have not accepted their invite yet, so this is fully reversible: they go back to being a Contact — no seat, no access, and not a Collaborator — and the seat is released. Their profile and every note on it are kept, so you can Promote them again at any time."
                : "They have already accepted, so an active account cannot go back to being a Contact. They will be deactivated instead: access to every plan they were assigned to ends immediately and their seat is released. Their profile and history are kept, and reactivating them takes the seat back."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                if (removing) void submitRemoveFromSeat(removing);
              }}
            >
              {isSubmitting ? "Removing…" : "Remove from seat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirming a member's own deletion. Destructive and irreversible — the profile and
          its plan access are removed — but the seat it was holding is only released now, so
          the copy names what happens to the seat as well as to the person. */}
      <AlertDialog
        open={confirmingSelfDeletion !== null}
        onOpenChange={(open) => !open && setConfirmingSelfDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {confirmingSelfDeletion?.name}&rsquo;s deletion?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They deleted their own profile, so their account and login are already gone.
              Their seat has been held until now. Confirming removes them from your
              organization
              {(confirmingSelfDeletion?.planAccess.planIds.length ?? 0) > 0
                ? `, revokes their access to ${
                    confirmingSelfDeletion?.planAccess.planIds.length
                  } plan${
                    confirmingSelfDeletion?.planAccess.planIds.length === 1 ? "" : "s"
                  }`
                : ""}
              , and releases the seat. Their profile is deleted and this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                if (confirmingSelfDeletion) {
                  void submitConfirmSelfDeletion(confirmingSelfDeletion);
                }
              }}
            >
              {isSubmitting ? "Confirming…" : "Confirm deletion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
