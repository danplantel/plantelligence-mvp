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
import { DashboardTeam } from "./dashboard-team";
import {
  quickActions,
  quickInsights as defaultQuickInsights,
  userInfo as defaultUserInfo,
} from "./dashboard.funcs";
import { resolveBrandingImageUrl } from "@/lib/branding-image-url";
import {
  PRESET_ROLE_LABELS,
  type TeammateAssignmentRole,
} from "@/types/teammate";

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

    // Two of these four values live outside the reader's own rows for anyone who is not the
    // organization's owner. `/api/profile` resolves them and already returns them — the dashboard
    // was just not reading them. An invited teammate's `User` row is created from a name and an
    // email and has no wizard session, so `userSetup` and `branding` are undefined for them: their
    // photo and job title are on the seat (`profileData.seat`, mirrored from the Key Contact the
    // seat was granted from) and the firm's logo is on the organization
    // (`profileData.organization.source`, resolved from the owner's row). Reading only the first
    // two sources left an Admin, Editor or Viewer with an empty avatar and the generic
    // `/logo-2.png` while the owner saw both.
    const seat = profileData.seat as
      | {
          headshot?: string | null;
          jobTitle?: string | null;
          role?: TeammateAssignmentRole | null;
        }
      | null
      | undefined;
    const organization = profileData.organization as
      | {
          viewerIsOwner?: boolean;
          source?: { logo?: string | null } | null;
        }
      | null
      | undefined;

    const rawAvatar =
      branding?.aiAvatar ||
      profileData.headshot ||
      userSetup?.headshot ||
      (userSetup?.headshotData as any)?.previewDataUrl ||
      // Last of the editable sources, matching the precedence in `/api/profile/header`: the seat
      // is the organization's copy of the person, so a photo the teammate uploaded themselves
      // (which writes `User.headshot`, arriving via `profileData.headshot` above) wins over it.
      seat?.headshot ||
      "";
    return {
      name: userSetup?.name || profileData.name || "User",
      title: userSetup?.title || profileData.title || seat?.jobTitle || "Advisor",
      // The organisation's owner is not a teammate and holds no seat, so their role is derived from
      // `viewerIsOwner`; everyone else takes the seat's summarised assignment role. Null means
      // "nothing to show" — the row then renders the title alone, as it did before.
      role: organization?.viewerIsOwner ? "owner" : seat?.role ?? null,
      // The org logo is a fallback only: it sits AFTER the reader's own logo so an owner (whose
      // `branding.logo` / `advisorLogoUrl` are set) is unaffected, and it is what a teammate — who
      // has neither — sees instead of the generic placeholder.
      logo:
        branding?.logo ||
        profileData.advisorLogoUrl ||
        organization?.source?.logo ||
        "/logo-2.png",
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

  // A Viewer is read-only across the grid, so the dashboard's write entry points are withheld:
  // Quick Actions keeps only a read, and the Needs Attention / Active Plans rows stop offering
  // edit destinations. The data itself is already scoped by `listAccessiblePlanIds` (doc §8),
  // so what remains is exactly what a Viewer may see.
  const viewerReadOnly = Boolean(
    !profileData?.organization?.viewerIsOwner &&
      (profileData as any)?.seat?.role === "viewer",
  );

  const visibleQuickActions = useMemo(
    () =>
      viewerReadOnly
        ? quickActions.filter((action) => action.viewerAllowed)
        : quickActions,
    [viewerReadOnly],
  );

  const readerRole = userInfo.role as string | null;
  // `owner`/`admin` is the whole difference that matters on the dashboard:
  //  - `publish` is allowed for them alone, so the task list's "Ready to publish" row is theirs.
  //  - `org_settings` is allowed for them alone, so the team panel is theirs to see.
  // Every other dashboard control maps to an `edit` row a non-Viewer role already holds.
  const isOwnerOrAdmin = readerRole === "owner" || readerRole === "admin";
  const canPublish = isOwnerOrAdmin;
  const canManageOrg = isOwnerOrAdmin;

  return (
    // `pt-8` adds the gap the fixed header does not: the dashboard <main> clears it with `pt-16`
    // (see `components/layout/layout-client.tsx`), which puts the identity row flush under the
    // header. This is scoped to the dashboard, so other pages keep their own top spacing.
    <div className="px-6 pt-8">
      <div className="w-full space-y-6 max-w-7xl mx-auto">
        {/* ── Top row: identity (+ logo) · team ────────────────────────────────
            Who you are on the left, the organization's team on the right. The
            organization's logo moved INTO the left identity zone — its old pinned-right
            slot now holds the team panel. The seat meter used to hold the middle
            column — see the note at the top of `Dashboard` for why it no longer does.

            `[minmax(0,1fr)_auto]` gives the identity card all the flexible space while
            the team panel keeps its intrinsic width. `minmax(0, …)` rather than a bare
            `1fr`: `1fr` has an `auto` minimum, so a long name could push the panel out
            of the row instead of truncating inside its own column. Below `lg` the two
            stack, and `items-stretch` (the grid default, stated for intent) plus each
            child's `h-full` keeps the two cards the same height. */}
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
                  {/* Organization logo — moved to the LEFT, with the identity, so the
                      right zone can hold the team panel. Sized down from the old
                      156×104 pin so it reads as a brand mark beside the greeting. */}
                  {userInfo.logo ? (
                    <div className="flex h-14 max-w-[120px] shrink-0 items-center justify-start overflow-hidden">
                      <BrandingImage
                        src={userInfo.logo}
                        alt="Organization logo"
                        className="h-full w-auto object-contain"
                      />
                    </div>
                  ) : null}
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
                      <p className="flex min-w-0 items-center gap-1.5 text-sm font-normal text-muted-foreground">
                        {userInfo.role ? (
                          <span className="shrink-0 rounded-full bg-accent-blue/10 px-2 py-0.5 text-[10px] font-semibold text-accent-blue dark:bg-accent-blue/20">
                            {PRESET_ROLE_LABELS[userInfo.role]}
                          </span>
                        ) : null}
                        <span className="truncate">
                          {userInfo.title || "Advisor"}
                        </span>
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Right zone: the team panel, in the space the logo used to hold.
              Owner/Admin only — the roster is `org_settings` data, the same rule that
              keeps Settings → People & Access off every other role. */}
          {canManageOrg ? <DashboardTeam /> : null}
        </div>

      {/* Quick Actions */}
      <QuickActions actions={visibleQuickActions} />
      
      {/* Quick Insights */}
      <QuickInsights
        insights={quickInsightItems}
        isLoading={isLoadingStats}
        renderDetail={(insight) => {
          switch (insight.id) {
            case "active-plans":
              return <ActivePlansPanel viewerReadOnly={viewerReadOnly} />;
            case "meetings-this-week":
              return <MeetingsThisWeekPanel />;
            case "needs-attention":
              return <NeedsAttentionPanel viewerReadOnly={viewerReadOnly} />;
            default:
              return null;
          }
        }}
      />

      {/* Tasks & Meetings */}
      <TasksAndMeetings
        viewerReadOnly={viewerReadOnly}
        canPublish={canPublish}
      />

      {/* Recent Activity */}
      <RecentActivity />


      </div>
    </div>
  );
}
