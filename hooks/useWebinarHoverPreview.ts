"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hover teaser — hovering a webinar card plays the opening seconds of its video,
 * muted, the way YouTube previews a thumbnail.
 *
 * The teaser's length and embed parameters live in `lib/webinar-video-embed`. This
 * hook decides *when* a teaser starts, which row's payload it needs, and — because a
 * teaser that has to download first is not really a teaser — keeps those payloads
 * warm before the pointer ever arrives.
 */

/**
 * Hover intent. The payload is already warm by now, so this is no longer about
 * hiding a download; it is about not flashing teasers while the pointer sweeps
 * across the grid on its way somewhere else.
 */
const HOVER_PREVIEW_DELAY_MS = 250;

/**
 * Room for a full grid of warm teasers. Each entry is one video's base64, so this
 * cap is what keeps a long list from holding the whole account in memory. Rows past
 * it are simply not preloaded — their teaser still works, it just waits on its
 * download the way it always did.
 */
const PAYLOAD_CACHE_LIMIT = 12;

/**
 * Gap between preload requests. Downloads are serialised rather than fired in
 * parallel: a page of twenty multi-MB videos all starting at once would fight the
 * page's own content for bandwidth and delay the very first card the visitor is
 * likely to hover. Cards are queued in reading order, which is also the order they
 * are likely to be looked at.
 */
const PRELOAD_STAGGER_MS = 200;

/**
 * Fetched payloads, keyed by request URL and shared by every card on the page. A
 * grid renders one hook per card, so this has to live at module scope for the
 * preloader and the hover path to see the same copy — a hover landing mid-preload
 * must not pull the same multi-MB video a second time.
 */
const payloadCache = new Map<string, string>();
/** Downloads in flight, keyed the same way. */
const pendingFetches = new Map<string, Promise<string>>();
/** URLs already sitting in the queue, so re-renders cannot pile duplicates up. */
const queuedPreloads = new Set<string>();
const preloadQueue: string[] = [];
let drainingPreloads = false;

function rememberPayload(endpoint: string, base64: string) {
  payloadCache.delete(endpoint); // Re-insert so the newest entry is the last evicted.
  payloadCache.set(endpoint, base64);
  while (payloadCache.size > PAYLOAD_CACHE_LIMIT) {
    const oldest = payloadCache.keys().next().value;
    if (oldest === undefined) break;
    payloadCache.delete(oldest);
  }
}

/** One download per URL, shared by the preloader and the hover path. */
function fetchVideoPayload(endpoint: string): Promise<string> {
  const cached = payloadCache.get(endpoint);
  if (cached) return Promise.resolve(cached);

  const inFlight = pendingFetches.get(endpoint);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    const base64 = result?.data?.videoFileUrl;

    if (
      !response.ok ||
      !result?.success ||
      typeof base64 !== "string" ||
      !base64
    ) {
      throw new Error(result?.error || "Failed to load video");
    }

    rememberPayload(endpoint, base64);
    return base64;
  })();

  pendingFetches.set(endpoint, promise);
  return promise.finally(() => {
    pendingFetches.delete(endpoint);
  });
}

async function drainPreloadQueue() {
  if (drainingPreloads) return;
  drainingPreloads = true;

  try {
    while (preloadQueue.length > 0) {
      const endpoint = preloadQueue.shift() as string;
      queuedPreloads.delete(endpoint);

      // A hover may have fetched it while it sat in the queue.
      if (payloadCache.has(endpoint)) continue;

      try {
        await fetchVideoPayload(endpoint);
      } catch {
        // A failed preload is not worth reporting: nothing was asked for yet, and
        // the hover path would only swallow the error too.
      }

      if (preloadQueue.length === 0) break;
      await new Promise((resolve) => setTimeout(resolve, PRELOAD_STAGGER_MS));
    }
  } finally {
    drainingPreloads = false;
  }
}

function enqueuePreload(endpoint: string) {
  if (payloadCache.has(endpoint) || queuedPreloads.has(endpoint)) return;
  // Beyond the cache's capacity a preload would immediately evict another card's
  // warmer payload, so it is not queued at all.
  if (payloadCache.size + queuedPreloads.size >= PAYLOAD_CACHE_LIMIT) return;

  queuedPreloads.add(endpoint);
  preloadQueue.push(endpoint);
  void drainPreloadQueue();
}

/** The subset of a webinar row the teaser needs. */
export interface HoverPreviewSubject {
  id: string;
  /** External video URL (YouTube, Vimeo, or a direct file). */
  videoUrl?: string | null;
  /** Base64 payload, when the row already carries one. */
  videoFileUrl?: string | null;
  /**
   * True when an uploaded file exists. List responses report the file's presence
   * without the base64 payload, which is what makes a fetch necessary.
   */
  hasVideoFile?: boolean;
}

/** What `WebinarHoverPreviewLayer` needs to render one card's teaser. */
export interface HoverPreviewState {
  id: string;
  videoUrl: string | null;
  videoFileUrl: string | null;
  isLoading: boolean;
}

interface UseWebinarHoverPreviewOptions {
  /**
   * Endpoint returning `{ data: { videoFileUrl } }` for one row. It differs by
   * surface: the dashboard calls the bare route, while a card on a public portal
   * page has to name the plan so an anonymous visitor is allowed through.
   *
   * Pass a stable function — `useCallback`, or one defined at module scope. The
   * preload path is keyed on it, so a new identity on every render would re-run
   * callers' effects for no reason.
   */
  videoFileEndpoint: (subject: HoverPreviewSubject) => string;
  /**
   * Suppresses the teaser while something else owns the page — a dialog, or the
   * dashboard's select mode.
   */
  suspended?: boolean;
  /**
   * Handed a freshly fetched base64 payload so the caller can keep its own copy.
   * A card that already holds the file then plays it without fetching again.
   */
  onFilePayload?: (id: string, base64: string) => void;
}

/**
 * Drives the hover teaser for a grid of webinar cards. Returns the props to spread
 * onto each card, the state to hand to `WebinarHoverPreviewLayer`, and the preloader
 * that keeps the payloads warm.
 *
 * Only one card previews at a time. Payloads are never pulled from the list response
 * — it deliberately omits them — so they are fetched per row: eagerly by the
 * preloader for the cards on screen, or on demand if a hover beats it there. A
 * failure stays silent, because the visitor asked for nothing yet.
 */
export function useWebinarHoverPreview({
  videoFileEndpoint,
  suspended = false,
  onFilePayload,
}: UseWebinarHoverPreviewOptions) {
  const [preview, setPreview] = useState<HoverPreviewState | null>(null);
  // The row the pointer is on, published so a card can react to a hover before its
  // teaser is playing — the portal fades its play badge out on it.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Pending hover-intent timer, and the row the pointer is on right now. The latter
  // is what tells an in-flight fetch that its card has already been left.
  const timerRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  // Held in a ref so the fetch never has to be rebuilt for a fresh closure.
  const onFilePayloadRef = useRef(onFilePayload);
  onFilePayloadRef.current = onFilePayload;

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Silences the teaser immediately — the pointer, as far as we know, is gone. */
  const stopHoverPreview = useCallback(() => {
    cancelTimer();
    activeIdRef.current = null;
    setHoveredId(null);
    setPreview(null);
  }, [cancelTimer]);

  const startHoverPreview = useCallback(
    async (subject: HoverPreviewSubject) => {
      // A row that already carries its video — an external URL, or a base64 payload
      // this card fetched earlier — needs no request at all.
      const inHand = subject.videoFileUrl
        ? { videoUrl: null, videoFileUrl: subject.videoFileUrl }
        : subject.videoUrl
        ? { videoUrl: subject.videoUrl, videoFileUrl: null }
        : null;

      if (inHand) {
        setPreview({ id: subject.id, ...inHand, isLoading: false });
        return;
      }

      const endpoint = videoFileEndpoint(subject);
      // The preloader's whole purpose: the pointer arrives and the teaser plays.
      const warm = payloadCache.get(endpoint);
      if (warm) {
        setPreview({
          id: subject.id,
          videoUrl: null,
          videoFileUrl: warm,
          isLoading: false,
        });
        return;
      }

      setPreview({
        id: subject.id,
        videoUrl: null,
        videoFileUrl: null,
        isLoading: true,
      });

      try {
        const base64 = await fetchVideoPayload(endpoint);
        onFilePayloadRef.current?.(subject.id, base64);

        // The response must not light up a card the visitor has already left.
        if (activeIdRef.current === subject.id) {
          setPreview({
            id: subject.id,
            videoUrl: null,
            videoFileUrl: base64,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error("Failed to load hover preview:", error);
        // Only clear what this request owns — a newer hover must not be torn down
        // by a stale failure.
        if (activeIdRef.current === subject.id) setPreview(null);
      }
    },
    [videoFileEndpoint],
  );

  /**
   * Warms the teasers for the rows given, so the first hover on each plays straight
   * away instead of waiting on a multi-MB download. Call it as soon as a grid has
   * its rows; repeat calls are free, since everything already cached, in flight, or
   * queued is skipped.
   */
  const preloadHoverPreviews = useCallback(
    (subjects: HoverPreviewSubject[]) => {
      for (const subject of subjects) {
        // Only uploaded files need a request; an external URL is already in hand.
        if (subject.videoUrl || subject.videoFileUrl || !subject.hasVideoFile) {
          continue;
        }
        enqueuePreload(videoFileEndpoint(subject));
      }
    },
    [videoFileEndpoint],
  );

  // Anything that takes over the page must silence the teaser, since the pointer
  // may never leave the card it is resting on.
  useEffect(() => {
    if (suspended) stopHoverPreview();
  }, [suspended, stopHoverPreview]);

  // A pending hover-intent timer must not outlive the component.
  useEffect(() => cancelTimer, [cancelTimer]);

  /**
   * Spread onto the element whose hover should start the teaser. A row with nothing
   * to play, or a page where the teaser is suspended, never arms the timer.
   */
  const getHoverProps = useCallback(
    (subject: HoverPreviewSubject) => ({
      onMouseEnter: () => {
        if (suspended) return;
        if (!subject.videoUrl && !subject.videoFileUrl && !subject.hasVideoFile)
          return;

        setHoveredId(subject.id);
        activeIdRef.current = subject.id;
        cancelTimer();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          void startHoverPreview(subject);
        }, HOVER_PREVIEW_DELAY_MS);
      },
      onMouseLeave: stopHoverPreview,
    }),
    [cancelTimer, startHoverPreview, stopHoverPreview, suspended],
  );

  /**
   * The teaser for one card, or null when it is another card's turn. This is what
   * keeps a single preview from rendering on every card in the grid.
   */
  const previewFor = useCallback(
    (id: string) => (preview && preview.id === id ? preview : null),
    [preview],
  );

  return {
    preview,
    previewFor,
    hoveredId,
    getHoverProps,
    preloadHoverPreviews,
    stopHoverPreview,
  };
}
