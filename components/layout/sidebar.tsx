"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { DashboardNav } from "@/components/ui/dashboard-nav";
import { navItems } from "@/constants/data";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { useTheme } from "next-themes";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { usePathname } from "next/navigation";

const SIDEBAR_STATE_KEY = "sidebar-is-open";

const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
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
    // Only access localStorage after component mounts (client-side)
    if (typeof window !== "undefined") {
      const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
      return savedState !== null ? savedState === "true" : true;
    }
    return true;
  });
  const { theme = "system" } = useTheme();
  const [themeMode, setThemeMode] = useState("");

  useEffect(() => {
    setThemeMode(theme);
  }, [theme]);

  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => {
      const newState = !prev;
      // Save to localStorage when toggled
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_STATE_KEY, String(newState));
      }
      return newState;
    });
  }, []);

  // Set the CSS variable when sidebar state changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      isOpen ? "16rem" : "4rem",
    );

    // Also save to localStorage when state changes
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(isOpen));
    }
  }, [isOpen]);

  // Restore sidebar width if not on step 2 (step 2 sets it to 36rem for modal)
  useEffect(() => {
    // Check if we're not on step 2 (or not on wizard page at all)
    const isNotStep2 = currentStep === null || currentStep !== 2;

    if (isNotStep2) {
      const currentWidth =
        document.documentElement.style.getPropertyValue("--sidebar-width");

      // If sidebar-width is set to 36rem (step 2 modal width), restore it
      if (currentWidth === "36rem") {
        // Restore to correct sidebar width based on isOpen state
        document.documentElement.style.setProperty(
          "--sidebar-width",
          isOpen ? "16rem" : "4rem",
        );
      }
    }
  }, [currentStep, isOpen, pathname]);

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
      className={cn(
        `fixed left-0 top-0 h-screen z-50 bg-[#FDFDFD] dark:bg-background border-r border-[#efefef] dark:border-[#1c1c1c] transition-all duration-200 ease-in-out flex flex-col`,
        isOpen ? "w-64" : "w-16",
      )}
    >
      {/* Toggle Button to Collapse/Expand Sidebar */}
      <button
        onClick={toggleSidebar}
        className={cn(
          "absolute p-2 bg-white dark:bg-background border-[#efefef] dark:border-[#1c1c1c] border rounded-full shadow-lg z-30",
          "top-[76px] -right-4 transform -translate-y-1/2",
        )}
        type="button"
      >
        {isOpen ? (
          <Icons.chevronLeft className="w-4 h-4" />
        ) : (
          <Icons.chevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Logo */}
      <div className="flex items-center p-4 flex-shrink-0 overflow-hidden">
        <Link href={"#"} target="_blank" className="block w-full h-8 relative">
          {/* Full logo — fades out as sidebar collapses */}
          <img
            src={srcImage}
            alt="PlanTelligence"
            className={cn(
              "absolute left-0 top-0 transition-all duration-200 ease-in-out",
              isOpen
                ? "w-[200px] opacity-100"
                : "w-0 opacity-0 pointer-events-none",
            )}
          />
          {/* Icon logo — fades in as sidebar collapses */}
          <img
            src={iconImage}
            alt="PlanTelligence Icon"
            className={cn(
              "absolute left-0 top-0 transition-all duration-200 ease-in-out",
              isOpen
                ? "w-0 opacity-0 pointer-events-none"
                : "w-6 opacity-100",
            )}
          />
        </Link>
      </div>

      {/* Navigation */}
      <div className="px-4 mt-6 flex-1 overflow-y-auto">
        <DashboardNav items={navItems} isOpen={isOpen} />
      </div>
    </nav>
  );
});

Sidebar.displayName = "Sidebar";

export default Sidebar;
