"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type PendingNavigation =
  | { type: "href"; href: string }
  | { type: "back" }
  | null;

type UseNavigateAwayGuardOptions = {
  enabled: boolean;
  hasUnsavedChanges: boolean;
  onSaveAndExit?: () => Promise<void> | void;
  /** Runs when user confirms “Discard without saving” (before navigation). E.g. delete draft plan + reset wizard on Create Plan. */
  onDiscard?: () => Promise<void> | void;
  shouldIgnoreHref?: (href: string) => boolean;
};

export function useNavigateAwayGuard({
  enabled,
  hasUnsavedChanges,
  onSaveAndExit,
  onDiscard,
  shouldIgnoreHref,
}: UseNavigateAwayGuardOptions) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const pendingNavigationRef = useRef<PendingNavigation>(null);
  const bypassNextPopStateRef = useRef(false);

  const shouldGuard = enabled && hasUnsavedChanges;

  useEffect(() => {
    if (!shouldGuard) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [shouldGuard]);

  useEffect(() => {
    if (!shouldGuard) return;

    const onDocClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (event.button !== 0) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor?.href) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const href = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (href === current) return;
      if (shouldIgnoreHref?.(href)) return;

      event.preventDefault();
      event.stopPropagation();
      pendingNavigationRef.current = { type: "href", href };
      setDialogOpen(true);
    };

    document.addEventListener("click", onDocClickCapture, true);
    return () => document.removeEventListener("click", onDocClickCapture, true);
  }, [shouldGuard, shouldIgnoreHref]);

  useEffect(() => {
    if (!shouldGuard) return;

    window.history.pushState({ __guard: true }, "", window.location.href);

    const onPopState = () => {
      if (bypassNextPopStateRef.current) {
        bypassNextPopStateRef.current = false;
        return;
      }

      pendingNavigationRef.current = { type: "back" };
      setDialogOpen(true);
      window.history.pushState({ __guard: true }, "", window.location.href);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [shouldGuard]);

  const clearPendingNavigation = useCallback(() => {
    pendingNavigationRef.current = null;
  }, []);

  /** Radix AlertDialog fires onOpenChange(false) before button onClick; that was calling stay() and clearing pending nav so Discard did nothing. */
  const skipStayOnCloseRef = useRef(false);

  const stayAndKeepEditing = useCallback(() => {
    setDialogOpen(false);
    clearPendingNavigation();
  }, [clearPendingNavigation]);

  const continuePendingNavigation = useCallback(() => {
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setDialogOpen(false);

    if (!pending) return;
    if (pending.type === "href") {
      router.push(pending.href);
      return;
    }

    bypassNextPopStateRef.current = true;
    window.history.back();
  }, [router]);

  const saveAndExit = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onSaveAndExit?.();
      skipStayOnCloseRef.current = true;
      continuePendingNavigation();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not save changes. Please fix errors and try again.";
      toast.error(message);
      setDialogOpen(true);
    } finally {
      setIsSaving(false);
    }
  }, [continuePendingNavigation, isSaving, onSaveAndExit]);

  const suppressStayOnNextClose = useCallback(() => {
    skipStayOnCloseRef.current = true;
  }, []);

  const discardWithoutSaving = useCallback(async () => {
    suppressStayOnNextClose();
    try {
      await onDiscard?.();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not discard changes.";
      toast.error(message);
      return;
    }
    continuePendingNavigation();
  }, [continuePendingNavigation, onDiscard, suppressStayOnNextClose]);

  const dialogOnOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      if (skipStayOnCloseRef.current) {
        skipStayOnCloseRef.current = false;
        return;
      }
      stayAndKeepEditing();
    },
    [stayAndKeepEditing],
  );

  return useMemo(
    () => ({
      shouldGuard,
      dialogOpen,
      isSaving,
      stayAndKeepEditing,
      saveAndExit,
      discardWithoutSaving,
      dialogOnOpenChange,
      suppressStayOnNextClose,
    }),
    [
      shouldGuard,
      dialogOpen,
      isSaving,
      stayAndKeepEditing,
      saveAndExit,
      discardWithoutSaving,
      dialogOnOpenChange,
      suppressStayOnNextClose,
    ],
  );
}
