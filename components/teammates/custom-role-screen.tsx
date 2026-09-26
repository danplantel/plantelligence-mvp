"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Lock, Plus, Search } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { BENEFIT_CONTACT_CATEGORIES } from "@/lib/benefit-contacts";
import { cn } from "@/lib/utils";
import {
  evaluateSoftWarnings,
  finalizePermissionSet,
  summarizePermissionSet,
  type SoftWarning,
  type SoftWarningAssignment,
} from "@/lib/teammates/permissions";
import {
  COLLABORATOR_LOCKED_FUNCTIONS,
  PERMISSION_FUNCTIONS,
  PERMISSION_FUNCTION_LABELS,
  PRESET_ROLE_LABELS,
  permissionOptionsFor,
  presetPermissionSet,
  type PermissionAccess,
  type PermissionFunction,
  type TeammateAssignmentRole,
  type TeammatePermissionSet,
  type TeammatePersonType,
} from "@/types/teammate";

/** The option labels the spec's Step 3 table uses. */
const OPTION_LABELS: Record<PermissionAccess, string> = {
  no_access: "No Access",
  view: "View",
  edit: "Edit",
  not_allowed: "Not Allowed",
  allowed: "Allowed",
};

export interface CustomRolePlan {
  id: string;
  companyName: string;
}

/** One existing assignment, used to seed the grid so it never starts blank. */
export interface CustomRoleSeedAssignment {
  assignmentId: string;
  planId: string;
  categories: string[];
  categoriesAll: boolean;
  permissionSet: unknown;
}

export interface CustomRoleScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string | null;
  personType: TeammatePersonType;
  /** The person's current role — the preset the grid starts from (spec: never blank). */
  currentRole: TeammateAssignmentRole;
  plans: CustomRolePlan[];
  seed: CustomRoleSeedAssignment[];
  /**
   * T4's "Customize access" opens this from a category card, so the plan and the
   * category it was clicked from arrive pre-selected (T2a acceptance: "An invite from
   * Ayres → Group Health opens with Ayres and Group Health pre-selected").
   */
  initialPlanId?: string | null;
  initialCategory?: string | null;
  /** Per-plan category facts, so the soft warnings can be evaluated per plan. */
  planCategories?: Record<string, { active?: string[]; hidden?: string[] }>;
  onSaved: () => void;
}

/**
 * T2a — the Custom role screen (plan-first grid).
 *
 * Runs top to bottom in three steps and starts from the closest preset, never blank:
 *  1. **Plans** — This Plan / Certain Plans / All Plans (Team Members only).
 *  2. **Benefits categories** — "same on all plans" by default, per-plan pickers when off.
 *  3. **Functions** — the 14-row grid, "same permissions on all plans" by default, per-plan
 *     tabs when off.
 *
 * It is a thin layer over rules that already exist: `finalizePermissionSet` applies the
 * auto-enforced rules and the collaborator hard blocks, `evaluateSoftWarnings` decides
 * which warnings fire per plan, and `summarizePermissionSet` builds the summary line.
 * Nothing here re-implements a rule, so the screen and the API cannot disagree.
 *
 * Locked rows are shown with a lock and their copy rather than hidden, because the spec
 * asks for locked-but-visible: the advisor should see what an external collaborator can
 * never be given.
 */
export function CustomRoleScreen({
  open,
  onOpenChange,
  profileId,
  personType,
  currentRole,
  plans,
  seed,
  initialPlanId,
  initialCategory,
  planCategories,
  onSaved,
}: CustomRoleScreenProps) {
  const isCollaborator = personType === "collaborator";
  const baseRole: TeammateAssignmentRole =
    currentRole === "custom" ? "contributor" : currentRole;

  const [step, setStep] = useState(1);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [allPlans, setAllPlans] = useState(false);
  const [planQuery, setPlanQuery] = useState("");
  const [sameCategories, setSameCategories] = useState(true);
  const [categoriesByPlan, setCategoriesByPlan] = useState<Record<string, string[]>>({});
  const [samePermissions, setSamePermissions] = useState(true);
  const [gridByPlan, setGridByPlan] = useState<Record<string, TeammatePermissionSet>>({});
  const [activePlanTab, setActivePlanTab] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /** The preset the grid starts from, so a Custom screen is never blank. */
  const startingGrid = useMemo(
    () => finalizePermissionSet(presetPermissionSet(baseRole as never), personType),
    [baseRole, personType],
  );

  // Fresh state per opening, seeded from the person's current access.
  useEffect(() => {
    if (!open) return;
    const seedPlanIds = seed.map((entry) => entry.planId);
    const firstPlan = initialPlanId ?? seedPlanIds[0] ?? plans[0]?.id ?? "";
    const planIds = initialPlanId
      ? [...new Set([initialPlanId, ...seedPlanIds])]
      : seedPlanIds.length > 0
        ? seedPlanIds
        : firstPlan
          ? [firstPlan]
          : [];

    setStep(1);
    setSelectedPlanIds(planIds);
    setAllPlans(false);
    setPlanQuery("");
    setSameCategories(true);
    setSamePermissions(true);
    setActivePlanTab(firstPlan);

    const byPlan: Record<string, string[]> = {};
    const grids: Record<string, TeammatePermissionSet> = {};
    for (const planId of planIds) {
      const assignment = seed.find((entry) => entry.planId === planId);
      const categories = assignment?.categoriesAll
        ? [...BENEFIT_CONTACT_CATEGORIES]
        : assignment?.categories?.length
          ? assignment.categories
          : initialCategory && planId === initialPlanId
            ? [initialCategory]
            : [];
      byPlan[planId] = categories.length > 0 ? categories : [...BENEFIT_CONTACT_CATEGORIES];
      grids[planId] = assignment
        ? finalizePermissionSet(assignment.permissionSet, personType)
        : startingGrid;
    }
    setCategoriesByPlan(byPlan);
    setGridByPlan(grids);
  }, [
    open,
    seed,
    plans,
    initialPlanId,
    initialCategory,
    personType,
    startingGrid,
  ]);

  const visiblePlans = useMemo(() => {
    const term = planQuery.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) => plan.companyName.toLowerCase().includes(term));
  }, [plans, planQuery]);

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) => {
      const next = prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId];
      // Keep the per-plan drafts in step with the selection.
      setCategoriesByPlan((current) => ({
        ...current,
        ...(current[planId] ? {} : { [planId]: [...BENEFIT_CONTACT_CATEGORIES] }),
      }));
      setGridByPlan((current) => ({
        ...current,
        ...(current[planId] ? {} : { [planId]: startingGrid }),
      }));
      if (!activePlanTab || !next.includes(activePlanTab)) {
        setActivePlanTab(next[0] ?? "");
      }
      return next;
    });
  };

  const gridFor = useCallback(
    (planId: string) => gridByPlan[planId] ?? startingGrid,
    [gridByPlan, startingGrid],
  );

  /** Write one function's value on one plan (or on all, when "same" is on). */
  const setFunctionAccess = (
    planId: string,
    fn: PermissionFunction,
    value: PermissionAccess,
  ) => {
    setGridByPlan((prev) => {
      const targets = samePermissions ? selectedPlanIds : [planId];
      const next = { ...prev };
      for (const target of targets) {
        const current = next[target] ?? startingGrid;
        next[target] = finalizePermissionSet({ ...current, [fn]: value }, personType);
      }
      return next;
    });
  };

  const setPlanCategories = (planId: string, next: string[]) => {
    setCategoriesByPlan((prev) => {
      if (!sameCategories) return { ...prev, [planId]: next };
      const out = { ...prev };
      for (const target of selectedPlanIds) out[target] = next;
      return out;
    });
  };

  /** The warning checks see exactly what the save would write. */
  const warnings: SoftWarning[] = useMemo(() => {
    if (selectedPlanIds.length === 0) return [];
    const assignments: SoftWarningAssignment[] = selectedPlanIds.map((planId) => {
      const categories = categoriesByPlan[planId] ?? [];
      const info = planCategories?.[planId];
      return {
        planId,
        planName: plans.find((plan) => plan.id === planId)?.companyName ?? "Unknown plan",
        activeCategories: info?.active ?? [...BENEFIT_CONTACT_CATEGORIES],
        hiddenCategories: info?.hidden ?? [],
        coveredCategories: categories,
        permissionSet: gridFor(planId),
      };
    });
    return evaluateSoftWarnings({
      personType,
      role: "custom",
      assignments,
    });
  }, [
    selectedPlanIds,
    categoriesByPlan,
    planCategories,
    plans,
    gridFor,
    personType,
  ]);

  const summary = useMemo(() => {
    if (selectedPlanIds.length === 0) return "Custom";
    return summarizePermissionSet({
      personType,
      role: "custom",
      assignments: selectedPlanIds.map((planId) => ({
        planId,
        planName: plans.find((plan) => plan.id === planId)?.companyName ?? "Unknown plan",
        activeCategories: planCategories?.[planId]?.active ?? [...BENEFIT_CONTACT_CATEGORIES],
        hiddenCategories: planCategories?.[planId]?.hidden ?? [],
        coveredCategories: categoriesByPlan[planId] ?? [],
        permissionSet: gridFor(planId),
      })),
    });
  }, [selectedPlanIds, plans, planCategories, categoriesByPlan, gridFor, personType]);

  const warningsByPlan = useMemo(() => {
    const map = new Map<string, SoftWarning[]>();
    for (const warning of warnings) {
      if (!warning.planId) continue;
      const list = map.get(warning.planId) ?? [];
      list.push(warning);
      map.set(warning.planId, list);
    }
    return map;
  }, [warnings]);

  /** Warnings that are not tied to one plan (they apply to the person). */
  const personWarnings = warnings.filter((warning) => !warning.planId);

  /**
   * Save in two steps, using the routes that already exist rather than a bespoke bulk
   * endpoint: materialise the plan set first (which is what creates and removes
   * assignments), then write each assignment's own grid, categories and confirmed
   * warnings. `upsertAssignment` finalizes every grid and refuses a locked permission,
   * so the API holds the hard blocks even if this screen were bypassed.
   */
  const save = async () => {
    if (!profileId) return;
    if (selectedPlanIds.length === 0) {
      toast.error("Pick at least one plan.");
      return;
    }

    setIsSaving(true);
    try {
      const scopeResponse = await fetch(`/api/teammates/team/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planScope: allPlans ? "all_plans" : "certain_plans",
          planIds: selectedPlanIds,
          // Neutral here; each assignment gets its own scope in the second pass.
          categoryScope: "all",
          categories: [],
        }),
      });
      const scopeBody = (await scopeResponse.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!scopeResponse.ok) {
        toast.error(scopeBody.error ?? "Could not save the plan selection");
        return;
      }

      // Read back the assignments the server actually made, so each PATCH targets a
      // real row rather than an id guessed from the selection.
      const detailResponse = await fetch(`/api/teammates/team/${profileId}`, {
        cache: "no-store",
      });
      const detail = (await detailResponse.json().catch(() => ({}))) as {
        assignments?: { id: string; clientId: string }[];
      };
      const assignmentIdByPlan = new Map(
        (detail.assignments ?? []).map((row) => [row.clientId, row.id]),
      );

      const confirmedCodes = [...new Set(warnings.map((warning) => warning.code))];

      for (const planId of selectedPlanIds) {
        const assignmentId = assignmentIdByPlan.get(planId);
        if (!assignmentId) continue;
        const categories = categoriesByPlan[planId] ?? [];
        const response = await fetch(`/api/teammates/assignments/${assignmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "custom",
            customPermissionSet: gridFor(planId),
            categoryScope: categories.length > 0 ? "selected" : "all",
            categories,
            warningsConfirmed: confirmedCodes,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          toast.error(body.error ?? "Could not save custom access");
          return;
        }
      }

      toast.success("Custom access saved.");
      setConfirmOpen(false);
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Could not save custom access");
    } finally {
      setIsSaving(false);
    }
  };

  /** Warn before saving only when something is flagged; otherwise Save proceeds. */
  const requestSave = () => {
    if (warnings.length > 0) {
      setConfirmOpen(true);
      return;
    }
    void save();
  };

  const gridPlans = selectedPlanIds.slice();
  const gridPlanForTab = activePlanTab || gridPlans[0] || "";
  const grid = gridPlanForTab ? gridFor(gridPlanForTab) : startingGrid;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Custom access</DialogTitle>
            <DialogDescription>
              Starts from{" "}
              <span className="font-medium">{PRESET_ROLE_LABELS[baseRole as never]}</span>
              , then you narrow it. Locked rows cannot be granted to an external
              collaborator.
            </DialogDescription>
          </DialogHeader>

          {/* ── Step indicator ── */}
          <div className="flex items-center gap-2 text-xs">
            {["Plans", "Benefits categories", "Functions"].map((label, index) => {
              const number = index + 1;
              const isActive = step === number;
              const isDone = step > number;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(number)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition",
                    isActive
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                      isDone ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {isDone ? <Check className="h-2.5 w-2.5" /> : number}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>

          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">{summary}</p>

          {/* ── Step 1: plans ── */}
          {step === 1 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Which plans?</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedPlanIds.length} selected
                </span>
              </div>

              {!isCollaborator ? (
                <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <Switch
                    checked={allPlans}
                    onCheckedChange={(checked) => {
                      setAllPlans(checked);
                      if (checked) {
                        setSelectedPlanIds(plans.map((plan) => plan.id));
                      }
                    }}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">All Plans</span>
                    <span className="block text-[11px] text-muted-foreground">
                      Includes plans created in the future.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                  All Plans is available to Team Members only.
                </p>
              )}

              {!allPlans ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={planQuery}
                      onChange={(event) => setPlanQuery(event.target.value)}
                      placeholder="Search plans"
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-52 space-y-1 overflow-y-auto">
                    {visiblePlans.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        No plans match that search.
                      </p>
                    ) : (
                      visiblePlans.map((plan) => (
                        <label
                          key={plan.id}
                          className="flex items-center gap-2 rounded-md px-1 py-1 text-sm"
                        >
                          <Checkbox
                            checked={selectedPlanIds.includes(plan.id)}
                            onCheckedChange={() => togglePlan(plan.id)}
                          />
                          <span className="truncate">{plan.companyName}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Plus className="h-3 w-3" />
                    Ticking a plan creates its assignment; unticking removes it.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* ── Step 2: categories ── */}
          {step === 2 ? (
            <section className="space-y-3">
              <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <Switch
                  checked={sameCategories}
                  onCheckedChange={setSameCategories}
                />
                <span className="flex-1">
                  <span className="block font-medium">Same categories on all plans</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Off gives each plan its own category picker.
                  </span>
                </span>
              </label>

              {(sameCategories ? gridPlans.slice(0, 1) : gridPlans).map((planId) => {
                const plan = plans.find((entry) => entry.id === planId);
                const selected = categoriesByPlan[planId] ?? [];
                return (
                  <div key={planId} className="space-y-2 rounded-lg border p-3">
                    <Label className="text-xs">
                      {sameCategories ? "Categories" : plan?.companyName ?? "Plan"}
                    </Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {BENEFIT_CONTACT_CATEGORIES.map((category) => (
                        <label
                          key={category}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={selected.includes(category)}
                            onCheckedChange={() =>
                              setPlanCategories(
                                planId,
                                selected.includes(category)
                                  ? selected.filter((entry) => entry !== category)
                                  : [...selected, category],
                              )
                            }
                          />
                          {category}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}

          {/* ── Step 3: functions ── */}
          {step === 3 ? (
            <section className="space-y-3">
              <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <Switch
                  checked={samePermissions}
                  onCheckedChange={setSamePermissions}
                />
                <span className="flex-1">
                  <span className="block font-medium">
                    Same permissions on all selected plans
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Off gives each plan its own grid; new tabs copy the first plan.
                  </span>
                </span>
              </label>

              {!samePermissions && gridPlans.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  {gridPlans.map((planId) => (
                    <button
                      key={planId}
                      type="button"
                      onClick={() => setActivePlanTab(planId)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs transition",
                        gridPlanForTab === planId
                          ? "border-primary bg-primary/10 font-medium"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {plans.find((plan) => plan.id === planId)?.companyName ?? "Plan"}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="divide-y rounded-lg border">
                {PERMISSION_FUNCTIONS.map((fn) => {
                  const locked =
                    isCollaborator && COLLABORATOR_LOCKED_FUNCTIONS.includes(fn);
                  const options = permissionOptionsFor(fn);
                  return (
                    <div
                      key={fn}
                      className="flex flex-wrap items-center gap-3 px-3 py-2"
                    >
                      <span className="flex min-w-[190px] flex-1 items-center gap-1.5 text-sm">
                        {locked ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : null}
                        {PERMISSION_FUNCTION_LABELS[fn]}
                      </span>
                      <div
                        className="flex flex-wrap items-center gap-3"
                        role="radiogroup"
                        aria-label={PERMISSION_FUNCTION_LABELS[fn]}
                      >
                        {options.map((option) => {
                          const checked = grid[fn] === option;
                          return (
                            <label
                              key={option}
                              className={cn(
                                "flex items-center gap-1.5 text-xs",
                                locked
                                  ? "cursor-not-allowed text-muted-foreground/60"
                                  : "cursor-pointer",
                              )}
                              title={
                                locked
                                  ? "Not available for external collaborators."
                                  : undefined
                              }
                            >
                              <input
                                type="radio"
                                name={`${fn}-${gridPlanForTab}`}
                                checked={checked}
                                disabled={locked}
                                onChange={() =>
                                  setFunctionAccess(gridPlanForTab, fn, option)
                                }
                                className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                              />
                              {OPTION_LABELS[option]}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {isCollaborator ? (
                <p className="text-[11px] text-muted-foreground">
                  Publish, Invite, Delete, Org Settings and Billing are never available to
                  an external collaborator — not even through the API.
                </p>
              ) : null}

              {/* Inline warnings, as selections are made (Part A item 6). */}
              {personWarnings.length > 0 || warningsByPlan.size > 0 ? (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    {warnings.length} thing{warnings.length === 1 ? "" : "s"} to review
                  </p>
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    {personWarnings.map((warning) => (
                      <li key={warning.code}>• {warning.message}</li>
                    ))}
                    {[...warningsByPlan.entries()].flatMap(([planId, list]) =>
                      list.map((warning) => (
                        <li key={`${planId}-${warning.code}`}>
                          •{" "}
                          <span className="font-medium">
                            {plans.find((plan) => plan.id === planId)?.companyName}:
                          </span>{" "}
                          {warning.message}
                        </li>
                      )),
                    )}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <DialogFooter className="flex-wrap gap-2">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : null}
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)}>Next</Button>
            ) : (
              <Button onClick={requestSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save custom access
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The single confirm listing everything flagged (Part A item 6). */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save with these warnings?</DialogTitle>
            <DialogDescription>
              These are not errors — they are things worth a second look. Confirming
              records them on the audit trail.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {personWarnings.map((warning) => (
              <li key={warning.code}>• {warning.message}</li>
            ))}
            {[...warningsByPlan.entries()].flatMap(([planId, list]) =>
              list.map((warning) => (
                <li key={`confirm-${planId}-${warning.code}`}>
                  •{" "}
                  <span className="font-medium">
                    {plans.find((plan) => plan.id === planId)?.companyName}:
                  </span>{" "}
                  {warning.message}
                </li>
              )),
            )}
          </ul>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={isSaving}
            >
              Keep editing
            </Button>
            <Button onClick={() => void save()} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Save anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
