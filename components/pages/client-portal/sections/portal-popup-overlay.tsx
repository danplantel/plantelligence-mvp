"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { usePopUpAssets, shouldShowPopUpOnPage } from "@/hooks/useMarketingAssets";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "plantelligence_popup_dismissed";

interface PortalPopUpOverlayProps {
  clientId?: string;
  companyName?: string;
  companyLogo?: string;
}

/**
 * Displays published pop-up assets as modal overlays on the Benefits Hub.
 * Respects page visibility settings and dismiss state.
 *
 * Dismiss behavior:
 * - showEveryVisit = false → dismissed for the entire session (sessionStorage)
 * - showEveryVisit = true  → dismissed only for current page view;
 *   reappears on next page navigation or page reload
 */
export function PortalPopUpOverlay({
  clientId,
  companyName,
  companyLogo,
}: PortalPopUpOverlayProps) {
  const pathname = usePathname();
  const { assets, isLoading } = usePopUpAssets(clientId);
  const { url: resolvedLogoUrl } = useBrandingImageUrl(companyLogo ?? null);

  // Track which pop-ups are currently visible
  const [visiblePopUpId, setVisiblePopUpId] = useState<string | null>(null);
  // Session-persisted dismissed set (showEveryVisit = false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  // Per-page-view dismissed set (showEveryVisit = true) — resets on pathname change
  const [pageViewDismissedIds, setPageViewDismissedIds] = useState<Set<string>>(new Set());
  // Track previous pathname to detect navigation
  const prevPathnameRef = useRef(pathname);

  // Load dismissed pop-ups from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DISMISSED_KEY);
      if (stored) {
        setDismissedIds(new Set(JSON.parse(stored) as string[]));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Reset per-page-view dismissals when pathname changes (navigation occurred)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      setPageViewDismissedIds(new Set());
      prevPathnameRef.current = pathname;
    }
  }, [pathname]);

  // Dismiss a pop-up
  const dismissPopUp = useCallback((popUpId: string, showEveryVisit?: boolean) => {
    setVisiblePopUpId(null);
    if (showEveryVisit) {
      // "Show on every visit": only dismiss for this page view (in-memory only)
      setPageViewDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(popUpId);
        return next;
      });
    } else {
      // Normal dismiss: persist to sessionStorage — gone for the session
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(popUpId);
        try {
          sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
    }
  }, []);

  // Determine which pop-up should be shown based on current path
  const activePopUp = useMemo(() => {
    if (isLoading || assets.length === 0) return null;

    // Find the first eligible pop-up (not dismissed, matches current page)
    for (const asset of assets) {
      if (dismissedIds.has(asset.id)) continue;
      if (pageViewDismissedIds.has(asset.id)) continue;
      const data = asset.data as Record<string, unknown> | null | undefined;
      if (shouldShowPopUpOnPage(data, pathname)) {
        return asset;
      }
    }
    return null;
  }, [assets, dismissedIds, pageViewDismissedIds, pathname, isLoading]);

  // Show the pop-up when one becomes active
  useEffect(() => {
    if (activePopUp && activePopUp.id !== visiblePopUpId) {
      // Small delay to ensure page is rendered first
      const timer = setTimeout(() => {
        setVisiblePopUpId(activePopUp.id);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activePopUp, visiblePopUpId]);

  // Handle backdrop click to dismiss
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        const popUp = assets.find((a) => a.id === visiblePopUpId);
        const showEveryVisit = !!(popUp?.data as Record<string, unknown> | null | undefined)?.showEveryVisit;
        if (visiblePopUpId) {
          dismissPopUp(visiblePopUpId, showEveryVisit);
        }
      }
    },
    [visiblePopUpId, assets, dismissPopUp],
  );

  // Handle escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visiblePopUpId) {
        const popUp = assets.find((a) => a.id === visiblePopUpId);
        const showEveryVisit = !!(popUp?.data as Record<string, unknown> | null | undefined)?.showEveryVisit;
        dismissPopUp(visiblePopUpId, showEveryVisit);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visiblePopUpId, assets, dismissPopUp]);

  if (!visiblePopUpId) return null;

  const popUp = assets.find((a) => a.id === visiblePopUpId);
  if (!popUp) return null;

  const data = (popUp.data as Record<string, unknown> | null) ?? {};
  const subtitle = (data.flyerSubtitle as string) || "";
  const showEveryVisit = !!(data.showEveryVisit as boolean);
  const brandColor = popUp.bgColor || "#23919c";
  const ctaLabel = popUp.ctaText || "Learn More";
  const rawCtaUrl = (data.ctaUrl as string) || "";
  const ctaUrl = rawCtaUrl && !/^https?:\/\//i.test(rawCtaUrl)
    ? `https://${rawCtaUrl}`
    : rawCtaUrl;
  const hasCtaUrl = !!ctaUrl;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={popUp.headline || "Announcement"}
    >
      <div
        className="relative mx-4 w-full max-w-md animate-in fade-in zoom-in-95 duration-300"
        style={{ animationDuration: "300ms" }}
      >
        <div
          className="rounded-2xl border-2 bg-white shadow-2xl overflow-hidden"
          style={{ borderColor: brandColor }}
        >
          {/* Header area */}
          <div className="p-6 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Company logo */}
                {(resolvedLogoUrl || companyLogo) && (
                  <img
                    src={resolvedLogoUrl || companyLogo}
                    alt={companyName || "Company"}
                    className="h-10 w-10 rounded-lg object-contain border border-gray-100"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 leading-snug">
                    {popUp.headline || "Announcement"}
                  </h3>
                  {subtitle && (
                    <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissPopUp(popUp.id, showEveryVisit)}
                className="shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {popUp.body && (
            <div className="px-6 py-2">
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {popUp.body}
              </p>
            </div>
          )}

          {/* Footer with CTA and dismiss */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              onClick={() => dismissPopUp(popUp.id, showEveryVisit)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Dismiss
            </button>
            {hasCtaUrl ? (
              <a
                href={ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ background: brandColor }}
              >
                {ctaLabel}
              </a>
            ) : (
              <span
                className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ background: brandColor }}
              >
                {ctaLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
