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
    <div className="p-6">
      <div className="w-full space-y-6 max-w-8xl mx-auto">

      {/* User Info */}
      <Card className="px-6 py-[30px] bg-transparent">
        <CardContent className="flex flex-col items-start gap-4 p-0">
          {isLoadingUserInfo ? (
            <>
              {/* Logo skeleton */}
              <div className="animate-pulse">
                <div className="w-[120px] h-[80px] bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>

              <div className="flex items-center gap-4">
                {/* Avatar skeleton */}
                <div className="animate-pulse">
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>

                {/* Text skeleton */}
                <div className="animate-pulse space-y-2">
                  <div className="w-48 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </>
          ) : (
            <>
              <section className="flex gap-4 items-center">
                <div className="size-16 rounded-full overflow-hidden flex-shrink-0 border border-border dark:border-gray-600">
                  <Headshot
                    src={resolvedAvatar || userInfo.rawAvatar || undefined}
                    monogramName={userInfo.name}
                    alt="Avatar"
                  />
                </div>
                <section>
                  {userInfo.logo && (
                    <div className="w-[120px] h-[80px] flex items-center justify-center overflow-hidden rounded">
                      <BrandingImage
                        src={userInfo.logo}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <h4 className="text-xl font-semibold dark:text-gray-100">
                    Welcome back, {userInfo.name}!
                  </h4>
                  <p className="text-sm text-muted-foreground font-regular">
                    {userInfo.title || "Advisor"}
                  </p>
                </section>
              </section>
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
