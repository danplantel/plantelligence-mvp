"use client";

import { cn } from "@/lib/utils";
// Notifications UI — hidden for now; will be re-added later.
// import { DocumentExpirationNotifications } from "./document-expiration-notifications";
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
          style={{ left: "calc(var(--sidebar-width, 18rem) + 2.5rem)" }}
        >
          {stepper}
        </div>
      )}
      <nav
        className={cn(
          "flex items-center px-10 transition-all duration-200",
          stepper ? "h-[72px]" : "h-16",
          scrolled
            ? "bg-background/80 backdrop-blur-md shadow-sm"
            : "bg-transparent",
        )}
        style={{
          marginLeft: "var(--sidebar-width, 18rem)",
        }}
      >
        {/* Left: Title + Company Name + Step Title (hidden while the Editing Panel is open) */}
        <div
          className={cn(
            "flex items-center gap-2 min-w-0",
            editorOpen && portalHasContent ? "flex-none" : "flex-[1]",
          )}
        >
          {!editorOpen && title && (
            <h1
              className="text-sm font-semibold dark:text-white truncate"
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
              <span className="text-sm text-muted-foreground/40 dark:text-gray-600">/</span>
              <span
                className="text-sm font-semibold text-accent-blue truncate min-w-0"
                title={subtitle}
              >
                {subtitle}
              </span>
            </>
          )}
          {!editorOpen && stepTitle && (
            <>
              <span className="text-xl text-muted-foreground/40 dark:text-gray-600">/</span>
              <span className="text-sm font-medium text-muted-foreground truncate min-w-0">{stepTitle}</span>
            </>
          )}
        </div>

        {/* Center: Stepper (when provided) or portal target for page-level tabs
            (e.g. Edit Plan tabs). Pages portal their TabsList here via createPortal
            so it stays inside the <Tabs> React context while rendering in the header.
            A stepper is kept at its natural (compact) width so the left title area
            gets the leftover space; flex-[3] is only used for the tabs portal so
            tabs stay on one line. */}
        <div
          className={cn(
            "flex min-w-0",
            stepper
              ? "justify-center flex-shrink-0"
              : portalHasContent
                ? editorOpen
                  ? "flex-1 justify-start"
                  : "flex-[3] justify-center"
                : "justify-center flex-shrink-0",
          )}
        >
          {stepper && !editorOpen ? stepper : <div id="header-tabs-portal" className="w-full" />}
        </div>

        {/* Right: Actions */}
        <div
          className={cn(
            "flex items-center justify-end gap-2 min-w-0",
            editorOpen && portalHasContent ? "flex-none" : "flex-[1]",
          )}
        >
          {/* Notifications UI — hidden for now; will be re-added later. */}
          {/* <DocumentExpirationNotifications /> */}
          {/* Collapse the user menu to just the avatar while the Editing Panel is
              open so its name can never overlap the Light/Dark toggle. */}
          <div className="min-w-0">
            <UserNav compact={editorOpen} />
          </div>
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle light/dark mode"
              className="rounded-full shrink-0"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-5 w-5 text-yellow-400" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600" />
              )}
            </Button>
          )}
        </div>
      </nav>

    </div>
  );
}
