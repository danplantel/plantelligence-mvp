"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NavItemProps {
  item: NavItem;
  isOpen: boolean;
  onHover?: () => void;
  onLeave?: () => void;
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
  const path = usePathname();

  // Check if any child item is active
  const hasActiveChild = item.items?.some((subItem) => subItem.href === path);
  const isActive = item.href === path;

  // Expand if parent is active or has active child
  useEffect(() => {
    if (isActive || hasActiveChild) {
      setIsExpanded(true);
    }
  }, [isActive, hasActiveChild]);

  return (
    <div className="space-y-1">
      {item.items ? (
        <button
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full text-left px-4 py-3 rounded-md transition-colors duration-200",
            "hover:bg-accent-blue hover:text-white",
            isActive || hasActiveChild
              ? "bg-accent-blue text-white"
              : "text-muted-foreground",
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
        <Link
          href={item.href ?? "#"}
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          className={cn(
            "block px-4 py-3 rounded-md transition-colors duration-200",
            "hover:bg-accent-blue hover:text-white",
            isActive ? "bg-accent-blue text-white" : "text-muted-foreground",
          )}
        >
          <div className="flex items-center">
            <Icon className="size-6 mr-3" />
            {isOpen && <span>{item.title}</span>}
          </div>
        </Link>
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
                const isSubActive = subItem.href === path;

                return (
                  <Link
                    key={subIndex}
                    href={subItem.href ?? "#"}
                    className={cn(
                      "block px-3 py-2 rounded-md transition-colors duration-200",
                      "hover:bg-accent-blue hover:text-white",
                      isSubActive
                        ? "bg-accent-blue text-white"
                        : "text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center">
                      {SubIcon && <SubIcon className="w-4 h-4 mr-3" />}
                      <span>{subItem.title}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
