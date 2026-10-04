"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Loader2,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserMinus,
} from "lucide-react";

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Headshot } from "@/components/ui/headshot";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BENEFIT_CONTACT_CATEGORIES } from "@/lib/benefit-contacts";
import { CUSTOM_BENEFIT_CATEGORY } from "@/lib/benefit-custom-name";
import { cn } from "@/lib/utils";
import {
  COLLABORATOR_PRESET_ROLES,
  PRESET_ROLE_LABELS,
  PROFILE_STATE_LABELS,
  TEAM_MEMBER_PRESET_ROLES,
  type TeammateAssignmentRole,
} from "@/types/teammate";

/**
 * The reader's shape, imported as a TYPE only. `team.server.ts` builds a Prisma
 * client at module scope, so a value import here would drag server code into the
 * client bundle; `import type` is erased at compile time and cannot.
 */
import type { MembershipDetail } from "@/lib/teammates/team.server";
import { CustomRoleScreen } from "@/components/teammates/custom-role-screen";

/**
 * The canonical categories the picker offers. "Company / Plan Sponsor" is the
 * storage category for Custom benefits, so it is dropped here and each plan's
 * Custom benefits are listed by name instead (see `customBenefitOptions`).
 */
const CANONICAL_CATEGORY_OPTIONS = BENEFIT_CONTACT_CATEGORIES.filter(
  (category) => category !== CUSTOM_BENEFIT_CATEGORY,
);

export interface PersonAccessScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The person to manage. Null only while the dialog is closed. */
  profileId: string | null;
  /** Called after any successful change so the list behind the screen refreshes. */
  onChanged: () => void;
}

/** The two sets of presets differ by person type, and so does All Plans. */
function presetRolesFor(personType: "team_member" | "collaborator") {
  return personType === "collaborator"
    ? COLLABORATOR_PRESET_ROLES
    : TEAM_MEMBER_PRESET_ROLES;
}

/**
 * T6 — Assignment Management Screen.
 *
 * Spec T6 Part A:
 *  1. per-person screen: profile at top, assignments listed below by plan;
 *  2. plan access: This Plan / Certain Plans / All Plans (Team Members only);
 *  3. benefits access: All / Certain, pre-filled from what the person already holds;
 *  4. per-assignment controls: role dropdown + "Show on Benefits Hub" toggle;
 *  5. three separate actions: Remove Assignment, Deactivate, Delete Profile.
 *
 * Two deliberate interaction choices:
 *
 *  - **Rows apply immediately; the access block is saved deliberately.** A row edits
 *    exactly one assignment, so there is nothing to reconcile and instant feedback
 *    matches T6 Part B item 1 ("access ends immediately"). The Plan/Benefits access
 *    block changes *which* assignments exist, which the server reconciles by removing
 *    the ones that drop out — that deserves an explicit Save rather than firing as
 *    the advisor ticks boxes.
 *  - **Custom is rendered but not selectable.** It needs T2a's plan-first grid; the
 *    server refuses the role too (`custom_role_unavailable`), so the disabled entry
 *    documents the gap instead of offering a dead end.
 */
export function PersonAccessScreen({
  open,
  onOpenChange,
  profileId,
  onChanged,
}: PersonAccessScreenProps) {
  const [detail, setDetail] = useState<MembershipDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Plan / benefits access draft (applied with Save access).
  const [planScope, setPlanScope] = useState<"certain_plans" | "all_plans">(
    "certain_plans",
  );
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [categoryScope, setCategoryScope] = useState<"all" | "certain">("all");
  const [categories, setCategories] = useState<string[]>([]);

  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(
    null,
  );
  const [isWorking, setIsWorking] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  /** T2a: the plan-first grid, opened from the role dropdown's Custom entry. */
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customForAssignmentId, setCustomForAssignmentId] = useState<string | null>(
    null,
  );

  const hydrate = useCallback((next: MembershipDetail) => {
    setDetail(next);
    setPlanScope(next.profile.allPlans ? "all_plans" : "certain_plans");
    setPlanIds(next.assignments.map((assignment) => assignment.clientId));

    // Pre-fill benefits access from what the person already holds: "All" only when
    // every assignment covers every category, otherwise the union of what they have.
    const everyAssignmentIsAll =
      next.assignments.length > 0 &&
      next.assignments.every((assignment) => assignment.categoryScope === "all");
    if (everyAssignmentIsAll) {
      setCategoryScope("all");
      setCategories([]);
    } else {
      setCategoryScope("certain");
      const union = [
        ...new Set(next.assignments.flatMap((assignment) => assignment.categories)),
      ];
      // A "Certain" scope with nothing ticked would be refused by the server, so fall
      // back to the canonical categories rather than presenting an unsaveable state.
      setCategories(union.length > 0 ? union : [...CANONICAL_CATEGORY_OPTIONS]);
    }
  }, []);

  const reload = useCallback(async () => {
    if (!profileId) return;
    const response = await fetch(`/api/teammates/team/${profileId}`, {
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as
      | (MembershipDetail & { error?: string })
      | { error?: string };
    if (!response.ok) {
      throw new Error(
        (body as { error?: string }).error ?? "Could not load this person.",
      );
    }
    hydrate(body as MembershipDetail);
  }, [profileId, hydrate]);

  useEffect(() => {
    if (!open || !profileId) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setDetail(null);
    (async () => {
      try {
        await reload();
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Could not load this person.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, profileId, reload]);

  const personType = detail?.profile.personType ?? "collaborator";
  const isCollaborator = personType === "collaborator";
  const isDeactivated = Boolean(detail?.profile.deactivatedAt);
  const roleOptions = presetRolesFor(personType);

  /**
   * Every Custom benefit, flattened to one row per plan it exists on, so the
   * "Which categories?" list can offer it by name beneath its plan's label. A
   * Custom benefit is stored under the Custom category and lives on its own plan,
   * which is why the plan travels alongside the title.
   */
  const customBenefitOptions = useMemo(() => {
    const rows: { planId: string; planName: string; title: string }[] = [];
    for (const plan of detail?.plans ?? []) {
      for (const title of plan.customBenefits) {
        rows.push({ planId: plan.id, planName: plan.companyName, title });
      }
    }
    return rows;
  }, [detail?.plans]);

  const togglePlan = (planId: string) =>
    setPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId],
    );

  const toggleCategory = (category: string) =>
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((entry) => entry !== category)
        : [...prev, category],
    );

  /**
   * Ticking a Custom benefit also pins the plan it lives on when access is scoped
   * to Certain Plans: the benefit only exists on that plan, so granting the
   * category without the plan would silently grant nothing. Unticking leaves the
   * plan selected — removing it is the advisor's call, not a side effect.
   */
  const toggleCustomBenefit = (planId: string, title: string) => {
    const wasSelected = categories.includes(title);
    toggleCategory(title);
    if (!wasSelected && planScope === "certain_plans") {
      setPlanIds((prev) => (prev.includes(planId) ? prev : [...prev, planId]));
    }
  };

  /**
   * Choosing "Certain Plans" pulls in the plan behind every Custom benefit already
   * ticked above it — the categories section is rendered first, so the tick often
   * happens before the scope is chosen.
   */
  const handlePlanScopeChange = (value: string) => {
    const next = value as "certain_plans" | "all_plans";
    setPlanScope(next);
    if (next !== "certain_plans") return;
    const impliedPlanIds = customBenefitOptions
      .filter((option) => categories.includes(option.title))
      .map((option) => option.planId);
    if (impliedPlanIds.length === 0) return;
    setPlanIds((prev) => [...new Set([...prev, ...impliedPlanIds])]);
  };

  /** The access block: which plans, and which categories on them. */
  const saveAccess = async () => {
    if (!profileId) return;
    if (planScope === "certain_plans" && planIds.length === 0) {
      toast.error("Select at least one plan, or choose All Plans.");
      return;
    }
    if (categoryScope === "certain" && categories.length === 0) {
      toast.error("Select at least one category, or choose All categories.");
      return;
    }

    setIsSavingAccess(true);
    try {
      const response = await fetch(`/api/teammates/team/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planScope,
          planIds,
          categoryScope: categoryScope === "all" ? "all" : "certain",
          categories: categoryScope === "all" ? [] : categories,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        member?: { assignmentCount?: number; removedAssignments?: number };
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not save access");
        return;
      }

      const removed = body.member?.removedAssignments ?? 0;
      toast.success(
        `Access saved — ${body.member?.assignmentCount ?? 0} plan assignment${
          (body.member?.assignmentCount ?? 0) === 1 ? "" : "s"
        }${removed > 0 ? `, ${removed} removed` : ""}.`,
      );
      await reload();
      onChanged();
    } catch {
      toast.error("Could not save access");
    } finally {
      setIsSavingAccess(false);
    }
  };

  /** One assignment's row controls (spec T6 Part A item 4). */
  const patchAssignmentRow = async (
    assignmentId: string,
    patch: { role?: TeammateAssignmentRole; showOnBenefitsHub?: boolean },
  ) => {
    setPendingAssignmentId(assignmentId);
    try {
      const response = await fetch(`/api/teammates/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not update this assignment");
        return;
      }
      if (patch.role) {
        toast.success(`Role set to ${PRESET_ROLE_LABELS[patch.role as never] ?? patch.role}.`);
      } else if (patch.showOnBenefitsHub !== undefined) {
        toast.success(
          patch.showOnBenefitsHub
            ? "Shown on the Benefits Hub."
            : "Hidden from the Benefits Hub — they keep their admin access.",
        );
      }
      await reload();
      onChanged();
    } catch {
      toast.error("Could not update this assignment");
    } finally {
      setPendingAssignmentId(null);
    }
  };

  /** The first of the three actions (spec T6 Part A item 5). */
  const removeAssignmentRow = async (assignmentId: string, planName: string) => {
    setPendingAssignmentId(assignmentId);
    try {
      const response = await fetch(`/api/teammates/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not remove this assignment");
        return;
      }
      toast.success(`Removed their access to ${planName}.`);
      await reload();
      onChanged();
    } catch {
      toast.error("Could not remove this assignment");
    } finally {
      setPendingAssignmentId(null);
    }
  };

  /** The second action: Deactivate / Reactivate. */
  const toggleActive = async () => {
    if (!profileId) return;
    setIsWorking(true);
    try {
      const response = await fetch(`/api/teammates/team/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isDeactivated ? "reactivate" : "deactivate" }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(body.error ?? "Could not change this person's state");
        return;
      }
      toast.success(isDeactivated ? "Reactivated." : "Deactivated — access ended.");
      await reload();
      onChanged();
    } catch {
      toast.error("Could not change this person's state");
    } finally {
      setIsWorking(false);
    }
  };

  /**
   * The third action: Delete Profile.
   *
   * Sent as `remove_from_organization` rather than the strict `delete`, and that difference
   * is the whole point: `deleteTeammateProfile` refuses with a 409 while any assignment
   * remains (spec T6 item 3), so the strict action could only ever work on someone with no
   * plans — which is not who you delete. The cascade removes the assignments first and then
   * the profile, and the dialog below states that their access goes with them, so this is a
   * confirmed clear rather than a silent one.
   */
  const deleteProfile = async () => {
    if (!profileId) return;
    setIsWorking(true);
    try {
      const response = await fetch(`/api/teammates/team/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_from_organization" }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        member?: { removedAssignments?: number };
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not delete this profile");
        return;
      }

      const removed = body.member?.removedAssignments ?? 0;
      toast.success(
        removed > 0
          ? `Profile deleted — access to ${removed} plan${removed === 1 ? "" : "s"} removed with it.`
          : "Profile deleted.",
      );
      setIsDeleteOpen(false);
      onOpenChange(false);
      onChanged();
    } catch {
      toast.error("Could not delete this profile");
    } finally {
      setIsWorking(false);
    }
  };

  const assignmentCount = detail?.assignments.length ?? 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* `p-0` + flex: the dialog owns no padding of its own, so the sticky
            footer below reaches the very bottom edge (no gap under the bar) and
            each region carries its own padding instead. */}
        <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto p-0 sm:max-w-3xl">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Manage access</DialogTitle>
            <DialogDescription>
              Plan and category access live on assignments — one per plan. Change one
              row without affecting the others.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading access…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void reload()}>
                Try again
              </Button>
            </div>
          ) : detail ? (
            <div className="space-y-6 px-6 pb-6">
              {/* ── Profile (T6 Part A item 1) ── */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                  <Headshot
                    src={detail.profile.headshot}
                    alt={detail.profile.name}
                    monogramName={detail.profile.name}
                    wrapperClassName="rounded-full"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {detail.profile.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {detail.profile.email}
                    {detail.profile.companyName
                      ? ` · ${detail.profile.companyName}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">
                    {isCollaborator ? "Collaborator" : "Team Member"}
                  </Badge>
                  <Badge variant="outline">
                    {PROFILE_STATE_LABELS[detail.profile.state]}
                  </Badge>
                  {isDeactivated ? (
                    <Badge variant="destructive">Deactivated</Badge>
                  ) : null}
                  {detail.profile.allPlans ? (
                    <Badge variant="outline">All Plans</Badge>
                  ) : null}
                </div>
              </div>

              {/* ── Plan access + benefits access (T6 Part A items 2 and 3) ── */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Plan access</h3>
                  <span className="text-xs text-muted-foreground">
                    {assignmentCount} assignment{assignmentCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Categories first, then plans. Each section stacks its own
                      label, select and (when scoped) its picker directly beneath
                      the control it belongs to, rather than sitting side by side. */}
                  <div className="space-y-2">
                    <Label>Which categories?</Label>
                    <Select
                      value={categoryScope}
                      onValueChange={(value) =>
                        setCategoryScope(value as "all" | "certain")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        <SelectItem value="certain">Certain categories</SelectItem>
                      </SelectContent>
                    </Select>
                    {categoryScope === "certain" ? (
                      <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                        {CANONICAL_CATEGORY_OPTIONS.map((category) => (
                          <label
                            key={category}
                            className="flex min-w-0 items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={categories.includes(category)}
                              onCheckedChange={() => toggleCategory(category)}
                            />
                            <span className="truncate">{category}</span>
                          </label>
                        ))}
                        {/* Custom benefits, each under its plan's name. A title
                            reused across plans appears once per plan, matching how
                            a Custom benefit is stored. Ticking one selects that
                            plan below (see `toggleCustomBenefit`). */}
                        {customBenefitOptions.map((option) => (
                          <label
                            key={`${option.planId}:${option.title}`}
                            className="flex min-w-0 items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={categories.includes(option.title)}
                              onCheckedChange={() =>
                                toggleCustomBenefit(option.planId, option.title)
                              }
                            />
                            <span className="min-w-0">
                              <span
                                className="block truncate"
                                title={option.title}
                              >
                                {option.title}
                              </span>
                              <span
                                className="block truncate text-[11px] text-muted-foreground"
                                title={option.planName}
                              >
                                {option.planName}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Which plans?</Label>
                    <Select
                      value={planScope}
                      onValueChange={handlePlanScopeChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="certain_plans">Certain Plans</SelectItem>
                        {/* Spec T2a: All Plans is a Team-Member-only concept. */}
                        {!isCollaborator ? (
                          <SelectItem value="all_plans">All Plans</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                    {planScope === "all_plans" ? (
                      <p className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-muted-foreground dark:border-blue-900/40 dark:bg-blue-950/20">
                        Includes plans created in the future.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {/* Every plan as a toggleable pill — ticking one grants this
                            person access to that plan. The chip styling mirrors the
                            plan selector's pills (see
                            components/plan-selector/plan-search-bar.tsx). */}
                        {detail.plans.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No plans yet.
                          </p>
                        ) : (
                          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-lg border p-3">
                            {detail.plans.map((plan) => {
                              const selected = planIds.includes(plan.id);
                              return (
                                <button
                                  key={plan.id}
                                  type="button"
                                  onClick={() => togglePlan(plan.id)}
                                  aria-pressed={selected}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                                    selected
                                      ? "bg-[#23919C]/10 text-[#23919C] border-[#23919C]/30"
                                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#23919C]/40 hover:text-[#23919C] dark:bg-gray-700 dark:text-muted-foreground dark:border-gray-600 dark:hover:border-[#23919C]/50",
                                  )}
                                >
                                  {selected ? <Check className="size-3" /> : null}
                                  {plan.companyName}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* The save/cancel pair lives in the sticky bar at the bottom of
                    the dialog (see the end of DialogContent) so the access draft
                    can be committed without scrolling back up here. */}
              </section>

              {/* ── Assignments by plan (T6 Part A item 1 again, item 4) ── */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Assignments by plan</h3>

                {assignmentCount === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No plans yet. Tick a plan above to give this person access.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.assignments.map((assignment) => {
                      const isPending = pendingAssignmentId === assignment.id;
                      return (
                        <li
                          key={assignment.id}
                          className="space-y-3 rounded-lg border p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {assignment.planName}
                            </span>
                            {isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-red-600"
                              onClick={() =>
                                void removeAssignmentRow(
                                  assignment.id,
                                  assignment.planName,
                                )
                              }
                              disabled={isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">
                                Role on this plan
                              </Label>
                              <Select
                                value={assignment.role}
                                onValueChange={(value) => {
                                  // T2a: Custom is not written from here. Choosing it
                                  // opens the plan-first grid, which decides the plans,
                                  // categories and per-plan functions together.
                                  if (value === "custom") {
                                    setCustomForAssignmentId(assignment.id);
                                    setIsCustomOpen(true);
                                    return;
                                  }
                                  void patchAssignmentRow(assignment.id, {
                                    role: value as TeammateAssignmentRole,
                                  });
                                }}
                                disabled={isPending}
                              >
                                <SelectTrigger className="h-8 w-[190px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleOptions.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {PRESET_ROLE_LABELS[role]}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="custom">Custom…</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">
                                Categories
                              </Label>
                              <p className="text-xs">
                                {assignment.categoryScope === "all"
                                  ? "All categories"
                                  : assignment.categories.join(", ") || "None selected"}
                              </p>
                            </div>

                            <div className="ml-auto flex items-center gap-2">
                              <Label
                                htmlFor={`hub-${assignment.id}`}
                                className="text-[11px] text-muted-foreground"
                              >
                                Show on Benefits Hub
                              </Label>
                              <Switch
                                id={`hub-${assignment.id}`}
                                checked={assignment.showOnBenefitsHub}
                                onCheckedChange={(checked) =>
                                  void patchAssignmentRow(assignment.id, {
                                    showOnBenefitsHub: checked,
                                  })
                                }
                                disabled={isPending}
                              />
                            </div>
                          </div>

                          {assignment.inviteDueDate ? (
                            <p className="text-[11px] text-muted-foreground">
                              Invited with a deadline of{" "}
                              {new Date(assignment.inviteDueDate).toLocaleDateString()}
                              {assignment.inviteNote
                                ? ` · “${assignment.inviteNote}”`
                                : ""}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* ── The three separate actions (T6 Part A item 5) ── */}
              <section
                className={cn(
                  "space-y-3 rounded-xl border p-4",
                  "border-red-200/70 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-semibold">Person-level actions</h3>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  None of these delete content this person created. Deactivate keeps
                  the profile; Delete removes it and is only possible with no plans
                  left.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void toggleActive()}
                    disabled={isWorking}
                  >
                    {isDeactivated ? (
                      <UserCheck className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <UserMinus className="mr-2 h-3.5 w-3.5" />
                    )}
                    {isDeactivated ? "Reactivate" : "Deactivate"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setIsDeleteOpen(true)}
                    disabled={isWorking}
                    title="Remove this person from your organization"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete Profile
                  </Button>
                </div>

                {assignmentCount > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Deleting also revokes their access to {assignmentCount} plan
                    {assignmentCount === 1 ? "" : "s"}. Content they created stays
                    where it is.
                  </p>
                ) : null}
              </section>
            </div>
          ) : null}

          {/* Fixed action bar: Cancel closes and discards the draft (the screen
              re-hydrates from the server next time it opens); Save commits the
              plan/category scope. Sticky so it stays reachable however far the
              assignments list scrolls. */}
          {detail ? (
            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t bg-background px-6 py-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSavingAccess}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveAccess()}
                  disabled={isSavingAccess || isDeactivated}
                  title={
                    isDeactivated
                      ? "Reactivate this person before changing their plans"
                      : undefined
                  }
                  className="bg-accent-blue hover:bg-accent-blue/90"
                >
                  {isSavingAccess ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isSavingAccess ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── T2a: the Custom role screen (plan-first grid) ── */}
      <CustomRoleScreen
        open={isCustomOpen}
        onOpenChange={(next) => {
          setIsCustomOpen(next);
          if (!next) setCustomForAssignmentId(null);
        }}
        profileId={profileId}
        personType={personType}
        currentRole={
          detail?.assignments.find((row) => row.id === customForAssignmentId)?.role ??
          "contributor"
        }
        plans={detail?.plans ?? []}
        seed={(detail?.assignments ?? []).map((row) => ({
          assignmentId: row.id,
          planId: row.clientId,
          categories: row.categories,
          categoriesAll: row.categoryScope === "all",
          permissionSet: row.permissionSet,
        }))}
        initialPlanId={
          detail?.assignments.find((row) => row.id === customForAssignmentId)
            ?.clientId ?? null
        }
        onSaved={() => {
          void reload();
          onChanged();
        }}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this profile?</AlertDialogTitle>
            <AlertDialogDescription>
              {detail?.profile.name ?? "This person"} is removed from your
              organization
              {assignmentCount > 0
                ? `, along with their access to ${assignmentCount} plan${
                    assignmentCount === 1 ? "" : "s"
                  }`
                : ""}
              . Content they created stays where it is. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Keep profile</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteProfile();
              }}
              disabled={isWorking}
            >
              {isWorking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
