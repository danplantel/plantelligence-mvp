"use client";

import { memo, Suspense } from "react";
import type { NavItem } from "@/types";
import { NavItemComponent } from "./nav-item";

interface DashboardNavProps {
  items: NavItem[];
  isOpen: boolean;
}

export const DashboardNav = memo(function DashboardNav({
  items,
  isOpen,
}: DashboardNavProps) {
  if (!items?.length) {
    return null;
  }

  return (
    <nav className="space-y-2">
      {items.map((item, index) => (
        // Suspense is required because NavItemComponent uses useSearchParams()
        <Suspense key={index} fallback={null}>
          <NavItemComponent item={item} isOpen={isOpen} />
        </Suspense>
      ))}
    </nav>
  );
});
