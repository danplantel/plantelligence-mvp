"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { DashboardNav } from "@/components/ui/dashboard-nav";
import { navItems } from "@/constants/data";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { useTheme } from "next-themes";

const SIDEBAR_STATE_KEY = "sidebar-is-open";

const Sidebar = memo(function Sidebar() {
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

  const srcImage = "/pt_web_light.png";
  const iconImage = "/pt_icon_light.png";

  return (
    <nav
      className={cn(
        `fixed left-0 top-0 h-screen z-50 bg-[#F2F2F4] dark:bg-[#030303] border-r border-[#efefef] dark:border-[#1c1c1c] transition-all duration-200 ease-in-out flex flex-col`,
        isOpen ? "w-64" : "w-16",
      )}
    >
      {/* Arrow Button to Toggle Sidebar */}
      <button
        onClick={toggleSidebar}
        className={cn(
          "absolute p-2 bg-white dark:bg-[#030303] border-[#efefef] dark:border-[#1c1c1c] border rounded-full shadow-lg z-[60]",
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
      <div className="flex items-center justify-center pt-6 pb-4 flex-shrink-0">
        <Link href={"#"} target="_blank" className="flex justify-center w-full">
          <div className="flex justify-center">
            {isOpen ? (
              <img src={srcImage} className="w-[200px]" alt="PlanTelligence" />
            ) : (
              <img
                src={iconImage}
                className="w-8 h-10"
                alt="PlanTelligence Icon"
              />
            )}
          </div>
        </Link>
      </div>

      {/* Dashboard Navigation */}
      <div className="px-2 py-4 flex-1 overflow-y-auto">
        <div className="space-y-1">
          <DashboardNav items={navItems} isOpen={isOpen} />
        </div>
      </div>
    </nav>
  );
});

Sidebar.displayName = "Sidebar";

export default Sidebar;
