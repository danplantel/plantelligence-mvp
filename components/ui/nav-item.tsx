"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NavItemProps {
  item: NavItem;
  isOpen: boolean;
  /** Reserved for future use — always null now that navigation is immediate */
  pendingHref: string | null;
  /** Shared navigate function from DashboardNav */
  onNavigate: (href: string) => void;
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
    const hrefPath = href.slice(0, qIdx);
    const hrefQuery = href.slice(qIdx + 1);
    return hrefPath === pathname && hrefQuery === search;
  }
  return href === pathname;
}

export function NavItemComponent({
  item,
  isOpen,
  onNavigate,
  onHover,
  onLeave,
}: NavItemProps) {
  const Icon =
    item.icon && Icons[item.icon] ? Icons[item.icon] : Icons.arrowRight;
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const isActive = hrefMatches(item.href, pathname, search);
  const hasActiveChild = useMemo(
    () =>
      item.items?.some((subItem) =>
        hrefMatches(subItem.href, pathname, search),
      ) ?? false,
    [item.items, pathname, search],
  );

  // Expand if parent is active or has active child
  useEffect(() => {
    if (isActive || hasActiveChild) {
      setIsExpanded(true);
    }
  }, [isActive, hasActiveChild]);

  const handleNavigate = (href: string) => {
    if (href === "#") return;
    onNavigate(href);
  };

  return (
    <div className="space-y-1">
      {item.items ? (
        // Parent items with sub-menu: just toggle expand, no navigation
        isOpen ? (
          // Expanded sidebar: normal toggle behavior
          <button
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-full text-left py-3 rounded-md transition-colors duration-200",
              "px-4",
              isActive || hasActiveChild
                ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                : "text-muted-foreground hover:bg-accent-blue-light hover:text-accent-blue",
            )}
          >
            <div className="flex items-center">
              <Icon className="size-6 mr-3" />
              <span className="flex-1 text-sm">{item.title}</span>
              <Icons.chevronRight
                className={cn(
                  "size-6 transition-transform duration-200",
                  isExpanded ? "rotate-90" : "",
                )}
              />
            </div>
          </button>
        ) : (
          // Collapsed sidebar: popover with sub-items on click
          <Popover>
            <PopoverTrigger asChild>
              <button
                onMouseEnter={onHover}
                onMouseLeave={onLeave}
                className={cn(
                  "w-full py-3 rounded-md transition-colors duration-200 flex justify-center",
                  isActive || hasActiveChild
                    ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                    : "text-muted-foreground hover:bg-accent-blue-light hover:text-accent-blue",
                )}
              >
                <Icon className="size-6" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="start"
              sideOffset={12}
              className="w-48 p-2"
            >
              <div className="space-y-1">
                {item.items.map((subItem, subIndex) => {
                  const SubIcon =
                    subItem.icon && Icons[subItem.icon]
                      ? Icons[subItem.icon]
                      : null;
                  const isSubActive = hrefMatches(subItem.href, pathname, search);

                  return (
                    <button
                      key={subIndex}
                      onClick={() => handleNavigate(subItem.href ?? "#")}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md transition-colors duration-200 flex items-center gap-3",
                        isSubActive
                          ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                          : "text-muted-foreground hover:bg-accent-blue-light hover:text-accent-blue",
                      )}
                    >
                      {SubIcon && <SubIcon className="w-4 h-4" />}
                      <span className="text-sm">{subItem.title}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )
      ) : (
        // Leaf items: navigate immediately via onNavigate
        <button
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          onClick={() => handleNavigate(item.href ?? "#")}
          className={cn(
            "w-full text-left py-3 rounded-md transition-colors duration-200",
            isOpen ? "px-4" : "px-0 flex justify-center",
            isActive
              ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
              : "text-muted-foreground hover:bg-accent-blue-light hover:text-accent-blue",
          )}
        >
          <div className={cn("flex items-center", !isOpen && "justify-center")}>
            <Icon className={cn("size-6", isOpen && "mr-3")} />
            {isOpen && <span className="text-sm">{item.title}</span>}
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
                const isSubActive = hrefMatches(subItem.href, pathname, search);

                return (
                  <button
                    key={subIndex}
                    onClick={() => handleNavigate(subItem.href ?? "#")}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md transition-colors duration-200",
                      isSubActive
                        ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                        : "text-muted-foreground hover:bg-accent-blue-light hover:text-accent-blue",
                    )}
                  >
                    <div className="flex items-center">
                      {SubIcon && <SubIcon className="w-4 h-4 mr-3" />}
                      <span className="text-sm">{subItem.title}</span>
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
