"use client";

import { memo, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
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

  return <NavList items={items} isOpen={isOpen} />;
});

function NavList({ items, isOpen }: { items: NavItem[]; isOpen: boolean }) {
  const router = useRouter();

  // Eagerly prefetch all nav routes on mount
  useEffect(() => {
    items.forEach((item) => {
      if (item.href) router.prefetch(item.href);
      item.items?.forEach((subItem) => {
        if (subItem.href) router.prefetch(subItem.href);
      });
    });
  }, [items, router]);

  const navigate = (href: string) => {
    router.push(href);
  };

  return (
    <nav className="space-y-1">
      {items.map((item, index) => (
        <Suspense key={index} fallback={null}>
          <NavItemComponent
            item={item}
            isOpen={isOpen}
            pendingHref={null}
            onNavigate={navigate}
          />
        </Suspense>
      ))}
    </nav>
  );
}
