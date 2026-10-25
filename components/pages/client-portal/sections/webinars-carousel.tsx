"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  WebinarReplayCard,
  guessLanguageFromWebinar,
  type WebinarReplay,
} from "./webinars-section";
import type { WebinarPlacementKey } from "@/lib/webinar-placements";

/**
 * The hub pages' videos — a Netflix-style row.
 *
 * This used to be its own band (`BenefitsHubWebinarsSection`, a three-up grid)
 * sitting between the help grid and the FAQ. It now rides along the bottom of
 * "How Can We Help You Today?", as one horizontal rail: the row scrolls sideways
 * with snap points, and the chevrons page through it. That keeps a page with ten
 * videos from pushing the FAQ and the support contacts a screen further down.
 *
 * Everything the band did is preserved here, because the card is the same one:
 * `WebinarReplayCard` opens the video, fetches its file on play, and handles the
 * hover teaser. The fetch below is the band's own, moved alongside it.
 */

/** Placeholders while the row loads — the same three-card reservation the grid made. */
const SKELETON_CARDS = 4;

function WebinarCardSkeleton() {
  return (
    <div className="w-[260px] shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:w-[300px]">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-6 w-4/5" />
        <div className="space-y-1">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

/**
 * Load the videos published to one portal page.
 *
 * The plan identifier comes from the route segment (known on the first render, so
 * the request does not wait on the portal context's own profile request) or from
 * the `clientId` prop, which is what the dashboard preview passes — it has no
 * `[id]` segment. Both filters run server-side; `includeVideoFiles=0` keeps the
 * multi-MB video payloads out of the list (the card fetches one on play).
 */
export function useHubWebinars(
  placement: WebinarPlacementKey,
  clientId?: string,
) {
  const params = useParams();
  const planRef =
    (typeof clientId === "string" && clientId) ||
    (typeof params?.id === "string" ? params.id : "");

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

  return { replays, isLoading };
}

interface WebinarsCarouselProps {
  /** Which portal page's videos to show (see `lib/webinar-placements`). */
  placement: WebinarPlacementKey;
  /** Plan identifier for hosts with no `[id]` route segment (the preview). */
  clientId?: string;
  brandColor?: string;
  secondaryColor?: string;
  /**
   * The heading's colour. Defaults to the plan's brand colour; a dark host (the
   * journey section) passes white, since the brand colour is usually dark too.
   */
  headingColor?: string;
  title?: string;
}

export function WebinarsCarousel({
  placement,
  clientId,
  brandColor = "#002B5B",
  secondaryColor = "#FBBF24",
  headingColor,
  title = "Webinars",
}: WebinarsCarouselProps) {
  const { replays, isLoading } = useHubWebinars(placement, clientId);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /** Arrow availability follows the track's real position, not a card count. */
  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, replays.length, isLoading]);

  const page = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // One "page" leaves a card and a half visible, the way a streaming rail does,
    // so the reader can see that the row continues in that direction.
    el.scrollBy({
      left: direction * Math.round(el.clientWidth * 0.85),
      behavior: "smooth",
    });
  };

  // Nothing at all for a plan that has filed no videos — an empty rail is worse
  // than no rail. The loading skeletons still reserve the row's height.
  if (!isLoading && replays.length === 0) return null;

  const arrowClass =
    "grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-default disabled:opacity-30";

  return (
    <div
      className="mt-14"
      data-testid="webinars-carousel"
      data-placement={placement}
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <h3
          className="font-dm-serif text-xl leading-tight sm:text-2xl"
          style={{ color: headingColor || brandColor }}
        >
          {title}
        </h3>

        {/* Paging controls. Hidden on a phone, where the row is swiped. */}
        {isLoading ? null : (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label="Scroll webinars left"
              onClick={() => page(-1)}
              disabled={!canScrollLeft}
              className={arrowClass}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Scroll webinars right"
              onClick={() => page(1)}
              disabled={!canScrollRight}
              className={arrowClass}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        data-testid="webinars-carousel-track"
        aria-busy={isLoading || undefined}
        // `snap-x` + one snap point per card is what makes it feel like a rail
        // rather than a free-scrolling list. The scrollbar is hidden in every
        // engine (the arrows and the visible next card are the affordance).
        className={cn(
          "flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {isLoading ? (
          <>
            <span className="sr-only">Loading videos…</span>
            {Array.from({ length: SKELETON_CARDS }).map((_, index) => (
              <WebinarCardSkeleton key={index} />
            ))}
          </>
        ) : (
          replays.map((replay) => (
            <div
              key={replay.id}
              data-testid="webinar-slide"
              // One fixed width per slide, so the row reads as a filmstrip and
              // the card inside never has to guess its own size.
              className="w-[260px] shrink-0 snap-start sm:w-[300px]"
            >
              <WebinarReplayCard
                replay={replay}
                secondaryColor={secondaryColor}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
