"use client";

import { Pencil } from "lucide-react";

import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";
import {
  buildPortalEditHref,
  portalPageLabel,
} from "@/lib/portal-editor-intent";
import { cn } from "@/lib/utils";

export interface PortalSectionEditButtonProps {
  /** The panel section to open, addressed with `portalSectionId`. */
  sectionId: string;
  /** Visible text, and the button's accessible name. Keep it short. */
  label: string;
  /** Positioning, from the caller (the button is absolutely positioned). */
  className?: string;
  /**
   * Render the pencil alone, in a circle. `label` stays as the accessible name and
   * the tooltip, but is not painted — for a button pinned to a small region (the
   * welcome banner's headline, its portrait, the company logo) where a labelled
   * pill would cover the thing it edits.
   */
  iconOnly?: boolean;
  /**
   * Where the section is actually edited, when that is NOT this page.
   *
   * The footer disclosure, for instance, belongs to the Landing Page's panel: on
   * My Benefits Team, News & Events and Employee Resources this button navigates
   * there and opens the panel on arrival (the intent travels in `sessionStorage`,
   * see [`portal-editor-intent`](../../lib/portal-editor-intent.ts:1)).
   */
  editPath?: string;
  /** The URL pushed when `editPath` differs — may carry a hash to scroll to. */
  editHref?: string;
  /**
   * The page the advisor is clicking from, in words. Defaults to the current
   * path's name; the landing page uses it to explain why they were moved.
   */
  sourceLabel?: string;
}

/**
 * The blue Edit button that points the Edit Panel at the region it sits on.
 *
 * This is the portal's counterpart to Create/Edit Client and Benefits Step 2,
 * where clicking a part of the page brings the editor up on the section that owns
 * it. It renders NOTHING unless a portal editing provider is mounted and the viewer
 * may edit, so it can sit unconditionally in shared sections that are also shown
 * to participants and inside wizard previews.
 *
 * The host positions it: it is `absolute`, so give it a `relative` parent and a
 * `className` such as `right-3 top-3`.
 */
export function PortalSectionEditButton({
  sectionId,
  label,
  className,
  iconOnly = false,
  editPath,
  editHref,
  sourceLabel,
}: PortalSectionEditButtonProps) {
  const editing = useOptionalPortalEditing();
  if (!editing?.canEdit) return null;

  return (
    <button
      type="button"
      // The region underneath is often clickable itself (the hero, a card); the
      // edit affordance must never trigger it.
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();

        // Edited somewhere else: remember what to open, go there, and let the
        // panel on that page consume the intent. `editPath` stays hash-free so it
        // matches the arriving `pathname`.
        if (
          editPath &&
          typeof window !== "undefined" &&
          window.location.pathname !== editPath
        ) {
          // The request rides the URL: `?editSection=…&editFrom=…`. `comments` is
          // dropped on the way — the advisor is going there to edit, so the rail
          // must stay shut — and the provider on that page opens the panel on the
          // section and explains the move.
          //
          // A full navigation on purpose: the sections this button redirects to
          // (the footer disclosure) live in ANOTHER route's panel, and a fresh
          // load is what guarantees that panel exists and can scroll itself.
          window.location.assign(
            buildPortalEditHref({
              search: window.location.search,
              editPath,
              editHref,
              sectionId,
              sourceLabel: sourceLabel || portalPageLabel(window.location.pathname),
            }),
          );
          return;
        }

        editing.focusSection(sectionId);
      }}
      aria-label={label}
      title={label}
      className={cn(
        "absolute z-30 inline-flex items-center gap-1.5 rounded-full bg-blue-500 text-[11px] font-semibold leading-none text-white shadow-lg transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        iconOnly ? "h-7 w-7 justify-center p-0" : "px-3 py-1.5",
        className,
      )}
    >
      <Pencil
        className={iconOnly ? "h-3.5 w-3.5" : "h-3 w-3"}
        strokeWidth={2.5}
        aria-hidden
      />
      {iconOnly ? null : label}
    </button>
  );
}
