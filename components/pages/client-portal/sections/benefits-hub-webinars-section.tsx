"use client";

import { useEffect, useState } from "react";
import { useClientPortal } from "@/contexts/client-portal-context";
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
  const { clientData } = useClientPortal();

  // The plan id comes from the portal context, NOT the route segment: portal URLs
  // are slugs (`/{plan-slug}`), while stored webinars reference the plan's
  // ObjectId. Comparing a slug against `webinar.clientId` matched nothing, which is
  // why this section rendered empty. The News & Events section reads the same id.
  const planId = clientData?.id;

  const [replays, setReplays] = useState<WebinarReplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!planId) {
        setReplays([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // `placement` is filtered server-side, so this section never receives the
        // other pages' video payloads.
        const response = await fetch(
          `/api/webinars?clientId=${encodeURIComponent(
            planId,
          )}&placement=${encodeURIComponent(placement)}`,
          { cache: "no-store" },
        );
        const result = await response.json();

        if (cancelled) return;

        if (response.ok && result.success && Array.isArray(result.data)) {
          // The endpoint is advisor-scoped; keep only this plan's videos.
          const filtered = result.data.filter(
            (webinar: any) => webinar.clientId === planId,
          );

          setReplays(
            filtered.map((webinar: any) => ({
              id: webinar.id,
              title: webinar.webinarTitle,
              eventDate: webinar.eventDate,
              thumbnail: webinar.thumbnail ?? undefined,
              videoUrl: webinar.videoUrl,
              videoFileUrl: webinar.videoFileUrl,
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
  }, [planId, placement]);

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
