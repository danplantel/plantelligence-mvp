"use client";

import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  HelpCircle,
  Info,
  Loader2,
  Mail,
  Pencil,
  Plus,
  UserRound,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Headshot } from "@/components/ui/headshot";
import type { SeatUsageSummary } from "@/components/pages/seat-meter";
// The same dialog Edit Client, the Create Plan wizard and Add/Edit Benefit use, so an
// invite means one thing everywhere.
import { InviteCollaboratorDialog } from "@/components/teammates/invite-collaborator-dialog";
import { BENEFIT_CONTACT_CATEGORIES } from "@/lib/benefit-contacts";
import {
  describeAllRoles,
  describeRole,
  type RoleCapability,
} from "@/lib/teammates/role-summary";
import {
  COLLABORATOR_PRESET_ROLES,
  PRESET_ROLE_LABELS,
  PRESET_ROLES,
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
  planAccess: { scope: "all" | "certain" | "none"; planIds: string[]; planNames: string[] };
  categoryAccess: { scope: "all" | "certain" | "none"; categories: string[] };
  allPlans: boolean;
  /** ISO timestamp while deactivated; null/absent for a live profile. */
  deactivatedAt?: string | null;
}

interface PlanOption {
  id: string;
  companyName: string;
}

type PlanScopeChoice = "all_plans" | "certain_plans";
type CategoryScopeChoice = "all" | "certain";

/** Team-Member roles only; Contributor/Reviewer are collaborator presets. */
const TEAM_MEMBER_ROLES: TeammateAssignmentRole[] = [
  "owner",
  "admin",
  "editor",
  "viewer",
];

interface AccessDraft {
  role: TeammateAssignmentRole;
  planScope: PlanScopeChoice;
  planIds: string[];
  categoryScope: CategoryScopeChoice;
  categories: string[];
}

const EMPTY_ACCESS: AccessDraft = {
  role: "editor",
  planScope: "all_plans",
  planIds: [],
  categoryScope: "all",
  categories: [],
};

/**
 * The same draft, scoped for an external Collaborator: Contributor (the server's
 * own default for that type) and an explicit plan selection, because All Plans is
 * not offered to Collaborators (spec T2a).
 */
const EMPTY_COLLABORATOR_ACCESS: AccessDraft = {
  role: "contributor",
  planScope: "certain_plans",
  planIds: [],
  categoryScope: "all",
  categories: [],
};

function planAccessLabel(row: TeamMemberRow): string {
  if (row.isOwner || row.planAccess.scope === "all") return "All Plans";
  if (row.planAccess.scope === "none") return "No plan access";
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

function isPresetRole(role: TeammateAssignmentRole): role is TeammatePresetRole {
  return (PRESET_ROLES as readonly string[]).includes(role);
}

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

function CapabilityChips({
  title,
  items,
  positive,
}: {
  title: string;
  items: string[];
  positive?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge
            key={item}
            variant={positive ? "secondary" : "outline"}
            className="text-[11px] font-normal"
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/**
 * The capability list for one role. Every item comes from the SAME grid the API
 * enforces (see lib/teammates/role-summary.ts), so what is shown here cannot
 * drift from what a person can actually do.
 */
function RoleCapabilityBody({ capability }: { capability: RoleCapability }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{capability.summary}</p>
      <CapabilityChips title="Can edit" items={capability.edit} positive />
      <CapabilityChips title="View only" items={capability.view} />
      <CapabilityChips title="No access" items={capability.none} />
      <CapabilityChips title="Allowed" items={capability.allowed} positive />
      <CapabilityChips title="Not allowed" items={capability.notAllowed} />
      {capability.isReadOnly ? (
        <p className="text-xs text-muted-foreground">
          Read-only: this role cannot save any changes.
        </p>
      ) : null}
    </div>
  );
}

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

/** Explains the role currently selected in the form. */
function RoleHelpPopover({ role }: { role: TeammateAssignmentRole }) {
  if (!isPresetRole(role)) return null;
  const capability = describeRole(role);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          What can this role do?
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-sm font-semibold">{capability.label}</p>
        <RoleCapabilityBody capability={capability} />
      </PopoverContent>
    </Popover>
  );
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

/**
 * Explains the seat rules next to the live count.
 *
 * Every rule below is one the server actually enforces in
 * [`lib/teammates/seats.server.ts`](lib/teammates/seats.server.ts) — the 14-day
 * invite hold (`INVITE_SEAT_HOLD_DAYS`), the owner's seat
 * (`OWNER_CONSUMES_SEAT`), and confirm-instead-of-block at the limit
 * (`assertSeatAvailable`) — and the figures come from the same `getSeatUsage`
 * payload the meter renders, so the explanation cannot drift from the numbers.
 */
function SeatUsageInfoDialog({
  seats,
  ownerName,
  viewerIsOwner,
}: {
  seats: SeatUsageSummary;
  /** Display name of the ORGANIZATION owner, for the reserved-seat rule. */
  ownerName: string | null;
  /** True only when the signed-in user is that owner. */
  viewerIsOwner: boolean;
}) {
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
   * The reserved seat belongs to the ORGANIZATION's owner (`Organization.ownerUserId`
   * — see `OWNER_CONSUMES_SEAT` in seats.server.ts), not to whoever is reading the
   * page. An Admin reaches this tab without owning the organization, so "your own
   * seat" would be a false statement for them. All three variants are true for
   * their reader; only the second person changes.
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

/* ───────────────────────── Seat cards ───────────────────────── */

/** A filled seat: an existing Team Member. Clicking opens the Edit modal. */
function FilledSeatCard({
  row,
  onEdit,
}: {
  row: TeamMemberRow;
  onEdit: (row: TeamMemberRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onEdit(row)}
      className="group relative flex h-full flex-col items-center gap-3 rounded-xl border bg-card p-4 text-center transition hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Pencil className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />

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

      <span className="w-full space-y-1">
        <span className="block truncate text-sm font-medium">{row.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {row.email}
        </span>
      </span>

      <span className="flex flex-wrap items-center justify-center gap-1">
        <Badge variant={row.isOwner ? "default" : "secondary"}>
          {row.isOwner ? "Owner" : PRESET_ROLE_LABELS[row.role]}
        </Badge>
        <Badge variant="outline">
          {PROFILE_STATE_LABELS[row.status] ?? row.status}
        </Badge>
      </span>

      <span className="mt-auto w-full space-y-0.5 text-[11px] leading-tight text-muted-foreground">
        <span className="block truncate">{planAccessLabel(row)}</span>
        <span className="block truncate">{categoryAccessLabel(row)}</span>
      </span>
    </button>
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
 * One Collaborator: an external person with scoped access and no seat.
 *
 * Rendered as a row rather than a card because the card grid means "seats", and a
 * Collaborator is defined by not holding one. The company is shown because a
 * partner firm usually sends several people (T1 groups them on one
 * `TeammateCompany`).
 */
function CollaboratorRow({
  row,
  onEdit,
  onToggleActive,
}: {
  row: TeamMemberRow;
  onEdit: (row: TeamMemberRow) => void;
  onToggleActive: (row: TeamMemberRow) => void;
}) {
  const isDeactivated = Boolean(row.deactivatedAt);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        <Headshot
          src={row.headshot}
          alt={row.name}
          monogramName={row.name}
          wrapperClassName="rounded-full"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {row.email}
          {row.companyName ? ` · ${row.companyName}` : ""}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {planAccessLabel(row)} · {categoryAccessLabel(row)}
        </span>
      </span>

      <span className="flex shrink-0 flex-wrap items-center gap-1">
        <Badge variant="secondary">{PRESET_ROLE_LABELS[row.role]}</Badge>
        {isDeactivated ? (
          <Badge variant="outline" className="text-muted-foreground">
            Deactivated
          </Badge>
        ) : (
          <Badge variant="outline">
            {PROFILE_STATE_LABELS[row.status] ?? row.status}
          </Badge>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onToggleActive(row)}>
          {isDeactivated ? "Reactivate" : "Deactivate"}
        </Button>
      </span>
    </li>
  );
}

/* ───────────────────── Shared access fields ───────────────────── */

function AccessFields({
  value,
  onChange,
  plans,
  roles = TEAM_MEMBER_ROLES,
  allowAllPlans = true,
  disabled,
}: {
  value: AccessDraft;
  onChange: (next: AccessDraft) => void;
  plans: PlanOption[];
  /** Presets this person type may hold; a Collaborator can never be Owner/Admin. */
  roles?: readonly TeammateAssignmentRole[];
  /** Spec T2a: "All Plans is shown for Team Members only." */
  allowAllPlans?: boolean;
  disabled?: boolean;
}) {
  const toggle = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Role</Label>
            <RoleHelpPopover role={value.role} />
          </div>
          <Select
            value={value.role}
            disabled={disabled}
            onValueChange={(role) =>
              onChange({ ...value, role: role as TeammateAssignmentRole })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((option) => (
                <SelectItem key={option} value={option}>
                  {PRESET_ROLE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Plan access</Label>
          <Select
            value={value.planScope}
            disabled={disabled}
            onValueChange={(scope) =>
              onChange({ ...value, planScope: scope as PlanScopeChoice })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowAllPlans ? (
                <SelectItem value="all_plans">All Plans</SelectItem>
              ) : null}
              <SelectItem value="certain_plans">Certain Plans</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.planScope === "certain_plans" ? (
        <div className="space-y-2">
          <Label>Which plans</Label>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
            {plans.length === 0 ? (
              <p className="text-xs text-muted-foreground">No plans yet.</p>
            ) : (
              plans.map((plan) => (
                <label key={plan.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    disabled={disabled}
                    checked={value.planIds.includes(plan.id)}
                    onCheckedChange={() =>
                      onChange({ ...value, planIds: toggle(value.planIds, plan.id) })
                    }
                  />
                  {plan.companyName}
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Benefits access</Label>
        <Select
          value={value.categoryScope}
          disabled={disabled}
          onValueChange={(scope) =>
            onChange({ ...value, categoryScope: scope as CategoryScopeChoice })
          }
        >
          <SelectTrigger className="sm:w-1/2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="certain">Certain categories</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.categoryScope === "certain" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {BENEFIT_CONTACT_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
              <Checkbox
                disabled={disabled}
                checked={value.categories.includes(category)}
                onCheckedChange={() =>
                  onChange({
                    ...value,
                    categories: toggle(value.categories, category),
                  })
                }
              />
              {category}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── Section ───────────────────────── */

export function TeamMembersSection() {
  const [team, setTeam] = useState<TeamMemberRow[]>([]);
  const [seats, setSeats] = useState<SeatUsageSummary | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [addAccess, setAddAccess] = useState<AccessDraft>(EMPTY_ACCESS);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editAccess, setEditAccess] = useState<AccessDraft>(EMPTY_ACCESS);

  // Collaborators: external people, no seat. They get their own list and their own
  // Add flow, because they are created with a different type and cannot be given
  // All Plans or the Owner/Admin presets.
  const [collaborators, setCollaborators] = useState<TeamMemberRow[]>([]);
  const [collaboratorsOpen, setCollaboratorsOpen] = useState("collaborators");
  /** Which person type the Add modal is creating right now. */
  const [addType, setAddType] = useState<"team_member" | "collaborator">(
    "team_member",
  );
  /** The collaborator awaiting a deactivate confirmation. */
  const [deactivating, setDeactivating] = useState<TeamMemberRow | null>(null);

  /**
   * Invite Collaborator — the email-sending path.
   *
   * Deliberately a SEPARATE action from "Add Collaborator": the latter grants scoped
   * access silently (an Owner sharing a screen may not want mail sent yet), while this
   * one creates the same profile and assignment AND emails the person. Two intents, two
   * buttons, so neither has to guess.
   */
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
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
          collaborators?: TeamMemberRow[];
          seats?: SeatUsageSummary;
        };
        setTeam(body.team ?? []);
        setCollaborators(body.collaborators ?? []);
        setSeats(body.seats ?? null);
      } else {
        setTeam([]);
        setCollaborators([]);
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

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setAddType("team_member");
    setName("");
    setEmail("");
    setAddAccess(EMPTY_ACCESS);
    setConfirmUpgrade(false);
    setIsAddOpen(true);
  };

  /** The same modal, forced to the free Collaborator type and its own defaults. */
  const openAddCollaborator = () => {
    setAddType("collaborator");
    setName("");
    setEmail("");
    setAddAccess(EMPTY_COLLABORATOR_ACCESS);
    setConfirmUpgrade(false);
    setIsAddOpen(true);
  };

  const openEdit = (row: TeamMemberRow) => {
    setEditing(row);
    setEditName(row.name);
    setEditAccess({
      role: row.isOwner ? "owner" : row.role,
      // A Collaborator is never offered All Plans (T2a). A collaborator whose
      // assignments happen to cover every plan reports scope "all", so that maps
      // back to the explicit list of plans they actually have — the same access,
      // expressed in the only form their editor accepts.
      planScope:
        row.personType === "collaborator"
          ? "certain_plans"
          : row.planAccess.scope === "all"
            ? "all_plans"
            : "certain_plans",
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

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/teammates/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          // Only the Collaborator flow pins the type. The Team Member flow leaves it
          // to the server's email-domain guess, which is what the modal's own copy
          // explains.
          ...(addType === "collaborator" ? { type: "collaborator" } : {}),
          role: addAccess.role,
          planScope: addAccess.planScope,
          planIds: addAccess.planIds,
          categoryScope: addAccess.categoryScope,
          categories: addAccess.categories,
          ...(confirmed ? { confirmUpgrade: true } : {}),
        }),
      });

      const body = (await response.json()) as {
        error?: string;
        code?: string;
        member?: { personType: string; assignmentCount: number };
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

      toast.success(
        `${email} added as a ${
          body.member?.personType === "collaborator" ? "Collaborator" : "Team Member"
        } with ${body.member?.assignmentCount ?? 0} plan assignment(s).`,
      );
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
          categories: editAccess.categories,
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
   * Deactivate or reactivate a person (spec T6): deactivating ends their access but
   * keeps the profile, reactivating restores it. Neither touches a seat — seats
   * belong to Team Members — so this needs no upgrade confirm. The response's meter
   * is folded back in anyway so the header stays truthful if that ever changes.
   */
  const submitToggleActive = async (row: TeamMemberRow) => {
    const reactivating = Boolean(row.deactivatedAt);
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/teammates/team/${row.profileId ?? row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: reactivating ? "reactivate" : "deactivate",
          }),
        },
      );

      const body = (await response.json()) as {
        error?: string;
        seats?: SeatUsageSummary;
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not update this person");
        return;
      }

      if (body.seats) setSeats(body.seats);
      setDeactivating(null);
      toast.success(
        reactivating ? `${row.name} reactivated.` : `${row.name} deactivated.`,
      );
      await load();
    } catch {
      toast.error("Could not update this person");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * One card per seat. Occupied cards are the people already on the team; the
   * rest are open. If the organization is over its allowance (a confirmed
   * over-limit add), the grid grows so no member is hidden.
   */
  const emptyCards = useMemo(() => {
    const total = Math.max(seats?.seatsIncluded ?? 0, team.length);
    return Math.max(0, total - team.length);
  }, [seats?.seatsIncluded, team.length]);

  const pendingCount = seats?.seatsPending ?? 0;

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

  return (
    <div className="space-y-6">
      {/* Spec T3 Part A item 3: usage, with pending invites called out. */}
      {seats ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-base font-medium">Team Members</h3>
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RolesPermissionsDialog />
            <Button onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Team Member
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading team…
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {team.map((row) => (
            <FilledSeatCard key={row.id} row={row} onEdit={openEdit} />
          ))}
          {Array.from({ length: emptyCards }).map((_, index) => (
            <EmptySeatCard key={`empty-${index}`} onAdd={openAdd} />
          ))}
        </div>
      )}

      {/* ── Collaborators ──
          The other half of the team: external people with scoped access and no
          seat. They are listed here rather than as seat cards because a seat is
          precisely what they do not consume. Rendered only once the lists have
          loaded, so an empty organization cannot flash "No Collaborators yet"
          while the request is still in flight. */}
      {isLoading ? null : (
      <Accordion
        type="single"
        collapsible
        value={collaboratorsOpen}
        onValueChange={setCollaboratorsOpen}
        className="rounded-xl border bg-card px-4"
      >
        <AccordionItem value="collaborators" className="border-b-0">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex flex-1 flex-wrap items-center gap-2 pr-2 text-left">
              <span className="text-base font-medium">Collaborators</span>
              <Badge variant="secondary">{collaborators.length}</Badge>
              <span className="text-xs font-normal text-muted-foreground">
                External people — free, no seat.
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Collaborators yet. Add one when someone outside your organization
                needs access to a plan — a provider, a TPA contact, a specialist.
              </p>
            ) : (
              <ul className="space-y-2">
                {collaborators.map((row) => (
                  <CollaboratorRow
                    key={row.id}
                    row={row}
                    onEdit={openEdit}
                    onToggleActive={(target) => {
                      // Reactivating is safe and immediate; deactivating ends access,
                      // so it asks first.
                      if (target.deactivatedAt) void submitToggleActive(target);
                      else setDeactivating(target);
                    }}
                  />
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Whatever role they hold, they can never publish, invite, delete, or
                see organization settings.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setIsInviteOpen(true)}
                  disabled={plans.length === 0}
                  title={
                    plans.length === 0
                      ? "Create a plan before inviting a collaborator"
                      : "Email someone an invite to complete a plan's sections"
                  }
                >
                  <UserRoundPlus className="mr-2 h-4 w-4" />
                  Invite Collaborator
                </Button>
                <Button variant="outline" onClick={openAddCollaborator}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Collaborator
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      )}

      {/* ── Invite Collaborator (sends the email) ── */}
      <InviteCollaboratorDialog
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        planOptions={plans.map((plan) => ({
          id: plan.id,
          name: plan.companyName,
        }))}
        source="settings"
        onInvited={() => void load()}
      />

      {/* ── Add Team Member / Collaborator ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {addType === "collaborator" ? "Add Collaborator" : "Add Team Member"}
            </DialogTitle>
            <DialogDescription>
              {addType === "collaborator"
                ? "Someone outside your organization. No seat is used — scope them to the plans and benefit categories they should reach."
                : "The email domain decides the default: a match with your organization adds a Team Member (uses a seat), any other domain adds a Collaborator (free)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="team-member-name">Name</Label>
                <Input
                  id="team-member-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jane Smith"
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
            </div>

            <AccessFields
              value={addAccess}
              onChange={setAddAccess}
              plans={plans}
              roles={
                addType === "collaborator"
                  ? COLLABORATOR_PRESET_ROLES
                  : TEAM_MEMBER_ROLES
              }
              allowAllPlans={addType !== "collaborator"}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitAdd(confirmUpgrade)}
              disabled={isSubmitting || !email.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {addType === "collaborator" ? "Add Collaborator" : "Add Team Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Team Member / Collaborator ── */}
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
                roles={
                  editing.personType === "collaborator"
                    ? COLLABORATOR_PRESET_ROLES
                    : TEAM_MEMBER_ROLES
                }
                allowAllPlans={editing.personType !== "collaborator"}
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

      {/* Spec T6: deactivate ends access but keeps the profile, so it is reversible
          and asks for confirmation rather than warning about data loss. */}
      <AlertDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {deactivating?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They immediately lose access to every plan they were assigned to. Their
              profile, notes and history are kept, and you can reactivate them at any
              time. No seat is affected — Collaborators never use one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                if (deactivating) void submitToggleActive(deactivating);
              }}
            >
              {isSubmitting ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
