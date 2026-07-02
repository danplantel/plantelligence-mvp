"use client";

import { useClientPortal } from "@/contexts/client-portal-context";
import { WebinarsDashboard } from "@/components/pages/client-portal/sections/webinars-dashboard";
import { NewsEventsHeader } from "@/components/pages/client-portal/sections/news-events-header";
import { NewsEventsResources } from "@/components/pages/client-portal/sections/news-events-resources";
import { NewsPostList } from "@/components/pages/client-portal/sections/news-post-list";

export default function NewsEventsPage() {
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";
  const clientId = clientData?.id;

  return (
    <div className="min-h-screen bg-white">
      <main>
        <NewsEventsHeader />

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
