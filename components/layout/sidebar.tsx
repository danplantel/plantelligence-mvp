"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { DashboardNav } from "@/components/ui/dashboard-nav";
import { navItems } from "@/constants/data";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { useTheme } from "next-themes";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { usePathname } from "next/navigation";
import { PREVIEW_EDITOR_LAYOUT_EVENT } from "@/lib/preview-editor-layout";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useViewerAccess } from "@/hooks/useViewerAccess";
import { mayUsePath } from "@/lib/teammates/nav-access";
import { Skeleton } from "@/components/ui/skeleton";
import type { NavItem } from "@/types";

const SIDEBAR_STATE_KEY = "sidebar-is-open";

/** Read the saved preference; storage failures must not crash the layout. */
function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STATE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Persist the preference; a quota/security failure must not block the toggle. */
function writeSidebarPreference(isOpen: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STATE_KEY, String(isOpen));
  } catch {
    // Storage is unavailable — the in-memory state still works.
  }
}

/**
 * The nav's placeholder while the access summary is still being read.
 *
 * Which links this viewer gets is decided by their role and permission grid, so until that answer
 * lands there is nothing honest to draw. The summary fails OPEN, so the previous behaviour was to
 * render the full nav and then remove the entries a Collaborator may not use — a flash of links
 * that lead to a refusal. The rows mirror `NavItemComponent`'s own geometry (a 24px icon beside a
 * one-line label, inside the container's `px-4`), so the reveal is a fade rather than a relayout,
 * and the icon-only column is kept when the rail is collapsed.
 */
function NavSkeleton({ isOpen }: { isOpen: boolean }) {
  return (
    <nav className="space-y-2" aria-hidden="true">
      {navItems.map((item, index) => (
        <div
          key={item.title ?? index}
          className="flex items-center px-2 py-2 xl:px-4 xl:py-3"
        >
          <Skeleton className="mr-2 size-5 shrink-0 rounded-md xl:mr-3 xl:size-6" />
          {isOpen ? <Skeleton className="h-3.5 w-20 xl:h-4 xl:w-24" /> : null}
        </div>
      ))}
    </nav>
  );
}

// The restricted destinations live in `lib/teammates/nav-access.ts`, shared with the
// layout guard so a hidden link and a typed URL are decided by one rule.

const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  // Chrome-level access: whether this viewer is a Collaborator, and the union of the
  // grids they hold. Seeded from the server through SWR's cache, so the nav never flashes.
  const { isCollaborator, can, isLoading: isAccessLoading } = useViewerAccess();
  // ── Responsive rail width ──
  // The dashboard only renders from 1024px up (`DESKTOP_ONLY_MIN_WIDTH_PX`), so the rail
  // is scaled down between 1024 and 1280 (13rem) and full-size at `xl` and up (16rem).
  // The width it gives back is width the header's title, stepper and action cluster keep.
  // `--sidebar-width` is the single source every other surface offsets by, so the width
  // rendered below and the value written in the effects are BOTH derived from
  // `railWidth` — the nav and the surfaces that clear it cannot drift apart.
  const isRoomy = useMediaQuery("(min-width: 1280px)");
  const openRailWidth = isRoomy ? "16rem" : "13rem";
  // Get currentStep from wizard store (only if on wizard page)
  const currentStep = useNewClientWizardStore((state) => {
    // Only get currentStep if we're on the new client wizard page
    if (pathname?.includes("/new-client")) {
      return state.currentStep;
    }
    return null;
  });

  // Initialize state from localStorage if available, otherwise default to true
  const [isOpen, setIsOpen] = useState(() => {
    // Only access localStorage after component mounts (client-side).
    if (typeof window !== "undefined") return readSidebarPreference();
    return true;
  });
  const { theme = "system" } = useTheme();
  const [themeMode, setThemeMode] = useState("");

  // Preview pages (Edit Plan / Edit Benefit) ask us to rail-collapse while their
  // inline Editing Panel is open, so the nav stays visible beside the panel
  // instead of being painted over. This is a *view* override only — `isOpen`
  // (the user's own preference, persisted to localStorage) is left untouched and
  // restored as soon as the panel closes.
  const [forcedCollapsed, setForcedCollapsed] = useState(false);
  useEffect(() => {
    const handleLayoutChange = (event: Event) => {
      const detail = (event as CustomEvent<{ isOpen?: boolean }>).detail;
      setForcedCollapsed(!!detail?.isOpen);
    };
    window.addEventListener(PREVIEW_EDITOR_LAYOUT_EVENT, handleLayoutChange);
    return () =>
      window.removeEventListener(
        PREVIEW_EDITOR_LAYOUT_EVENT,
        handleLayoutChange,
      );
  }, []);

  const effectiveOpen = isOpen && !forcedCollapsed;
  /** The rail's real width, and the value written to `--sidebar-width`. */
  const railWidth = effectiveOpen ? openRailWidth : "4rem";

  useEffect(() => {
    setThemeMode(theme);
  }, [theme]);

  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => {
      const newState = !prev;
      if (typeof window !== "undefined") writeSidebarPreference(newState);
      return newState;
    });
  }, []);

  // Persist the user's own preference — never the temporary editor rail-collapse.
  useEffect(() => {
    if (typeof window !== "undefined") writeSidebarPreference(isOpen);
  }, [isOpen]);

  // `--sidebar-width` is the real sidebar width that every other surface offsets
  // by (header, main, previews). It follows the *effective* state so the editor's
  // rail-collapse is reflected everywhere at once.
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", railWidth);
  }, [railWidth]);

  // Restore sidebar width if not on step 2 (step 2 sets it to 36rem for modal)
  useEffect(() => {
    // Check if we're not on step 2 (or not on wizard page at all)
    const isNotStep2 = currentStep === null || currentStep !== 2;

    if (isNotStep2) {
      const currentWidth =
        document.documentElement.style.getPropertyValue("--sidebar-width");

      // If sidebar-width is set to 36rem (step 2 modal width), restore it
      if (currentWidth === "36rem") {
        // Restore to correct sidebar width based on the effective state
        document.documentElement.style.setProperty("--sidebar-width", railWidth);
      }
    }
  }, [currentStep, railWidth, pathname]);

  /**
   * The nav items this viewer may see.
   *
   * Only a Collaborator's list is narrowed, and only by `NAV_REQUIREMENTS` — everyone
   * else sees the nav they see today, so an owner or a Team Member is never affected.
   */
  const visibleNavItems = useMemo(() => {
    if (!isCollaborator) return navItems;

    // One shared rule with the layout guard, so a link the nav hides and a URL typed
    // directly are decided in exactly the same place (`lib/teammates/nav-access.ts`).
    const mayReach = (href?: string) =>
      mayUsePath(href, { isCollaborator, can });

    return (
      navItems
        .map((item) => {
          // An item's OWN destination can be off-limits too (Dashboard, for instance) —
          // filtering only the children would leave those top-level links in place.
          if (!mayReach(item.href)) return null;
          return item.items
            ? {
                ...item,
                items: item.items.filter((child) => mayReach(child.href)),
              }
            : item;
        })
        .filter((item): item is NavItem => item !== null)
        // A group whose every child was filtered out has nothing left to lead to.
        .filter((item) => !item.items || item.items.length > 0)
    );
  }, [isCollaborator, can]);

  const srcImage =
    themeMode === "dark"
      ? "/plantelligence-logos/pt_web_dark.png"
      : "/plantelligence-logos/pt_web_light.png";

  const iconImage =
    themeMode === "dark"
      ? "/plantelligence-logos/pt_icon_dark.png"
      : "/plantelligence-logos/pt_icon_light.png";

  return (
    <nav
      aria-label="Main"
      className={cn(
        `fixed left-0 top-0 h-screen z-50 bg-[#FDFDFD] dark:bg-background border-r border-[#efefef] dark:border-[#1c1c1c] transition-all duration-200 ease-in-out flex flex-col`,
      )}
      // Width comes from the same value written to `--sidebar-width`, so the rail can
      // never disagree with the header/main offset that clears it.
      style={{ width: railWidth }}
    >
      {/* Toggle Button to Collapse/Expand Sidebar. Hidden while the Preview
          editing panel forces the rail, so it cannot overlap the panel's edge. */}
      {!forcedCollapsed && (
        <button
          onClick={toggleSidebar}
          aria-label={effectiveOpen ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(
            "absolute p-2 bg-white dark:bg-background border-[#efefef] dark:border-[#1c1c1c] border rounded-full shadow-lg z-30",
            "top-[76px] -right-4 transform -translate-y-1/2",
          )}
          type="button"
        >
          {effectiveOpen ? (
            <Icons.chevronLeft className="w-4 h-4" />
          ) : (
            <Icons.chevronRight className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Logo */}
      <div className="flex flex-shrink-0 items-center overflow-hidden p-3 xl:p-4">
        <Link href={"#"} target="_blank" className="block w-full h-8 relative">
          {/* Full logo — fades out as sidebar collapses */}
          <img
            src={srcImage}
            alt="PlanTelligence"
            className={cn(
              "absolute left-0 top-0 transition-all duration-200 ease-in-out",
              effectiveOpen
                ? "w-[152px] opacity-100 xl:w-[200px]"
                : "w-0 opacity-0 pointer-events-none",
            )}
          />
          {/* Icon logo — fades in as sidebar collapses */}
          <img
            src={iconImage}
            alt="PlanTelligence Icon"
            className={cn(
              "absolute left-0 top-0 transition-all duration-200 ease-in-out",
              effectiveOpen
                ? "w-0 opacity-0 pointer-events-none"
                : "w-6 opacity-100",
            )}
          />
        </Link>
      </div>

      {/* Navigation — a placeholder while the access summary decides the list, so the nav never
          flashes links this viewer cannot use (see `NavSkeleton`). */}
      <div className="mt-4 flex-1 overflow-y-auto px-3 xl:mt-6 xl:px-4">
        {isAccessLoading ? (
          <NavSkeleton isOpen={effectiveOpen} />
        ) : (
          <DashboardNav items={visibleNavItems} isOpen={effectiveOpen} />
        )}
      </div>
    </nav>
  );
});

Sidebar.displayName = "Sidebar";

export default Sidebar;
