"use client";

import { Card, CardContent } from "@/components/ui/card";
import { QuickActions } from "@/components/ui/quick-actions";
import { DashboardPanels } from "@/components/ui/dashboard-panels";
import { ResetOnboardingButton } from "@/components/ui/reset-onboarding-button";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect, useState } from "react";
import { Headshot } from "@/components/ui/headshot";
import { BrandingImage } from "@/components/ui/branding-image";
import axios from "axios";
import {
  demoStats as defaultDemoStats,
  quickActions,
  userInfo as defaultUserInfo,
} from "./dashboard.funcs";

export function Dashboard() {
  const { setTitle } = usePageTitleContext();

  const [userInfo, setUserInfo] = useState(defaultUserInfo);
  const [demoStats, setDemoStats] = useState(defaultDemoStats);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(true);

  useEffect(() => {
    setTitle("Dashboard");
  }, [setTitle]);

  // Load user data from profile API
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoadingUserInfo(true);
        const response = await axios.get("/api/profile");
        const profile = response.data;

        const wizardSession = profile.wizardSessions?.[0];
        const userSetup = wizardSession?.userSetup;
        const branding = wizardSession?.branding;

        const newUserInfo = {
          name: userSetup?.name || profile.name || "User",
          title: userSetup?.title || profile.title || "Advisor",
          logo: branding?.logo || profile.advisorLogoUrl || "/logo-2.png",
          avatar:
            branding?.aiAvatar ||
            userSetup?.headshotData?.avatar?.["64"] ||
            userSetup?.headshotData?.circle?.["400"] ||
            userSetup?.headshotData?.square?.["400"] ||
            userSetup?.headshot ||
            profile.headshot ||
            "",
        };

        setUserInfo(newUserInfo);
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setIsLoadingUserInfo(false);
      }
    };

    loadUserData();
  }, []);

  // Fetch real dashboard stats
  useEffect(() => {
    async function fetchDashboardStats() {
      try {
        setIsLoadingStats(true);
        const response = await axios.get("/api/dashboard/stats");
        const stats = response.data.data;

        // Filter out stats with 0 values (only for plans and meetings)
        const filteredStats = defaultDemoStats.filter((stat) => {
          switch (stat.title) {
            case "Active Plans":
              return stats.activePlans > 0;
            case "Upcoming Meetings":
              return stats.upcomingMeetings > 0;
            default:
              return true; // Keep all other stats
          }
        });

        // Update stats with real values (only for plans and meetings)
        const updatedStats = filteredStats.map((stat) => {
          switch (stat.title) {
            case "Active Plans":
              return { ...stat, value: stats.activePlans };
            case "Upcoming Meetings":
              return { ...stat, value: stats.upcomingMeetings };
            default:
              return stat; // Keep original values for other stats
          }
        });

        setDemoStats(updatedStats);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
        // Keep default stats on error
      } finally {
        setIsLoadingStats(false);
      }
    }

    fetchDashboardStats();
  }, []);

  return (
    <div className="px-10 py-4 space-y-6">
      <Card className="px-6 py-[30px]">
        <CardContent className="flex justify-between items-center gap-4 p-0">
          <div className="flex items-center gap-4">
            {isLoadingUserInfo ? (
              <div className="flex items-center gap-4">
                {/* Logo skeleton */}
                <div className="animate-pulse">
                  <div className="w-[120px] h-[80px] bg-gray-200 rounded"></div>
                </div>

                {/* Avatar skeleton */}
                <div className="animate-pulse">
                  <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
                </div>

                {/* Text skeleton */}
                <div className="animate-pulse space-y-2">
                  <div className="w-48 h-6 bg-gray-200 rounded"></div>
                  <div className="w-24 h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            ) : (
              <>
                {userInfo.logo && (
                  <div className="w-[120px] h-[80px] flex items-center justify-center overflow-hidden rounded">
                    <BrandingImage
                      src={userInfo.logo}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <section className="flex gap-4 items-center">
                  <div className="size-16 rounded-full overflow-hidden flex-shrink-0 border border-border">
                    <Headshot
                      src={userInfo.avatar || undefined}
                      monogramName={userInfo.name}
                      alt="Avatar"
                    />
                  </div>
                  <section>
                    <h4 className="text-xl font-semibold">
                      Welcome back, {userInfo.name}!
                    </h4>
                    <p className="text-sm text-muted-foreground font-regular">
                      {userInfo.title || "Advisor"}
                    </p>
                  </section>
                </section>
              </>
            )}
            <div className="ml-auto">
              <ResetOnboardingButton />
            </div>
          </div>

          <div className="flex gap-4">
            {isLoadingStats ? (
              <div className="flex gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex gap-2">
                      <div className="w-6 h-6 bg-gray-200 rounded"></div>
                      <div className="w-8 h-6 bg-gray-200 rounded"></div>
                    </div>
                    <div className="w-20 h-4 bg-gray-200 rounded mt-1"></div>
                  </div>
                ))}
              </div>
            ) : (
              demoStats.map((stat) => (
                <section key={stat.title}>
                  <section
                    className={`flex gap-2 font-semibold text-xl ${stat.color}`}
                  >
                    <stat.icon />
                    {stat.value}
                  </section>
                  <p className="text-sm text-muted-foreground font-normal">
                    {stat.title}
                  </p>
                </section>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <QuickActions actions={quickActions} />
      <DashboardPanels />
    </div>
  );
}
