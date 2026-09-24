"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import useSWR from "swr";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFlyerCategoryDisclaimer } from "@/lib/disclaimer-constants";
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
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";
import { PlanSearchBar } from "@/components/plan-selector/plan-search-bar";
import { PlanChangeLoadingDialog } from "@/components/ui/plan-change-loading-dialog";

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

// SVG Illustrations

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

interface TypeFilterOption {
  value: AssetType | "All";
  label: string;
}

interface MarketingAssetListProps {
  value: string;
  title: string;
  icon: React.ReactNode;
  assets: SavedAsset[];
  isLoading: boolean;
  /** Type-filter options. Pass a single "All" option to hide the type dropdown. */
  typeOptions: TypeFilterOption[];
  emptyTitle: string;
  emptyDescription: string;
  onPreview: (asset: SavedAsset) => void;
  onEdit: (asset: SavedAsset) => void;
  mutateAssets: () => void;
  /** Flyer download helpers */
  advisorLogoUrl?: string;
  companyName?: string;
  planLogo?: string;
  /** When false, hides the status filter pills (e.g. for the Flyers accordion). */
  showStatusFilter?: boolean;
}

/**
 * Self-contained accordion item that lists a subset of saved marketing assets
 * (e.g. Flyers or Portal Notices) with its own status/type filters, bulk
 * selection, and per-row preview / edit / download / delete / status controls.
 */
function MarketingAssetListAccordionItem({
  value,
  title,
  icon,
  assets,
  isLoading,
  typeOptions,
  emptyTitle,
  emptyDescription,
  onPreview,
  onEdit,
  mutateAssets,
  advisorLogoUrl,
  companyName,
  planLogo,
  showStatusFilter = true,
}: MarketingAssetListProps) {
  const [statusFilter, setStatusFilter] = useState<MarketingAssetStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<AssetType | "All">("All");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  const filteredAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          (statusFilter === "All" || a.status === statusFilter) &&
          (typeFilter === "All" || a.type === typeFilter)
      ),
    [assets, statusFilter, typeFilter],
  );

  // Clear selection when the asset list or filters change
  useEffect(() => {
    setSelectedAssets(new Set());
  }, [statusFilter, typeFilter, assets]);

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
        toast.success(`${deleted === 1 ? "1 asset" : `${deleted} assets`} deleted`, {
          description: "Successfully removed from this plan.",
        });
      }
    }
  }, [selectedAssets, clearSelectedAssets, mutateAssets]);

  return (
    <AccordionItem value={value} className="rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm">
      <AccordionTrigger className="px-5 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
          <span className="text-xs text-muted-foreground font-normal">({assets.length})</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-0 pb-0">
        {isLoading ? (
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
        ) : assets.length > 0 ? (
          <>
            {/* Filter bar */}
            <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-b bg-white dark:bg-gray-800">
              <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
                <Checkbox
                  checked={filteredAssets.length > 0 && selectedAssets.size === filteredAssets.length}
                  onCheckedChange={() => toggleSelectAll()}
                  className="shrink-0 mr-1"
                  aria-label="Select all assets"
                />
                {showStatusFilter &&
                  (["All", ...ASSET_STATUSES] as const).map((s) => {
                    const count = s === "All" ? assets.length : assets.filter((a) => a.status === s).length;
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
              {typeOptions.length > 1 && (
                <div className="relative shrink-0">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as AssetType | "All")}
                    className="appearance-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 pr-8 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              )}
            </div>

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
                      ? emptyTitle
                      : `No assets with "${statusFilter}" status`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {statusFilter === "All"
                      ? emptyDescription
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
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPreview(asset)}>
                      <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                        <span className="font-semibold hover:text-[var(--accent-blue)] transition-colors">
                          {asset.type === "portal-notice"
                            ? "Top Banner"
                            : asset.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                          }
                        </span>
                        {asset.type !== "flyer" && asset.headline && (
                          <span className="text-muted-foreground ml-1.5 font-normal">
                            {asset.headline}
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
                            const savedDisclaimer = (d.disclaimerText as string) || "";
                            const categoryDisclaimer = getFlyerCategoryDisclaimer((d.flyerCategory as string) || "") || "";
                            // Use the category's default footer text unless the advisor saved a custom
                            // disclaimer that differs from the standard default (e.g. legacy flyers
                            // created before category-specific footers existed).
                            const disclaimerText =
                              savedDisclaimer && !savedDisclaimer.startsWith("Securities and advisory services offered through")
                                ? savedDisclaimer
                                : (categoryDisclaimer || savedDisclaimer);
                            const flyerLanguage = ((d.flyerLanguage as "en" | "es") || "en");

                            // Ensure the QR image is inlined as a data URL so it survives
                            // SVG -> PDF rasterisation (external sub-resources are blocked).
                            const resolvedQrDataUrl = await resolveQrImageDataUrl(flyerQrDataUrl, flyerQrUrl);

                            const flyerProps: FlyerPreviewProps = {
                              headline: asset.headline ?? "",
                              body: asset.body ?? "",
                              ctaText: "",
                              bgColor: asset.bgColor ?? "#23919c",
                              startDate: asset.startDate ?? "",
                              planName: companyName ?? "",
                              planLogo: planLogo,
                              organizationLogo: advisorLogoUrl,
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
                            const safeName = (companyName ?? "flyer").replace(/[^a-zA-Z0-9_-]/g, "_");
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
                    <button type="button" className="text-xs font-medium text-[var(--accent-blue)] hover:underline shrink-0" onClick={() => onEdit(asset)}>Edit</button>

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
                                toast.success("Asset deleted", {
                                  description: `"${asset.headline || asset.type}" has been removed.`,
                                });
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

                    {asset.type !== "flyer" && (
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
                    )}
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
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{emptyTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export default function MarketingPage() {
  const { setTitle, setSubtitle } = usePageTitleContext();
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  // Loading dialog shown while the newly selected plan's data is being loaded.
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  // Advisor profile (for the flyer advisor logo).
  const { data: profileData } = useSWR("/api/profile", jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });

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
  const handlePreviewAsset = useCallback((asset: SavedAsset) => {
    setActiveAssetType(asset.type);
    setPreviewAsset(asset);
    setModalOpen(true);
  }, []);

  const handleEditAsset = useCallback((asset: SavedAsset) => {
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
  }, []);

  // â”€â”€ Fetch assets from API â”€â”€
  const { data: assetsData, isLoading: isLoadingAssets, mutate: mutateAssets, error: assetsError } = useSWR(
    selectedPlan ? `/api/marketing/assets?clientId=${selectedPlan}` : null,
    jsonFetcher,
    { dedupingInterval: 10_000, revalidateOnFocus: true },
  );
  const savedAssets: SavedAsset[] = useMemo(() => assetsData?.data ?? [], [assetsData]);
  // `summary=1`: this picker reads only id/companyName/slug/status (the plan logo comes
  // from `planData`, a separate request). The default select ships every plan's
  // `keyContacts` + legacy `employeePortalPreview` mirror — base64 images, measured at
  // 8.3 MB / 6.6 s for 7 plans.
  const { data: clientsData, isLoading: isLoadingClients } = useSWR(
    "/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc&summary=1",
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
    // No-op when the same plan is already selected.
    if (clientId === selectedPlan) return;
    setSelectedPlan(clientId);
    // Show the loading dialog while the new plan's data loads.
    setIsPlanLoading(true);
  };

  // Close the plan loading dialog once the new plan's marketing assets are
  // loaded (covers success + error). A minimum display time prevents an
  // instant flash, and an 8s cap guarantees the dialog can never get stuck.
  useEffect(() => {
    if (!isPlanLoading) return;
    const cap = window.setTimeout(() => setIsPlanLoading(false), 8000);
    return () => window.clearTimeout(cap);
  }, [isPlanLoading]);
  useEffect(() => {
    if (!isPlanLoading) return;
    const check = window.setTimeout(() => {
      if (!isLoadingAssets && (assetsData !== undefined || !!assetsError)) {
        setIsPlanLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(check);
  }, [isPlanLoading, isLoadingAssets, assetsData, assetsError]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedPlan),
    [clients, selectedPlan]
  );

  // Show the selected plan's company name in the page header (next to the
  // "Marketing" title) instead of inside the plan search bar.
  useEffect(() => {
    setSubtitle(selectedClient?.companyName ?? "");
  }, [selectedClient, setSubtitle]);

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
                  title="Marketing"
                  module="marketing"
                  disabled={clients.length === 0}
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

            {/* Portal Notices Accordion */}
            <MarketingAssetListAccordionItem
              value="portal-notices"
              title="Portal Notices"
              icon={
                <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
              assets={savedAssets.filter((a) => a.type !== "flyer")}
              isLoading={isLoadingAssets}
              typeOptions={[
                { value: "All", label: "All Types" },
                { value: "portal-notice", label: "Top Banner" },
                { value: "pop-up", label: "Pop-Up" },
                { value: "news-post", label: "News Post" },
              ]}
              emptyTitle="No portal notices yet"
              emptyDescription="Create your first notice, pop-up, or news post above."
              onPreview={handlePreviewAsset}
              onEdit={handleEditAsset}
              mutateAssets={mutateAssets}
            />

            {/* Flyers Accordion */}
            <MarketingAssetListAccordionItem
              value="flyers"
              title="Flyers"
              icon={
                <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              }
              assets={savedAssets.filter((a) => a.type === "flyer")}
              isLoading={isLoadingAssets}
              typeOptions={[{ value: "All", label: "All Types" }]}
              showStatusFilter={false}
              emptyTitle="No flyers yet"
              emptyDescription="Create your first flyer above."
              onPreview={handlePreviewAsset}
              onEdit={handleEditAsset}
              mutateAssets={mutateAssets}
              advisorLogoUrl={(profileData as any)?.advisorLogoUrl}
              companyName={selectedClient?.companyName}
              planLogo={planLogo}
            />
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

        {/* Loading dialog shown while the selected plan's data is loading */}
        <PlanChangeLoadingDialog open={isPlanLoading} />
      </div>
    </div>
  );
}


