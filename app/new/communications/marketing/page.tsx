"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Clock, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import MarketingAssetModal, {
  type AssetType,
} from "@/components/pages/marketing/marketing-asset-modal";
import {
  buildFlyerSvgFromData,
  downloadFlyerPdf,
  svgElementToDataUrl,
  generateFlyerPdfBlob,
} from "@/lib/marketing/flyer-pdf";
import { toR2BrandingKey, getR2ObjectProxyUrl } from "@/lib/branding-image-url";
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

export type MarketingAssetStatus =
  | "Draft"
  | "Ready for Review"
  | "Published"
  | "Scheduled"
  | "Hidden"
  | "Archived";

const ASSET_STATUSES: MarketingAssetStatus[] = [
  "Draft",
  "Ready for Review",
  "Published",
  "Scheduled",
  "Hidden",
  "Archived",
];

const STATUS_COLORS: Record<MarketingAssetStatus, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-300",
  "Ready for Review": "bg-amber-50 text-amber-700 border-amber-300",
  Published: "bg-green-50 text-green-700 border-green-300",
  Scheduled: "bg-blue-50 text-blue-700 border-blue-300",
  Hidden: "bg-yellow-50 text-yellow-700 border-yellow-300",
  Archived: "bg-red-50 text-red-700 border-red-300",
};

interface MarketingOption {
  id: string;
  label: string;
  description: string;
  cta: string;
  illustration: React.ReactNode;
}

interface SavedAsset {
  id: string;
  type: AssetType;
  createdAt: string;
  status: MarketingAssetStatus;
  // Flyer-specific fields (populated when type === "flyer")
  headline?: string;
  body?: string;
  startDate?: string;
  bgColor?: string;
  planName?: string;
  planLogo?: string;
  flyerSubtitle?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
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

  const isCurrentPlan = useCallback(
    (id: string) => value === id,
    [value],
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
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#23919C]/40 hover:text-[#23919C] dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:border-[#23919C]/50",
              )}
            >
              {plan.companyName}
            </button>
          ))}
        </div>
      )}

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

// ── SVG Illustrations ──

const FlyerIllustration = () => (
  <svg viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
    <rect x="4" y="3" width="40" height="32" rx="3" fill="var(--accent-blue-light)" fillOpacity="0.4" />
    <rect x="4" y="3" width="40" height="32" rx="3" stroke="var(--accent-blue)" strokeWidth="1" strokeOpacity="0.3" />
    <rect x="4" y="3" width="40" height="10" rx="3" fill="var(--accent-blue)" fillOpacity="0.12" />
    <text x="24" y="10.5" textAnchor="middle" fill="var(--accent-blue)" fontSize="3" fontWeight="700" fontFamily="system-ui" letterSpacing="0.4">YOUR BENEFITS</text>
    <circle cx="8" cy="16" r="1" fill="var(--accent-blue)" fillOpacity="0.2" />
    <circle cx="11" cy="16" r="1" fill="var(--accent-blue)" fillOpacity="0.2" />
    <circle cx="14" cy="16" r="1" fill="var(--accent-blue)" fillOpacity="0.2" />
    <rect x="7" y="19" width="15" height="2" rx="1" fill="var(--accent-blue)" fillOpacity="0.4" />
    <rect x="7" y="23" width="12" height="2" rx="1" fill="var(--accent-blue)" fillOpacity="0.25" />
    <rect x="7" y="27" width="10" height="1.5" rx="0.75" fill="var(--accent-blue)" fillOpacity="0.15" />
    <rect x="27" y="15" width="14" height="14" rx="2" fill="var(--accent-blue-light)" fillOpacity="0.5" />
    <rect x="27" y="15" width="14" height="14" rx="2" stroke="var(--accent-blue)" strokeWidth="0.6" strokeOpacity="0.2" />
    <rect x="29" y="23" width="2.5" height="4" rx="0.4" fill="var(--accent-blue)" fillOpacity="0.25" />
    <rect x="32.5" y="20" width="2.5" height="7" rx="0.4" fill="var(--accent-blue)" fillOpacity="0.35" />
    <rect x="36" y="17" width="2.5" height="10" rx="0.4" fill="var(--accent-blue)" fillOpacity="0.5" />
    <rect x="7" y="30" width="13" height="3" rx="1.5" fill="var(--accent-blue)" fillOpacity="0.15" />
    <text x="13.5" y="32" textAnchor="middle" fill="var(--accent-blue)" fontSize="1.8" fontWeight="600" fontFamily="system-ui" fillOpacity="0.7">Learn More</text>
  </svg>
);

const PortalNoticeIllustration = () => (
  <svg viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
    <rect x="3" y="2" width="42" height="34" rx="2.5" fill="var(--accent-blue-light)" fillOpacity="0.3" />
    <rect x="3" y="2" width="42" height="34" rx="2.5" stroke="var(--accent-blue)" strokeWidth="0.6" strokeOpacity="0.15" />
    {/* Page header */}
    <rect x="3" y="2" width="42" height="6" rx="2.5" fill="var(--accent-blue)" fillOpacity="0.08" />
    <circle cx="7" cy="5" r="0.6" fill="var(--accent-blue)" fillOpacity="0.3" />
    <rect x="10" y="4" width="14" height="2" rx="1" fill="var(--accent-blue)" fillOpacity="0.15" />
    {/* Notice banner bar */}
    <rect x="3" y="9" width="42" height="6" rx="0" fill="var(--accent-blue)" fillOpacity="0.14" />
    <rect x="3" y="9" width="42" height="6" rx="0" stroke="var(--accent-blue)" strokeWidth="0.6" strokeOpacity="0.3" />
    <text x="24" y="12.5" textAnchor="middle" fill="var(--accent-blue)" fontSize="2.5" fontWeight="600" fontFamily="system-ui">⚡ Open Enrollment Now Open</text>
    {/* Page content */}
    <rect x="7" y="18" width="16" height="2" rx="1" fill="var(--accent-blue)" fillOpacity="0.2" />
    <rect x="7" y="22" width="11" height="1.2" rx="0.6" fill="var(--accent-blue)" fillOpacity="0.1" />
    <rect x="30" y="17" width="14" height="12" rx="1.5" fill="var(--accent-blue-light)" fillOpacity="0.4" />
    <rect x="30" y="17" width="14" height="12" rx="1.5" stroke="var(--accent-blue)" strokeWidth="0.5" strokeOpacity="0.12" />
    <path d="M33 24l2-2 1.5 1.5L40 21l3 3v1H33v-1z" fill="var(--accent-blue)" fillOpacity="0.12" />
    <rect x="7" y="26" width="8" height="1" rx="0.5" fill="var(--accent-blue)" fillOpacity="0.06" />
  </svg>
);

const PopUpMessageIllustration = () => (
  <svg viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
    {/* Page background */}
    <rect x="3" y="2" width="42" height="34" rx="2.5" fill="var(--accent-blue-light)" fillOpacity="0.2" />
    <rect x="3" y="2" width="42" height="34" rx="2.5" stroke="var(--accent-blue)" strokeWidth="0.5" strokeOpacity="0.1" />
    <rect x="7" y="6" width="8" height="1.5" rx="0.75" fill="var(--accent-blue)" fillOpacity="0.1" />
    <rect x="7" y="10" width="14" height="8" rx="1.5" fill="var(--accent-blue)" fillOpacity="0.04" />
    <rect x="7" y="10" width="14" height="8" rx="1.5" stroke="var(--accent-blue)" strokeWidth="0.4" strokeOpacity="0.08" />
    {/* Modal overlay */}
    <rect x="5" y="4" width="38" height="30" rx="3" fill="var(--accent-blue)" fillOpacity="0.06" />
    {/* Modal dialog box */}
    <rect x="9" y="9" width="30" height="20" rx="3" fill="white" stroke="var(--accent-blue)" strokeWidth="0.6" strokeOpacity="0.3" />
    {/* Modal header */}
    <rect x="9" y="9" width="30" height="5" rx="3" fill="var(--accent-blue)" fillOpacity="0.1" />
    <circle cx="35" cy="11.5" r="1" fill="var(--accent-blue)" fillOpacity="0.15" />
    <path d="M34.5 11l1 1M35.5 11l-1 1" stroke="var(--accent-blue)" strokeWidth="0.5" strokeOpacity="0.3" />
    {/* Modal content */}
    <rect x="13" y="17" width="22" height="2" rx="1" fill="var(--accent-blue)" fillOpacity="0.3" />
    <rect x="13" y="21" width="16" height="1.2" rx="0.6" fill="var(--accent-blue)" fillOpacity="0.12" />
    {/* Modal CTA */}
    <rect x="13" y="25" width="9" height="2.5" rx="1.25" fill="var(--accent-blue)" fillOpacity="0.18" />
    <text x="17.5" y="26.8" textAnchor="middle" fill="var(--accent-blue)" fontSize="1.6" fontWeight="600" fontFamily="system-ui" fillOpacity="0.7">OK</text>
  </svg>
);

const NewsPostIllustration = () => (
  <svg viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
    <rect x="3" y="2" width="42" height="34" rx="2.5" fill="var(--accent-blue-light)" fillOpacity="0.3" />
    <rect x="3" y="2" width="42" height="34" rx="2.5" stroke="var(--accent-blue)" strokeWidth="0.6" strokeOpacity="0.15" />
    {/* Feed list */}
    {/* Post 1 */}
    <rect x="5" y="4" width="38" height="9" rx="1.5" fill="var(--accent-blue)" fillOpacity="0.04" />
    <rect x="5" y="4" width="38" height="9" rx="1.5" stroke="var(--accent-blue)" strokeWidth="0.4" strokeOpacity="0.08" />
    <circle cx="9.5" cy="8.5" r="2" fill="var(--accent-blue-light)" fillOpacity="0.6" stroke="var(--accent-blue)" strokeWidth="0.4" strokeOpacity="0.2" />
    <rect x="13" y="6.5" width="12" height="1.5" rx="0.75" fill="var(--accent-blue)" fillOpacity="0.3" />
    <rect x="13" y="9.5" width="8" height="1" rx="0.5" fill="var(--accent-blue)" fillOpacity="0.12" />
    <rect x="34" y="6.5" width="7" height="1.5" rx="0.75" fill="var(--accent-blue)" fillOpacity="0.08" />
    {/* Post 2 */}
    <rect x="5" y="14.5" width="38" height="9" rx="1.5" fill="var(--accent-blue)" fillOpacity="0.06" />
    <rect x="5" y="14.5" width="38" height="9" rx="1.5" stroke="var(--accent-blue)" strokeWidth="0.4" strokeOpacity="0.1" />
    <circle cx="9.5" cy="19" r="2" fill="var(--accent-blue-light)" fillOpacity="0.6" stroke="var(--accent-blue)" strokeWidth="0.4" strokeOpacity="0.2" />
    <rect x="13" y="17" width="18" height="1.5" rx="0.75" fill="var(--accent-blue)" fillOpacity="0.35" />
    <rect x="13" y="20" width="10" height="1" rx="0.5" fill="var(--accent-blue)" fillOpacity="0.12" />
    <rect x="34" y="17" width="7" height="1.5" rx="0.75" fill="var(--accent-blue)" fillOpacity="0.08" />
    {/* Post 3 */}
    <rect x="5" y="25" width="38" height="9" rx="1.5" fill="var(--accent-blue)" fillOpacity="0.04" />
    <rect x="5" y="25" width="38" height="9" rx="1.5" stroke="var(--accent-blue)" strokeWidth="0.4" strokeOpacity="0.08" />
    <circle cx="9.5" cy="29.5" r="2" fill="var(--accent-blue-light)" fillOpacity="0.6" stroke="var(--accent-blue)" strokeWidth="0.4" strokeOpacity="0.2" />
    <rect x="13" y="27.5" width="15" height="1.5" rx="0.75" fill="var(--accent-blue)" fillOpacity="0.25" />
    <rect x="13" y="30.5" width="7" height="1" rx="0.5" fill="var(--accent-blue)" fillOpacity="0.1" />
    <rect x="34" y="27.5" width="7" height="1.5" rx="0.75" fill="var(--accent-blue)" fillOpacity="0.08" />
  </svg>
);

const OPTIONS: MarketingOption[] = [
  {
    id: "flyer",
    label: "Flyer",
    description: "Create a print or digital flyer.",
    cta: "Create Flyer",
    illustration: <FlyerIllustration />,
  },
  {
    id: "portal-notice",
    label: "Portal Notice",
    description: "Add a short announcement bar to the Benefits Hub.",
    cta: "Create Notice",
    illustration: <PortalNoticeIllustration />,
  },
  {
    id: "pop-up",
    label: "Pop-Up Message",
    description: "Show a message when participants visit the Benefits Hub.",
    cta: "Create Pop-Up",
    illustration: <PopUpMessageIllustration />,
  },
  {
    id: "news-post",
    label: "News & Events Post",
    description: "Publish an update, announcement, recap, or reminder.",
    cta: "Create Post",
    illustration: <NewsPostIllustration />,
  },
];

export default function MarketingPage() {
  const { setTitle } = usePageTitleContext();
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeAssetType, setActiveAssetType] = useState<AssetType>("flyer");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MarketingAssetStatus | "All">("All");

  // ── Fetch assets from API ──
  const { data: assetsData, isLoading: isLoadingAssets, mutate: mutateAssets } = useSWR(
    selectedPlan ? `/api/marketing/assets?clientId=${selectedPlan}` : null,
    jsonFetcher,
    { dedupingInterval: 10_000, revalidateOnFocus: true },
  );
  const savedAssets: SavedAsset[] = useMemo(() => assetsData?.data ?? [], [assetsData]);
  const filteredAssets = useMemo(
    () => savedAssets.filter((a) => statusFilter === "All" || a.status === statusFilter),
    [savedAssets, statusFilter],
  );
  const hasAssets = savedAssets.length > 0;

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
              </>
            )}
          </CardContent>
        </Card>

        {selectedPlan && selectedClient && (
        <div className="space-y-4">
          <Accordion type="multiple" defaultValue={["create"]} className="space-y-4">
            {/* ── Create Marketing Asset Accordion ── */}
            <AccordionItem value="create" className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-700 shadow-sm">
              <AccordionTrigger className="px-5 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Marketing Asset
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                {/* Empty state when no assets */}
                {savedAssets.length === 0 && (
                  <div className="flex flex-col items-center justify-center pb-4 pt-2 px-4 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-blue-light)]/40 dark:bg-[var(--accent-blue-light)]/20">
                      <svg className="h-6 w-6 text-[var(--accent-blue)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="12" x2="12" y2="18" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-3">
                      No Communications Added Yet
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                      Create your first flyer, notice, pop-up, or news update for this Benefits Hub.
                    </p>
                  </div>
                )}
                {/* Creation cards — 4-column grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="group relative flex flex-col items-center text-center rounded-2xl border-2 border-transparent bg-white dark:bg-gray-900 shadow-sm hover:shadow-xl hover:border-[var(--accent-blue)]/40 transition-all duration-300 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-blue)] overflow-hidden"
                      onClick={() => {
                        setActiveAssetType(option.id as AssetType);
                        setModalOpen(true);
                      }}
                    >
                      <div className="flex h-32 w-full items-center justify-center bg-[var(--accent-blue-light)]/30 dark:bg-[var(--accent-blue-light)]/20 px-6">
                        <div className="flex items-center justify-center h-full w-full max-w-[180px] text-[var(--accent-blue)]">
                          {option.illustration}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col items-center px-4 pt-3.5 pb-5">
                        <div className="flex flex-col items-center justify-start flex-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {option.label}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400 max-w-[180px]">
                            {option.description}
                          </p>
                        </div>
                        <span className="mt-auto inline-flex items-center rounded-lg bg-[var(--accent-blue)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent-blue)] group-hover:bg-[var(--accent-blue)] group-hover:text-white transition-colors duration-200">
                          {option.cta}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ── Edit Marketing Assets Accordion ── */}
            <AccordionItem value="edit" className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-700 shadow-sm">
              <AccordionTrigger className="px-5 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Edit Marketing Assets
                  <span className="text-xs text-muted-foreground font-normal">({savedAssets.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                {isLoadingAssets ? (
                  /* Loading skeleton */
                  <div className="divide-y dark:divide-gray-700">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                    ))}
                  </div>
                ) : hasAssets ? (
                  <>
                    {savedAssets.length > 0 && (
                      <div className="flex items-center gap-1.5 px-5 py-2.5 border-b bg-white dark:bg-gray-900 overflow-x-auto">
                        {(["All", ...ASSET_STATUSES] as const).map((s) => {
                          const count = s === "All" ? savedAssets.length : savedAssets.filter((a) => a.status === s).length;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setStatusFilter(s)}
                              className={cn(
                                "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                statusFilter === s
                                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
                              )}
                            >
                              {s === "All" ? "All" : s} <span className="opacity-60">({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="divide-y dark:divide-gray-700">
                      {filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
                          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8" />
                              <path d="m21 21-4.35-4.35" />
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {statusFilter === "All"
                              ? "No marketing assets created yet"
                              : `No assets with "${statusFilter}" status`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {statusFilter === "All"
                              ? "Create your first flyer, notice, pop-up, or news post above."
                              : "Try selecting a different status filter or create a new asset."}
                          </p>
                        </div>
                      ) : (
                        filteredAssets.map((asset) => (
                          <div key={asset.id} className="flex items-center gap-3 px-5 py-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-blue)]/10 text-sm">
                              {asset.type === "flyer" ? "📄" : asset.type === "portal-notice" ? "📢" : asset.type === "pop-up" ? "💬" : "📰"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{asset.headline}</p>
                              <p className="text-xs text-muted-foreground">
                                {asset.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} · {asset.createdAt}
                              </p>
                            </div>

                            {asset.type === "flyer" && (
                              <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline shrink-0 disabled:opacity-50"
                                disabled={downloadingId === asset.id}
                                onClick={async () => {
                                  setDownloadingId(asset.id);
                                  try {
                                    const logoUrl = asset.planLogo ? getR2ObjectProxyUrl(toR2BrandingKey(asset.planLogo) ?? "") || asset.planLogo : null;
                                    const svgEl = buildFlyerSvgFromData(
                                      { headline: asset.headline ?? "", body: asset.body ?? "", startDate: asset.startDate ?? "", bgColor: asset.bgColor ?? "#23919c", planName: asset.planName ?? "", planLogo: asset.planLogo, flyerSubtitle: asset.flyerSubtitle, flyerImage: asset.flyerImage, flyerQrUrl: asset.flyerQrUrl, meetingTime: asset.meetingTime, meetingLocation: asset.meetingLocation },
                                      logoUrl,
                                    );
                                    const dataUrl = await svgElementToDataUrl(svgEl);
                                    const blob = await generateFlyerPdfBlob(dataUrl);
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    const safeName = (asset.planName ?? "flyer").replace(/[^a-zA-Z0-9_-]/g, "_");
                                    a.download = `${safeName}_flyer.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  } catch (err) { console.error("Failed to download flyer PDF:", err); } finally { setDownloadingId(null); }
                                }}
                              >
                                {downloadingId === asset.id ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                )}
                                Download
                              </button>
                            )}
                            <button type="button" className="text-xs font-medium text-[var(--accent-blue)] hover:underline shrink-0" onClick={() => { setActiveAssetType(asset.type); setModalOpen(true); }}>Edit</button>

                            {deletingId === asset.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">Are you sure?</span>
                                <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline shrink-0 disabled:opacity-50" disabled={isDeletingLoading}
                                  onClick={async () => {
                                    setIsDeletingLoading(true);
                                    try { await fetch(`/api/marketing/assets/${asset.id}`, { method: "DELETE" }); mutateAssets(); } catch (err) { console.error("Failed to delete:", err); }
                                    setDeletingId(null); setIsDeletingLoading(false);
                                  }}
                                >
                                  {isDeletingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Yes
                                </button>
                                <button type="button" className="text-xs font-medium text-gray-500 hover:underline shrink-0" onClick={() => setDeletingId(null)}>No</button>
                              </div>
                            ) : (
                              <button type="button" className="text-xs font-medium text-red-500 hover:underline shrink-0" onClick={() => setDeletingId(asset.id)}>Delete</button>
                            )}

                            <div className="relative shrink-0 ml-2">
                              <select value={asset.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value as MarketingAssetStatus;
                                  try { await fetch(`/api/marketing/assets/${asset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) }); mutateAssets(); } catch (err) { console.error("Failed to update status:", err); }
                                }}
                                className={cn("appearance-none rounded-full border px-2.5 py-0.5 pr-6 text-[11px] font-semibold cursor-pointer transition-colors", STATUS_COLORS[asset.status])}
                              >
                                {ASSET_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                              </select>
                              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-current opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                      <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No marketing assets yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Create your first asset above.</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          </div>
        )}

        {/* ── Marketing Asset Creation Modal ── */}
        {selectedClient && (
          <MarketingAssetModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            assetType={activeAssetType}
            planName={selectedClient.companyName}
            planId={selectedPlan}
            onSave={() => {
              mutateAssets();
            }}
          />
        )}
      </div>
    </div>
  );
}
