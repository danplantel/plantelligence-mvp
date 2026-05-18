"use client";

import { memo } from "react";
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
        <NavItemComponent key={index} item={item} isOpen={isOpen} />
      ))}
    </nav>
  );
});
