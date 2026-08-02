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

  // Resolve the Secondary Banner image (uploaded in wizard Step 1 → Brand Images)
  // as the background image for the News & Events header. Falls back to the
  // default static banner when no custom image has been uploaded.
  const { url: resolvedSecondaryBannerUrl } = useBrandingImageUrl(
    clientData?.secondaryBannerImg ?? null,
  );

  return (
    <div className="min-h-screen bg-white">
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

        <NewsEventsResources
          brandColor={brandColor}
          secondaryColor={secondaryColor}
        />
      </main>
    </div>
  );
}
