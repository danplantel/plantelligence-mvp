"use client";

import { VideosCardSection } from "./videos-card-section";

interface WebinarSectionProps {
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  enableEditing?: boolean;
}

/**
 * The News & Events page's webinar/meetings section.
 *
 * A thin host around [`VideosCardSection`](videos-card-section.tsx:1074) — the
 * page owns the header and the news posts; this is the band beneath them. Its
 * webinar replays render in the same poster rail (and count-driven card widths)
 * as the benefit hubs' video section, on this page's white surface.
 */
export function WebinarSection({
  brandColor,
  secondaryColor,
  clientId,
}: WebinarSectionProps) {
  return (
    <VideosCardSection
      brandColor={brandColor}
      secondaryColor={secondaryColor}
      clientId={clientId}
    />
  );
}
