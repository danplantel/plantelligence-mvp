"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { Pencil } from "lucide-react";
import { toNextImageSrc } from "@/lib/branding-image-url";

interface RetirementJourneySectionProps {
  brandColor?: string;
  mainTitle?: string;
  subtitle?: string;
  description?: string;
  /** When provided, a <video> element replaces the right-column featured image */
  planVideoUrl?: string;
  /** Fallback image shown when no planVideoUrl is set. Expected to be a category-specific placeholder. */
  planVideoFallbackImage?: string;

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

export function RetirementJourneySection({
  brandColor = "#0FB879",
  mainTitle = "Your Retirement Journey Starts Here",
  subtitle = "Build your future with confidence.",
  description,
  planVideoUrl,
  planVideoFallbackImage,
  onMainTitleClick,
  onSubtitleClick,
  onDescriptionClick,
  onVideoClick,
}: RetirementJourneySectionProps) {

  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  const textVariants = {
    hidden: { opacity: 0, x: -80 },
    visible: { opacity: 1, x: 0 },
  };

  const imageVariants = {
    hidden: { opacity: 0, x: 80 },
    visible: { opacity: 1, x: 0 },
  };

  const [hoveredField, setHoveredField] = useState<string | null>(null);

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
      className="relative flex min-h-[50vh] flex-col overflow-hidden bg-gray-100 text-white lg:min-h-screen"
    >
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-[1280px] items-center gap-6 pb-2 md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <motion.div
            className="max-w-3xl"
            variants={textVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div
              className={`relative ${onMainTitleClick ? "cursor-pointer group" : ""}`}
              onClick={(e) => { e.stopPropagation(); onMainTitleClick?.(); }}
              onMouseEnter={() => onMainTitleClick && setHoveredField("mainTitle")}
              onMouseLeave={() => onMainTitleClick && setHoveredField(null)}
            >
              {onMainTitleClick && hoveredField === "mainTitle" && <EditPencil label="Edit header" />}
              <h1 className="mb-4 mt-[2em] lg:mt-0 font-unna font-dm-serif text-gray-900 text-[28px] font-normal leading-tight sm:text-3xl md:text-4xl lg:text-[40px]">
                {mainTitle}
              </h1>
            </div>
            <div
              className={`relative ${onSubtitleClick ? "cursor-pointer group" : ""}`}
              onClick={(e) => { e.stopPropagation(); onSubtitleClick?.(); }}
              onMouseEnter={() => onSubtitleClick && setHoveredField("subtitle")}
              onMouseLeave={() => onSubtitleClick && setHoveredField(null)}
            >
              {onSubtitleClick && hoveredField === "subtitle" && <EditPencil label="Edit subtitle" />}
              <h2 className="mb-5 text-lg font-medium font-dm-serif text-[#26A69A] sm:text-xl md:text-2xl lg:text-[24px]">
                {subtitle}
              </h2>
            </div>
            <div
              className={`relative ${onDescriptionClick ? "cursor-pointer group" : ""}`}
              onClick={(e) => { e.stopPropagation(); onDescriptionClick?.(); }}
              onMouseEnter={() => onDescriptionClick && setHoveredField("description")}
              onMouseLeave={() => onDescriptionClick && setHoveredField(null)}
            >
              {onDescriptionClick && hoveredField === "description" && <EditPencil label="Edit body text" />}
              <p className="mb-6 sm:text-[19px] text-base leading-relaxed text-gray-800 font-red-hat">
                {description}
              </p>
            </div>
          </motion.div>

          <motion.div
            className={`relative w-full ${onVideoClick ? "cursor-pointer group" : ""}`}
            variants={imageVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            onClick={(e) => { e.stopPropagation(); onVideoClick?.(); }}
            onMouseEnter={() => onVideoClick && setHoveredField("video")}
            onMouseLeave={() => onVideoClick && setHoveredField(null)}
          >
            {onVideoClick && hoveredField === "video" && <EditPencil label="Edit plan video" />}
            <div className="aspect-video overflow-hidden rounded-xl border border-white/15 bg-black/80 shadow-2xl sm:rounded-2xl">
              {planVideoUrl ? (
                <video
                  src={planVideoUrl}
                  controls
                  className="h-full w-full object-cover"
                  playsInline
                  preload="metadata"
                />
              ) : (
                <Image
                  src={planVideoFallbackImage || "/placeholder.svg"}
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
