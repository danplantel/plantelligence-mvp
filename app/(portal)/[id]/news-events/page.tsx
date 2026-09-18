"use client";

import { useClientPortal } from "@/contexts/client-portal-context";
import { WebinarsDashboard } from "@/components/pages/client-portal/sections/webinars-dashboard";
import { NewsEventsHeader } from "@/components/pages/client-portal/sections/news-events-header";
import { NewsEventsResources } from "@/components/pages/client-portal/sections/news-events-resources";
import { NewsPostList } from "@/components/pages/client-portal/sections/news-post-list";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";

export default function NewsEventsPage() {
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";
  const clientId = clientData?.id;

  // Background for the News & Events header.
  //
  // The "Secondary Banner" Brand Images slot is documented as this page's header
  // background, so it wins when set. Otherwise fall back to the plan's hero
  // background (`backgroundImg`, the "Header Background" slot that every other
  // portal hero uses) before letting the header show its static default — an
  // advisor who only set the Header slot still gets a real banner here instead
  // of a generic one.
  //
  // Resolved through useBrandingImageUrl because the value can be an R2 key
  // (`org/…`) as well as an absolute/data URL; a bare key would otherwise be
  // requested as the relative path /org/… and 404.
  const heroBackgroundSource =
    (clientData?.secondaryBannerImg || "").trim() ||
    (clientData?.backgroundImg || "").trim();

  const { url: resolvedHeroBackgroundUrl } = useBrandingImageUrl(
    heroBackgroundSource || null,
  );

  return (
    <div className="min-h-screen bg-white">
      <main>
        <NewsEventsHeader
          backgroundImage={resolvedHeroBackgroundUrl ?? undefined}
        />

        {/* Published news posts from Marketing */}
        <NewsPostList
          clientId={clientId}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
        />

        <WebinarsDashboard
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
        />

        <NewsEventsResources
          brandColor={brandColor}
          secondaryColor={secondaryColor}
        />
      </main>
    </div>
  );
}
