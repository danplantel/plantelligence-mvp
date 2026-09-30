"use client";

import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  HelpCircle,
  Loader2,
  Mail,
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
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import type { SeatUsageSummary } from "@/components/pages/seat-meter";
// The same dialog Edit Client, the Create Plan wizard and Add/Edit Benefit use, so an
// invite means one thing everywhere.
import { InviteCollaboratorDialog } from "@/components/teammates/invite-collaborator-dialog";
import { BENEFIT_CONTACT_CATEGORIES } from "@/lib/benefit-contacts";
import { PersonAccessScreen } from "@/components/teammates/person-access-screen";
// Shared with the dashboard's seats card, so the seat rules are written down once.
import { SeatUsageInfoDialog } from "@/components/teammates/seats/seat-usage-info-dialog";
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
}: {
  row: TeamMemberRow;
  onEdit: (row: TeamMemberRow) => void;
  onRemove?: (row: TeamMemberRow) => void;
}) {
  return (
    <div className="group relative flex h-full flex-col items-center gap-3 rounded-xl border bg-card p-4 text-center transition hover:border-primary/60 hover:shadow-sm">
      <button
        type="button"
        onClick={() => onEdit(row)}
        aria-label={`Manage ${row.name}`}
        className="flex w-full flex-1 flex-col items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(row)}
          className="mt-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserRoundMinus className="h-3 w-3" />
          Remove from seat
        </button>
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
  onRemove,
}: {
  row: TeamMemberRow;
  onEdit: (row: TeamMemberRow) => void;
  onToggleActive: (row: TeamMemberRow) => void;
  /** Removes the person and the access that goes with them. Absent while loading. */
  onRemove: (row: TeamMemberRow) => void;
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

      <span className="flex shrink-0 flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onToggleActive(row)}>
          {isDeactivated ? "Reactivate" : "Deactivate"}
        </Button>
        {/* Deactivate ends access but keeps the person; Remove is the way out of the
            organization, which is what "I added this collaborator by mistake" asks for. */}
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700"
          onClick={() => onRemove(row)}
        >
          <UserRoundMinus className="mr-1.5 h-3.5 w-3.5" />
          Remove
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
  customCategories = [],
  disabled,
}: {
  value: AccessDraft;
  onChange: (next: AccessDraft) => void;
  plans: PlanOption[];
  /** Presets this person type may hold; a Collaborator can never be Owner/Admin. */
  roles?: readonly TeammateAssignmentRole[];
  /** Spec T2a: "All Plans is shown for Team Members only." */
  allowAllPlans?: boolean;
  /**
   * The organisation's own Custom benefit titles.
   *
   * A Custom benefit is stored as category "Company / Plan Sponsor" under whatever title the
   * advisor gave it, so these are offered as their own rows: the advisor recognises "Wellness
   * Programs", not the storage label.
   */
  customCategories?: readonly string[];
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
        <div className="space-y-2">
          <Label>Which benefit categories</Label>
          {/* Two columns at EVERY width, inside a bordered box that matches the plans list
              above it. The previous `sm:grid-cols-2` was viewport-based, so it collapsed to
              a single column in any genuinely narrow context and ran the list off the bottom
              of the dialog. `max-h` plus a scroll keeps a long list from doing the same. */}
          <div className="grid max-h-48 grid-cols-2 gap-x-4 gap-y-2 overflow-y-auto rounded-md border p-3">
            {BENEFIT_CONTACT_CATEGORIES.map((category) => (
              <label
                key={category}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
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
                <span className="truncate">{category}</span>
              </label>
            ))}
            {/* The Custom benefits the advisor created, appended after the canonical four.
                `title` on the label because these are free text and the column is narrow. */}
            {customCategories.map((category) => (
              <label
                key={category}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
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
                <span className="truncate" title={category}>
                  {category}
                </span>
              </label>
            ))}
          </div>
          {customCategories.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Custom benefits are listed by the name you gave them. Selecting one also
              grants its Custom benefit page.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The category a Custom benefit is stored under.
 *
 * Duplicated as a literal rather than imported from
 * `lib/teammates/benefit-categories.server.ts`, which is server-only — importing it here
 * would drag a Prisma client into the browser bundle.
 */
const CUSTOM_BENEFIT_CATEGORY = "Company / Plan Sponsor";

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
  /** The seat holder awaiting a "remove from seat" confirmation. */
  const [removing, setRemoving] = useState<TeamMemberRow | null>(null);
  /** The person awaiting a "remove from the organization" confirmation. */
  const [removingPerson, setRemovingPerson] = useState<TeamMemberRow | null>(null);

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
          customCategories?: string[];
        };
        setTeam(body.team ?? []);
        setCollaborators(body.collaborators ?? []);
        setSeats(body.seats ?? null);
        // Read with the same response so the category list is complete on first paint.
        setCustomCategories(body.customCategories ?? []);
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
   * Extracted because the two entry points must reset the SAME set: a field added to one
   * and forgotten in the other is how a stale company name ends up attached to the next
   * person. Also always returns to the chooser, never to whichever slide was used last.
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
    setAddType("team_member");
    setAddAccess(EMPTY_ACCESS);
    setConfirmUpgrade(false);
    resetAddForm();
    setIsAddOpen(true);
  };

  /** The same modal, forced to the free Collaborator type and its own defaults. */
  const openAddCollaborator = () => {
    setAddType("collaborator");
    setAddAccess(EMPTY_COLLABORATOR_ACCESS);
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

    // A Custom benefit is ADDRESSED by the category "Company / Plan Sponsor" — that is what
    // the portal's Custom page checks against — so scoping somebody to the advisor's own
    // title has to carry that category as well. Without this the person is granted the
    // benefit and then refused its page, which is the worst kind of failure: it looks like
    // access was given.
    const selectedCustom = addAccess.categories.filter((category) =>
      customCategories.includes(category),
    );
    const categoriesToSend = [
      ...new Set([
        ...addAccess.categories,
        ...(selectedCustom.length > 0 ? [CUSTOM_BENEFIT_CATEGORY] : []),
      ]),
    ];

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/teammates/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          // A PICKED contact pins the type to the button the advisor pressed. The domain
          // guess is moot once the profile is known, and guessing "collaborator" for an
          // external address would contradict a button that said "Add Team Member".
          //
          // The typed path does NOT pin the type for a Team Member, because the modal's copy
          // tells the advisor the domain decides — that behaviour predates this form and is
          // left intact rather than changed quietly.
          ...(pickedContact
            ? {
                profileId: pickedContact.profileId,
                type: addType,
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
                ...(addType === "collaborator"
                  ? { type: "collaborator" as const }
                  : {}),
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
   * Remove a person from the organization outright — their plan access goes with them.
   *
   * Nothing in this tab can drop a single assignment, and the T6 screen's Delete used to
   * refuse while any remained (spec T6 item 3), so a Collaborator on any plan had no route
   * out at all. The server does the two writes in order (assignments, then profile) for one
   * confirm, because "remove this person" is one decision; the dialog names the access that
   * goes with it so it is never a surprise.
   */
  const submitRemovePerson = async (row: TeamMemberRow) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/teammates/team/${row.profileId ?? row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remove_from_organization" }),
        },
      );

      const body = (await response.json()) as {
        error?: string;
        seats?: SeatUsageSummary;
        member?: { removedAssignments?: number };
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not remove this person");
        return;
      }

      if (body.seats) setSeats(body.seats);
      setRemovingPerson(null);

      const revoked = body.member?.removedAssignments ?? 0;
      toast.success(
        revoked > 0
          ? `${row.name} removed, along with their access to ${revoked} plan${
              revoked === 1 ? "" : "s"
            }.`
          : `${row.name} removed.`,
      );
      await load();
    } catch {
      toast.error("Could not remove this person");
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
          {seatHolders.map((row) => (
            <FilledSeatCard
              key={row.id}
              row={row}
              onEdit={openEdit}
              // The Owner's seat is reserved, and their row is synthesized rather than
              // stored, so there is no seat to give back and no profileId to address.
              // A deactivated member holds nothing either, and their removal is undone
              // from their own screen rather than from this grid.
              onRemove={
                row.isOwner || row.deactivatedAt
                  ? undefined
                  : (target) => setRemoving(target)
              }
            />
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
                    onRemove={(target) => setRemovingPerson(target)}
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
        {/* A flex column rather than a scrolling box: the header and the footer stay put
            while the middle scrolls, so Back / Cancel / Add are always reachable without
            scrolling to the bottom of a long form. `overflow-y-auto` on DialogContent
            itself was what pushed the buttons off-screen behind the fields. */}
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {addStep === "choose"
                ? addType === "collaborator"
                  ? "Add Collaborator"
                  : "Add Team Member"
                : addStep === "new"
                  ? "New contact"
                  : "Existing contact"}
            </DialogTitle>
            <DialogDescription>
              {addStep === "choose"
                ? addType === "collaborator"
                  ? "Someone outside your organization. No seat is used — scope them to the plans and benefit categories they should reach."
                  : "Someone with an email on your organization's domain uses a seat; anyone else is added as a free Collaborator."
                : addStep === "new"
                  ? addType === "collaborator"
                    ? "Enter their details, then scope them to the plans and benefit categories they should reach."
                    : "Enter their details. The email domain decides the default: a match with your organization adds a Team Member (uses a seat), any other domain adds a Collaborator (free)."
                  : "Pick somebody already on one of your plans. Their name and email come from the contact, so there is nothing to retype."}
            </DialogDescription>
          </DialogHeader>

          {/* The only scrollable region. `min-h-0` is load-bearing: a flex child defaults to
              `min-height: auto`, which lets a tall child grow the column instead of
              scrolling inside it — and then the footer is pushed out again. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
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
              roles={
                addType === "collaborator"
                  ? COLLABORATOR_PRESET_ROLES
                  : TEAM_MEMBER_ROLES
              }
              allowAllPlans={addType !== "collaborator"}
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
                {addType === "collaborator" ? "Add Collaborator" : "Add Team Member"}
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
        onChanged={() => void load()}
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

      {/* Removing a person is destructive and irreversible — unlike Deactivate, which
          keeps them — so the copy leads with what goes with the profile: their plan
          access. Stated up front because the T6 screen used to refuse this while any
          assignment remained, so the reader may have learned to expect a block. */}
      <AlertDialog
        open={removingPerson !== null}
        onOpenChange={(open) => !open && setRemovingPerson(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removingPerson?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They are removed from your organization
              {(removingPerson?.planAccess.planIds.length ?? 0) > 0
                ? `, and their access to ${
                    removingPerson?.planAccess.planIds.length
                  } plan${
                    removingPerson?.planAccess.planIds.length === 1 ? "" : "s"
                  } is revoked first`
                : ""}
              . Their profile is deleted and this cannot be undone. Content they
              created stays where it is. If you only want to end their access, use
              Deactivate instead — that keeps the person.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                if (removingPerson) void submitRemovePerson(removingPerson);
              }}
            >
              {isSubmitting ? "Removing…" : "Remove person"}
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
