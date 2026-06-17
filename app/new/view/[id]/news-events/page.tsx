"use client";

import { useClientPortal } from "@/contexts/client-portal-context";
import { WebinarsDashboard } from "@/components/pages/client-portal/sections/webinars-dashboard";
import { NewsEventsHeader } from "@/components/pages/client-portal/sections/news-events-header";
import { NewsEventsAnnouncements } from "@/components/pages/client-portal/sections/news-events-announcements";
import { NewsEventsResources } from "@/components/pages/client-portal/sections/news-events-resources";

export default function NewsEventsPage() {
  const { clientData } = useClientPortal();
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";
  const clientId = clientData?.id;

  return (
    <div className="min-h-screen bg-white">
      <main>
        <NewsEventsHeader />

        {/* <NewsEventsAnnouncements
          brandColor={brandColor}
          secondaryColor={secondaryColor}
        /> */}

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
