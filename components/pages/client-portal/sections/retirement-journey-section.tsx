"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
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
}

export function RetirementJourneySection({
  brandColor = "#0FB879",
  mainTitle = "Your Retirement Journey Starts Here",
  subtitle = "Build your future with confidence.",
  description,
  planVideoUrl,
  planVideoFallbackImage,
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
            <h1 className="mb-4 mt-[2em] lg:mt-0 font-unna font-dm-serif text-gray-900 text-[28px] font-normal leading-tight sm:text-3xl md:text-4xl lg:text-[40px]">
              {mainTitle}
            </h1>
            <h2 className="mb-5 text-lg font-medium font-dm-serif text-[#26A69A] sm:text-xl md:text-2xl lg:text-[24px]">
              {subtitle}
            </h2>
            <p className="mb-6 sm:text-[19px] text-base leading-relaxed text-gray-800 font-red-hat">
              {description}
            </p>
          </motion.div>

          <motion.div
            className="relative w-full"
            variants={imageVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          >
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
