"use client";

/**
 * portal-comments-rail — **the Portal Comments UI**: the Comments panel as it appears on the
 * participant portal.
 *
 * (The product's name for it. It is the same rail the dashboard shows — this file adds only the way it
 * is turned on and the chrome around it, and re-implements none of it.)
 *
 * The five "Open Portal" buttons append `?comments=on` so an advisor can read a plan exactly as a
 * participant does and comment on it in the same view. This is what makes that flag mean something.
 *
 * THREE GATES, and all three must open:
 *
 *  1. **The flag.** `?comments=on` is a PREFERENCE, never an authority — see
 *     [`portal-surface.ts`](../../lib/comments/portal-surface.ts) for why a signed token was
 *     rejected. Without it the portal renders exactly as it did before this existed.
 *  2. **A session.** The portal is PUBLIC: employees reach it with no account, and `middleware.ts`
 *     deliberately leaves the route ungated. A participant must never see a rail, so arming only on
 *     `authenticated` is what keeps a shared portal link a plain portal. (The comment APIs would
 *     refuse an anonymous caller anyway — this just means nobody has to look at an error panel.)
 *  3. **A desktop viewport.** The portal is what employees open on a phone. Below the breakpoint the
 *     flag is ignored and `--comments-inset` is never set, so a phone gets today's portal untouched
 *     rather than a column of screen taken by a panel.
 *
 * Once armed, everything else is the existing engine: the rail registers the SAME surface the
 * dashboard would, reads and writes the same routes, and is refused by the same
 * `resolveCommentAccess`. No permission rule is re-implemented here, which is the point.
 *
 * The chrome is the only thing this file adds beyond the gates: the portal is scaled down to the
 * space the rail leaves (`PortalCommentsZoom`, header included) so the advisor reads the
 * participant's actual screen instead of a page reflowed into a column it was never designed for.
 *
 * The flag is read in an EFFECT rather than during render: the server cannot know it, and reading
 * `window.location` while rendering would make the client's first paint disagree with the server's
 * markup — a hydration mismatch for a panel that is a nicety.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MessageSquare } from "lucide-react";
import {
  CommentModeProvider,
  useCommentMode,
} from "@/components/comments/comment-mode-provider";
import { CommentsRail } from "@/components/comments/comments-rail";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { wantsCommentsRail } from "@/lib/comments/portal-surface";

/** The same breakpoint the desktop gate uses — a rail is a desktop affordance. */
const DESKTOP_QUERY = "(min-width: 1024px)";

export function PortalCommentsRail({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flagged, setFlagged] = useState(false);
  const { status } = useSession();
  // `serverFallback: false` — assume NOT desktop until measured, so a phone never reserves the column
  // for a panel it is about to be told it cannot have.
  const isDesktop = useMediaQuery(DESKTOP_QUERY, false);

  useEffect(() => {
    setFlagged(wantsCommentsRail(window.location.search));
  }, []);

  const armed = flagged && status === "authenticated" && isDesktop;

  // The rail's own top offset. The dashboard docks it below its header (`4rem`); here the portal's
  // header is cleared by `--comments-inset` — it stops where the rail begins — so the panel can use
  // the full height of the window instead of starting below a header it is not sitting under.
  useEffect(() => {
    if (!armed) return;
    const root = document.documentElement;
    root.style.setProperty("--comments-rail-top", "0px");
    // Braces, not a concise arrow: `removeProperty` returns a value, and a cleanup that returns one
    // is not a cleanup as far as React's types are concerned. `comments-layout.ts` does it this way
    // for the same reason.
    return () => {
      root.style.removeProperty("--comments-rail-top");
    };
  }, [armed]);

  if (!armed) return <>{children}</>;

  return (
    <CommentModeProvider initialMode="on">
      {children}
      <CommentsRail />
      {/* Inside the provider: it is the rail's own on/off control. */}
      <PortalCommentsButton />
    </CommentModeProvider>
  );
}

/**
 * The floating Comments button, bottom-right.
 *
 * The portal has no header action cluster, so without this a reader who closes the rail has no way
 * back to it short of editing the URL — the flag is what MOUNTED the panel, and closing it is not a
 * navigation, so nothing re-reads the query string. Same icon and same active treatment as the
 * header's `CommentsToggle`, so the control reads as the same feature rather than as a portal-only
 * invention.
 *
 * It sits at the rail's LEFT edge while the rail is open (`inset + 1.5rem`), which is also what keeps
 * it clickable: parked in the corner it would be underneath the panel it is meant to close. With the
 * rail closed `--comments-inset` is absent, the expression collapses to the corner, and the button
 * drifts back to where a reader expects it.
 */
function PortalCommentsButton() {
  const { canComment, mode, needsDraft, toggleMode } = useCommentMode();
  const active = canComment && mode === "on";

  const label = needsDraft
    ? "Save a draft to turn on comments"
    : active
      ? "Turn comments off"
      : "Turn comments on";

  return (
    <button
      type="button"
      onClick={toggleMode}
      disabled={!canComment}
      aria-pressed={active}
      aria-label={label}
      title={label}
      style={{ right: "calc(var(--comments-inset, 0px) + 1.5rem)" }}
      className={cn(
        "fixed bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors",
        active
          ? "text-accent-blue"
          : "text-muted-foreground hover:text-foreground",
        !canComment && "cursor-not-allowed opacity-60",
      )}
    >
      <MessageSquare className="h-5 w-5" />
      {active && (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent-blue" />
      )}
    </button>
  );
}
