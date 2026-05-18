"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NavItemProps {
  item: NavItem;
  isOpen: boolean;
  onHover?: () => void;
  onLeave?: () => void;
}

/**
 * Returns true if `href` matches the given `pathname` + `search`.
 * - If href has a query string, requires full pathname+query match.
 * - If href has no query string, matches pathname only.
 */
function hrefMatches(
  href: string | undefined,
  pathname: string,
  search: string,
): boolean {
  if (!href || href === "#") return false;
  const qIdx = href.indexOf("?");
  if (qIdx !== -1) {
    // href has query — compare full path+query
    const hrefPath = href.slice(0, qIdx);
    const hrefQuery = href.slice(qIdx + 1);
    return hrefPath === pathname && hrefQuery === search;
  }
  // href has no query — pathname-only match
  return href === pathname;
}

export function NavItemComponent({
  item,
  isOpen,
  onHover,
  onLeave,
}: NavItemProps) {
  const Icon =
    item.icon && Icons[item.icon] ? Icons[item.icon] : Icons.arrowRight;
  const [isExpanded, setIsExpanded] = useState(false);
  // Optimistic href: set immediately on click so active style shows before pathname updates
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();
  // useSearchParams gives us the current query string without the "?"
  const searchParams = useSearchParams();
  const search = searchParams.toString(); // e.g. "tab=preview"
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // While a transition is pending, derive pathname+search from the optimistic pendingHref
  const effectivePathname = useMemo(() => {
    if (isPending && pendingHref) {
      const qIdx = pendingHref.indexOf("?");
      return qIdx !== -1 ? pendingHref.slice(0, qIdx) : pendingHref;
    }
    return pathname;
  }, [isPending, pendingHref, pathname]);

  const effectiveSearch = useMemo(() => {
    if (isPending && pendingHref) {
      const qIdx = pendingHref.indexOf("?");
      return qIdx !== -1 ? pendingHref.slice(qIdx + 1) : "";
    }
    return search;
  }, [isPending, pendingHref, search]);

  const isActive = hrefMatches(item.href, effectivePathname, effectiveSearch);
  const hasActiveChild = useMemo(
    () =>
      item.items?.some((subItem) =>
        hrefMatches(subItem.href, effectivePathname, effectiveSearch),
      ) ?? false,
    [item.items, effectivePathname, effectiveSearch],
  );

  // Expand if parent is active or has active child
  useEffect(() => {
    if (isActive || hasActiveChild) {
      setIsExpanded(true);
    }
  }, [isActive, hasActiveChild]);

  // Clear pending href once the transition completes
  useEffect(() => {
    if (!isPending) {
      setPendingHref(null);
    }
  }, [isPending]);

  // Eagerly prefetch all nav routes on mount — works in both dev and production
  useEffect(() => {
    if (item.href) router.prefetch(item.href);
    item.items?.forEach((subItem) => {
      if (subItem.href) router.prefetch(subItem.href);
    });
  }, [item, router]);

  const navigate = useCallback(
    (href: string) => {
      // Don't re-navigate if already on this exact href
      const qIdx = href.indexOf("?");
      const hrefPath = qIdx !== -1 ? href.slice(0, qIdx) : href;
      const hrefQuery = qIdx !== -1 ? href.slice(qIdx + 1) : "";
      if (hrefPath === effectivePathname && hrefQuery === effectiveSearch) return;
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [effectivePathname, effectiveSearch, router],
  );

  return (
    <div className="space-y-1">
      {item.items ? (
        // Parent items with sub-menu: just toggle expand, no navigation
        <button
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full text-left px-4 py-3 rounded-md transition-colors duration-200",
            isActive || hasActiveChild
              ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
              : "text-muted-foreground hover:bg-accent-blue-light hover:text-accent-blue",
          )}
        >
          <div className="flex items-center">
            <Icon className="size-6 mr-3" />
            {isOpen && <span className="flex-1">{item.title}</span>}
            {isOpen && (
              <Icons.chevronRight
                className={cn(
                  "size-6 transition-transform duration-200",
                  isExpanded ? "rotate-90" : "",
                )}
              />
            )}
          </div>
        </button>
      ) : (
        // Leaf items: navigate with optimistic active state via useTransition
        <button
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          onClick={() => navigate(item.href ?? "#")}
          className={cn(
            "w-full text-left px-4 py-3 rounded-md transition-colors duration-200",
            isActive
              ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
              : "text-muted-foreground hover:bg-accent-blue-light hover:text-accent-blue",
          )}
        >
          <div className="flex items-center">
            <Icon className="size-6 mr-3" />
            {isOpen && <span>{item.title}</span>}
          </div>
        </button>
      )}

      {/* Submenu */}
      <AnimatePresence>
        {item.items && isExpanded && isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="ml-4 space-y-1">
              {item.items.map((subItem, subIndex) => {
                const SubIcon =
                  subItem.icon && Icons[subItem.icon]
                    ? Icons[subItem.icon]
                    : null;
                const isSubActive = hrefMatches(
                  subItem.href,
                  effectivePathname,
                  effectiveSearch,
                );

                return (
                  <button
                    key={subIndex}
                    onClick={() => navigate(subItem.href ?? "#")}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md transition-colors duration-200",
                      isSubActive
                        ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                        : "text-muted-foreground hover:bg-accent-blue-light hover:text-accent-blue",
                    )}
                  >
                    <div className="flex items-center">
                      {SubIcon && <SubIcon className="w-4 h-4 mr-3" />}
                      <span>{subItem.title}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
