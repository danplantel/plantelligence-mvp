"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Clock } from "lucide-react";
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
  illustration: React.ReactNode;
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

const FlyerIllustration = () => (
  <svg viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
    {/* Flyer document body — landscape orientation */}
    <rect x="6" y="3" width="36" height="24" rx="2.5" fill="currentColor" opacity="0.1" />
    <rect x="6" y="3" width="36" height="24" rx="2.5" stroke="currentColor" strokeWidth="1.2" />
    {/* Flyer header bar */}
    <rect x="10" y="7" width="28" height="4" rx="1.5" fill="currentColor" opacity="0.8" />
    {/* Flyer body text lines */}
    <rect x="10" y="14" width="16" height="2" rx="1" fill="currentColor" opacity="0.4" />
    <rect x="10" y="18" width="12" height="2" rx="1" fill="currentColor" opacity="0.25" />
    {/* Image placeholder on right side of flyer */}
    <rect x="28" y="14" width="10" height="8" rx="1.5" fill="currentColor" opacity="0.08" />
    <rect x="28" y="14" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
    <path d="M30 20l2-2 1.5 1.5L36 16l1.5 1.5v2H30v.5z" fill="currentColor" opacity="0.25" />
    {/* Bottom accent bar */}
    <rect x="10" y="22" width="20" height="1.5" rx="0.75" fill="currentColor" opacity="0.15" />
  </svg>
);

const BannerIllustration = () => (
  <svg viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
    <style>{`
      @keyframes bannerSlideDown {
        0%   { transform: translateY(-100%); }
        22%  { transform: translateY(-100%); }
        28%  { transform: translateY(6%); }
        32%  { transform: translateY(3%); }
        36%  { transform: translateY(0); }
        100% { transform: translateY(0); }
      }
      .banner-group {
        animation: bannerSlideDown 6.5s ease-in-out infinite;
      }
    `}</style>

    {/* Clip path to hide banner when it's above the viewport */}
    <defs>
      <clipPath id="viewportClip">
        <rect x="2" y="1" width="44" height="34" rx="2.5" />
      </clipPath>
    </defs>

    {/* Viewport / Browser screen frame */}
    <rect x="2" y="1" width="44" height="34" rx="2.5" fill="currentColor" opacity="0.04" />
    <rect x="2" y="1" width="44" height="34" rx="2.5" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />

    {/* Browser toolbar */}
    <circle cx="6" cy="3.5" r="0.7" fill="currentColor" opacity="0.25" />
    <circle cx="8.5" cy="3.5" r="0.7" fill="currentColor" opacity="0.25" />
    <circle cx="11" cy="3.5" r="0.7" fill="currentColor" opacity="0.25" />
    <rect x="15" y="2.5" width="18" height="2" rx="1" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.12" />

    {/* Clipped content area */}
    <g clipPath="url(#viewportClip)">
      {/* ── Animated banner — slides into the nav-bar slot ── */}
      <g className="banner-group">
        <rect x="2" y="5" width="44" height="5" rx="0" fill="currentColor" opacity="0.14" />
        <rect x="2" y="5" width="44" height="5" rx="0" stroke="currentColor" strokeWidth="0.8" />
        <rect x="3" y="5.4" width="42" height="1" rx="0.5" fill="currentColor" opacity="0.06" />

        <text x="24" y="8.3" textAnchor="middle" fill="currentColor" fontSize="3" fontWeight="600" fontFamily="system-ui">
          ⚠ Open Enrollment ends soon
        </text>
      </g>

      {/* ── Stationary page content (pushed down to clear the banner) ── */}

      {/* Hero section */}
      <rect x="5" y="12" width="16" height="2.5" rx="1.25" fill="currentColor" opacity="0.2" />
      <rect x="5" y="15.5" width="12" height="1.5" rx="0.75" fill="currentColor" opacity="0.1" />

      {/* Hero image placeholder */}
      <rect x="26" y="11.5" width="17" height="12" rx="1.5" fill="currentColor" opacity="0.035" />
      <rect x="26" y="11.5" width="17" height="12" rx="1.5" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
      <path d="M30 18l2.5-2.5 2 2 4-4.5 3.5 4v1.5H30V18z" fill="currentColor" opacity="0.1" />

      {/* Lower content rows */}
      <rect x="5" y="18.5" width="9" height="1" rx="0.5" fill="currentColor" opacity="0.08" />
      <rect x="5" y="20.5" width="6" height="1" rx="0.5" fill="currentColor" opacity="0.05" />
    </g>
  </svg>
);

const OPTIONS: MarketingOption[] = [
  {
    id: "create-flyer",
    label: "Create a Flyer",
    description: "Design and generate a marketing flyer for this plan.",
    illustration: <FlyerIllustration />,
  },
  {
    id: "top-banner",
    label: "Top Banner Notification",
    description: "Create a banner announcement to display at the top of the Benefits Hub.",
    illustration: <BannerIllustration />,
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
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedClient.companyName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                What would you like to create?
              </p>
            </div>

            {/* Edit Marketing Assets — list item above the cards */}
            <button
              type="button"
              className="group flex w-full items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-blue"
              onClick={() => {
                // TODO: Navigate to edit marketing assets page
                console.log(`[Marketing] Edit Marketing Assets for plan ${selectedPlan}`);
              }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                  {/* Folder */}
                  <path d="M4 30V10a2 2 0 012-2h8l2 3h10a2 2 0 012 2v17a2 2 0 01-2 2H6a2 2 0 01-2-2z" fill="currentColor" opacity="0.15" />
                  <path d="M4 30V10a2 2 0 012-2h8l2 3h10a2 2 0 012 2v17a2 2 0 01-2 2H6a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" />
                  {/* Document inside */}
                  <rect x="11" y="12" width="10" height="12" rx="1" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="0.7" />
                  <rect x="13" y="15" width="6" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
                  <rect x="13" y="18" width="6" height="1.5" rx="0.75" fill="currentColor" opacity="0.25" />
                  {/* Pencil */}
                  <path d="M27 10l-8 8-1 3 3-1 8-8-2-2z" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Edit Marketing Assets
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Review, update, or remove existing marketing materials for this plan.
                </p>
              </div>
              <svg className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {/* Create cards — 2-column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {OPTIONS.map((option, index) => {
                const accentColors = [
                  { bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: "text-emerald-600 dark:text-emerald-400", border: "hover:border-emerald-300 dark:hover:border-emerald-700", ring: "group-hover:bg-emerald-600 group-hover:text-white", illBg: "bg-emerald-50/50 dark:bg-emerald-950/20" },
                  { bg: "bg-violet-50 dark:bg-violet-950/30", icon: "text-violet-600 dark:text-violet-400", border: "hover:border-violet-300 dark:hover:border-violet-700", ring: "group-hover:bg-violet-600 group-hover:text-white", illBg: "bg-violet-50/50 dark:bg-violet-950/20" },
                ];
                const c = accentColors[index];
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`group relative flex flex-col items-center text-center rounded-2xl border-2 border-transparent bg-white dark:bg-gray-900 shadow-sm hover:shadow-xl ${c.border} transition-all duration-300 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-blue overflow-hidden`}
                    onClick={() => {
                      // TODO: Navigate to the respective sub-page or open a drawer/modal
                      console.log(`[Marketing] Selected option: ${option.id} for plan ${selectedPlan}`);
                    }}
                  >
                    {/* Wider illustration area */}
                    <div className={`flex h-28 w-full items-center justify-center ${c.illBg} px-6 py-4`}>
                      <div className={`h-full w-full max-w-[200px] ${c.icon}`}>
                        {option.illustration}
                      </div>
                    </div>
                    {/* Content below illustration */}
                    <div className="flex flex-col items-center px-6 pb-6 pt-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {option.label}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400 max-w-[220px]">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
