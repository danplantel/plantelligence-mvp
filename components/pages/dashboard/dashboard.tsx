"use client";

import { Card, CardContent } from "@/components/ui/card";
import { QuickInsights } from "@/components/ui/quick-insights";
import { QuickActions } from "@/components/ui/quick-actions";
import { ResetOnboardingButton } from "@/components/ui/reset-onboarding-button";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect, useMemo, useState } from "react";
import { Headshot } from "@/components/ui/headshot";
import { BrandingImage } from "@/components/ui/branding-image";
import useSWR from "swr";
import { ActivePlansPanel } from "./active-plans-panel";
import { MeetingsThisWeekPanel } from "./meetings-this-week-panel";
import { NeedsAttentionPanel } from "./needs-attention-panel";
import { RecentActivity } from "./recent-activity";
import { TasksAndMeetings } from "./tasks-and-meetings";
import {
  quickActions,
  quickInsights as defaultQuickInsights,
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

  // The seat meter is deliberately NOT on the dashboard any more.
  //
  // Recorded because it contradicts a written rule rather than merely omitting one: spec T3
  // Part A item 3 asks for "X of Y seats used … visible in Settings → Team and on the
  // dashboard", and `components/pages/seat-meter.tsx` quotes that line in its own header.
  // This is a product decision overriding that half of the sentence, so the next person to
  // read the spec finds the reason here instead of assuming an oversight.
  //
  // Nothing was thrown away to achieve it: `SeatMeter` and `useSeatUsage` are untouched in
  // `components/pages/seat-meter.tsx`, so restoring the dashboard zone is a re-wire rather than
  // a rebuild. (They are now referenced by nothing else — the meter was the only consumer of
  // this hook, which is why the dashboard no longer fires `GET /api/teammates/seats` on load.)
  // The shared "How seats work" dialog lives in
  // `components/teammates/seats/seat-usage-info-dialog.tsx`, and the seats UI itself lives only
  // in Settings → People & Access.

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

  // Quick Insights — overlay live counts onto the tile definitions.
  // Tiles with no `statsKey` have no backing query yet and keep their placeholder value.
  // Live-backed tiles fall back to an em dash rather than a fabricated number, so a failed
  // or partial stats response can never render a misleading count.
  const quickInsightItems = useMemo(() => {
    const stats = statsData?.data;
    return defaultQuickInsights.map((insight) => {
      if (!insight.statsKey) return insight;
      const liveValue = stats?.[insight.statsKey];
      return {
        ...insight,
        value:
          typeof liveValue === "number" ? liveValue : (insight.value ?? "—"),
      };
    });
  }, [statsData]);

  return (
    <div className="px-6">
      <div className="w-full space-y-6 max-w-7xl mx-auto">
        {/* ── Top row: identity · branding ─────────────────────────────────────
            Two zones across the parent width: who you are on the left, the
            organization's logo pinned right. The seat meter used to hold the middle
            column — see the note at the top of `Dashboard` for why it no longer does.

            Two details that are load-bearing rather than cosmetic:

            1. `[minmax(0,1fr)_auto]` gives the identity card all the flexible space
               while the logo keeps its intrinsic width. `minmax(0, …)` rather than a
               bare `1fr`: `1fr` has an `auto` minimum, so a long name could push the
               logo out of the row instead of truncating inside its own column.
            2. The logo is deliberately NOT its own Card. It is a bare grid child
               pinned to the right, which keeps the row to one card instead of
               inventing a bordered box to hold a single image.
            Below `lg` the two stack, because the logo is a fixed 156×104 and cannot
            shrink. `items-stretch` (the grid default, stated for intent) makes both
            children the same height, and the `h-full` below is what lets the identity
            content centre vertically against the taller logo. */}
        <div className="grid items-stretch grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          {/* Identity — left */}
          <Card className="px-5 bg-transparent">
            <CardContent className="flex h-full items-center gap-4 p-0">
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Branding logo — pinned right. Deliberately not a Card: a single image
              does not need a bordered box, and this keeps the row to two cards. The
              logo is also fixed at 156×104 and cannot shrink, which is why the whole
              row stacks below `lg` instead of squeezing it. */}
          {isLoadingUserInfo ? (
            <div className="flex items-center justify-end">
              <div className="h-[104px] w-[156px] flex-shrink-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ) : userInfo.logo ? (
            <div className="flex items-center justify-end">
              <div className="flex h-[104px] w-[156px] flex-shrink-0 items-center justify-center overflow-hidden rounded">
                <BrandingImage
                  src={userInfo.logo}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          ) : null}
        </div>

      {/* Quick Actions */}
      <QuickActions actions={quickActions} />
      
      {/* Quick Insights */}
      <QuickInsights
        insights={quickInsightItems}
        isLoading={isLoadingStats}
        renderDetail={(insight) => {
          switch (insight.id) {
            case "active-plans":
              return <ActivePlansPanel />;
            case "meetings-this-week":
              return <MeetingsThisWeekPanel />;
            case "needs-attention":
              return <NeedsAttentionPanel />;
            default:
              return null;
          }
        }}
      />

      {/* Tasks & Meetings */}
      <TasksAndMeetings />

      {/* Recent Activity */}
      <RecentActivity />


      </div>
    </div>
  );
}
