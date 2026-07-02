"use client";

import useSWR from "swr";
import { useMemo } from "react";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

export interface MarketingAsset {
  id: string;
  clientId: string;
  type: "portal-notice" | "pop-up" | "news-post";
  status: string;
  headline: string;
  body: string;
  ctaText: string;
  startDate?: string | null;
  endDate?: string | null;
  bgColor: string;
  data?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch published marketing assets for a given client from the public endpoint.
 * @param clientId - The plan/client ID
 * @param type - Optional filter by asset type
 */
export function useMarketingAssets(clientId?: string, type?: string) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  if (type) params.set("type", type);

  const { data, error, isLoading } = useSWR(
    clientId ? `/api/marketing/assets/public?${params.toString()}` : null,
    jsonFetcher,
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
    },
  );

  return {
    assets: (data?.data as MarketingAsset[]) ?? [],
    isLoading,
    error,
  };
}

/**
 * Fetch published pop-up assets for a given client.
 */
export function usePopUpAssets(clientId?: string) {
  return useMarketingAssets(clientId, "pop-up");
}

/**
 * Fetch published news-post assets for a given client.
 */
export function useNewsPostAssets(clientId?: string) {
  return useMarketingAssets(clientId, "news-post");
}

/**
 * Fetch published portal-notice (top banner) assets for a given client.
 */
export function usePortalNoticeAssets(clientId?: string) {
  return useMarketingAssets(clientId, "portal-notice");
}

/**
 * Determines if a pop-up should be shown on the current page based on its popupPages configuration.
 */
export function shouldShowPopUpOnPage(
  popupData: Record<string, unknown> | null | undefined,
  currentPath: string,
): boolean {
  if (!popupData) return false;
  const pages = popupData.popupPages as string[] | undefined;
  if (!pages || pages.length === 0) return false;

  // "all" means show on every page
  if (pages.includes("all")) return true;

  for (const page of pages) {
    if (page === "home" && (currentPath === "/" || currentPath === "")) return true;
    if (page === "benefits" && (currentPath.includes("/retirement") || currentPath.includes("/health-insurance") || currentPath.includes("/life-insurance") || currentPath.includes("/wellness-programs"))) return true;
    if (page === "news-events" && currentPath.includes("/news-events")) return true;
    if (page === "my-benefits-team" && currentPath.includes("/my-benefits-team")) return true;
  }

  return false;
}
