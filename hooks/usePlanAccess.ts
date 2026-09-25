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
        const body = (await response.json()) as PlanAccessResponse;
        setState(body);
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === "AbortError") return;
        // A failed lookup must not leak the page: treat it as denied.
        setState({
          allowed: false,
          reason: "lookup_failed",
          message: "You don't have access to this plan/section",
        });
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
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

  if (loading) {
    return { status: "loading", can: guardedCan };
  }

  if (!state || !state.allowed) {
    return {
      status: "denied",
      message: state?.message ?? "You don't have access to this plan/section",
      reason: state?.reason ?? "unknown",
      can: guardedCan,
    };
  }

  return { status: "allowed", access: state, can: guardedCan };
}
