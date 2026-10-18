"use client";

import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOptionalMessagesMode } from "./messages-mode-provider";

/**
 * The Messages control in the header's action cluster.
 *
 * Two deliberate differences from the Comments toggle beside it:
 *
 *  - it carries a NUMERIC badge, because the number is the reason to open the panel. A dot says
 *    "something happened"; "3" says whether it is worth stopping for. Capped at "9+" so the icon
 *    cannot grow a two-digit pill and reflow the cluster.
 *  - it is always rendered inside the dashboard, because every member can receive a message. The
 *    Comments toggle can hide itself on a page that is not a comment surface; this one has no such
 *    page — a conversation is not about the page you are on.
 *
 * The icon is `MessagesSquare` rather than the comments' `MessageSquare` on purpose: two adjacent
 * pills with the same glyph would read as one control with two states.
 */
export function MessagesToggle() {
  const context = useOptionalMessagesMode();
  if (!context) return null;

  const { open, toggle, unreadTotal } = context;
  const label = open ? "Close messages" : "Open messages";
  const badge = unreadTotal > 9 ? "9+" : String(unreadTotal);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={open}
      aria-label={
        unreadTotal > 0 ? `${label} (${unreadTotal} unread)` : label
      }
      title={unreadTotal > 0 ? `${label} — ${unreadTotal} unread` : label}
      // Scales down with the viewport (see the header's responsive note), and the
      // unread badge with it — the cluster is what has to fit beside the page title.
      className={cn(
        "relative h-7 w-7 shrink-0 rounded-full xl:h-8 xl:w-8",
        open && "text-accent-blue",
      )}
    >
      <MessagesSquare className="h-4 w-4 xl:h-5 xl:w-5" />
      {unreadTotal > 0 && (
        <span className="absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground xl:right-0.5 xl:top-0.5 xl:h-4 xl:min-w-4 xl:text-[10px]">
          {badge}
        </span>
      )}
    </Button>
  );
}
