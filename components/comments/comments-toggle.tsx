"use client";

import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOptionalCommentMode } from "./comment-mode-provider";

/**
 * The Comments on/off control, rendered in the header's action cluster.
 *
 * Renders nothing on a page that is not a comment surface, so no other page grows a
 * dead button. On a Create wizard before the row is saved it stays visible but disabled
 * with a hint, so the feature is discoverable rather than mysteriously absent.
 */
export function CommentsToggle() {
  const context = useOptionalCommentMode();
  if (!context || !context.hasSurface) return null;

  const { canComment, mode, needsDraft, toggleMode } = context;
  const active = canComment && mode === "on";

  const label = needsDraft
    ? "Save a draft to turn on comments"
    : active
      ? "Turn comments off"
      : "Turn comments on";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      disabled={!canComment}
      aria-pressed={active}
      aria-label={label}
      title={canComment ? `${label} (Shift+C)` : label}
      className={cn("relative shrink-0 rounded-full", active && "text-accent-blue")}
    >
      <MessageSquare className="h-5 w-5" />
      {active && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-blue" />
      )}
    </Button>
  );
}
