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
  // Controls the collapsed-sidebar popup so it can be closed after navigating
  // to one of the child routes.
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
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

  // Expand on initial mount if the parent or a child is the active route (e.g.
  // deep links). We intentionally don't re-run on navigation so that clicking a
  // child route collapses the expanded submenu.
  useEffect(() => {
    if (isActive || hasActiveChild) {
      setIsExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            // Rows scale down with the viewport (the rail is 13rem below `xl`, 16rem
            // at `xl` and up — see the sidebar), so the padding and the icon step down
            // with it. The label keeps `text-sm` (it is the primary nav) and gains
            // `truncate` so a long title ellipsises instead of wrapping in a narrower rail.
            className={cn(
              "w-full text-left py-2 rounded-md transition-colors duration-200 xl:py-3",
              "px-2 xl:px-4",
              isActive
                ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                : hasActiveChild
                  ? "bg-accent-blue-light text-accent-blue dark:text-white hover:bg-accent-blue-light hover:text-accent-blue"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <div className="flex items-center">
              <Icon className="mr-2 size-5 shrink-0 xl:mr-3 xl:size-6" />
              <span className="flex-1 truncate text-sm">{item.title}</span>
              <Icons.chevronRight
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200 xl:size-6",
                  isExpanded ? "rotate-90" : "",
                )}
              />
            </div>
          </button>
        ) : (
          // Collapsed sidebar: popover with sub-items on click
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                onMouseEnter={onHover}
                onMouseLeave={onLeave}
                className={cn(
                  "w-full py-2 rounded-md transition-colors duration-200 flex justify-center xl:py-3",
                  isActive
                    ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                    : hasActiveChild
                      ? "bg-accent-blue-light text-accent-blue hover:bg-accent-blue-light hover:text-accent-blue"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5 xl:size-6" />
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
                      data-nav-href={subItem.href}
                      onClick={() => {
                        handleNavigate(subItem.href ?? "#");
                        // Close the popup once the user navigates to a child route
                        setIsPopoverOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md transition-colors duration-200 flex items-center gap-3",
                        isSubActive
                          ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
          data-nav-href={item.href}
          onClick={() => handleNavigate(item.href ?? "#")}
          className={cn(
            "w-full text-left py-2 rounded-md transition-colors duration-200 xl:py-3",
            isOpen ? "px-2 xl:px-4" : "px-0 flex justify-center",
            isActive
              ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <div className={cn("flex items-center", !isOpen && "justify-center")}>
            <Icon
              className={cn("size-5 shrink-0 xl:size-6", isOpen && "mr-2 xl:mr-3")}
            />
            {isOpen && <span className="truncate text-sm">{item.title}</span>}
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
            <div className="ml-3 space-y-1 xl:ml-4">
              {item.items.map((subItem, subIndex) => {
                const SubIcon =
                  subItem.icon && Icons[subItem.icon]
                    ? Icons[subItem.icon]
                    : null;
                const isSubActive = hrefMatches(subItem.href, pathname, search);

                return (
                  <button
                    key={subIndex}
                    data-nav-href={subItem.href}
                    onClick={() => {
                      handleNavigate(subItem.href ?? "#");
                      // Collapse the expanded submenu once the user navigates to a
                      // child route.
                      setIsExpanded(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded-md transition-colors duration-200 xl:px-3 xl:py-2",
                      isSubActive
                        ? "bg-accent-blue text-white hover:bg-accent-blue hover:text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center">
                      {SubIcon && (
                        <SubIcon className="mr-2 size-3.5 shrink-0 xl:mr-3 xl:size-4" />
                      )}
                      <span className="truncate text-sm">{subItem.title}</span>
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
