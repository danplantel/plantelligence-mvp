"use client";

import { useEffect } from "react";
import { Monitor } from "lucide-react";

import {
  DESKTOP_ONLY_COPY,
  DESKTOP_ONLY_MEDIA_QUERY,
  type DesktopOnlyCopy,
  type DesktopOnlyVariant,
} from "@/lib/desktop-only";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface DesktopOnlyGateProps {
  /** Selects the notice copy (see `DESKTOP_ONLY_COPY`). */
  variant: DesktopOnlyVariant;
  /**
   * Fired when the gate resolves to "blocked" (viewport below the desktop
   * breakpoint). Used by onboarding to send the [MEDIUM] resume email. Called
   * once per blocked resolution; the callback itself owns any throttling.
   */
  onBlocked?: () => void;
  children: React.ReactNode;
}

/**
 * Blocks a desktop-only surface on small screens and renders a "use a computer"
 * notice instead. At or above the breakpoint it renders `children` unchanged.
 *
 * Because the children are not mounted while blocked, their data-loading,
 * autosave and validation effects never run on a phone.
 */
export function DesktopOnlyGate({
  variant,
  onBlocked,
  children,
}: DesktopOnlyGateProps) {
  const isDesktop = useMediaQuery(DESKTOP_ONLY_MEDIA_QUERY);

  useEffect(() => {
    if (!isDesktop) onBlocked?.();
  }, [isDesktop, onBlocked]);

  if (isDesktop) {
    return <>{children}</>;
  }

  return <DesktopOnlyNotice copy={DESKTOP_ONLY_COPY[variant]} />;
}

/** The full-screen fallback shown below the desktop breakpoint. */
export function DesktopOnlyNotice({ copy }: { copy: DesktopOnlyCopy }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted">
          <Monitor className="size-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{copy.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  );
}
