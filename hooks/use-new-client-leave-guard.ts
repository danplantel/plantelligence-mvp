"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { hasUnsavedWizardWork } from "@/lib/new-client-wizard-dirty";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";

type UseNewClientLeaveGuardOptions = {
  enabled: boolean;
  /** While completing the wizard (full navigation away is intentional). */
  suppressGuard?: boolean;
};

export function useNewClientLeaveGuard({
  enabled,
  suppressGuard,
}: UseNewClientLeaveGuardOptions) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);

  const dirty = useNewClientWizardStore((s) =>
    hasUnsavedWizardWork({
      isCompleted: s.isCompleted,
      stepData: s.stepData,
      currentStep: s.currentStep,
      draftClientId: s.draftClientId,
    }),
  );

  const shouldGuard = enabled && !suppressGuard && dirty;

  useEffect(() => {
    if (!shouldGuard) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [shouldGuard]);

  useEffect(() => {
    if (!shouldGuard) return;

    const onDocClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor?.href) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;

      if (!window.location.pathname.startsWith("/new/new-client")) return;

      if (url.pathname.startsWith("/new/new-client")) return;

      e.preventDefault();
      e.stopPropagation();
      pendingHrefRef.current = next;
      setDialogOpen(true);
    };

    document.addEventListener("click", onDocClickCapture, true);
    return () =>
      document.removeEventListener("click", onDocClickCapture, true);
  }, [shouldGuard]);

  const confirmLeave = useCallback(() => {
    const href = pendingHrefRef.current;
    pendingHrefRef.current = null;
    setDialogOpen(false);
    if (href) {
      router.push(href);
    }
  }, [router]);

  const cancelLeave = useCallback(() => {
    pendingHrefRef.current = null;
    setDialogOpen(false);
  }, []);

  return {
    dialogOpen,
    confirmLeave,
    cancelLeave,
    shouldGuard,
  };
}
