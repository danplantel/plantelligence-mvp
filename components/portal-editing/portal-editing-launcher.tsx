"use client";

import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { PortalChromeButtonSkeleton } from "@/components/portal-editing/portal-chrome-button-skeleton";

/**
 * The floating Edit button.
 *
 * It sits to the LEFT of the Comments button, which in turn sits left of the
 * "Ask a question" pill. The offset clears both controls so all three remain
 * visible in the bottom-right cluster.
 */
const EDIT_BUTTON_RIGHT =
  "calc(max(1.5rem, calc(max(var(--comments-inset, 0px), var(--messages-inset, 0px)) + 1.5rem)) + 15.5rem)";

export function PortalEditingLauncher() {
  const { target, canEdit, isOpen, togglePanel, isAccessLoading } =
    usePortalEditing();
  if (!target) return null;

  // "Not answered yet" is not "not allowed". The access summary is a request,
  // and while it is in flight the button used to render DISABLED — which read
  // as a broken or forbidden control. It now waits as a skeleton in exactly the
  // same spot.
  if (isAccessLoading) {
    return (
      <PortalChromeButtonSkeleton
        label="Checking your access…"
        style={{ right: EDIT_BUTTON_RIGHT }}
      />
    );
  }

  const label = canEdit
    ? isOpen
      ? "Close editing panel"
      : "Edit this page"
    : "You have view-only access to this page";

  return (
    <button
      type="button"
      onClick={togglePanel}
      aria-pressed={isOpen}
      aria-label={label}
      title={label}
      style={{ right: EDIT_BUTTON_RIGHT }}
      // Fixed light colours rather than the theme tokens: this button sits
      // OUTSIDE `.portal-root`, so the portal's light-theme overrides do not
      // reach it — with the dashboard in dark mode the tokens rendered it dark
      // against a light portal.
      //
      // Never `disabled`: a view-only viewer gets a control that says why on
      // hover, and `togglePanel` refuses the action in the provider.
      className={cn(
        "fixed bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg transition-colors",
        isOpen ? "text-accent-blue" : "text-gray-500 hover:text-gray-900",
        !canEdit && "text-gray-400",
      )}
    >
      <Pencil className="h-5 w-5" />
      {isOpen && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent-blue" />
      )}
    </button>
  );
}
