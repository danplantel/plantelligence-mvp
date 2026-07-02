"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { toNextImageSrc } from "@/lib/branding-image-url";

export interface JourneyVideo {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  tag?: string;
  description?: string;
}

export interface FeaturedJourneyVideo extends JourneyVideo {
  rating: string | number;
  category: string;
  embedUrl?: string;
}

interface AutoCarouselVideoRowProps {
  title: string;
  videos: JourneyVideo[];
  onVideoClick: (video: JourneyVideo) => void;
  speed?: number;
}

function AutoCarouselVideoRow({
  title,
  videos,
  onVideoClick,
  speed = 30,
}: AutoCarouselVideoRowProps) {
  // Show only first 3 videos
  const displayedVideos = videos.slice(0, 3);
  const looped = useMemo(
    () => [...displayedVideos, ...displayedVideos],
    [displayedVideos],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const CARD_STEP = 416; // 400px width + 16px gap
    const intervalMs = speed * 100;

    const autoplay = () => {
      const c = scrollRef.current;
      if (!c || pauseRef.current) return;

      const halfWidth = c.scrollWidth / 2;

      if (c.scrollLeft >= halfWidth) {
        c.scrollLeft -= halfWidth;
      }

      c.scrollBy({
        left: CARD_STEP,
        behavior: "smooth",
      });
    };

    const id = window.setInterval(autoplay, intervalMs);

    return () => window.clearInterval(id);
  }, [looped, speed]);

  const handleManualScroll = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;

    const CARD_STEP = 416; // 400px width + 16px gap
    const halfWidth = container.scrollWidth / 2;

    if (container.scrollLeft >= halfWidth) {
      container.scrollLeft -= halfWidth;
    }

    const amount = direction === "right" ? CARD_STEP : -CARD_STEP;

    container.scrollBy({
      left: amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-unna font-dm-serif text-[24px] text-white">
        {title}
      </h3>

      <div className="relative overflow-hidden rounded-2xl bg-black/30 px-10 py-4">
        <button
          type="button"
          onClick={() => handleManualScroll("left")}
          className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 lg:flex"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => handleManualScroll("right")}
          className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 lg:flex"
        >
          ›
        </button>

        <div
          className="overflow-hidden"
          style={{ width: "calc(400px * 3 + 16px * 2)" }}
        >
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth scrollbar-hide"
            onMouseEnter={() => {
              pauseRef.current = true;
            }}
            onMouseLeave={() => {
              pauseRef.current = false;
            }}
          >
            {looped.map((video, index) => (
              <button
                key={`${video.id}-${index}`}
                onClick={() => onVideoClick(video)}
                className="group relative h-[256px] w-[400px] flex-shrink-0 overflow-hidden rounded-xl bg-[#0C111C] text-left shadow-lg transition hover:-translate-y-1"
              >
                <img
                  src={video.thumbnail || "/placeholder.svg"}
                  alt={video.title}
                  className="h-full w-full object-cover contrast-110 saturate-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-70 transition group-hover:opacity-90" />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 text-white">
                  {video.tag && (
                    <span className="mb-2 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/90">
                      {video.tag}
                    </span>
                  )}
                  <p className="text-sm font-semibold">{video.title}</p>
                  <span className="mt-1 text-xs text-white/70">
                    {video.duration}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface RetirementJourneySectionProps {
  brandColor?: string;
  featuredVideo: FeaturedJourneyVideo;
  retirementVideos: JourneyVideo[];
  planningVideos: JourneyVideo[];
  onVideoClick: (video: JourneyVideo) => void;
  onFeaturedVideoClick: () => void;
  dbVideos?: JourneyVideo[];
  dbFeaturedVideo?: FeaturedJourneyVideo;
  mainTitle?: string;
  subtitle?: string;
  firstCarouselTitle?: string;
  secondCarouselTitle?: string;
  backgroundImage?: string;
  backgroundImageAlt?: string;
}

export function RetirementJourneySection({
  brandColor = "#0FB879",
  featuredVideo: propFeaturedVideo,
  retirementVideos: propRetirementVideos,
  planningVideos: propPlanningVideos,
  onVideoClick,
  onFeaturedVideoClick,
  dbVideos,
  dbFeaturedVideo,
  mainTitle = "Your Retirement Journey Starts Here",
  subtitle = "Build your financial future with confidence.",
  firstCarouselTitle = "Retirement Planning Essentials",
  secondCarouselTitle = "Financial Planning & Strategy",
  backgroundImage = "/Hiking-Couple-Looking.webp",
  backgroundImageAlt = "Two hikers climbing mountain at sunset - retirement journey metaphor",
}: RetirementJourneySectionProps) {
  // Use database videos if provided, otherwise use static videos
  const featuredVideo = dbFeaturedVideo || propFeaturedVideo;
  const retirementVideos =
    dbVideos && dbVideos.length > 0
      ? dbVideos.slice(0, Math.ceil(dbVideos.length / 2))
      : propRetirementVideos;
  const planningVideos =
    dbVideos && dbVideos.length > 0
      ? dbVideos.slice(Math.ceil(dbVideos.length / 2))
      : propPlanningVideos;
  const heroImageSrc = toNextImageSrc(
    backgroundImage,
    "/Hiking-Couple-Looking.webp",
  );
  return (
    <section className="relative overflow-hidden bg-black text-white">
      <div className="absolute inset-0" style={{ height: "60%" }}>
        <Image
          src={heroImageSrc}
          alt={backgroundImageAlt}
          className="w-full object-cover"
          fill
          priority
        />

        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-black" />

        <div
          className="absolute inset-x-0 bg-gradient-to-t from-black to-transparent"
          style={{
            bottom: "50%",
            height: "135%",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex flex-col items-center justify-center px-4 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="grid w-full max-w-[1280px] items-center gap-6 pb-2 md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="max-w-3xl">
            <h1 className="mb-4 font-unna font-dm-serif text-[28px] font-normal leading-tight sm:text-3xl md:text-4xl lg:text-[40px]">
              {mainTitle}
            </h1>
            <h2 className="mb-5 text-lg font-medium font-dm-serif text-[#26A69A] sm:text-xl md:text-2xl lg:text-[24px]">
              {subtitle}
            </h2>
            <p className="mb-6 text-base leading-relaxed text-white/90 sm:text-[19px] font-red-hat">
              {featuredVideo.description}
            </p>
          </div>

          <div className="relative w-full">
            <div className="aspect-video overflow-hidden rounded-xl border border-white/15 bg-black/80 shadow-2xl sm:rounded-2xl">
              <Image
                src={featuredVideo.thumbnail || "/placeholder.svg"}
                alt={featuredVideo.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
