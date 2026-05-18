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
        // Scroll to show the next section but not jump completely
        const currentScroll = window.scrollY;
        const nextSectionTop = (nextSection as HTMLElement).offsetTop;
        const scrollAmount = nextSectionTop - currentScroll - 100; // Increased scroll amount
        window.scrollBy({ top: scrollAmount, behavior: "smooth" });
      } else {
        // If no next sibling, scroll down by a smaller amount
        window.scrollBy({ top: 400, behavior: "smooth" });
      }
    }
  };

  return (
    <section
      id="portal-mission"
      ref={sectionRef}
      className="px-4 sm:px-6 lg:px-8 flex items-center min-h-[590px] bg-[#FEFCF7] relative py-8 sm:py-12"
    >
      <div className="max-w-[1400px] mx-auto w-full flex gap-4 sm:gap-6 lg:gap-8 items-center overflow-x-auto">
        <div className="relative flex-shrink-0">
          <div className="flex justify-center w-[280px] sm:w-[350px] lg:w-[420px] h-[280px] sm:h-[350px] lg:h-[470px] items-center aspect-square overflow-hidden">
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

        <motion.div
          variants={fadeLeft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="flex-shrink-0"
        >
          <div className="w-[280px] sm:w-[500px] md:w-[650px] lg:w-[800px] flex flex-col justify-around min-h-[280px] sm:min-h-[350px] lg:min-h-[470px] p-4 sm:p-8 lg:p-14 box-border">
            <h2 className="mb-4 sm:mb-6 font-dm-serif text-[#002B5B] text-xl sm:text-2xl md:text-3xl lg:text-[40px] leading-tight">
              {company?.missionHeadline ||
                "We care about people. We value teamwork. We deliver results."}
            </h2>
            <p className="text-[#6B6B6B] font-red-hat text-base sm:text-sm md:text-base leading-[1.8] mb-4 sm:mb-6">
              {company?.missionBody ||
                "At Company Name, this employee benefits portal is one way we show our commitment to supporting you—in work, in life, and beyond. It reflects our foundation of integrity, service, and care by making it easier to access the resources, tools, and information you need. As we continue to grow and evolve, this portal reinforces our promise to invest in your well-being and success every step of the way."}
            </p>
            <button
              onClick={handleScrollDown}
              className="w-full sm:w-auto max-w-[250px] px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm md:text-base text-white uppercase font-semibold rounded-md transition-colors duration-200 hover:opacity-90"
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
