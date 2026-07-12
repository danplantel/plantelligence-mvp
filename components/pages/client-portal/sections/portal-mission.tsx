"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { BrandingImage } from "@/components/ui/branding-image";

interface PortalMissionProps {
  company?: {
    companyName?: string;
    missionHeadline?: string;
    missionBody?: string;
    thumbnailImg?: string;
    thumbnailImgName?: string;
  };
  brandColor?: string;
  secondaryColor?: string;
}

export function PortalMission({
  company,
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
}: PortalMissionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  const fadeLeft = {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0 },
  };
  const handleScrollDown = () => {
    if (sectionRef.current) {
      const nextSection = sectionRef.current.nextElementSibling;
      if (nextSection) {
        const currentScroll = window.scrollY;
        const nextSectionTop = (nextSection as HTMLElement).offsetTop;
        const scrollAmount = nextSectionTop - currentScroll - 100;
        window.scrollBy({ top: scrollAmount, behavior: "smooth" });
      } else {
        window.scrollBy({ top: 400, behavior: "smooth" });
      }
    }
  };

  return (
    <section
      id="portal-mission"
      ref={sectionRef}
      className="px-4 sm:px-6 lg:px-8 flex items-center min-h-0 sm:min-h-[590px] bg-[#FEFCF7] relative py-8 sm:py-12"
    >
      {/* CSS Grid layout:
          - Mobile: single column (image on top, text below)
          - Desktop (lg): two columns — image left, text right */}
      <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[42%_58%] gap-8 lg:gap-12">

        {/* ── Left column: Image ── */}
        <div className="w-full">
          <div className="w-full h-[260px] sm:h-[340px] lg:h-[460px] overflow-hidden rounded-lg">
            {company?.thumbnailImg ? (
              <BrandingImage
                src={company.thumbnailImg}
                alt="Team collaboration"
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={
                  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=600&fit=crop&crop=center"
                }
                alt="Team collaboration"
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </div>

        {/* ── Right column: Text + Button (animated) ── */}
        <motion.div
          variants={fadeLeft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="w-full"
        >
          <div className="flex flex-col justify-center p-4 sm:p-6 lg:p-10">
            <h2
              className="mb-4 sm:mb-5 font-dm-serif text-xl sm:text-2xl md:text-3xl lg:text-[40px] leading-tight"
              style={{ color: brandColor }}
            >
              {company?.missionHeadline ||
                "We care about people. We value teamwork. We deliver results."}
            </h2>
            <p className="text-[#6B6B6B] font-red-hat text-sm sm:text-base lg:text-[2em] leading-[1.8] mb-4 sm:mb-5">
              {company?.missionBody ||
                "At Company Name, this employee benefits portal is one way we show our commitment to supporting you—in work, in life, and beyond. It reflects our foundation of integrity, service, and care by making it easier to access the resources, tools, and information you need. As we continue to grow and evolve, this portal reinforces our promise to invest in your well-being and success every step of the way."}
            </p>
            <button
              onClick={handleScrollDown}
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base text-white uppercase font-semibold rounded-md transition-colors duration-200 hover:opacity-90"
              style={{
                background: secondaryColor || brandColor || "#D4A574",
              }}
              aria-label="Explore your benefits"
            >
              Explore Your Benefits
            </button>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
