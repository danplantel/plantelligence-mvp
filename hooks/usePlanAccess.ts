"use client";

import { useEffect, useMemo, useState } from "react";

import {
  createPermissionChecker,
  type RequiredLevel,
} from "@/lib/teammates/permission-levels";
import type {
  PermissionFunction,
  TeammatePermissionSet,
} from "@/types/teammate";

/** Shape returned by GET /api/teammates/plan-access. */
export interface PlanAccessResponse {
  allowed: boolean;
  kind?: "owner" | "teammate";
  role?: string;
  categories?: "all" | string[];
  permissionSet?: TeammatePermissionSet | null;
  showOnBenefitsHub?: boolean;
  reason?: string;
  message?: string;
}

export interface UsePlanAccessInput {
  /** Plan ObjectId or slug. Falsy disables the lookup. */
  planId: string | null | undefined;
  category?: string | null;
  /** Defaults to no specific function — any assignment on the plan passes. */
  permission?: PermissionFunction;
  level?: RequiredLevel;
}

export interface PlanAccessState {
  status: "loading" | "allowed" | "denied";
  access?: PlanAccessResponse;
  message?: string;
  reason?: string;
  /**
   * Does the caller hold this function at this level?
   * Fail-closed: while loading, and whenever access is denied, this returns
   * false so restricted controls start hidden rather than flashing enabled.
   */
  can: (fn: PermissionFunction, level?: RequiredLevel) => boolean;
}

/**
 * Client-side view of the caller's plan access, backed by the same server engine
 * the mutating routes use. It exists so pages can render the restricted state
 * and hide controls (spec T2 Part A) — it is never the enforcement point.
 */
export function usePlanAccess(input: UsePlanAccessInput): PlanAccessState {
  const { planId, category, permission, level } = input;
  const [state, setState] = useState<PlanAccessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(planId));

  useEffect(() => {
    if (!planId) {
      setState(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    /**
     * Guards EVERY state write from this run — including the `finally`.
     *
     * The cleanup below aborts the request when the inputs change, and on a dynamic
     * route the inputs DO change right after mount as `useParams()` populates (the
     * plan arrives, then the category). An aborted fetch still runs its `.finally`,
     * and that was clearing `loading` while `state` was still `null` — so the hook
     * fell through to `denied` for as long as the *replacement* request took (~1s),
     * showing "You don't have access to this plan/section" to a user who has access.
     * A superseded run must publish nothing at all.
     */
    let active = true;

    const params = new URLSearchParams({ planId });
    if (category) params.set("category", category);
    if (permission) params.set("permission", permission);
    if (level) params.set("level", level);

    setLoading(true);
    fetch(`/api/teammates/plan-access?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!active) return;
        const body = (await response.json()) as PlanAccessResponse;
        if (!active) return;
        setState(body);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if ((error as Error)?.name === "AbortError") return;
        // A failed lookup must not leak the page: treat it as denied.
        setState({
          allowed: false,
          reason: "lookup_failed",
          message: "You don't have access to this plan/section",
        });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [planId, category, permission, level]);

  const can = useMemo(
    () => createPermissionChecker(state?.permissionSet ?? null),
    [state?.permissionSet],
  );

  // Owners have no grid, so `createPermissionChecker(null)` already returns true
  // for every function; a denied state must still fail closed.
  const guardedCan = useMemo(
    () =>
      (fn: PermissionFunction, required: RequiredLevel = "view"): boolean => {
        if (loading || !state) return false;
        if (!state.allowed) return false;
        return can(fn, required);
      },
    [can, loading, state],
  );

  /**
   * No planId yet is "not ready", NOT "denied".
   *
   * `useParams()` is empty on the first client render of a dynamic route, and the
   * caller's own state (which plan/category it is editing) can arrive a tick later
   * than the component. Reporting that as `denied` made the restricted notice flash
   * on pages the user is fully entitled to — with a meaningless
   * "Reference: unknown", because no server decision had been made at all. The
   * lookup is simply disabled until there is something to look up.
   */
  if (!planId) {
    return { status: "loading", can: guardedCan };
  }

  if (loading) {
    return { status: "loading", can: guardedCan };
  }

  /**
   * Belt and braces: `denied` is only ever returned for an actual answer.
   *
   * Every path that has no response yet is a `loading` state (no planId, request in
   * flight), so reaching here with `state === null` would mean a future refactor
   * dropped a guard — and the cost of guessing wrong is telling a permitted user they
   * have no access. Fail closed on `can()`, but never claim a refusal that was never
   * issued.
   */
  if (!state) {
    return { status: "loading", can: guardedCan };
  }

  if (!state.allowed) {
    return {
      status: "denied",
      message: state.message ?? "You don't have access to this plan/section",
      // A body with no `reason` is not an access decision (a 400/malformed response
      // from the lookup), so name it for what it is. "unknown" told support nothing.
      reason: state.reason ?? "lookup_incomplete",
      can: guardedCan,
    };
  }

  return { status: "allowed", access: state, can: guardedCan };
}
