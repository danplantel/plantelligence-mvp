"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

/** Placeholders shown while the videos load — one full row at `lg`. */
const SKELETON_CARDS = 3;

/**
 * Placeholder mirroring `WebinarReplayCard`: media, title, the fixed-height
 * description box, then the details row. Reserving that space is the whole point —
 * this band used to render nothing and then push everything below it down.
 */
function WebinarCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-4 p-6">
        <Skeleton className="h-7 w-4/5" />
        {/* Four lines to match the card's fixed 80px description box. */}
        <div className="space-y-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
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
 * While its videos load it shows a skeleton shaped like the real cards, so the band
 * reserves its height instead of shoving the page down when the cards arrive. A plan
 * that hasn't filed any videos renders nothing at all rather than an empty band.
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

  // Nothing at all for a plan that has filed no videos — an empty band in the
  // middle of the page is worse than no band.
  if (!isLoading && replays.length === 0) return null;

  return (
    <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h2
          className="font-dm-serif text-center text-2xl sm:text-[40px] font-normal leading-tight"
          style={{ color: brandColor }}
        >
          {title}
        </h2>

        {isLoading ? (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            aria-busy="true"
          >
            <span className="sr-only">Loading videos…</span>
            {Array.from({ length: SKELETON_CARDS }).map((_, index) => (
              <WebinarCardSkeleton
                key={index}
                // Third placeholder only exists in the three-column layout; on a
                // phone it would just be a long stack of grey boxes.
                className={index === 2 ? "hidden lg:block" : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {replays.map((replay) => (
              <WebinarReplayCard
                key={replay.id}
                replay={replay}
                secondaryColor={secondaryColor}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
