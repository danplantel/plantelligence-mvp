"use client";

import { Loader2 } from "lucide-react";
import type { HoverPreviewState } from "@/hooks/useWebinarHoverPreview";
import { cn } from "@/lib/utils";
import {
  HOVER_PREVIEW_SECONDS,
  getWebinarHoverEmbedUrl,
} from "@/lib/webinar-video-embed";

/**
 * The hover teaser itself: a muted few seconds of the video painted over a card's
 * thumbnail, the way YouTube previews a card.
 *
 * It renders *inside* the card's media box and takes no pointer events of its own,
 * because the click that opens the full video belongs to the card underneath. That
 * is also why the embed gets `pointer-events-none` — an iframe would otherwise
 * swallow the click.
 */
export function WebinarHoverPreviewLayer({
  /** Null unless this card is the one currently previewing. */
  preview,
  /** Used for the framed player's accessible name. */
  title,
  /**
   * Extra classes for the layer's root. Cards that keep their own play badge on top
   * of the video pass a stacking order here; without one the layer simply paints
   * where the card's DOM order puts it.
   */
  className,
}: {
  preview: HoverPreviewState | null;
  title: string;
  className?: string;
}) {
  // Loop the teaser over its opening seconds. Rewriting `currentTime` keeps the
  // decoder warm, where pausing and replaying would flash the first frame each
  // time; hovering is usually sustained, and a card frozen mid-teaser reads as
  // broken.
  const loopTeaser = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.currentTime >= HOVER_PREVIEW_SECONDS) video.currentTime = 0;
  };

  // A clip shorter than the teaser window never reaches that cap, so it is looped
  // on end rather than left frozen on its last frame.
  const restartTeaser = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    video.currentTime = 0;
    void video.play().catch(() => {
      /* Autoplay can be refused; the last frame simply stays put. */
    });
  };

  if (!preview) return null;

  const rootClass = cn("pointer-events-none absolute inset-0", className);

  if (preview.isLoading) {
    return (
      <div className={cn(rootClass, "flex items-center justify-center bg-black/40")}>
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      </div>
    );
  }

  if (preview.videoFileUrl) {
    return (
      <video
        className={cn(rootClass, "h-full w-full object-cover")}
        src={`data:video/mp4;base64,${preview.videoFileUrl}`}
        autoPlay
        muted
        playsInline
        onTimeUpdate={loopTeaser}
        onEnded={restartTeaser}
      />
    );
  }

  if (preview.videoUrl) {
    const embedUrl = getWebinarHoverEmbedUrl(preview.videoUrl);

    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          className={cn(rootClass, "h-full w-full")}
          frameBorder="0"
          allow="autoplay; encrypted-media; picture-in-picture"
          title={`Hover preview of ${title}`}
        />
      );
    }

    return (
      <video
        className={cn(rootClass, "h-full w-full object-cover")}
        src={preview.videoUrl}
        autoPlay
        muted
        playsInline
        onTimeUpdate={loopTeaser}
        onEnded={restartTeaser}
      />
    );
  }

  return null;
}
