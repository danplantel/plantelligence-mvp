"use client";

import { HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { BENEFIT_CONTACT_CATEGORIES } from "@/lib/benefit-contacts";
import {
  CUSTOM_BENEFIT_CATEGORY,
  isCustomHubCategory,
} from "@/lib/benefit-custom-name";
import { describeRole, type RoleCapability } from "@/lib/teammates/role-summary";
import {
  PRESET_ROLE_LABELS,
  PRESET_ROLES,
  type TeammateAssignmentRole,
  type TeammatePresetRole,
} from "@/types/teammate";

/**
 * The teammate access picker — Role, Plan access, Benefits access.
 *
 * Extracted from Settings → People & Access so the SAME controls can be reused wherever a
 * teammate is created (that tab, and "Give Team Seat" in the benefits wizard). A permission
 * picker duplicated per surface is two chances to offer a role the rules engine refuses, or
 * to hide one it allows — and the two would drift the moment either is edited.
 *
 * Everything offered here is a PREFERENCE. The server still finalizes the grid
 * (`finalizePermissionSet`) and validates what was asked for, so a caller that sends
 * something disallowed is refused rather than trusted.
 */

export interface PlanOption {
  id: string;
  companyName: string;
}

export type PlanScopeChoice = "all_plans" | "certain_plans";
export type CategoryScopeChoice = "all" | "certain";

export interface AccessDraft {
  role: TeammateAssignmentRole;
  planScope: PlanScopeChoice;
  planIds: string[];
  categoryScope: CategoryScopeChoice;
  categories: string[];
}

/** Team-Member roles only; Contributor/Reviewer are collaborator presets. */
export const TEAM_MEMBER_ROLES: TeammateAssignmentRole[] = [
  "owner",
  "admin",
  "editor",
  "viewer",
];

/**
 * A new Team Member's draft. Editor + All Plans + All Categories is the spec's own default
 * ("Default: All Plans + All Categories"), so a caller that wants those can hand this
 * straight to the server rather than restating them.
 */
export const EMPTY_ACCESS: AccessDraft = {
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
export const EMPTY_COLLABORATOR_ACCESS: AccessDraft = {
  role: "contributor",
  planScope: "certain_plans",
  planIds: [],
  categoryScope: "all",
  categories: [],
};

function isPresetRole(role: TeammateAssignmentRole): role is TeammatePresetRole {
  return (PRESET_ROLES as readonly string[]).includes(role);
}

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
export function RoleCapabilityBody({ capability }: { capability: RoleCapability }) {
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

/*
 * `CUSTOM_BENEFIT_CATEGORY` and `isCustomHubCategory` come from lib/benefit-custom-name.
 *
 * They used to be defined here — the storage key as a literal, because
 * `lib/teammates/benefit-categories.server.ts` is server-only, plus a local comparison for
 * it. The header and the Benefits list ask the same question ("is this the Custom hub?"), so
 * the answer now has one definition instead of three.
 */

/**
 * The canonical categories the access picker offers. The Custom hub is reached through the
 * Custom titles the advisor actually authored, which are listed underneath and each carry
 * this key with them — see `categoriesForAccess`.
 */
const GRANTABLE_BENEFIT_CATEGORIES = BENEFIT_CONTACT_CATEGORIES.filter(
  (category) => !isCustomHubCategory(category),
);

/**
 * The advisor's own Custom benefit titles, cleaned for the picker.
 *
 * Three exclusions, all of them about not offering one grant twice under two names:
 *  - the hub's storage label, which is a page key rather than a benefit (see above);
 *  - a title that repeats a canonical row, e.g. a Custom benefit called "Retirement" — two
 *    checkboxes with one label would read as two different grants;
 *  - a title that repeats another title, compared case-insensitively.
 */
function selectableCustomTitles(customCategories: readonly string[]): string[] {
  const taken = new Set(
    GRANTABLE_BENEFIT_CATEGORIES.map((category) => category.trim().toLowerCase()),
  );
  const titles: string[] = [];
  for (const raw of customCategories) {
    const title = raw.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (taken.has(key) || isCustomHubCategory(title)) continue;
    taken.add(key);
    titles.push(title);
  }
  return titles;
}

/**
 * The category list to send for an access draft.
 *
 * A Custom benefit is stored under `Company / Plan Sponsor`, and that key is what the portal
 * checks before rendering the Custom page — so scoping somebody to one of the advisor's own
 * titles has to carry it too. Without that the person is granted the benefit and then refused
 * its page, which is the worst kind of failure: it looks like access was given.
 *
 * The membership test runs against `selectableCustomTitles`, NOT the raw list, so a title
 * that is really the hub's storage label — or one that merely repeats a canonical category —
 * cannot drag the Custom page along with an ordinary grant.
 *
 * `currentCustomBenefit` is the benefit being created in the caller's own draft (see
 * `AccessFields`). It is included because it is NOT among the organisation's published titles
 * yet, and it is the most likely thing to be selected — omitting it would send a title with
 * no storage key behind it, which is exactly the failure this function exists to prevent.
 *
 * Shared by the Add and Edit paths so they cannot drift apart.
 */
export function categoriesForAccess(
  categories: readonly string[],
  customCategories: readonly string[],
  currentCustomBenefit?: string | null,
): string[] {
  const customTitles = new Set([
    ...selectableCustomTitles(customCategories),
    ...selectableCustomTitles(
      currentCustomBenefit ? [currentCustomBenefit] : [],
    ),
  ]);
  const customTitleSelected = categories.some((category) =>
    customTitles.has(category),
  );
  return [
    ...new Set([
      ...categories,
      ...(customTitleSelected ? [CUSTOM_BENEFIT_CATEGORY] : []),
    ]),
  ];
}

export function AccessFields({
  value,
  onChange,
  plans,
  roles = TEAM_MEMBER_ROLES,
  allowAllPlans = true,
  customCategories = [],
  currentCustomBenefit,
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
  /**
   * The Custom benefit the caller is creating RIGHT NOW, if any.
   *
   * A benefit that has not been saved has no `Benefit` row, so it is absent from the
   * organisation's title list — yet it is the benefit this person is being given access to
   * help with, so it is offered as its own row. Optional: only a caller inside a
   * Custom-benefit draft has one.
   */
  currentCustomBenefit?: string | null;
  disabled?: boolean;
}) {
  /**
   * The published Custom rows this picker may offer, already cleaned of the hub's storage
   * label and of anything that repeats a canonical category. Computed here so the rendered
   * list and the list `categoriesForAccess` reasons about are the same one.
   */
  const customTitles = selectableCustomTitles(customCategories);

  /**
   * The benefit this draft is creating, if the caller named one.
   *
   * Shown as its own row rather than merged into `customTitles`, so the advisor can see that
   * the benefit they are working on is among the grants — which is the whole reason a seat is
   * being handed out at this moment. Skipped when it would add nothing: a title that is
   * already published is listed above it, and a title that is really the hub's storage label
   * grants nothing the hub row does not (see `isCustomHubCategory`).
   */
  const inProgressCustomBenefit = (currentCustomBenefit ?? "").trim();
  const inProgressAlreadyListed = customTitles.some(
    (title) => title.toLowerCase() === inProgressCustomBenefit.toLowerCase(),
  );
  const showInProgressCustomBenefit =
    inProgressCustomBenefit.length > 0 &&
    !inProgressAlreadyListed &&
    !isCustomHubCategory(inProgressCustomBenefit);

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
            {GRANTABLE_BENEFIT_CATEGORIES.map((category) => (
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
            {/* The advisor's own Custom benefit titles, under their own heading so they
                read as the named benefits they are rather than as more canonical rows.
                `customTitles` rather than the raw prop is what makes that true: a title
                that is really the hub's storage label, or one that repeats a canonical
                row, would otherwise be a second checkbox for something already offered
                above. `title` on the label because these are free text and the column is
                narrow. */}
            {customTitles.length > 0 ? (
              <p className="col-span-2 mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Custom benefits
              </p>
            ) : null}
            {customTitles.map((category) => (
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
            {/* The benefit this draft is creating. Its own heading rather than another row
                under "Custom benefits" because it is not published yet: it is the thing the
                seat is being handed out for, and it arrives already ticked (the caller seeds
                `categories` with it). */}
            {showInProgressCustomBenefit ? (
              <p className="col-span-2 mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                This benefit
              </p>
            ) : null}
            {showInProgressCustomBenefit ? (
              <label className="flex min-w-0 items-center gap-2 text-sm">
                <Checkbox
                  disabled={disabled}
                  checked={value.categories.includes(inProgressCustomBenefit)}
                  onCheckedChange={() =>
                    onChange({
                      ...value,
                      categories: toggle(value.categories, inProgressCustomBenefit),
                    })
                  }
                />
                <span className="truncate" title={inProgressCustomBenefit}>
                  {inProgressCustomBenefit}
                </span>
              </label>
            ) : null}
            {/* The one case the row above cannot cover: a benefit whose own name IS the
                hub's storage label. Selecting it would grant exactly what the hub key
                grants, so there is nothing extra to tick — said out loud rather than
                leaving a requested row silently missing. */}
            {inProgressCustomBenefit.length > 0 && !showInProgressCustomBenefit ? (
              <p className="col-span-2 text-[11px] leading-relaxed text-muted-foreground">
                This benefit is named the same as the Custom hub, so it is covered by the
                Custom hub access rather than listed on its own.
              </p>
            ) : null}
          </div>
          {customTitles.length > 0 ? (
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
