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

  // Eagerly prefetch all nav routes on mount — works in both dev and production
  useEffect(() => {
    items.forEach((item) => {
      if (item.href) router.prefetch(item.href);
      item.items?.forEach((subItem) => {
        if (subItem.href) router.prefetch(subItem.href);
      });
    });
  }, [items, router]);

  // Navigate immediately — no useTransition so the page changes right away.
  // The loading.tsx skeleton shows instantly while the new page loads.
  const navigate = (href: string) => {
    router.push(href);
  };

  return (
    <nav className="space-y-2">
      {items.map((item, index) => (
        // Suspense required because NavItemComponent uses useSearchParams()
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
