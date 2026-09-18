"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  WebinarReplayCard,
  guessLanguageFromWebinar,
  type WebinarReplay,
} from "./webinars-section";
import type { WebinarPlacementKey } from "@/lib/webinar-placements";

interface BenefitsHubWebinarsSectionProps {
  /** Which portal page's videos to show (see `lib/webinar-placements`). */
  placement: WebinarPlacementKey;
  brandColor?: string;
  secondaryColor?: string;
  /** Heading shown above the grid. */
  title?: string;
}

/**
 * The "Webinars" section for a benefit hub page (Retirement, Health Insurance,
 * Life Insurance, Wellness Programs).
 *
 * Distinct from the News & Events `WebinarsSection`, which also renders plan
 * *meetings* and splits everything into upcoming/past/replays — a hub page wants
 * only the videos published to it, as one grid. Videos are assigned to a page in
 * Communications → Webinars, so this is a read-only view of that choice.
 *
 * Renders nothing while loading or when the page has no videos, so a plan that
 * hasn't filed any doesn't get an empty band in the middle of its page.
 */
export function BenefitsHubWebinarsSection({
  placement,
  brandColor = "#002B5B",
  secondaryColor = "#FBBF24",
  title = "Webinars",
}: BenefitsHubWebinarsSectionProps) {
  // Take the plan identifier from the route segment, which is known on the very
  // first render. The portal context's `clientData` only arrives after its own
  // profile request resolves, so waiting for it pushed this section's fetch to the
  // end of a waterfall — that, together with the video payloads, is why the band
  // appeared seconds after the rest of the page. Portal URLs carry the plan slug
  // and the API accepts a slug or an ObjectId, so the segment is enough here.
  const params = useParams();
  const planRef = typeof params?.id === "string" ? params.id : "";

  const [replays, setReplays] = useState<WebinarReplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!planRef) {
        setReplays([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Both filters run server-side. `includeVideoFiles=0` is the important one:
        // without it this response carried every video's multi-MB base64 string, so
        // a visitor waited for the whole account's videos before a single card
        // appeared. `WebinarReplayCard` fetches a video's file only when play is
        // pressed.
        const response = await fetch(
          `/api/webinars?clientId=${encodeURIComponent(
            planRef,
          )}&placement=${encodeURIComponent(placement)}&includeVideoFiles=0`,
          { cache: "no-store" },
        );
        const result = await response.json();

        if (cancelled) return;

        if (response.ok && result.success && Array.isArray(result.data)) {
          // No client-side filtering: the response is already narrowed to this plan
          // by the server, and the identifier we sent may be a slug, which would
          // never equal a row's `clientId` ObjectId.
          setReplays(
            result.data.map((webinar: any) => ({
              id: webinar.id,
              clientId: webinar.clientId,
              title: webinar.webinarTitle,
              description: webinar.description ?? undefined,
              eventDate: webinar.eventDate,
              thumbnail: webinar.thumbnail ?? undefined,
              videoUrl: webinar.videoUrl,
              hasVideoFile: Boolean(webinar.hasVideoFile),
              language: guessLanguageFromWebinar(webinar),
            })),
          );
        } else {
          setReplays([]);
        }
      } catch (error) {
        console.error("Failed to load hub webinars:", error);
        if (!cancelled) setReplays([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [planRef, placement]);

  if (isLoading || replays.length === 0) return null;

  return (
    <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h2
          className="font-dm-serif text-center text-2xl sm:text-[40px] font-normal leading-tight"
          style={{ color: brandColor }}
        >
          {title}
        </h2>

        {/*
          Deliberately start-aligned at every count, including a lone card.
          With 4 videos the last one already sits alone at the left of row 2 and
          can't be centered without breaking the grid, so centering a
          single-video page would be the same visual situation treated two ways.
          It also keeps the card's own left-aligned content on the page's left
          gutter, and matches the News & Events grid that renders the same card.
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {replays.map((replay) => (
            <WebinarReplayCard
              key={replay.id}
              replay={replay}
              secondaryColor={secondaryColor}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
