"use client";

/**
 * The Comments / Messages switch shown at the top of either right-hand rail.
 *
 * The portal's floating button opens the Comments rail; this switch is how a
 * reader moves to Direct Messages without leaving the rail, and back again.
 * It only renders when BOTH providers are mounted — the dashboard keeps its
 * header toggles and passes no switch flag, so it is unaffected.
 *
 * `setMode("on")` is deliberate rather than `toggleMode`: choosing a panel is
 * a request to show that panel, never a request to hide it. The arbiter in
 * `lib/right-panel.ts` closes whichever rail currently holds the column.
 */

import { MessageSquare, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalCommentMode } from "./comment-mode-provider";
import { useOptionalMessagesMode } from "@/components/messages/messages-mode-provider";

export function RailPanelSwitch({
  active,
}: {
  active: "comments" | "messages";
}) {
  const comments = useOptionalCommentMode();
  const messages = useOptionalMessagesMode();
  if (!comments || !messages) return null;

  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors";
  const selected = "bg-background text-accent-blue shadow-sm";
  const idle = "text-muted-foreground hover:text-foreground";

  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5"
      role="tablist"
      aria-label="Switch panel"
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === "comments"}
        aria-label="Show comments"
        onClick={() => comments.setMode("on")}
        className={cn(base, active === "comments" ? selected : idle)}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Comments
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "messages"}
        aria-label="Show direct messages"
        onClick={() => messages.setMode("on")}
        className={cn(base, active === "messages" ? selected : idle)}
      >
        <MessagesSquare className="h-3.5 w-3.5" />
        Messages
        {messages.unreadTotal > 0 && (
          <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground">
            {messages.unreadTotal > 9 ? "9+" : messages.unreadTotal}
          </span>
        )}
      </button>
    </div>
  );
}
