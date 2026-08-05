"use client";

import { cn } from "@/lib/utils";
import { UserNav } from "./user-nav";
import { DocumentExpirationNotifications } from "./document-expiration-notifications";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  /** Optional stepper component to render centered in the header */
  stepper?: ReactNode;
  /** Optional step title to display next to the page title */
  stepTitle?: string;
}

export default function Header({ stepper, stepTitle }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const { title } = usePageTitleContext();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
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
        {/* Left: Title + Step Title */}
        <div className="flex items-center gap-2 flex-[1] min-w-0">
          {title && <h1 className="text-xl font-semibold dark:text-white truncate">{title}</h1>}
          {stepTitle && (
            <>
              <span className="text-xl text-muted-foreground/40 dark:text-gray-600">/</span>
              <span className="text-sm font-medium text-muted-foreground truncate">{stepTitle}</span>
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
            "flex justify-center min-w-0",
            stepper ? "flex-shrink-0" : "flex-[3]",
          )}
        >
          {stepper ? stepper : <div id="header-tabs-portal" className="w-full" />}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-2 flex-[1] min-w-0">
          <DocumentExpirationNotifications />
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle light/dark mode"
              className="rounded-full"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-5 w-5 text-yellow-400" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600" />
              )}
            </Button>
          )}
          <UserNav />
        </div>
      </nav>

    </div>
  );
}
