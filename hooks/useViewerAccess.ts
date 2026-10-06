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

/** The shape `GET /api/teammates/viewer-access` returns, and the layout seeds. */
export interface ViewerAccessData {
  isCollaborator: boolean;
  functions: TeammatePermissionSet | null;
  /** Owner or Admin — may add a Team Member, invite, or grant a seat. */
  canManageTeam: boolean;
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
  can: (fn: PermissionFunction, level?: RequiredLevel) => boolean;
} {
  const { data } = useSWR<ViewerAccessData>(
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

  return { isCollaborator, canManageTeam, can };
}
