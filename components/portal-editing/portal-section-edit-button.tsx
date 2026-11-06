"use client";

import { Pencil } from "lucide-react";

import { useOptionalPortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { cn } from "@/lib/utils";

export interface PortalSectionEditButtonProps {
  /** The panel section to open, addressed with `portalSectionId`. */
  sectionId: string;
  /** Visible text, and the button's accessible name. Keep it short. */
  label: string;
  /** Positioning, from the caller (the button is absolutely positioned). */
  className?: string;
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
        editing.focusSection(sectionId);
      }}
      aria-label={label}
      title={label}
      className={cn(
        "absolute z-30 inline-flex items-center gap-1.5 rounded-full bg-blue-500 px-3 py-1.5 text-[11px] font-semibold leading-none text-white shadow-lg transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        className,
      )}
    >
      <Pencil className="h-3 w-3" strokeWidth={2.5} />
      {label}
    </button>
  );
}
