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
} from "./videos-card-section";
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

/** Placeholders while the row loads — the same four-card reservation the rail makes. */
const SKELETON_CARDS = 4;

/**
 * Width of one slide in the four-column rail.
 *
 * The rail is still one horizontal track, but its cards follow the same
 * count-driven width system as `supportCardColumnClass`: every card in the row
 * is the SAME size and the row fills its width.
 *
 *   1 video  → half the row (two of four columns), centred
 *   2 videos → halves
 *   3 videos → thirds
 *   4+       → quarters; a fifth starts the next page of the rail
 *
 * On a PHONE every card is 86% wide, not full width. That deliberate sliver is
 * the whole affordance: the next poster's edge stays on screen, so the row
 * reads as continuing sideways even though the scrollbar is hidden and the
 * paging arrows live in the (often off-screen) heading. A full-width card
 * looked like the only video the plan had.
 *
 * Written as static strings (not an interpolated `w-[…/n]`) so Tailwind can see
 * every class it has to generate.
 */
function slideWidthClass(count: number): string {
  const stacked = "w-[86%] shrink-0 sm:w-[calc((100%-1.25rem)/2)]";
  if (count <= 0) return stacked;
  // One or two videos: half each. A lone card is centred by the track.
  if (count <= 2) {
    return `${stacked} lg:w-[calc((100%-1.25rem)/2)]`;
  }
  // Three videos: equal thirds — no wide card, no small pair.
  if (count === 3) {
    return `${stacked} lg:w-[calc((100%-2.5rem)/3)]`;
  }
  // Four or more: one column each. The fifth starts the next rail page.
  return `${stacked} lg:w-[calc((100%-3.75rem)/4)]`;
}

function WebinarCardSkeleton() {
  return (
    <div className="w-[86%] shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3.75rem)/4)]">
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
/** Epoch millis for a row's upload time; 0 when the payload does not say. */
function uploadTime(value: Date | string | undefined): number {
  if (!value) return 0;
  const time =
    value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(time) ? time : 0;
}

export function useHubVideos(
  placement: WebinarPlacementKey,
  clientId?: string,
  /**
   * Skip the read when the host already has the rows (the News & Events band
   * fetches meetings and replays together and hands the replays to the rail).
   */
  skip = false,
) {
  const params = useParams();
  const planRef =
    (typeof clientId === "string" && clientId) ||
    (typeof params?.id === "string" ? params.id : "");

  const [replays, setReplays] = useState<WebinarReplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (skip) {
      setIsLoading(false);
      return;
    }
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
          const mapped: WebinarReplay[] = result.data.map((webinar: any) => ({
            id: webinar.id,
            clientId: webinar.clientId,
            title: webinar.webinarTitle,
            description: webinar.description ?? undefined,
            // Stored runtime from the upload form / backfill. The card measures
            // the file itself only when this is missing.
            duration: webinar.duration ?? undefined,
            eventDate: webinar.eventDate,
            createdAt: webinar.createdAt,
            thumbnail: webinar.thumbnail ?? undefined,
            videoUrl: webinar.videoUrl,
            hasVideoFile: Boolean(webinar.hasVideoFile),
            language: guessLanguageFromWebinar(webinar),
          }));

          // Newest upload first. The API orders by `eventDate` (what the News &
          // Events band wants), which is not what "latest video" means here — the
          // rail shows the videos in the order the advisor added them. Equal
          // timestamps keep the server's order, since `sort` is stable.
          mapped.sort(
            (a, b) => uploadTime(b.createdAt) - uploadTime(a.createdAt),
          );

          setReplays(mapped);
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
  }, [planRef, placement, skip]);

  return { replays, isLoading };
}

interface VideoCarouselProps {
  /** Which portal page's videos to show (see `lib/webinar-placements`). */
  placement: WebinarPlacementKey;
  /** Plan identifier for hosts with no `[id]` route segment (the preview). */
  clientId?: string;
  /**
   * Rows the HOST already fetched. When present the rail does not fetch again —
   * the News & Events band reads its replays alongside its meetings and passes
   * them here so one page makes one request.
   */
  replays?: WebinarReplay[] | null;
  /** The host's loading state for `replays`. */
  isLoading?: boolean;
  brandColor?: string;
  secondaryColor?: string;
  /**
   * The heading's colour. Defaults to the plan's brand colour; a dark host (the
   * journey section) passes white, since the brand colour is usually dark too.
   */
  headingColor?: string;
  /**
   * The rail's heading. The journey section passes "<Benefit Category> Essentials";
   * "Videos" is the neutral fallback for a host that has no category.
   */
  title?: string;
  /** Extra classes on the rail's root (e.g. `mt-0` inside a dark host band). */
  className?: string;
  /**
   * The colour of the description printed under each poster card. Defaults to
   * the heading colour, which is right on the dark journey section; the News &
   * Events host passes a dark grey because its rail sits on white.
   */
  captionColor?: string;
  /**
   * Hand a picked video to the host instead of letting the card open its own
   * dialog. The journey section uses it to play the video inline, at the top of
   * the section.
   */
  onSelect?: (replay: WebinarReplay) => void;
  /** The video the host is currently playing, so the rail can mark it. */
  activeId?: string | number | null;
}

export function VideoCarousel({
  placement,
  clientId,
  brandColor = "#002B5B",
  secondaryColor = "#FBBF24",
  headingColor,
  title = "Videos",
  captionColor,
  className,
  onSelect,
  activeId,
  replays: providedReplays,
  isLoading: providedLoading,
}: VideoCarouselProps) {
  const { replays: fetchedReplays, isLoading: fetchedLoading } = useHubVideos(
    placement,
    clientId,
    providedReplays != null,
  );
  const items = providedReplays ?? fetchedReplays;
  const loading =
    providedReplays != null ? Boolean(providedLoading) : fetchedLoading;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  /**
   * Whether the row actually runs off the edge.
   *
   * Four cards fill a 1280px column exactly once they are quarter-width (the
   * count-driven width system above), so a plan with up to four videos has
   * nothing to page to — the chevrons are hidden rather than shown permanently
   * disabled. Measured, not counted: the visible count changes with the viewport.
   */
  const [isScrollable, setIsScrollable] = useState(false);

  /** Arrow availability follows the track's real position, not a card count. */
  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Rounded off: sub-pixel layout can leave a 1px overflow nobody can scroll to.
    setIsScrollable(el.scrollWidth - el.clientWidth > 4);
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
  }, [updateArrows, items.length, loading]);

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
  if (!loading && items.length === 0) return null;

  const arrowClass =
    "grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-default disabled:opacity-30";

  return (
    <div
      className={cn("mt-14", className)}
      data-testid="video-carousel"
      data-placement={placement}
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3
            data-testid="rail-title"
            className="font-dm-serif text-xl leading-tight sm:text-2xl"
            style={{ color: headingColor || brandColor }}
          >
            {title}
          </h3>
          {/* How many videos the row holds. Nothing until the fetch answers, so it
              never flashes "0 videos" at a plan that has some. */}
          {loading ? null : (
            <span
              data-testid="rail-count"
              className="font-red-hat text-sm opacity-70"
              style={{ color: headingColor || brandColor }}
            >
              {items.length} {items.length === 1 ? "video" : "videos"}
            </span>
          )}
        </div>

        {/* Paging controls. Hidden on a phone, where the row is swiped, and gone
            entirely when the row does not overflow (four or fewer videos). */}
        {loading || !isScrollable ? null : (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label="Scroll videos left"
              onClick={() => page(-1)}
              disabled={!canScrollLeft}
              className={arrowClass}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Scroll videos right"
              onClick={() => page(1)}
              disabled={!canScrollRight}
              className={arrowClass}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* The track and, on phones only, its floating paging controls. The
          next card's sliver already says "there is more"; these make that
          tappable where the heading's arrows are off-screen or too small to
          reach. They are OUTSIDE the scroller so they stay put while it moves. */}
      <div className="relative">
        <div
          ref={scrollerRef}
          data-testid="video-carousel-track"
          aria-busy={loading || undefined}
          // `snap-x` + one snap point per card is what makes it feel like a rail
          // rather than a free-scrolling list. The scrollbar is hidden in every
          // engine (the visible next card, the phone chevrons and the heading's
          // arrows are the affordance).
          className={cn(
            "flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // A lone video is half-width, so centre it rather than hugging the
            // left edge (the same choice the support-card row makes).
            !loading && items.length === 1 && "justify-center",
          )}
        >
          {loading ? (
            <>
              <span className="sr-only">Loading videos…</span>
              {Array.from({ length: SKELETON_CARDS }).map((_, index) => (
                <WebinarCardSkeleton key={index} />
              ))}
            </>
          ) : (
            items.map((replay) => {
              const isActive =
                activeId != null && String(activeId) === String(replay.id);
              return (
                <div
                  key={replay.id}
                  data-testid="video-slide"
                  data-active={isActive || undefined}
                  aria-current={isActive ? "true" : undefined}
                  // Count-driven width: every card in the row shares the same width,
                  // so three videos are three equal thirds rather than a wide card
                  // beside two small ones. No ring here: it sits outside the box
                  // (clipped at the top by this scroll container) and would wrap the
                  // caption too — the card draws its own inset border on the thumbnail.
                  className={cn("snap-start", slideWidthClass(items.length))}
                >
                  {/* The poster variant: the card itself is the 16:9 frame, with the
                    play control top-right and the title + runtime along the bottom.
                    The description therefore sits under the card. */}
                  <WebinarReplayCard
                    replay={replay}
                    secondaryColor={secondaryColor}
                    variant="poster"
                    onSelect={onSelect}
                    active={isActive}
                  />
                  {replay.description ? (
                    <p
                      className="mt-2 line-clamp-2 text-xs leading-snug opacity-80"
                      style={{
                        color: captionColor || headingColor || brandColor,
                      }}
                    >
                      {replay.description}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Each control exists only while there is something that way, so there
            is never a disabled ghost. `sm:hidden` keeps them off tablet/desktop,
            where the heading's arrows are visible. */}
        {!loading && isScrollable && canScrollLeft ? (
          <button
            type="button"
            aria-label="Show previous videos"
            onClick={() => page(-1)}
            className="absolute left-1 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-md transition-colors hover:bg-white sm:hidden"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        {!loading && isScrollable && canScrollRight ? (
          <button
            type="button"
            aria-label="Show more videos"
            onClick={() => page(1)}
            className="absolute right-1 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-md transition-colors hover:bg-white sm:hidden"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
