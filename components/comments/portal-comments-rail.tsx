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

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import {
  CommentModeProvider,
  useCommentMode,
} from "@/components/comments/comment-mode-provider";
import { CommentsRail } from "@/components/comments/comments-rail";
import { MessagesModeProvider } from "@/components/messages/messages-mode-provider";
import { MessagesRail } from "@/components/messages/messages-rail";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useClientPortal } from "@/contexts/client-portal-context";
import { cn } from "@/lib/utils";
import {
  portalCommentsSurface,
  wantsCommentsRail,
} from "@/lib/comments/portal-surface";
import { benefitCategoryToVisibilityKey } from "@/lib/portal-category-visibility";
import {
  customBenefitNameToSlug,
  isPlaceholderBenefitName,
} from "@/lib/benefit-custom-name";

/** The same breakpoint the desktop gate uses — a rail is a desktop affordance. */
const DESKTOP_QUERY = "(min-width: 1024px)";

export function PortalCommentsRail({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flagged, setFlagged] = useState(false);
  const { status } = useSession();
  const { clientData } = useClientPortal();
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  // `serverFallback: false` — assume NOT desktop until measured, so a phone never reserves the column
  // for a panel it is about to be told it cannot have.
  const isDesktop = useMediaQuery(DESKTOP_QUERY, false);

  useEffect(() => {
    setFlagged(wantsCommentsRail(window.location.search));
  }, []);

  const armed = flagged && status === "authenticated" && isDesktop;

  /**
   * The Plan / Benefit conversation this rail is attached to.
   *
   * The panel itself is global (it sits beside the page, not inside it), so the
   * reader needs the page's own name to know which comments they are reading.
   * The same surface mapping the layout registers is used here, including the
   * Custom hub's advisor-chosen slug.
   */
  const surfaceLabel = useMemo(() => {
    const planSlug = typeof params?.id === "string" ? params.id : "";
    const hubs = (clientData as any)?.benefitHubs;
    const customHubSlug = (() => {
      if (!Array.isArray(hubs)) return null;
      const hub = hubs.find(
        (entry: any) =>
          benefitCategoryToVisibilityKey(String(entry?.category || "")) ===
          "Other",
      );
      const title = String(hub?.title || "").trim();
      return title && !isPlaceholderBenefitName(title)
        ? customBenefitNameToSlug(title)
        : null;
    })();
    const surface = portalCommentsSurface({
      pathname: pathname ?? "",
      planSlug,
      customHubSlug,
    });
    if (!surface) return null;

    const benefitLabel =
      surface.targetType === "benefit"
        ? surface.category === "Other"
          ? "Custom Benefit"
          : surface.category
        : "Plan Hub";
    const companyName = String(clientData?.companyName || "").trim();
    return companyName ? `${companyName} · ${benefitLabel}` : benefitLabel;
  }, [clientData, params?.id, pathname]);

  // The rail's own top offset. The dashboard docks it below its header (`4rem`); here the portal's
  // header is cleared by `--comments-inset` — it stops where the rail begins — so the panel can use
  // the full height of the window instead of starting below a header it is not sitting under.
  useEffect(() => {
    if (!armed) return;
    const root = document.documentElement;
    root.style.setProperty("--comments-rail-top", "0px");
    // The Messages rail shares this column and docks to the same top edge.
    root.style.setProperty("--messages-rail-top", "0px");
    // Braces, not a concise arrow: `removeProperty` returns a value, and a cleanup that returns one
    // is not a cleanup as far as React's types are concerned. `comments-layout.ts` does it this way
    // for the same reason.
    return () => {
      root.style.removeProperty("--comments-rail-top");
      root.style.removeProperty("--messages-rail-top");
    };
  }, [armed]);

  if (!armed) return <>{children}</>;

  return (
    <CommentModeProvider initialMode="on">
      <MessagesModeProvider>
        {children}
        <CommentsRail
          surfaceLabel={surfaceLabel}
          showViewer
          showPanelSwitch
        />
        {/* Same column as Comments; `lib/right-panel.ts` keeps the two exclusive. */}
        <MessagesRail showPanelSwitch />
        {/* Inside the providers: the portal's single floating Comments button. */}
        <PortalCommentsButton />
      </MessagesModeProvider>
    </CommentModeProvider>
  );
}

/**
 * The floating Comments button, bottom-right.
 *
 * The portal has no header action cluster, so without this a reader who closes
 * the rail has no way back to it short of editing the URL. Same icon and active
 * treatment as the dashboard's `CommentsToggle`.
 *
 * The Comments / Messages switch lives at the top of the rail itself
 * (`RailPanelSwitch`), not here: this button only opens the Comments panel.
 *
 * It sits at the rail's LEFT edge while either rail is open
 * (`inset + 1.5rem`) — the single place to read the MAX of the two insets,
 * since only one can be open at a time. With both closed the expression
 * collapses to the corner.
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
      style={{
        right:
          "calc(max(var(--comments-inset, 0px), var(--messages-inset, 0px)) + 1.5rem)",
      }}
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
