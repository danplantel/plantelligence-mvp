"use client";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCommentMode } from "@/components/comments/comment-mode-provider";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { PortalChromeButtonSkeleton } from "@/components/portal-editing/portal-chrome-button-skeleton";

/**
 * The floating "eye" — one control that hides or restores the advisor chrome.
 *
 * An armed portal can carry three floating controls: Comments, Edit, and the
 * chat pill. Reviewing the page the way an employee sees it meant clicking two
 * buttons and remembering what had been open. The eye closes both at once, and
 * opens both again, so the advisor can look at the real thing and get straight
 * back to work.
 *
 * It only drives surfaces the viewer is allowed to use:
 *
 *  - a view-only collaborator never has an edit panel opened for them;
 *  - commenting needs a persisted surface AND no unsaved draft, so while a
 *    draft is pending the eye still opens the edit panel — that is where the
 *    draft gets saved from;
 *  - with neither available the button is disabled rather than silently doing
 *    nothing.
 *
 * It sits left of the Edit button, which sits left of Comments, which sits left
 * of the chat pill: the whole cluster reads in one direction, furthest control
 * outermost.
 */
export function PortalVisibilityToggle() {
  const {
    target,
    canEdit,
    isOpen: editorOpen,
    openPanel,
    closePanel,
    isAccessLoading,
  } = usePortalEditing();
  const { canComment, mode, needsDraft, setMode, surfaceResolved } =
    useCommentMode();

  // Only the armed portal mounts this (inside `PortalCommentsRail`), and only
  // pages that own an editing surface get the button at all.
  if (!target) return null;

  const commentsOpen = canComment && mode === "on";
  const chromeOpen = editorOpen || commentsOpen;

  const canOpenEditor = canEdit;
  const canOpenComments = canComment && !needsDraft;
  const canOpenAnything = canOpenEditor || canOpenComments;

  const label = chromeOpen
    ? "Hide the editor and comments"
    : canOpenAnything
      ? "Show the editor and comments"
      : "You have view-only access to this page";

  const toggle = () => {
    if (chromeOpen) {
      if (editorOpen) closePanel();
      if (commentsOpen) setMode("off");
      return;
    }
    if (canOpenEditor) openPanel();
    if (canOpenComments) setMode("on");
  };

  const right =
    // The Edit button's own offset, plus one button width and the gap between
    // them, so this one always lands to its left.
    "calc(max(1.5rem, calc(max(var(--comments-inset, 0px), var(--messages-inset, 0px)) + 1.5rem)) + 19.5rem)";

  // Either answer still in flight: wait as a skeleton, like its two neighbours,
  // rather than offering a control that cannot do anything yet.
  if (isAccessLoading || !surfaceResolved) {
    return (
      <PortalChromeButtonSkeleton
        label="Checking what you can edit…"
        style={{ right }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={chromeOpen}
      aria-label={label}
      title={label}
      style={{ right }}
      // Fixed light colours, for the same reason as its two neighbours: this
      // sits outside `.portal-root`, so theme tokens would follow the dashboard
      // and render it dark over a light portal.
      className={cn(
        "fixed bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg transition-colors",
        chromeOpen
          ? "text-accent-blue"
          : "text-gray-500 hover:text-gray-900",
        // Never `disabled`: a viewer who can open neither surface gets the
        // reason in the label instead of a greyed-out control.
        !canOpenAnything && "text-gray-400",
      )}
    >
      {chromeOpen ? (
        <EyeOff className="h-5 w-5" />
      ) : (
        <Eye className="h-5 w-5" />
      )}
      {chromeOpen && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent-blue" />
      )}
    </button>
  );
}
