"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getRecentPlanIds,
  persistPlanSelection,
  PLAN_SELECTOR_MANDATORY_SEARCH_THRESHOLD,
  PLAN_SELECTOR_SEARCH_THRESHOLD,
  type PlanSelectorModule,
} from "@/lib/plan-selector-storage";

export type StickyPlanOption = { id: string; companyName: string };

export interface StickyPlanComboboxProps {
  module: PlanSelectorModule;
  plans: StickyPlanOption[];
  value: string;
  onChange: (planId: string) => void;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

function matchesQuery(name: string, q: string): boolean {
  if (!q.trim()) return true;
  return name.toLowerCase().includes(q.trim().toLowerCase());
}

export function StickyPlanCombobox({
  module,
  plans,
  value,
  onChange,
  disabled,
  label = "Plan",
  required,
  placeholder = "Select plan",
  className,
  id = "sticky-plan-combobox",
}: StickyPlanComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [highlight, setHighlight] = useState(0);
  const [menuLayout, setMenuLayout] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const showSearch = plans.length >= PLAN_SELECTOR_SEARCH_THRESHOLD;
  const mandatoryFilter =
    plans.length >= PLAN_SELECTOR_MANDATORY_SEARCH_THRESHOLD;

  const recentIds = getRecentPlanIds();
  const planById = useMemo(() => {
    const m = new Map<string, StickyPlanOption>();
    plans.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans]);

  const recentPlans = useMemo(() => {
    const seen = new Set<string>();
    const out: StickyPlanOption[] = [];
    for (const rid of recentIds) {
      const p = planById.get(rid);
      if (p && !seen.has(p.id)) {
        if (matchesQuery(p.companyName, query)) {
          out.push(p);
          seen.add(p.id);
        }
      }
    }
    return out;
  }, [recentIds, planById, query]);

  const otherPlans = useMemo(() => {
    const recentSet = new Set(recentPlans.map((p) => p.id));
    const rest = plans.filter((p) => !recentSet.has(p.id));
    const sorted = [...rest].sort((a, b) =>
      a.companyName.localeCompare(b.companyName, undefined, {
        sensitivity: "base",
      }),
    );
    if (!mandatoryFilter || query.trim()) {
      return sorted.filter((p) => matchesQuery(p.companyName, query));
    }
    return [];
  }, [plans, recentPlans, query, mandatoryFilter]);

  const flatOptions = useMemo(
    () => [...recentPlans, ...otherPlans],
    [recentPlans, otherPlans],
  );

  const updateMenuLayout = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    setMenuLayout({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 200),
      maxHeight: Math.min(288, Math.max(160, spaceBelow)),
    });
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [open, query, flatOptions.length]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuLayout(null);
      return;
    }
    updateMenuLayout();
  }, [open, updateMenuLayout, flatOptions.length, plans.length]);

  useEffect(() => {
    if (!open) return;
    updateMenuLayout();
    const onScrollOrResize = () => updateMenuLayout();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updateMenuLayout]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  const selectPlan = useCallback(
    (planId: string) => {
      persistPlanSelection(module, planId);
      onChange(planId);
      setOpen(false);
      setQuery("");
    },
    [module, onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (flatOptions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % flatOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + flatOptions.length) % flatOptions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = flatOptions[highlight];
      if (opt) selectPlan(opt.id);
    }
  };

  const displayName =
    plans.find((p) => p.id === value)?.companyName || placeholder;

  const dropdown =
    open && menuLayout ? (
      <div
        ref={menuRef}
        role="listbox"
        className="rounded-md border border-input bg-white shadow-lg flex flex-col overflow-hidden"
        style={{
          position: "fixed",
          top: menuLayout.top,
          left: menuLayout.left,
          width: menuLayout.width,
          maxHeight: menuLayout.maxHeight,
          zIndex: 400,
        }}
        onKeyDown={onKeyDown}
      >
        {showSearch && (
          <div className="border-b p-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder={
                  mandatoryFilter
                    ? "Search plans (required for full list)…"
                    : "Search plans…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="h-9 pl-8 bg-background"
                aria-label="Search plans"
              />
            </div>
            {mandatoryFilter && !query.trim() && (
              <p className="mt-1.5 text-xs text-muted-foreground px-1">
                Showing recent plans only. Type to search all {plans.length}{" "}
                plans.
              </p>
            )}
          </div>
        )}

        <div
          className="overflow-y-auto flex-1 min-h-0 py-1"
          style={{ maxHeight: showSearch ? undefined : menuLayout.maxHeight - 8 }}
        >
          {recentPlans.length > 0 && (
            <div className="px-2 pb-1">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1">
                <Clock className="h-3 w-3" />
                Recent
              </div>
              {recentPlans.map((client, idx) => {
                const isHi = highlight === idx;
                return (
                  <button
                    key={`r-${client.id}`}
                    type="button"
                    role="option"
                    aria-selected={value === client.id}
                    className={cn(
                      "w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none",
                      isHi && "bg-muted",
                    )}
                    onClick={() => selectPlan(client.id)}
                    onMouseEnter={() => setHighlight(idx)}
                  >
                    {client.companyName}
                  </button>
                );
              })}
            </div>
          )}

          {otherPlans.length > 0 && (
            <div className="px-2 pt-1 border-t border-border/60">
              {recentPlans.length > 0 && (
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1">
                  All plans
                </div>
              )}
              {otherPlans.map((client, idx) => {
                const globalIdx = recentPlans.length + idx;
                const isHi = highlight === globalIdx;
                return (
                  <button
                    key={client.id}
                    type="button"
                    role="option"
                    aria-selected={value === client.id}
                    className={cn(
                      "w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none",
                      isHi && "bg-muted",
                    )}
                    onClick={() => selectPlan(client.id)}
                    onMouseEnter={() => setHighlight(globalIdx)}
                  >
                    {client.companyName}
                  </button>
                );
              })}
            </div>
          )}

          {flatOptions.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {mandatoryFilter && !query.trim()
                ? "Type above to search plans."
                : "No plans match your search."}
            </div>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className={cn("space-y-2", className)} ref={rootRef}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </Label>
      ) : null}
      <div className="relative">
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="outline"
          disabled={disabled || plans.length === 0}
          className="w-full justify-between h-9 px-3 bg-white dark:bg-gray-800"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="truncate text-left">{displayName}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </div>
      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}
