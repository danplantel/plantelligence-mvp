"use client";

import { useMemo } from "react";
import useSWR from "swr";

import {
  createPermissionChecker,
  type RequiredLevel,
} from "@/lib/teammates/permission-levels";
import type {
  PermissionFunction,
  TeammatePermissionSet,
} from "@/types/teammate";

/**
 * SWR key for the access summary.
 *
 * Exported because the dashboard layout seeds it as SWR `fallback` data (see
 * `NewLayoutClient`), so EVERY `useViewerAccess()` in the tree — the sidebar, the page
 * guard, Settings — starts with the server's answer rather than an empty one, and the
 * chrome never renders the wrong thing for a frame.
 */
export const VIEWER_ACCESS_KEY = "/api/teammates/viewer-access";

/**
 * Where a Collaborator DOES have access — the first plan they were given.
 *
 * Carried by the access summary because the chrome refuses URLs that name no plan
 * (`/dashboard`, `/clients`, …): without it the restricted notice has nothing to say beyond
 * "you don't have access". Mirrors the server's `PrimaryAssignmentContext`.
 */
export interface PrimaryAssignmentContext {
  planId: string;
  planCompanyName: string | null;
  /** The section labels the grant covers; empty for a grant that covers the whole plan. */
  categories: string[];
  organizationName: string | null;
  ownerUserId: string | null;
}

/** The shape `GET /api/teammates/viewer-access` returns, and the layout seeds. */
export interface ViewerAccessData {
  isCollaborator: boolean;
  functions: TeammatePermissionSet | null;
  /** Owner or Admin — may add a Team Member, invite, or grant a seat. */
  canManageTeam: boolean;
  /** See `PrimaryAssignmentContext`. Absent for everyone who is never refused by the gate. */
  primaryAssignment?: PrimaryAssignmentContext | null;
}

/**
 * The chrome-level access summary for the signed-in user (see
 * [`getViewerAccess`](../lib/teammates/viewer-access.server.ts)), used to hide nav
 * destinations and to refuse a restricted page reached by URL.
 *
 * `initialData` is the value the dashboard layout resolved on the SERVER. Seeding it is
 * what removes the flash: without it the hook starts with no answer, `isCollaborator` is
 * read as false, and the chrome renders the owner's view for a frame before correcting
 * itself. With it, the first paint is already right.
 *
 * When there is no seed (a standalone consumer), the read is fail-OPEN: while it is in
 * flight, or if it fails, the caller is reported as a non-collaborator with a null grid,
 * which `createPermissionChecker` reads as "everything allowed". Hiding a page the user
 * can reach is the worse failure; the API refuses the real action regardless.
 */
export function useViewerAccess(initialData?: ViewerAccessData | null): {
  isCollaborator: boolean;
  canManageTeam: boolean;
  /** Where a Collaborator DOES have access — see `PrimaryAssignmentContext`. */
  primaryAssignment: PrimaryAssignmentContext | null;
  /**
   * The summary has not answered yet — a request is in flight and nothing is cached.
   *
   * False on every seeded read (the dashboard layout hands the server's answer to SWR as
   * `fallbackData`), which is why a caller can safely key a PLACEHOLDER on it: while this is
   * true, `isCollaborator` and `can` are the fail-open defaults rather than an answer, and
   * anything derived from them — the sidebar's link list, for instance — would be a guess.
   */
  isLoading: boolean;
  can: (fn: PermissionFunction, level?: RequiredLevel) => boolean;
} {
  const { data, isLoading } = useSWR<ViewerAccessData>(
    VIEWER_ACCESS_KEY,
    (url: string) => fetch(url).then((response) => response.json()),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      fallbackData: initialData ?? undefined,
    },
  );

  const isCollaborator = Boolean(data?.isCollaborator);
  // Fail-open, like the rest of the summary: an unanswered read must never hide an
  // action that the server would allow.
  const canManageTeam = data ? Boolean(data.canManageTeam) : true;
  const can = useMemo(
    () => createPermissionChecker(data?.functions ?? null),
    [data?.functions],
  );

  return {
    isCollaborator,
    canManageTeam,
    primaryAssignment: data?.primaryAssignment ?? null,
    isLoading,
    can,
  };
}
