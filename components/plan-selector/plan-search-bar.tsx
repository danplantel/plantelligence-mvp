"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getRecentPlanIds,
  persistPlanSelection,
  type PlanSelectorModule,
} from "@/lib/plan-selector-storage";
import { getBenefitsHubOpenPortalUrl } from "@/lib/marketing/hub-url";
import { isActiveClientStatus } from "@/lib/active-client-status";

/** Minimal plan shape the selector needs. */
export interface PlanSearchBarPlan {
  id: string;
  companyName: string;
  slug?: string | null;
  status?: string | null;
}

interface PlanSearchBarProps {
  plans: PlanSearchBarPlan[];
  /** Currently selected plan id ("" when none). */
  value: string;
  onChange: (planId: string) => void;
  /** Heading shown above the search field. */
  title: string;
  disabled?: boolean;
  /** Sticky-selection scope the choice is remembered under. */
  module?: PlanSelectorModule;
}

/**
 * Searchable plan picker that starts the Communications flows (Meetings,
 * Webinars) and the other plan-scoped pages (Documents, Marketing, Edit Client).
 *
 * Extracted from the Meetings page so the surfaces cannot drift: the same
 * heading, recent-plan chips, keyboard navigation and dropdown are shared, and
 * only the heading differs per page.
 *
 * Only Active plans are offered: Draft and Archived plans are filtered out
 * before the list, the recent chips and the Open Portal link are built, so a
 * plan that is not live can never be selected here. Selection is persisted
 * under the caller's `module` scope (Communications by default), so picking a
 * plan on one Communications page is restored on the other.
 */
export function PlanSearchBar({
  plans,
  value,
  onChange,
  title,
  disabled,
  module = "communications",
}: PlanSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recentIds = getRecentPlanIds();
  // Active plans only — everything below (dropdown, recents, selection) reads
  // from this list, never from the raw `plans` prop.
  const activePlans = useMemo(
    () => plans.filter((p) => isActiveClientStatus(p.status)),
    [plans],
  );
  const planMap = useMemo(() => {
    const m = new Map<string, PlanSearchBarPlan>();
    activePlans.forEach((p) => m.set(p.id, p));
    return m;
  }, [activePlans]);
  const recentPlanObjects = useMemo(() => {
    const result: PlanSearchBarPlan[] = [];
    const seen = new Set<string>();
    for (const id of recentIds) {
      const p = planMap.get(id);
      if (p && !seen.has(id)) {
        result.push(p);
        seen.add(id);
      }
    }
    return result;
  }, [recentIds, planMap]);
  const allPlansSorted = useMemo(() => {
    const recentSet = new Set(recentPlanObjects.map((p) => p.id));
    const recents: PlanSearchBarPlan[] = [];
    const others: PlanSearchBarPlan[] = [];
    for (const p of activePlans) {
      if (recentSet.has(p.id)) recents.push(p);
      else others.push(p);
    }
    others.sort((a, b) =>
      a.companyName.localeCompare(b.companyName, undefined, {
        sensitivity: "base",
      }),
    );
    return [...recents, ...others];
  }, [activePlans, recentPlanObjects]);
  const dropdownItems = useMemo(() => {
    if (!query.trim()) return allPlansSorted;
    const q = query.toLowerCase();
    return allPlansSorted.filter((p) =>
      p.companyName.toLowerCase().includes(q),
    );
  }, [query, allPlansSorted]);
  const selectedPlan = useMemo(
    () => activePlans.find((p) => p.id === value),
    [activePlans, value],
  );
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  useEffect(() => {
    setHighlight(0);
  }, [dropdownItems.length, open]);
  const isCurrentPlan = (id: string) => value === id;
  const selectPlan = (planId: string) => {
    persistPlanSelection(module, planId);
    onChange(planId);
    setOpen(false);
    setQuery("");
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (dropdownItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % dropdownItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(
        (h) => (h - 1 + dropdownItems.length) % dropdownItems.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = dropdownItems[highlight];
      if (item) selectPlan(item.id);
    }
  };
  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-2xl font-bold shrink-0">{title}</CardTitle>
        </div>
        {value && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const slug = (selectedPlan as { slug?: string | null })?.slug;
              const resolvedSlug = slug || value;
              const url = getBenefitsHubOpenPortalUrl(resolvedSlug);
              window.open(url, "_blank");
            }}
            className="gap-1.5 shrink-0 bg-accent-blue text-white hover:bg-accent-blue/90"
          >
            <ExternalLink className="h-4 w-4" />
            Open Portal
          </Button>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search for a plan"
          value={query}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="h-9 pl-9 pr-3 bg-white dark:bg-gray-800"
          aria-label="Search plans"
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
        />
      </div>

      {/* Recent Plans chips (same style as benefits page) */}
      {recentPlanObjects.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Clock className="size-3 text-gray-400 shrink-0" />
          {recentPlanObjects.slice(0, 5).map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => selectPlan(plan.id)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                isCurrentPlan(plan.id)
                  ? "bg-[#23919C]/10 text-[#23919C] border-[#23919C]/30"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#23919C]/40 hover:text-[#23919C] dark:bg-gray-700 text-muted-foreground dark:border-gray-600 dark:hover:border-[#23919C]/50",
              )}
            >
              {plan.companyName}
            </button>
          ))}
        </div>
      )}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              role="listbox"
              className="rounded-md border border-input bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-50"
              style={{
                position: "fixed",
                top: (containerRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                left: containerRef.current?.getBoundingClientRect().left ?? 0,
                width: containerRef.current?.getBoundingClientRect().width ?? 300,
                maxHeight: 288,
              }}
            >
              {query.trim() && (
                <div className="px-3 py-1.5 border-b border-border/60">
                  <p className="text-xs text-muted-foreground">
                    {dropdownItems.length} plan
                    {dropdownItems.length !== 1 ? "s" : ""} found
                  </p>
                </div>
              )}
              <div className="overflow-y-auto max-h-[256px] py-1">
                {dropdownItems.length > 0 && (
                  <>
                    {recentPlanObjects.length > 0 && (
                      <div className="px-2 pb-1">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5">
                          <Clock className="h-3 w-3" />
                          Recent
                        </div>
                        {recentPlanObjects.map((plan, idx) => {
                          const isHi = highlight === idx;
                          return (
                            <button
                              key={`r-${plan.id}`}
                              type="button"
                              role="option"
                              aria-selected={value === plan.id}
                              className={cn(
                                "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                                isHi &&
                                  "bg-accent-blue/10 text-accent-blue font-medium",
                                !isHi && "hover:bg-muted",
                              )}
                              onClick={() => selectPlan(plan.id)}
                              onMouseEnter={() => setHighlight(idx)}
                            >
                              {plan.companyName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {dropdownItems.length > recentPlanObjects.length && (
                      <div
                        className={cn(
                          "px-2",
                          recentPlanObjects.length > 0 &&
                            "pt-1 border-t border-border/60",
                        )}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5">
                          {query.trim() ? "Matching plans" : "All plans"}
                        </div>
                        {dropdownItems
                          .slice(recentPlanObjects.length)
                          .map((plan, idx) => {
                            const globalIdx =
                              recentPlanObjects.length + idx;
                            const isHi = highlight === globalIdx;
                            return (
                              <button
                                key={plan.id}
                                type="button"
                                role="option"
                                aria-selected={value === plan.id}
                                className={cn(
                                  "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                                  isHi &&
                                    "bg-accent-blue/10 text-accent-blue font-medium",
                                  !isHi && "hover:bg-muted",
                                )}
                                onClick={() => selectPlan(plan.id)}
                                onMouseEnter={() => setHighlight(globalIdx)}
                              >
                                {plan.companyName}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
                {dropdownItems.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {query.trim()
                      ? "No plans match your search."
                      : "No plans available."}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
