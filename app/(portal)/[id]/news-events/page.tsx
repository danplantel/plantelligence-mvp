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
  // The "Secondary Banner" Brand Images slot — selected in the Create Plan wizard
  // or in Edit Client — is this page's header background. When it was never
  // selected we pass nothing through, so NewsEventsHeader renders its bundled
  // default (`/news-events-default-bg.webp`).
  //
  // Resolved through useBrandingImageUrl because the stored value can be an R2
  // key (`org/…`) as well as an absolute/data URL; a bare key would otherwise be
  // requested as the relative path /org/… and 404.
  const { url: resolvedSecondaryBannerUrl } = useBrandingImageUrl(
    (clientData?.secondaryBannerImg || "").trim() || null,
  );

  return (
    <div className="min-h-screen pb-10 bg-white">
      <main>
        <NewsEventsHeader
          backgroundImage={resolvedSecondaryBannerUrl ?? undefined}
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

        {/* <NewsEventsResources
          brandColor={brandColor}
          secondaryColor={secondaryColor}
        /> */}
      </main>
    </div>
  );
}
