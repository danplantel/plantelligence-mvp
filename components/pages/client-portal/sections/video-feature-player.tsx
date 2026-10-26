"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getEmbedUrl, type WebinarReplay } from "./videos-card-section";

/**
 * The video a visitor picked from the section's videos rail, playing in place of
 * the journey section's two-column intro.
 *
 * It is a sibling of `WebinarReplayCard`, not a reuse of its dialog: the card pops
 * a centred modal over the grid, whereas this one replaces the section's own top
 * half and runs edge to edge, with the rail left underneath so another video can
 * be picked without closing this one first.
 *
 * Resolution order matches the card: an embeddable URL (YouTube/Vimeo) plays in an
 * iframe, a direct file URL in a `<video>`, and an uploaded file is fetched from
 * `/api/webinars/[id]` — the list endpoints deliberately omit the multi-MB base64,
 * so the payload is only ever downloaded for the video actually being watched.
 */
interface VideoFeaturePlayerProps {
  replay: WebinarReplay;
  /**
   * The plan whose page this is. An anonymous visitor's request is authorised by
   * it: the endpoint derives the owning advisor from the plan and then requires
   * the webinar to belong to that plan.
   */
  clientId?: string;
  /** Accent colour, used on the close control's hover ring. */
  secondaryColor?: string;
  /** Runs the X (and Escape): the host puts its two-column intro back. */
  onClose: () => void;
}

export function VideoFeaturePlayer({
  replay,
  clientId,
  secondaryColor = "#C89B5B",
  onClose,
}: VideoFeaturePlayerProps) {
  /** The uploaded file's base64, fetched on demand (null until it arrives). */
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const planRef = clientId || replay.clientId || "";
  const embedUrl = replay.videoUrl ? getEmbedUrl(replay.videoUrl) : null;
  const needsFileFetch = Boolean(
    !replay.videoUrl && !replay.videoFileUrl && replay.hasVideoFile,
  );

  // Re-arm for each video: picking a second one must not inherit the first one's
  // loading state or error.
  useEffect(() => {
    setFileBase64(null);
    setHasError(false);
    if (!needsFileFetch) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const load = async () => {
      try {
        const query = planRef
          ? `?forPortal=1&clientId=${encodeURIComponent(planRef)}`
          : "";
        const response = await fetch(`/api/webinars/${replay.id}${query}`, {
          cache: "no-store",
        });
        const result = await response.json();
        const url = result?.data?.videoFileUrl;
        if (cancelled) return;
        if (response.ok && result?.success && typeof url === "string" && url) {
          setFileBase64(url);
        } else {
          setHasError(true);
        }
      } catch (error) {
        console.error("Failed to load webinar video:", error);
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [replay.id, needsFileFetch, planRef]);

  // Escape is the keyboard equivalent of the X, the same contract the card's
  // dialog gives.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const directSrc = useMemo(() => {
    // A file URL that the embed parser does not recognise plays as-is.
    if (replay.videoUrl && !embedUrl) return replay.videoUrl;
    if (replay.videoFileUrl) return `data:video/mp4;base64,${replay.videoFileUrl}`;
    if (fileBase64) return `data:video/mp4;base64,${fileBase64}`;
    return null;
  }, [replay.videoUrl, replay.videoFileUrl, embedUrl, fileBase64]);

  const showMissingState = !isLoading && !hasError && !embedUrl && !directSrc;

  return (
    <div
      className="relative w-full bg-black"
      data-testid="video-feature-player"
      data-video-id={replay.id}
    >
      {/* Full width of the section, but never taller than the viewport allows:
          the aspect ratio sets the height and `object-contain` letterboxes it. */}
      <div
        className="relative w-full bg-black"
        style={{ aspectRatio: "16 / 9", maxHeight: "80vh" }}
      >
        {isLoading ? (
          <div className="grid h-full w-full place-items-center">
            <p className="text-sm text-white/70">Loading video…</p>
          </div>
        ) : hasError ? (
          <div className="grid h-full w-full place-items-center px-6 text-center">
            <p className="text-sm text-white/70">
              This video could not be loaded.
            </p>
          </div>
        ) : embedUrl ? (
          <iframe
            src={embedUrl}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={replay.title}
          />
        ) : directSrc ? (
          <video
            className="h-full w-full object-contain"
            controls
            autoPlay
            playsInline
            src={directSrc}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="grid h-full w-full place-items-center">
            <p className="text-sm text-white/70">
              {showMissingState ? "This video has no playable source." : null}
            </p>
          </div>
        )}

        {/* Title on the left, X on the right — both over a scrim so they stay
            legible on a bright frame, and above the iframe so the X is clickable. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4">
          <p
            className="pointer-events-auto line-clamp-2 max-w-[70%] font-dm-serif text-base leading-snug text-white drop-shadow sm:text-lg"
            title={replay.title}
          >
            {replay.title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="pointer-events-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-white text-white shadow-lg transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            style={{ outlineColor: secondaryColor }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
