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
      className={cn(
        "relative shrink-0 rounded-full",
        open && "text-accent-blue",
      )}
    >
      <MessagesSquare className="h-5 w-5" />
      {unreadTotal > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
          {badge}
        </span>
      )}
    </Button>
  );
}
