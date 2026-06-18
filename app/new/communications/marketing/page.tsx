"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Clock, FileText, Bell, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getLastPlanId,
  getRecentPlanIds,
  persistPlanSelection,
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";

interface Client {
  id: string;
  companyName: string;
  status?: string;
}

interface MarketingOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

function PlanSearchBar({
  plans,
  value,
  onChange,
  disabled,
}: {
  plans: Client[];
  value: string;
  onChange: (planId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recentIds = getRecentPlanIds();
  const planMap = useMemo(() => {
    const m = new Map<string, Client>();
    plans.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans]);

  const recentPlanObjects = useMemo(() => {
    const result: Client[] = [];
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
    const recents: Client[] = [];
    const others: Client[] = [];
    for (const p of plans) {
      if (recentSet.has(p.id)) recents.push(p);
      else others.push(p);
    }
    others.sort((a, b) =>
      a.companyName.localeCompare(b.companyName, undefined, {
        sensitivity: "base",
      })
    );
    return [...recents, ...others];
  }, [plans, recentPlanObjects]);

  const dropdownItems = useMemo(() => {
    if (!query.trim()) return allPlansSorted;
    const q = query.toLowerCase();
    return allPlansSorted.filter((p) =>
      p.companyName.toLowerCase().includes(q)
    );
  }, [query, allPlansSorted]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === value),
    [plans, value]
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

  const selectPlan = (planId: string) => {
    persistPlanSelection("marketing", planId);
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
        (h) => (h - 1 + dropdownItems.length) % dropdownItems.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = dropdownItems[highlight];
      if (item) selectPlan(item.id);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <CardTitle className="text-2xl font-bold pb-2">Marketing</CardTitle>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Select a plan
        <span className="text-red-500"> *</span>
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={selectedPlan ? selectedPlan.companyName : "Search plans\u2026"}
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
                    {dropdownItems.length} plan{dropdownItems.length !== 1 ? "s" : ""} found
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
                                isHi && "bg-accent-blue/10 text-accent-blue font-medium",
                                !isHi && "hover:bg-muted"
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
                          recentPlanObjects.length > 0 && "pt-1 border-t border-border/60"
                        )}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5">
                          {query.trim() ? "Matching plans" : "All plans"}
                        </div>
                        {dropdownItems
                          .slice(recentPlanObjects.length)
                          .map((plan, idx) => {
                            const globalIdx = recentPlanObjects.length + idx;
                            const isHi = highlight === globalIdx;
                            return (
                              <button
                                key={plan.id}
                                type="button"
                                role="option"
                                aria-selected={value === plan.id}
                                className={cn(
                                  "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                                  isHi && "bg-accent-blue/10 text-accent-blue font-medium",
                                  !isHi && "hover:bg-muted"
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
            document.body
          )
        : null}
    </div>
  );
}

function RecentPlanLabels({
  plans,
  onSelect,
}: {
  plans: Client[];
  onSelect: (planId: string) => void;
}) {
  const recentIds = getRecentPlanIds();
  const recentPlanObjects = useMemo(() => {
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const result: Client[] = [];
    const seen = new Set<string>();
    for (const id of recentIds) {
      const p = planMap.get(id);
      if (p && !seen.has(id)) {
        result.push(p);
        seen.add(id);
      }
    }
    return result;
  }, [recentIds, plans]);

  if (recentPlanObjects.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
      {recentPlanObjects.slice(0, 5).map((plan) => (
        <button
          key={plan.id}
          type="button"
          onClick={() => {
            persistPlanSelection("marketing", plan.id);
            onSelect(plan.id);
          }}
          className="inline-flex items-center rounded-md border border-accent-blue/30 bg-accent-blue/5 px-2 py-0.5 text-xs font-medium text-accent-blue hover:bg-accent-blue/10 hover:border-accent-blue/50 transition-colors"
        >
          {plan.companyName}
        </button>
      ))}
    </div>
  );
}

const OPTIONS: MarketingOption[] = [
  {
    id: "create-flyer",
    label: "Create a Flyer",
    description: "Design and generate a marketing flyer for this plan.",
    icon: <FileText className="h-8 w-8" />,
  },
  {
    id: "top-banner",
    label: "Top Banner Notification",
    description: "Create a banner announcement to display at the top of the Benefits Hub.",
    icon: <Bell className="h-8 w-8" />,
  },
  {
    id: "edit-assets",
    label: "Edit Marketing Assets",
    description: "Review, update, or remove existing marketing materials for this plan.",
    icon: <Pencil className="h-8 w-8" />,
  },
];

export default function MarketingPage() {
  const { setTitle } = usePageTitleContext();
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  const { data: clientsData, isLoading: isLoadingClients } = useSWR(
    "/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc",
    jsonFetcher,
    {
      keepPreviousData: true,
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
    }
  );

  const clients: Client[] = useMemo(
    () =>
      ((clientsData?.data as Client[]) ?? []).filter(
        (c) => (c.status ?? "Active") !== "Archived"
      ),
    [clientsData]
  );

  useEffect(() => {
    setTitle("Marketing");
  }, [setTitle]);

  const stickyInit = useRef(false);
  useEffect(() => {
    if (clients.length === 0 || stickyInit.current) return;
    if (!getLastPlanId("marketing")) return;
    const resolved = resolveStickyPlanId(clients, "marketing", null);
    if (!resolved) return;
    stickyInit.current = true;
    setSelectedPlan(resolved);
  }, [clients]);

  const handlePlanChange = (clientId: string) => {
    setSelectedPlan(clientId);
  };

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedPlan),
    [clients, selectedPlan]
  );

  return (
    <div className="p-6 bg-background">
      <div className="w-full space-y-6 max-w-4xl mx-auto">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            {isLoadingClients ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="relative">
                  <Skeleton className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
            ) : (
              <>
                <PlanSearchBar
                  plans={clients}
                  value={selectedPlan}
                  onChange={handlePlanChange}
                  disabled={clients.length === 0}
                />
                {!selectedPlan && clients.length > 0 && (
                  <RecentPlanLabels plans={clients} onSelect={handlePlanChange} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {selectedPlan && selectedClient && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {selectedClient.companyName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a marketing action below to get started.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {OPTIONS.map((option) => (
                <Card
                  key={option.id}
                  className="group cursor-pointer hover:shadow-md hover:border-accent-blue/40 transition-all duration-200"
                  onClick={() => {
                    // TODO: Navigate to the respective sub-page or open a drawer/modal
                    console.log(`[Marketing] Selected option: ${option.id} for plan ${selectedPlan}`);
                  }}
                >
                  <CardContent className="p-6 flex flex-col items-start gap-4">
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue group-hover:bg-accent-blue group-hover:text-white transition-colors duration-200">
                        {option.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-foreground">
                            {option.label}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {option.description}
                    </p>
                  </CardContent>
                </Card>
              ))}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
