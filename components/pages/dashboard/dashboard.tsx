"use client";

import { Card, CardContent } from "@/components/ui/card";
import { QuickActions } from "@/components/ui/quick-actions";
import { ResetOnboardingButton } from "@/components/ui/reset-onboarding-button";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect, useMemo, useState } from "react";
import { Headshot } from "@/components/ui/headshot";
import { BrandingImage } from "@/components/ui/branding-image";
import useSWR from "swr";
import {
  demoStats as defaultDemoStats,
  quickActions,
  userInfo as defaultUserInfo,
} from "./dashboard.funcs";
import { resolveBrandingImageUrl } from "@/lib/branding-image-url";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const SWR_OPTS = {
  keepPreviousData: true,
  dedupingInterval: 60_000,   // profile/stats rarely change — cache for 60s
  revalidateOnFocus: false,   // don't re-fetch just because user switched tabs
} as const;

export function Dashboard() {
  const { setTitle } = usePageTitleContext();

  useEffect(() => {
    setTitle("Dashboard");
  }, [setTitle]);

  // SWR: profile — cached, shows instantly on revisit
  const { data: profileData, isLoading: isLoadingUserInfo } = useSWR(
    "/api/profile",
    jsonFetcher,
    SWR_OPTS,
  );

  // SWR: dashboard stats — cached
  const { data: statsData, isLoading: isLoadingStats } = useSWR(
    "/api/dashboard/stats",
    jsonFetcher,
    SWR_OPTS,
  );

  const userInfo = useMemo(() => {
    if (!profileData) return defaultUserInfo;
    const wizardSession = profileData.wizardSessions?.[0];
    const userSetup = wizardSession?.userSetup;
    const branding = wizardSession?.branding;
    const rawAvatar =
      branding?.aiAvatar ||
      profileData.headshot ||
      userSetup?.headshot ||
      (userSetup?.headshotData as any)?.previewDataUrl ||
      "";
    return {
      name: userSetup?.name || profileData.name || "User",
      title: userSetup?.title || profileData.title || "Advisor",
      logo: branding?.logo || profileData.advisorLogoUrl || "/logo-2.png",
      rawAvatar,
    };
  }, [profileData]);

  // Pre-resolve R2 keys so the Headshot component receives a displayable URL
  const [resolvedAvatar, setResolvedAvatar] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    resolveBrandingImageUrl(userInfo.rawAvatar || null).then((url) => {
      if (!cancelled) setResolvedAvatar(url ?? userInfo.rawAvatar ?? "");
    });
    return () => { cancelled = true; };
  }, [userInfo.rawAvatar]);

  const demoStats = useMemo(() => {
    const stats = statsData?.data;
    if (!stats) return defaultDemoStats;
    const filtered = defaultDemoStats.filter((stat) => {
      switch (stat.title) {
        case "Active Plans": return stats.activePlans > 0;
        case "Upcoming Meetings": return stats.upcomingMeetings > 0;
        default: return true;
      }
    });
    return filtered.map((stat) => {
      switch (stat.title) {
        case "Active Plans": return { ...stat, value: stats.activePlans };
        case "Upcoming Meetings": return { ...stat, value: stats.upcomingMeetings };
        default: return stat;
      }
    });
  }, [statsData]);

  return (
    <div className="px-6">
      <div className="w-full space-y-6 max-w-6xl mx-auto">

      {/* User Info */}
      <Card className="px-5 mt-4 bg-transparent">
        <CardContent className="flex items-center justify-between gap-4 p-0">
          {isLoadingUserInfo ? (
            <>
              {/* Identity skeleton: avatar + greeting lines (left) */}
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="size-16 flex-shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-6 w-48 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>

              {/* Logo skeleton (right) */}
              <div className="h-[104px] w-[156px] flex-shrink-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </>
          ) : (
            <>
              {/* Identity: avatar + greeting — flush left */}
              <div className="flex min-w-0 flex-1 items-center gap-4 text-left">
                <div className="size-16 flex-shrink-0 overflow-hidden rounded-full border border-border dark:border-gray-600">
                  <Headshot
                    src={resolvedAvatar || userInfo.rawAvatar || undefined}
                    monogramName={userInfo.name}
                    alt="Avatar"
                  />
                </div>
                <div className="min-w-0 text-left">
                  <h4 className="truncate text-xl font-semibold dark:text-gray-100">
                    Welcome back, {userInfo.name}!
                  </h4>
                  <p className="truncate text-sm font-normal text-muted-foreground">
                    {userInfo.title || "Advisor"}
                  </p>
                </div>
              </div>

              {/* Advisor branding logo — flush right */}
              {userInfo.logo && (
                <div className="ml-auto flex h-[104px] w-[156px] flex-shrink-0 items-center justify-center overflow-hidden rounded">
                  <BrandingImage
                    src={userInfo.logo}
                    alt="Logo"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Quick Actions */}
      <QuickActions actions={quickActions} />
      </div>
    </div>
  );
}
