"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { Clock, Pencil, Play } from "lucide-react";
import { toNextImageSrc } from "@/lib/branding-image-url";
import { resolvePortalPrimaryContact } from "@/lib/portal-primary-contact";
import { resolveJourneyImage } from "@/lib/benefits-video-fallback";

/** `m:ss` for the video's runtime. */
function formatVideoDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/**
 * Default headline / subhead per benefit category, used when the plan has not
 * written its own (no `journeyHeader` / `journeySubtitle` override). The Custom hub
 * is stored under "Company / Plan Sponsor".
 */
const VIDEO_TITLE_DEFAULTS: Record<
  string,
  { title: string; subtitle: string }
> = {
  Retirement: {
    title: "Your Retirement Journey Starts Here",
    subtitle: "Build your financial future with confidence.",
  },
  "Group Health": {
    title: "Get the Most From Your Health Plan",
    subtitle: "Care, coverage, and costs, explained.",
  },
  "Group Life": {
    title: "Protect What Matters Most",
    subtitle: "Coverage for you and the people who count on you.",
  },
  "Company / Plan Sponsor": {
    title: "Everything You Need, Explained",
    subtitle: "Quick videos on the benefits and resources available to you.",
  },
};

/** The default copy for a category, falling back to Retirement's. */
function defaultCopyFor(category?: string) {
  return (
    (category && VIDEO_TITLE_DEFAULTS[category]) ||
    VIDEO_TITLE_DEFAULTS.Retirement
  );
}

interface BenefitsVideoSectionProps {
  brandColor?: string;
  /** Accent colour for the subtitle and the Watch Now CTA. */
  secondaryColor?: string;
  /** Headline. Defaults to the category's copy when omitted. */
  mainTitle?: string;
  /** Subhead. Defaults to the category's copy when omitted. */
  subtitle?: string;
  description?: string;
  /** When provided, a <video> element replaces the right-column featured image */
  planVideoUrl?: string;
  /**
   * Image shown instead of a video — the plan's own "Default Image" upload or
   * gallery pick (R2 key or URL). When omitted/empty the section uses its
   * category's stock image, so this is always set on screen.
   */
  planVideoFallbackImage?: string;
  /** Poster image (uploaded, captured frame, or URL) for the video and its no-video fallback. */
  videoThumbnail?: string;
  /**
   * Short label describing the video — "Advisor Intro", "This benefit", or
   * "Our Services". Shown beside the runtime under the subtitle.
   */
  videoLabel?: string;
  /** The plan's contacts — resolves the key contact named on the Schedule button. */
  keyContacts?: unknown;
  /** Benefit category used to pick the key contact. */
  category?: string;
  /**
   * When set, "Schedule with …" becomes a button that runs this instead of opening
   * the contact's scheduling URL. The hub pages use it to scroll to the
   * "Have Questions?" band, where that contact's card (and its links) live.
   */
  onScheduleClick?: () => void;

  // ── Optional edit hooks (used by the Benefits wizard preview) ──
  /** When set, clicking the main title opens the editor and a pencil shows on hover */
  onMainTitleClick?: () => void;
  /** When set, clicking the subtitle opens the editor and a pencil shows on hover */
  onSubtitleClick?: () => void;
  /** When set, clicking the description opens the editor and a pencil shows on hover */
  onDescriptionClick?: () => void;
  /** When set, clicking the video/image area opens the editor and a pencil shows on hover */
  onVideoClick?: () => void;
}

export function BenefitsVideoSection({
  brandColor = "#0FB879",
  secondaryColor = "#C89B5B",
  mainTitle,
  subtitle,
  description,
  planVideoUrl,
  planVideoFallbackImage,
  videoThumbnail,
  videoLabel = "This benefit",
  keyContacts,
  category,
  onScheduleClick,
  onMainTitleClick,
  onSubtitleClick,
  onDescriptionClick,
  onVideoClick,
}: BenefitsVideoSectionProps) {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  // A plan's own copy wins; otherwise the category default fills the heading and
  // subhead, so every hub reads correctly without each page repeating the strings.
  const categoryCopy = defaultCopyFor(category);
  const resolvedMainTitle = mainTitle?.trim()
    ? mainTitle
    : categoryCopy.title;
  const resolvedSubtitle = subtitle?.trim() ? subtitle : categoryCopy.subtitle;

  // What the right-hand panel paints when there is no video: the plan's own
  // default image, otherwise the category's stock image (see
  // lib/benefits-video-fallback.ts — the editor previews this same value).
  const resolvedFallbackImage = resolveJourneyImage(
    planVideoFallbackImage,
    category,
  );

  const textVariants = {
    hidden: { opacity: 0, x: -80 },
    visible: { opacity: 1, x: 0 },
  };

  const imageVariants = {
    hidden: { opacity: 0, x: 80 },
    visible: { opacity: 1, x: 0 },
  };

  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // A new source has a new runtime; don't show the previous video's length until
  // the new metadata arrives.
  useEffect(() => {
    setVideoDurationSec(null);
  }, [planVideoUrl]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  /** "Watch Now" brings the player into view and starts it. */
  const handleWatchNow = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.scrollIntoView({ behavior: "smooth", block: "center" });
    void video.play().catch(() => {});
  }, []);

  // The category's key contact — the same person the welcome banner signs.
  const primaryContact = useMemo(
    () => resolvePortalPrimaryContact(keyContacts, category),
    [keyContacts, category],
  );
  const contactFirstName =
    String(primaryContact?.fullName || primaryContact?.name || "")
      .trim()
      .split(/\s+/)[0] || "";
  const scheduleLabel = contactFirstName
    ? `Schedule with ${contactFirstName}`
    : "Schedule a Meeting";
  const scheduleHref = (primaryContact as any)?.schedulingUrl || "";

  const EditPencil = ({ label }: { label: string }) => (
    <div
      className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20"
      title={label}
    >
      <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
    </div>
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[50vh] flex-col overflow-hidden bg-[#111828] text-white lg:min-h-screen"
    >
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-[1280px] items-center gap-6 pb-2 md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <motion.div
            className="flex h-full max-w-3xl flex-col justify-center"
            variants={textVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div
              className={`relative ${
                onMainTitleClick ? "cursor-pointer group" : ""
              }`}
              data-preview-field="journeyHeader"
              onClick={(e) => {
                e.stopPropagation();
                onMainTitleClick?.();
              }}
              onMouseEnter={() =>
                onMainTitleClick && setHoveredField("mainTitle")
              }
              onMouseLeave={() => onMainTitleClick && setHoveredField(null)}
            >
              {onMainTitleClick && hoveredField === "mainTitle" && (
                <EditPencil label="Edit header" />
              )}
              <h1 className="mb-4 mt-[2em] lg:mt-0 font-unna font-dm-serif text-white text-[28px] font-normal leading-tight sm:text-3xl md:text-4xl lg:text-[40px]">
                {resolvedMainTitle}
              </h1>
            </div>
            <div
              className={`relative ${
                onSubtitleClick ? "cursor-pointer group" : ""
              }`}
              data-preview-field="journeySubtitle"
              onClick={(e) => {
                e.stopPropagation();
                onSubtitleClick?.();
              }}
              onMouseEnter={() =>
                onSubtitleClick && setHoveredField("subtitle")
              }
              onMouseLeave={() => onSubtitleClick && setHoveredField(null)}
            >
              {onSubtitleClick && hoveredField === "subtitle" && (
                <EditPencil label="Edit subtitle" />
              )}
              <h2
                className="mb-3 text-lg font-medium font-dm-serif sm:text-xl md:text-2xl lg:text-[24px]"
                style={{ color: secondaryColor }}
              >
                {resolvedSubtitle}
              </h2>
            </div>

            {/* Video meta — runtime + content label, directly under the subtitle.
                Both only describe a video, so with no video there is nothing to say
                and the whole row is dropped (the label would otherwise sit on the
                page implying a video that isn't there). */}
            {planVideoUrl && (
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-red-hat text-white/70">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {videoDurationSec != null
                    ? formatVideoDuration(videoDurationSec)
                    : "--:--"}
                </span>
                {videoLabel?.trim() ? (
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                    {videoLabel}
                  </span>
                ) : null}
              </div>
            )}

            <div
              className={`relative ${
                onDescriptionClick ? "cursor-pointer group" : ""
              }`}
              data-preview-field="journeyBodyText"
              onClick={(e) => {
                e.stopPropagation();
                onDescriptionClick?.();
              }}
              onMouseEnter={() =>
                onDescriptionClick && setHoveredField("description")
              }
              onMouseLeave={() => onDescriptionClick && setHoveredField(null)}
            >
              {onDescriptionClick && hoveredField === "description" && (
                <EditPencil label="Edit body text" />
              )}
              <p className="mb-6 sm:text-[19px] text-base leading-relaxed text-white/80 font-red-hat">
                {description}
              </p>
            </div>

            {/* Left-column CTAs: start the plan video and book the key contact.
                "Watch Now" only exists to start a video, so with no video it is
                dropped rather than shown disabled. */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {planVideoUrl && (
                <button
                  type="button"
                  onClick={handleWatchNow}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90"
                  style={{ background: secondaryColor }}
                >
                  Watch Now
                  <Play
                    className="h-4 w-4"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                </button>
              )}

              {onScheduleClick ? (
                <button
                  type="button"
                  onClick={onScheduleClick}
                  className="inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10"
                >
                  {scheduleLabel}
                </button>
              ) : scheduleHref ? (
                <a
                  href={scheduleHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10"
                >
                  {scheduleLabel}
                </a>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10"
                >
                  {scheduleLabel}
                </button>
              )}
            </div>
          </motion.div>

          <motion.div
            className={`relative w-full ${
              onVideoClick ? "cursor-pointer group" : ""
            }`}
            data-preview-field="planVideo"
            variants={imageVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            onClick={(e) => {
              e.stopPropagation();
              onVideoClick?.();
            }}
            onMouseEnter={() => onVideoClick && setHoveredField("video")}
            onMouseLeave={() => onVideoClick && setHoveredField(null)}
          >
            {onVideoClick && hoveredField === "video" && (
              <EditPencil label="Edit plan video" />
            )}
            <div className="aspect-video overflow-hidden rounded-xl border border-white/15 bg-black/80 shadow-2xl sm:rounded-2xl">
              {planVideoUrl ? (
                <div
                  className="relative h-full w-full cursor-pointer"
                  onClick={handlePlayPause}
                >
                  <video
                    ref={videoRef}
                    src={planVideoUrl}
                    poster={videoThumbnail || undefined}
                    className="h-full w-full object-cover"
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(event) =>
                      setVideoDurationSec(event.currentTarget.duration)
                    }
                    onEnded={() => setIsPlaying(false)}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                  />
                  {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-110">
                        <Play
                          className="h-7 w-7 translate-x-0.5 text-gray-900"
                          fill="currentColor"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // No video → the plan's default image. The poster (`videoThumbnail`)
                // is deliberately NOT consulted here: it describes a video that no
                // longer exists, and would mask the image the advisor just chose.
                <Image
                  src={resolvedFallbackImage}
                  alt={"Category placeholder image"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
