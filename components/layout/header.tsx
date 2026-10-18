"use client";

import { cn } from "@/lib/utils";
import { NotificationsMenu } from "./notifications-menu";
import { CommentsToggle } from "@/components/comments/comments-toggle";
import { MessagesToggle } from "@/components/messages/messages-toggle";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserNav } from "./user-nav";

interface HeaderProps {
  /** Optional stepper component to render centered in the header */
  stepper?: ReactNode;
  /** Optional step title to display next to the page title */
  stepTitle?: string;
}

export default function Header({ stepper, stepTitle }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const { title, subtitle } = usePageTitleContext();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // When an "Editing Panel" is open (Create Benefits step 5 editor via
  // step5EditorStateChange, or Create Plan step 2 editor via
  // step2EditorStateChange), hide the page title / step title so it doesn't
  // overlap the editor overlay, and center the Stepper over the full header —
  // matching how the Create Benefits wizard behaves.
  const [editorOpen, setEditorOpen] = useState(false);
  // True once a page portals a TabsList into #header-tabs-portal (e.g. the
  // Edit Plan tabs). Only then does the center of the header reserve the
  // wide flex-[3] area; otherwise it collapses so the left title/company
  // name area gets enough room and doesn't get truncated.
  const [portalHasContent, setPortalHasContent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (stepper) return;
    const el = document.getElementById("header-tabs-portal");
    if (!el) return;
    const update = () => setPortalHasContent(el.childElementCount > 0);
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, [stepper]);

  useEffect(() => {
    const handleEditorStateChange = (event: any) => {
      setEditorOpen(!!event?.detail?.isOpen);
    };
    window.addEventListener(
      "step5EditorStateChange" as any,
      handleEditorStateChange,
    );
    window.addEventListener(
      "step2EditorStateChange" as any,
      handleEditorStateChange,
    );
    return () => {
      window.removeEventListener(
        "step5EditorStateChange" as any,
        handleEditorStateChange,
      );
      window.removeEventListener(
        "step2EditorStateChange" as any,
        handleEditorStateChange,
      );
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrolled]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // The Plan's company name can be embedded in the page title (e.g. the Edit
  // Plan page sets "Edit Plan - {Company}"). Split it out so the company-name
  // portion renders in accent-blue, matching the accent-blue subtitle used
  // elsewhere (e.g. the Create Benefits page).
  const TITLE_COMPANY_SEPARATOR = " - ";
  const companySeparatorIndex = title.indexOf(TITLE_COMPANY_SEPARATOR);
  const titleMain =
    companySeparatorIndex >= 0 ? title.slice(0, companySeparatorIndex) : title;
  const titleCompany =
    companySeparatorIndex >= 0
      ? title.slice(companySeparatorIndex + TITLE_COMPANY_SEPARATOR.length)
      : "";

  // While the editing panel is open the stepper is rendered in the
  // absolutely-positioned overlay below, so it must NOT also occupy an in-flow
  // column — a full-width placeholder in that column is what consumed the whole
  // row and squeezed the right-hand actions.
  const stepperFloats = !!stepper && editorOpen;
  // The centre column only owns space when it actually renders something: the
  // in-flow stepper (editor closed) or portaled page-level tabs.
  const centerOwnsSpace = stepper ? !stepperFloats : portalHasContent;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      {/* When the Editing Panel is open, align the Stepper to the start of the
          visible header (immediately to the right of the fixed overlay editor,
          which covers the sidebar area). Keeping it shrink-wrapped and left of
          the action buttons prevents it from overlapping the Light/Dark toggle
          or UserNav, at any browser zoom level. */}
      {editorOpen && stepper && (
        <div
          className="absolute top-1/2 -translate-y-1/2 flex items-center"
          style={{
            left:
              "calc(var(--sidebar-width, 18rem) + var(--editor-inset, 0px) + 2.5rem)",
          }}
        >
          {stepper}
        </div>
      )}
      {/* Responsive scale. The dashboard only renders from 1024px up
          (`DESKTOP_ONLY_MIN_WIDTH_PX`), so `lg` is the floor and the base classes
          below are the compact 1024–1279px look; `xl:` (1280px) restores the
          full-size header. Before this, the fixed 40px side padding, the 8px gaps,
          the `text-sm`/`text-xl` type and the named UserNav all kept their size
          while the row shrank, so the title, the stepper and the action cluster
          ended up competing for the same space. Only paddings, gaps, type and icon
          sizes scale — the header's HEIGHT stays put, because the sidebar's
          collapse toggle is pinned to `top-[76px]` against it. */}
      <nav
        className={cn(
          "flex items-center px-3 transition-all duration-200 xl:px-10",
          stepper ? "h-[72px]" : "h-16",
          scrolled
            ? "bg-background/80 backdrop-blur-md shadow-sm"
            : "bg-transparent",
        )}
        style={{
          // Clears the sidebar *and* any Preview inline Editing Panel.
          marginLeft:
            "calc(var(--sidebar-width, 18rem) + var(--editor-inset, 0px))",
        }}
      >
        {/* Left: Title + Company Name + Step Title (hidden while the Editing Panel is open) */}
        <div
          className={cn(
            "flex items-center gap-1 min-w-0 xl:gap-1.5 2xl:gap-2",
            editorOpen && portalHasContent
              ? "flex-none"
              : // A page with a portalled tab strip (Edit Plan / Edit Benefit /
                // Settings) or a wizard stepper gives this column its CONTENT width
                // (`flex-none`). The title and the subtitle stay on ONE line and are
                // never ellipsised — the type steps down instead (see below) — so
                // neither piece of chrome beside them has to fight the title for
                // space. `min-w-fit`/`min-w-0` here used to make the title compete
                // with the strip, leaving the six-tab Edit Benefit strip roughly
                // 190–200px; it also let a nowrap title overflow its share on the
                // wizard pages.
                //
                // Pages with neither keep the previous behaviour: the symmetric
                // `flex-[1]` share while the content fits, raised to the content's
                // own width at `xl` where the room exists.
                portalHasContent || stepper
                ? "flex-none"
                : "flex-[1] min-w-0 xl:min-w-fit",
          )}
        >
          {!editorOpen && title && (
            <h1
              // No `truncate`/wrapping: the full value is always shown on one
              // line; the responsive type ramp is what makes it fit.
              className="whitespace-nowrap text-[11px] font-semibold leading-none dark:text-white xl:text-xs 2xl:text-sm"
              title={title}
            >
              {titleMain}
              {titleCompany && (
                <>
                  {TITLE_COMPANY_SEPARATOR}
                  <span className="text-accent-blue">{titleCompany}</span>
                </>
              )}
            </h1>
          )}
          {!editorOpen && subtitle && (
            <>
              <span className="text-[10px] leading-none text-muted-foreground/40 dark:text-gray-600 xl:text-[11px] 2xl:text-sm">/</span>
              <span
                className="whitespace-nowrap text-[10px] font-semibold leading-none text-accent-blue xl:text-[11px] 2xl:text-sm"
                title={subtitle}
              >
                {subtitle}
              </span>
            </>
          )}
          {!editorOpen && stepTitle && (
            <>
              <span className="text-[10px] leading-none text-muted-foreground/40 dark:text-gray-600 xl:text-[11px] 2xl:text-base">/</span>
              <span className="whitespace-nowrap text-[10px] font-medium leading-none text-muted-foreground xl:text-[11px] 2xl:text-sm">
                {stepTitle}
              </span>
            </>
          )}
        </div>

        {/* Center: Stepper (when provided) or portal target for page-level tabs
            (e.g. Edit Plan tabs). Pages portal their TabsList here via createPortal
            so it stays inside the <Tabs> React context while rendering in the header.
            A stepper is kept at its natural (compact) width so the title column and
            the action cluster split the leftover space evenly around it. The tab
            portal instead takes ALL the leftover space (`flex-1`) — the title
            column is `flex-none` there, so this is the one flexible column.

            When the editing panel is open the stepper is rendered in the
            absolutely-positioned overlay above, so this column holds nothing and
            just passes slack through. */}
        <div
          className={cn(
            "flex min-w-0",
            stepperFloats
              ? "flex-1"
              : stepper
                ? "justify-center flex-shrink-0"
                : portalHasContent
                  ? editorOpen
                    ? "flex-1 justify-start"
                    : // The title column is `flex-none`, so every pixel left over
                      // belongs to the tab strip — it gets the whole remainder and
                      // scrolls internally if its tabs are wider than that.
                      "flex-1 justify-center"
                  : "justify-center flex-shrink-0",
          )}
        >
          {stepperFloats ? null : stepper ? (
            stepper
          ) : (
            <div
              id="header-tabs-portal"
              className={cn(
                "w-full",
                // ── The tab strips are scaled from HERE ──
                // Settings, Edit Plan, Edit Benefit and Edit Client each define their own
                // TabsList and portal it in. The canonical sizes live in
                // `lib/header-tabs.ts` and are applied by those pages; the rules here
                // repeat the SAME ramp as a fallback for any tab list portalled in
                // without adopting that module. Radix renders a trigger as
                // `<button role="tab">`, so these selectors need no cooperation from
                // the pages. Three steps, driven by the width the centre column
                // actually has (see `HEADER_TAB_TRIGGER_CLASS`):
                //
                //   1024–1279px  base   11px labels, tight padding
                //   1280–1535px  `xl`   12px labels, slightly looser
                //   1536px+      `2xl`  13px labels, looser again
                //
                // The header's other controls return to full size at `xl`; the tabs
                // step up more gently because the title column now keeps its full
                // (un-ellipsised) width and a six-tab strip still has to share the
                // row with the action cluster. The strip stays one line and scrolls
                // horizontally, so a narrower tab just means more of them fit.
                "[&_[role=tab]]:gap-1 [&_[role=tab]]:px-1 [&_[role=tab]]:py-1.5 [&_[role=tab]]:text-[11px]",
                "xl:[&_[role=tab]]:gap-1.5 xl:[&_[role=tab]]:px-1.5 xl:[&_[role=tab]]:text-xs",
                "2xl:[&_[role=tab]]:gap-1.5 2xl:[&_[role=tab]]:px-2 2xl:[&_[role=tab]]:py-2.5 2xl:[&_[role=tab]]:text-[13px]",
                "[&_[role=tab]_svg]:size-3.5 xl:[&_[role=tab]_svg]:size-4",
                // With the Editing Panel open the page title is hidden and this
                // column starts immediately right of the panel, so the portalled
                // tabs must align to that edge instead of centring across the
                // header. Edit Plan already swaps its own TabsList to
                // `justify-start` when its panel opens; Edit Benefit's tabs are
                // centred in the list itself, so force the alignment here rather
                // than requiring every page to track the panel state. No-op for
                // the wizards, which render a stepper instead of this portal.
                editorOpen &&
                  portalHasContent &&
                  "[&>div]:!justify-start",
              )}
            />
          )}
        </div>

        {/* Right: Actions — always hard against the right edge and never
            compressed narrower than its own content. Without `min-w-fit` a
            squeezed right group overflows to the left (flex + justify-end spills
            toward the start), which is what pushed the Light/Dark toggle and
            UserNav over the stepper. */}
        <div
          className={cn(
            // The gap tightens with the viewport. On a tab page the group is
            // `flex-none`: its controls have their own compact `xl` ramp (see
            // `UserNav`, `CommentsToggle`, …) and must never be squeezed into
            // each other, but it also has nothing to gain from a growable share —
            // `flex-[1]` here only took space away from the title and the
            // portalled tab strip. When the centre column is a STEPPER (not tabs)
            // the previous symmetric split is kept, so the stepper stays visually
            // between the title and the actions.
            "flex min-w-0 items-center justify-end gap-1 xl:gap-2",
            centerOwnsSpace
              ? stepper
                ? "flex-[1] min-w-fit"
                : "flex-none"
              : "flex-none ml-auto shrink-0",
          )}
        >
          <MessagesToggle />
          <CommentsToggle />
          <NotificationsMenu />
          {/* Light/Dark toggle sits immediately beside the notifications bell — both
              are compact icon buttons, so they read as a single control cluster. */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle light/dark mode"
              className="h-7 w-7 shrink-0 rounded-full xl:h-8 xl:w-8"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-yellow-400 xl:h-5 xl:w-5" />
              ) : (
                <Moon className="h-4 w-4 text-gray-600 xl:h-5 xl:w-5" />
              )}
            </Button>
          )}
          {/* Collapse the user menu to just the avatar while the Editing Panel is
              open so its name can never overlap the Light/Dark toggle. When a page
              portals its tabs here, the name block stays collapsed until `2xl`:
              that width is what lets the full title stay on one line AND leaves
              the tab strip enough room to show every tab. */}
          <div className="min-w-0">
            <UserNav
              compact={editorOpen}
              detailsFrom={portalHasContent ? "2xl" : "xl"}
            />
          </div>
        </div>
      </nav>

    </div>
  );
}
