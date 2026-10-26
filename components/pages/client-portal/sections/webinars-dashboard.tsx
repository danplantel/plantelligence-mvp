"use client";

import { VideosCardSection } from "./videos-card-section";

interface WebinarsDashboardProps {
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  enableEditing?: boolean;
}

export function WebinarsDashboard({
  brandColor,
  secondaryColor,
  clientId,
  enableEditing = false,
}: WebinarsDashboardProps) {
  return (
    <>
      <VideosCardSection
        brandColor={brandColor}
        secondaryColor={secondaryColor}
        clientId={clientId}
      />
    </>
  );
}
