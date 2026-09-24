/**
 * Embed-URL helpers for webinar videos.
 *
 * A webinar links either to a hosted video (YouTube/Vimeo, which must be framed
 * through the provider's player) or to a direct file, which plays in a plain
 * `<video>`. Both the dashboard's watch dialog and the portal's hover teaser need
 * to tell the two apart, so the parsing lives here rather than being re-derived at
 * each call site.
 */

/** Seconds of video the hover teaser plays. Kept beside the embed it configures. */
export const HOVER_PREVIEW_SECONDS = 15;

/**
 * Convert a YouTube/Vimeo URL to its embed form. Returns null for anything that is
 * not a hosted video — including direct file URLs, which the caller should hand to
 * a `<video>` element instead.
 */
export function getWebinarEmbedUrl(url: string): string | null {
  if (!url) return null;

  // YouTube: watch links, youtu.be short links, and already-embedded URLs.
  const youtubeRegex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo.
  const vimeoRegex = /(?:vimeo\.com\/)(?:.*\/)?(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Already an embed URL — hand it back untouched.
  if (url.includes("youtube.com/embed") || url.includes("vimeo.com/video")) {
    return url;
  }

  // A direct file (mp4, webm, …): the caller plays it in a <video> element.
  return null;
}

/**
 * Muted, chrome-less embed for the hover teaser. YouTube honours `end`, so the
 * teaser stops at the same point as an uploaded file; Vimeo has no end-time
 * parameter, and `background` is its closest equivalent — muted, looping, and
 * without controls. Returns null for direct file URLs, which play in a `<video>`.
 */
export function getWebinarHoverEmbedUrl(url: string): string | null {
  const embed = getWebinarEmbedUrl(url);
  if (!embed) return null;

  if (embed.includes("youtube.com/embed")) {
    const [base] = embed.split("?");
    return `${base}?autoplay=1&mute=1&controls=0&start=0&end=${HOVER_PREVIEW_SECONDS}&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1`;
  }

  if (embed.includes("player.vimeo.com/video")) {
    return `${embed}?autoplay=1&muted=1&background=1&controls=0`;
  }

  return embed;
}
