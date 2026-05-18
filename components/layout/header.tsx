"use client";

import { cn } from "@/lib/utils";
import { UserNav } from "./user-nav";
import { DocumentExpirationNotifications } from "./document-expiration-notifications";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect, useState } from "react";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { title } = usePageTitleContext();

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

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
      <nav
        className={cn(
          "flex items-center justify-between h-16 px-10 transition-all duration-200",
          scrolled
            ? "bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm"
            : "bg-transparent",
        )}
        style={{
          marginLeft: "var(--sidebar-width, 18rem)",
        }}
      >
        <div className="flex items-center">
          {title && <h1 className="text-xl font-semibold">{title}</h1>}
        </div>

        <div className="flex items-center gap-2">
          <DocumentExpirationNotifications />
          <UserNav />
        </div>
      </nav>
    </div>
  );
}
