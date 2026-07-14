"use client";

import { motion } from "framer-motion";
import { useRef, useState, KeyboardEvent } from "react";
import { Pencil } from "lucide-react";
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
  onMissionHeadlineClick?: () => void;
  onMissionBodyClick?: () => void;
}

export function PortalMission({
  company,
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  onMissionHeadlineClick,
  onMissionBodyClick,
}: PortalMissionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  const handleInteractiveKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    handler?: () => void,
  ) => {
    if (!handler) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler();
    }
  };

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
            <div className="relative">
              <h2
                className={`mb-4 sm:mb-5 font-dm-serif text-xl sm:text-2xl md:text-3xl lg:text-[34px] leading-tight ${onMissionHeadlineClick
                  ? `cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${hoveredElement === "headline"
                      ? "opacity-90 ring-2 ring-blue-500/50 rounded-md px-2 -mx-2"
                      : "hover:opacity-90"
                    }`
                  : ""
                  }`}
                style={{ color: brandColor }}
                role={onMissionHeadlineClick ? "button" : undefined}
                tabIndex={onMissionHeadlineClick ? 0 : undefined}
                onClick={(e) => {
                  if (onMissionHeadlineClick) {
                    e.stopPropagation();
                    onMissionHeadlineClick();
                  }
                }}
                onKeyDown={(event: KeyboardEvent<HTMLHeadingElement>) =>
                  handleInteractiveKeyDown(event, onMissionHeadlineClick)
                }
                onMouseEnter={() => setHoveredElement("headline")}
                onMouseLeave={() => setHoveredElement(null)}
                onFocus={() => setHoveredElement("headline")}
                onBlur={() => setHoveredElement(null)}
              >
                {company?.missionHeadline ||
                  "We care about people. We value teamwork. We deliver results."}
              </h2>
              {onMissionHeadlineClick && hoveredElement === "headline" && (
                <div className="absolute top-[-7px] left-[-7px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                  <Pencil className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div className="relative">
              <p
                className={`text-[#6B6B6B] font-red-hat sm:text-base lg:text-[1.3em] leading-[1.8] mb-4 sm:mb-5 ${onMissionBodyClick
                  ? `cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${hoveredElement === "body"
                      ? "opacity-90 ring-2 ring-blue-500/50 rounded-md px-2 -mx-2"
                      : "hover:opacity-90"
                    }`
                  : ""
                  }`}
                role={onMissionBodyClick ? "button" : undefined}
                tabIndex={onMissionBodyClick ? 0 : undefined}
                onClick={(e) => {
                  if (onMissionBodyClick) {
                    e.stopPropagation();
                    onMissionBodyClick();
                  }
                }}
                onKeyDown={(event: KeyboardEvent<HTMLParagraphElement>) =>
                  handleInteractiveKeyDown(event, onMissionBodyClick)
                }
                onMouseEnter={() => setHoveredElement("body")}
                onMouseLeave={() => setHoveredElement(null)}
                onFocus={() => setHoveredElement("body")}
                onBlur={() => setHoveredElement(null)}
              >
                {company?.missionBody ||
                  "At Company Name, this employee benefits portal is one way we show our commitment to supporting you—in work, in life, and beyond. It reflects our foundation of integrity, service, and care by making it easier to access the resources, tools, and information you need. As we continue to grow and evolve, this portal reinforces our promise to invest in your well-being and success every step of the way."}
              </p>
              {onMissionBodyClick && hoveredElement === "body" && (
                <div className="absolute top-[-7px] left-[-7px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                  <Pencil className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
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
