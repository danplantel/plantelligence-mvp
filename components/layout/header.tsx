"use client";

import { cn } from "@/lib/utils";
import { UserNav } from "./user-nav";
import { DocumentExpirationNotifications } from "./document-expiration-notifications";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
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
          "flex items-center justify-between h-16 px-10 transition-all duration-200",
          scrolled
            ? "bg-background/80 backdrop-blur-md shadow-sm"
            : "bg-transparent",
        )}
        style={{
          marginLeft: "var(--sidebar-width, 18rem)",
        }}
      >
        <div className="flex items-center">
          {title && <h1 className="text-xl font-semibold dark:text-white">{title}</h1>}
        </div>

        <div className="flex items-center gap-2">
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
