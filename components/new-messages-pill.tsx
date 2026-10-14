"use client";

import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Discord-style "N new messages" pill: a floating affordance at the top of a message list that
 * appears when something arrived while the reader was scrolled up, and takes them to it.
 *
 * Shared by Direct Messages and Comments rather than written twice, for the same reason the dot
 * animation and the scroll helper are: it is one gesture, and two versions of it drifting apart is
 * how the two panels start feeling like different apps.
 *
 * A button and not a banner, because it IS the action — clicking it is the entire content, so it must
 * be reachable by keyboard and announced as what it does rather than just displayed.
 *
 * Singular on purpose when the count is one: "1 new messages" is the kind of detail that makes an
 * interface feel unfinished, and the pluralised count only earns its place once there is a number the
 * reader actually wants to weigh.
 */
export function NewMessagesPill({
  count,
  onClick,
  className,
}: {
  count: number;
  onClick: () => void;
  /**
   * Positioning, supplied by the caller — deliberately NOT baked in.
   *
   * The pill is used in two different geometries: floated over a scrolling message list (a DM
   * conversation), and in normal flow as a band at the top of the comments panel. Baking either one
   * in would make the other fight it, so the component owns only its appearance and the call site
   * owns where it sits.
   */
  className?: string;
}) {
  if (count <= 0) return null;

  const label = count === 1 ? "1 new message" : `${count} new messages`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-accent-blue px-3 py-1 text-[11px] font-semibold text-white shadow-md transition-colors hover:bg-accent-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        className,
      )}
      aria-label={`Jump to ${label}`}
      title="Jump to the newest messages"
    >
      <ArrowDown className="h-3 w-3" aria-hidden="true" />
      {label}
    </button>
  );
}
