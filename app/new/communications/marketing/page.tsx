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
import { Button } from "@/components/ui/button";
import { Search, Clock, Loader2, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import MarketingAssetModal, {
  type AssetType,
  type PortalNoticeElement,
} from "@/components/pages/marketing/marketing-asset-modal";
import {
  renderFlyerPreviewToSvg,
  svgElementToDataUrl,
  generateFlyerPdfBlob,
  resolveQrImageDataUrl,
} from "@/lib/marketing/flyer-pdf";
import type { FlyerPreviewProps } from "@/components/pages/marketing/flyer-templates";
import {
  getLastPlanId,
  getRecentPlanIds,
  persistPlanSelection,
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";
import {
  getBenefitsHubAbsoluteUrl,
  getBenefitsHubPath,
} from "@/lib/marketing/hub-url";

interface Client {
  id: string;
  companyName: string;
  slug?: string;
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
  /** Pre-generated QR code data URL (from QR.io or local) */
  flyerQrDataUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
  /** Nested JSON blob with type-specific payload (flyer fields live here) */
  data?: Record<string, unknown>;
}

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

/** Human-friendly topic labels for the built-in topical flyer templates. */
const TOPICAL_TEMPLATE_TOPICS: Record<string, string> = {
  TopicalTemplate1: "Retirement Savings From Former Employer",
  TopicalTemplate2: "Beneficiary Designation",
  TopicalTemplate3: "Start Your Retirement Journey",
};

/**
 * Build the secondary descriptor line shown under a saved flyer in the
 * "Marketing Assets" list. Shows the flyer kind (Meeting / Topical) and
 * its benefit category, plus for meeting flyers the meeting type & date, or
 * for topical flyers the topic.
 */
function formatFlyerMeta(asset: SavedAsset): string | null {
  if (asset.type !== "flyer") return null;
  const d = (asset.data ?? {}) as Record<string, unknown>;
  const template = (d.flyerTemplate as string) || "";
  const category = (d.flyerCategory as string) || "All Benefits";
  const isTopical = template.startsWith("Topical");

  const parts: string[] = [isTopical ? "Topical" : "Meeting", category];
  if (isTopical) {
    const topic = (d.flyerTopic as string) || TOPICAL_TEMPLATE_TOPICS[template] || "";
    if (topic) parts.push(topic);
  } else {
    const meetingType = (d.meetingType as string) || "";
    if (meetingType) parts.push(meetingType);
    if (asset.startDate) {
      parts.push(
        new Date(asset.startDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      );
    }
  }
  return parts.join(" · ");
}

function PlanSearchBar({
  plans,
  value,
  onChange,
  disabled,
  userSubdomain,
}: {
  plans: Client[];
  value: string;
  onChange: (planId: string) => void;
  disabled?: boolean;
  userSubdomain?: string;
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-2xl font-bold shrink-0">Marketing</CardTitle>
          {selectedPlan && (
            <span
              className="text-xl font-semibold text-accent-blue truncate max-w-[280px]"
              title={selectedPlan.companyName}
            >
              {selectedPlan.companyName}
            </span>
          )}
        </div>
        {value && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const slug =
                (selectedPlan as any)?.slug;
              const resolvedSlug = slug || value;
              const url =
                process.env.NODE_ENV === "development"
                  ? `${window.location.origin}${getBenefitsHubPath(resolvedSlug)}`
                  : getBenefitsHubAbsoluteUrl(resolvedSlug, userSubdomain);
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

// â”€â”€ SVG Illustrations â”€â”€

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
    <text x="24" y="12.5" textAnchor="middle" fill="var(--accent-blue)" fontSize="2.5" fontWeight="600" fontFamily="system-ui">Open Enrollment Now Open</text>
    {/* Page content */}
    <rect x="7" y="18" width="16" height="2" rx="1" fill="var(--accent-blue)" fillOpacity="0.2" />
    <rect x="7" y="22" width="11" height="1.2" rx="0.6" fill="var(--accent-blue)" fillOpacity="0.1" />
    <rect x="30" y="17" width="14" height="12" rx="1.5" fill="var(--accent-blue-light)" fillOpacity="0.4" />
    <rect x="30" y="17" width="14" height="12" rx="1.5" stroke="var(--accent-blue)" strokeWidth="0.5" strokeOpacity="0.12" />
    <path d="M33 24l2-2 1.5 1.5L40 21l3 3v1H33v-1z" fill="var(--accent-blue)" fillOpacity="0.12" />
    <rect x="7" y="26" width="8" height="1" rx="0.5" fill="var(--accent-blue)" fillOpacity="0.06" />
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
    description: "Add a Top Banner, Pop-Up, or News Update to Benefits Hub.",
    cta: "Create Notice",
    illustration: <PortalNoticeIllustration />,
  },
];

export default function MarketingPage() {
  const { setTitle } = usePageTitleContext();
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const { data: profileData } = useSWR("/api/profile", jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const userSubdomain: string | undefined = profileData?.subdomain || undefined;

  // Fetch plan details (for company logo)
  const { data: planData } = useSWR(
    selectedPlan ? `/api/clients/${selectedPlan}` : null,
    jsonFetcher,
    { dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const planLogo: string | undefined = useMemo(
    () => (planData?.data as { companyLogo?: string })?.companyLogo,
    [planData],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [activeAssetType, setActiveAssetType] = useState<AssetType>("flyer");
  const [editingFlyerStep, setEditingFlyerStep] = useState<number | undefined>(undefined);
  const [editingPortalElement, setEditingPortalElement] = useState<PortalNoticeElement | null | undefined>(undefined);
  const [editingAsset, setEditingAsset] = useState<SavedAsset | null>(null);
  const [previewAsset, setPreviewAsset] = useState<SavedAsset | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MarketingAssetStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<AssetType | "All">("All");

  // â”€â”€ Fetch assets from API â”€â”€
  const { data: assetsData, isLoading: isLoadingAssets, mutate: mutateAssets } = useSWR(
    selectedPlan ? `/api/marketing/assets?clientId=${selectedPlan}` : null,
    jsonFetcher,
    { dedupingInterval: 10_000, revalidateOnFocus: true },
  );
  const savedAssets: SavedAsset[] = useMemo(() => assetsData?.data ?? [], [assetsData]);
  const filteredAssets = useMemo(
    () => savedAssets.filter(
      (a) => (statusFilter === "All" || a.status === statusFilter) &&
             (typeFilter === "All" || a.type === typeFilter)
    ),
    [savedAssets, statusFilter, typeFilter],
  );
  const hasAssets = savedAssets.length > 0;

  // ── Bulk selection state ──
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Clear selection when plan or filter changes
  useEffect(() => {
    setSelectedAssets(new Set());
  }, [selectedPlan, statusFilter]);

  // ── Bulk selection helpers ──
  const toggleSelectAsset = useCallback((assetId: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedAssets((prev) => {
      if (prev.size === filteredAssets.length && filteredAssets.length > 0) {
        return new Set();
      }
      return new Set(filteredAssets.map((a) => a.id));
    });
  }, [filteredAssets]);

  const clearSelectedAssets = useCallback(() => setSelectedAssets(new Set()), []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedAssets.size === 0) return;
    setIsBulkDeleting(true);
    let deleted = 0;
    try {
      for (const assetId of selectedAssets) {
        const res = await fetch(`/api/marketing/assets/${assetId}`, { method: "DELETE" });
        if (res.ok) deleted++;
        else console.error("Failed to delete asset:", assetId, res.status);
      }
      if (deleted > 0) {
        clearSelectedAssets();
        mutateAssets();
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
    } finally {
      setIsBulkDeleting(false);
      if (deleted > 0) {
        console.log("[MarketingPage] Showing bulk delete toast — deleted:", deleted);
        toast.success(`${deleted === 1 ? "1 asset" : `${deleted} assets`} deleted`, {
          description: "Successfully removed from this plan.",
        });
        // Fallback: also log to confirm toast was called
        console.log("[MarketingPage] Bulk delete toast fired");
      } else {
        console.log("[MarketingPage] Bulk delete — no assets were deleted (deleted=0)");
      }
    }
  }, [selectedAssets, clearSelectedAssets, mutateAssets]);

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
                  userSubdomain={userSubdomain}
                />
              </>
            )}
          </CardContent>
        </Card>

        {selectedPlan && selectedClient && !isLoadingClients && (
        <div className="space-y-4">
          <Accordion type="multiple" defaultValue={["create"]} className="space-y-4">
            {/* Create Marketing Asset Accordion */}
            <AccordionItem value="create" className="rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm">
              <AccordionTrigger className="px-5 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Marketing Asset
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                {/* Creation cards 2-column grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
                  {OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="group relative flex flex-col items-center text-center rounded-2xl border-2 border-transparent bg-white dark:bg-gray-800 shadow-sm hover:shadow-xl hover:border-[var(--accent-blue)]/40 transition-all duration-300 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-blue)] overflow-hidden"
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
                        <span className="mt-4 inline-flex items-center rounded-lg bg-[var(--accent-blue)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent-blue)] group-hover:bg-[var(--accent-blue)] group-hover:text-white transition-colors duration-200">
                          {option.cta}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Marketing Assets Accordion */}
            <AccordionItem value="edit" className="rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm">
              <AccordionTrigger className="px-5 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Marketing Assets
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
                      <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-b bg-white dark:bg-gray-800">
                        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
                          <Checkbox
                            checked={filteredAssets.length > 0 && selectedAssets.size === filteredAssets.length}
                            onCheckedChange={() => toggleSelectAll()}
                            className="shrink-0 mr-1"
                            aria-label="Select all assets"
                          />
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
                                    ? "bg-gray-900 text-white dark:bg-accent-blue dark:text-white"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
                                )}
                              >
                                {s === "All" ? "All" : s} <span className="opacity-60">({count})</span>
                              </button>
                            );
                          })}
                        </div>
                        {/* Type filter dropdown */}
                        <div className="relative shrink-0">
                          <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as AssetType | "All")}
                            className="appearance-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 pr-8 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="All">All Types</option>
                            <option value="flyer">Flyer</option>
                            <option value="portal-notice">Top Banner</option>
                            <option value="pop-up">Pop-Up</option>
                            <option value="news-post">News Post</option>
                          </select>
                          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Bulk action bar */}
                    {selectedAssets.size > 0 && !isBulkDeleting && (
                      <div className="flex items-center justify-between rounded-none border-b border-red-200 bg-red-50 px-5 py-2.5 dark:border-red-800 dark:bg-red-900/20">
                        <span className="text-sm font-medium text-red-800 dark:text-red-300">
                          {selectedAssets.size} asset{selectedAssets.size !== 1 ? "s" : ""} selected
                        </span>
                        <div className="flex items-center gap-2">
                          <button type="button" className="text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200" onClick={clearSelectedAssets}>Clear</button>
                          <button type="button" className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 transition-colors" onClick={handleBulkDelete}>
                            <Trash2 className="h-3 w-3" />
                            Delete selected
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bulk deleting loading indicator */}
                    {isBulkDeleting && (
                      <div className="flex items-center justify-center border-b bg-accent-blue/5 px-5 py-4 dark:bg-accent-blue/10">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-accent-blue" />
                          <span className="text-sm font-medium text-accent-blue">Deleting assets...</span>
                        </div>
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
                            <Checkbox
                              checked={selectedAssets.has(asset.id)}
                              onCheckedChange={() => toggleSelectAsset(asset.id)}
                              className="shrink-0"
                            />
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase tracking-wide"
                              style={{
                                background:
                                  asset.type === "flyer" ? "#e0f2fe" :
                                  asset.type === "portal-notice" ? "#fef3c7" :
                                  asset.type === "pop-up" ? "#ede9fe" :
                                  "#dbeafe",
                                color:
                                  asset.type === "flyer" ? "#0284c7" :
                                  asset.type === "portal-notice" ? "#d97706" :
                                  asset.type === "pop-up" ? "#7c3aed" :
                                  "#2563eb",
                              }}
                            >
                              {asset.type === "flyer" ? "F" :
                               asset.type === "portal-notice" ? "TB" :
                               asset.type === "pop-up" ? "PU" :
                               "NE"}
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                              setActiveAssetType(asset.type);
                              setPreviewAsset(asset);
                              setModalOpen(true);
                            }}>
                              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                <span className="font-semibold hover:text-[var(--accent-blue)] transition-colors">
                                  {asset.type === "portal-notice"
                                    ? "Top Banner"
                                    : asset.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                                  }
                                </span>
                                {asset.type !== "flyer" && (
                                  <span className="text-muted-foreground ml-1">
                                    · {new Date(asset.createdAt).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                  </span>
                                )}
                              </p>
                              {asset.type === "flyer" &&
                                (() => {
                                  const meta = formatFlyerMeta(asset);
                                  if (!meta) return null;
                                  return (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {meta}
                                    </p>
                                  );
                                })()}
                            </div>

                            {asset.type === "flyer" && (
                              <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline shrink-0 disabled:opacity-50"
                                disabled={downloadingId === asset.id}
                                onClick={async () => {
                                  setDownloadingId(asset.id);
                                  try {
                                    // Flyer-specific fields are in the nested `data` JSON blob
                                    const d = asset.data ?? {};
                                    const flyerQrUrl = (d.flyerQrUrl as string) || asset.flyerQrUrl || "";
                                    const flyerQrDataUrl = (d.flyerQrDataUrl as string) || asset.flyerQrDataUrl || "";
                                    const flyerSubtitle = (d.flyerSubtitle as string) || asset.flyerSubtitle || "";
                                    const flyerImage = (d.flyerImage as string) || asset.flyerImage || "";
                                    const meetingTime = (d.meetingTime as string) || asset.meetingTime || "";
                                    const meetingLocation = (d.meetingLocation as string) || asset.meetingLocation || "";
                                    const flyerTemplate = (d.flyerTemplate as string) || "MeetingTemplate1";
                                    const flyerImagePosition = (d.flyerImagePosition as { x: number; y: number }) || { x: 50, y: 50 };
                                    const flyerImageWidth = (d.flyerImageWidth as number) || null;
                                    const flyerImageHeight = (d.flyerImageHeight as number) || null;
                                    const disclaimerText = (d.disclaimerText as string) || "";
                                    const flyerLanguage = ((d.flyerLanguage as "en" | "es") || "en");
                                    const organizationLogo = (profileData as any)?.advisorLogoUrl || undefined;

                                    // Ensure the QR image is inlined as a data URL so it survives
                                    // SVG -> PDF rasterisation (external sub-resources are blocked).
                                    const resolvedQrDataUrl = await resolveQrImageDataUrl(flyerQrDataUrl, flyerQrUrl);

                                    const flyerProps: FlyerPreviewProps = {
                                      headline: asset.headline ?? "",
                                      body: asset.body ?? "",
                                      ctaText: "",
                                      bgColor: asset.bgColor ?? "#23919c",
                                      startDate: asset.startDate ?? "",
                                      planName: selectedClient?.companyName ?? "",
                                      planLogo: planLogo,
                                      organizationLogo,
                                      disclaimerText,
                                      flyerImage,
                                      flyerQrUrl,
                                      flyerQrDataUrl: resolvedQrDataUrl,
                                      meetingTime,
                                      meetingLocation,
                                      flyerSubtitle,
                                      flyerTemplate: flyerTemplate as FlyerPreviewProps["flyerTemplate"],
                                      flyerLanguage,
                                      flyerImagePosition,
                                      flyerImageWidth,
                                      flyerImageHeight,
                                    };

                                    const svgEl = await renderFlyerPreviewToSvg(flyerProps);
                                    const dataUrl = await svgElementToDataUrl(svgEl);
                                    const blob = await generateFlyerPdfBlob(dataUrl);
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    const safeName = (selectedClient?.companyName ?? "flyer").replace(/[^a-zA-Z0-9_-]/g, "_");
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
                            <button type="button" className="text-xs font-medium text-[var(--accent-blue)] hover:underline shrink-0" onClick={() => {
                              setActiveAssetType(asset.type);
                              setEditingAsset(asset);
                              if (asset.type === "flyer") {
                                setEditingFlyerStep(3);
                                setEditingPortalElement(undefined);
                              } else if (asset.type === "portal-notice") {
                                setEditingPortalElement("top-banner");
                                setEditingFlyerStep(undefined);
                              } else {
                                setEditingFlyerStep(undefined);
                                setEditingPortalElement(undefined);
                              }
                              setModalOpen(true);
                            }}>Edit</button>

                            {deletingId === asset.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">Are you sure?</span>
                                <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline shrink-0 disabled:opacity-50" disabled={isDeletingLoading}
                                  onClick={async () => {
                                    setIsDeletingLoading(true);
                                    try {
                                      const res = await fetch(`/api/marketing/assets/${asset.id}`, { method: "DELETE" });
                                      if (res.ok) {
                                        mutateAssets();
                                        console.log("[MarketingPage] Showing single delete toast for:", asset.headline);
                                        toast.success("Asset deleted", {
                                          description: `"${asset.headline || asset.type}" has been removed.`,
                                        });
                                        console.log("[MarketingPage] Single delete toast fired");
                                      }
                                    } catch (err) { console.error("Failed to delete:", err); }
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

        {/* Marketing Asset Creation Modal */}
        {selectedClient && (
          <MarketingAssetModal
            open={modalOpen}
            onOpenChange={(v) => {
              setModalOpen(v);
              if (!v) {
                setEditingFlyerStep(undefined);
                setEditingPortalElement(undefined);
                setEditingAsset(null);
                setPreviewAsset(null);
              }
            }}
            assetType={activeAssetType}
            planName={selectedClient.companyName}
            planId={selectedPlan}
            initialFlyerStep={editingFlyerStep}
            initialPortalElement={editingPortalElement}
            editingAsset={editingAsset || previewAsset}
            previewOnly={!!previewAsset}
            onEditFromPreview={() => {
              setEditingAsset(previewAsset);
              setPreviewAsset(null);
            }}
            onSave={() => {
              mutateAssets();
            }}
          />
        )}
      </div>
    </div>
  );
}


