"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, Pencil } from "lucide-react";
import { useRef, KeyboardEvent, ReactNode, useState } from "react";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { isR2BrandingKey } from "@/lib/branding-image-url";

interface PortalHeroProps {
  companyData?: {
    companyName?: string;
    backgroundImg?: string;
    brandImages?: { header?: { url?: string } };
  };
  brandColor?: string;
  secondaryColor?: string;
  heroTitle?: string;
  heroDescription?: string;
  onHeroTitleClick?: () => void;
  onHeroDescriptionClick?: () => void;
  onContainerClick?: () => void;
  onBackgroundClick?: () => void;
  showEditIndicators?: boolean;
  heroTitleSlot?: React.ReactNode;
  heroDescriptionSlot?: React.ReactNode;
  backgroundOpacity?: number; // Controls background image brightness (0-1)
  containerBlockOpacity?: number; // Controls container background opacity (0-1)
  companyNameColor?: "yellow" | "default";
  containerInverted?: boolean;
  backgroundInverted?: boolean;
  useGradient?: boolean;
}

export function PortalHero({
  companyData,
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  heroTitle,
  heroDescription,
  onHeroTitleClick,
  onHeroDescriptionClick,
  onContainerClick,
  onBackgroundClick,
  heroTitleSlot,
  heroDescriptionSlot,
  backgroundOpacity = 1.0,
  containerBlockOpacity = 0.67,
  companyNameColor = "yellow",
  containerInverted = false,
  backgroundInverted = false,
  useGradient = false,
  showEditIndicators = true,
}: PortalHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [hoveredElement, setHoveredElement] = useState<
    "background" | "container" | "title" | "description" | null
  >(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const defaultTitle = `Welcome to the ${companyData?.companyName || "Company Name"
    } Benefits Hub!`;
  const defaultDescription = "--------";

  const handleScrollDown = () => {
    const missionSection = document.getElementById("portal-mission");
    if (missionSection) {
      const offset = 200; // Offset from top (0 means exactly at the start)
      const elementPosition = missionSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    } else {
      // Fallback: scroll to next section if mission section not found
      if (sectionRef.current) {
        const nextSection = sectionRef.current.nextElementSibling;
        if (nextSection) {
          const currentScroll = window.scrollY;
          const nextSectionTop = (nextSection as HTMLElement).offsetTop;
          const scrollAmount = nextSectionTop - currentScroll - 100;
          window.scrollBy({ top: scrollAmount, behavior: "smooth" });
        } else {
          window.scrollBy({ top: 300, behavior: "smooth" });
        }
      }
    }
  };

  const backgroundImgRaw =
    companyData?.backgroundImg ||
    (companyData as any)?.brandImages?.header?.url ||
    (companyData as any)?.brandImages?.thumbnail?.url ||
    "";
  const { url: backgroundImg, loading: backgroundImgLoading } =
    useBrandingImageUrl(backgroundImgRaw || null);
  const isR2Background = isR2BrandingKey(backgroundImgRaw);
  const displayBackgroundSrc = isR2Background
    ? backgroundImg ?? undefined
    : (backgroundImg ?? backgroundImgRaw) || undefined;
  const hasBackgroundImage = Boolean(backgroundImgRaw?.trim());
  const isEditable = Boolean(showEditIndicators && (
    onHeroTitleClick ||
    onHeroDescriptionClick ||
    onContainerClick
  ));

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

  const titleInteractiveProps = onHeroTitleClick
    ? {
      role: "button" as const,
      tabIndex: 0,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onHeroTitleClick();
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
        handleInteractiveKeyDown(event, onHeroTitleClick),
    }
    : {};

  const descriptionInteractiveProps = onHeroDescriptionClick
    ? {
      role: "button" as const,
      tabIndex: 0,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onHeroDescriptionClick();
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
        handleInteractiveKeyDown(event, onHeroDescriptionClick),
    }
    : {};

  const containerInteractiveProps = onContainerClick
    ? {
      role: "button" as const,
      tabIndex: 0,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onContainerClick();
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
        handleInteractiveKeyDown(event, onContainerClick),
    }
    : {};

  const backgroundInteractiveProps = onBackgroundClick
    ? {
      role: "button" as const,
      tabIndex: 0,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onBackgroundClick();
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
        handleInteractiveKeyDown(event, onBackgroundClick),
    }
    : {};

  return (
    <section
      ref={sectionRef}
      className={`px-4 sm:px-6 lg:px-20 min-h-[600px] sm:min-h-[700px] lg:min-h-screen sm:pt-0 relative isolate overflow-hidden flex justify-center items-center ${hasBackgroundImage ? "bg-[#FEFCF7]" : "bg-white"
        }`}
    >
      <div className="absolute inset-0">
        {hasBackgroundImage ? (
          <>
            {/* Background Image Container - uses opacity for full transparency control */}
            <div
              className={`absolute inset-0 transition-all z-0 ${isEditable && hoveredElement === "background"
                ? "ring-2 ring-blue-500/50 rounded-lg cursor-pointer"
                : ""
                }`}
              {...backgroundInteractiveProps}
              style={{
                isolation: "isolate",
                pointerEvents:
                  hoveredElement === "title" ||
                    hoveredElement === "description" ||
                    hoveredElement === "container"
                    ? "none"
                    : "auto",
              }}
              onMouseEnter={(e) => {
                if (isEditable) {
                  setHoveredElement("background");
                }
              }}
              onMouseLeave={() => {
                if (hoveredElement === "background") {
                  setHoveredElement(null);
                }
              }}
            >
              {/* Background image — R2 keys only after signed URL; no raw key in src */}
              {isR2Background && !displayBackgroundSrc && backgroundImgLoading ? (
                <div
                  className="absolute inset-0 animate-pulse bg-muted/50"
                  aria-hidden
                />
              ) : displayBackgroundSrc ? (
                <img
                  src={displayBackgroundSrc}
                  alt="Company background"
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : null}

              {/* Overlay DIV controls transparency - reacts to backgroundInverted */}
              <div
                className="absolute inset-0"
                style={{
                  background: backgroundInverted
                    ? "rgba(255, 255, 255, 1)"
                    : "rgba(0, 0, 0, 1)",
                  opacity: 1 - backgroundOpacity, // Inverted: 1 (100%) = transparent (image visible), 0 (0%) = opaque (image hidden)
                  isolation: "isolate",
                }}
              />

              {/* Edit icon indicator */}
              {isEditable && hoveredElement === "background" && (
                <div className="absolute top-2 left-2 z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                  <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-white" />
        )}
      </div>

      <div className="z-10 relative flex justify-center items-center px-2 sm:px-6 lg:px-8 box-border h-full w-full">
        <div
          data-container="true"
          className={`text-container relative lg:bottom-20 flex items-center justify-center px-4 sm:px-6 lg:px-10 box-border min-h-[280px] sm:min-h-[320px] w-full max-w-[900px] mx-auto transition-all relative ${isEditable && onContainerClick
            ? "[&:hover:not(:has(.text-content:hover))]:ring-2 [&:hover:not(:has(.text-content:hover))]:ring-blue-500/50 [&:hover:not(:has(.text-content:hover))]:rounded-md cursor-pointer"
            : isEditable
              ? "[&:hover:not(:has(.text-content:hover))]:ring-2 [&:hover:not(:has(.text-content:hover))]:ring-blue-500/50 [&:hover:not(:has(.text-content:hover))]:rounded-md"
              : ""
            }`}
          onMouseEnter={(e) => {
            if (
              onContainerClick &&
              hoveredElement !== "title" &&
              hoveredElement !== "description"
            ) {
              setHoveredElement("container");
            }
            if (leaveTimeoutRef.current) {
              clearTimeout(leaveTimeoutRef.current);
              leaveTimeoutRef.current = null;
            }
          }}
          onMouseLeave={(e) => {
            if (hoveredElement === "container") {
              leaveTimeoutRef.current = setTimeout(() => {
                if (hoveredElement === "container") {
                  setHoveredElement(null);
                }
              }, 50);
            }
          }}
          {...containerInteractiveProps}
        >
          {/* Container background layer - separate layer with opacity */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-md pointer-events-none"
            style={{
              background: useGradient
                ? containerInverted
                  ? `linear-gradient(to bottom, rgb(255, 255, 255), rgba(255, 255, 255, 0.2))`
                  : `linear-gradient(to bottom, rgb(0, 0, 0), rgba(0, 0, 0, 0.2))`
                : containerInverted
                  ? "rgb(255, 255, 255)"
                  : "rgb(0, 0, 0)",
              opacity: containerBlockOpacity,
            }}
          />

          {isEditable && onContainerClick && hoveredElement === "container" && (
            <div className="absolute top-[-7px] left-[-7px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
              <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
            </div>
          )}

          {/* Content layer - text without opacity */}
          <div
            className="text-content p-4 text-center flex flex-col items-center justify-center relative z-10"
            style={{
              color: containerInverted ? "#020617" : brandColor,
            }}
          >
            {heroTitleSlot || (
              <h1
                className={`text-content mb-4 sm:mb-6 font-dm-serif text-3xl sm:text-4xl md:text-5xl lg:text-[48px] w-full sm:w-4/5 relative z-10 ${onHeroTitleClick
                  ? `cursor-pointer transition-all ${showEditIndicators ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " : ""}${showEditIndicators && hoveredElement === "title"
                    ? "opacity-90 ring-2 ring-blue-500/50 rounded-md px-2 -mx-2"
                    : showEditIndicators ? "hover:opacity-90" : ""
                  }`
                  : ""
                  }`}
                style={{
                  pointerEvents: onHeroTitleClick ? "auto" : "auto",
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  if (showEditIndicators && onHeroTitleClick) {
                    setHoveredElement("title");
                  }
                }}
                onMouseLeave={(e) => {
                  if (hoveredElement === "title") {
                    setHoveredElement(null);
                  }
                }}
                {...titleInteractiveProps}
              >
                {/* Edit icon indicator */}
                {showEditIndicators && onHeroTitleClick && hoveredElement === "title" && (
                  <div className="absolute top-[-7px] left-[-7px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                    <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </div>
                )}
                {(() => {
                  const title = heroTitle || defaultTitle;
                  const companyName = companyData?.companyName || "";
                  if (companyName && title.includes(companyName)) {
                    // Split title to highlight company name
                    const parts = title.split(companyName);
                    return (
                      <>
                        <span
                          style={{
                            color: containerInverted ? "#020617" : "#ffffff",
                          }}
                        >
                          {parts[0]}
                        </span>
                        <span
                          style={{
                            color: containerInverted ? "#5c4106" : "#b68f40",
                          }}
                        >
                          {companyName}
                        </span>
                        <span
                          style={{
                            color: containerInverted ? "#020617" : "#ffffff",
                          }}
                        >
                          {parts[1]}
                        </span>
                      </>
                    );
                  }
                  return (
                    <span
                      style={{
                        color: containerInverted ? "#020617" : "#ffffff",
                      }}
                    >
                      {title}
                    </span>
                  );
                })()}
              </h1>
            )}
            {heroDescriptionSlot ||
              (() => {
                const description = heroDescription || defaultDescription;
                const paragraphs = description
                  .split("\n\n")
                  .filter((p) => p.trim());

                return paragraphs.length > 1 ? (
                  <div
                    className={`w-full text-center relative z-10 ${onHeroDescriptionClick
                      ? `cursor-pointer transition-all ${showEditIndicators ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 " : ""}${showEditIndicators && hoveredElement === "description"
                        ? "opacity-90 ring-2 ring-blue-500/50 rounded-lg px-2 -mx-2"
                        : showEditIndicators ? "hover:opacity-90" : ""
                      }`
                      : ""
                      }`}
                    style={{
                      color: containerInverted ? "#020617" : "#ffffff",
                      pointerEvents: onHeroDescriptionClick ? "auto" : "auto",
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      if (showEditIndicators && onHeroDescriptionClick) {
                        setHoveredElement("description");
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      if (hoveredElement === "description") {
                        setHoveredElement(null);
                      }
                    }}
                    {...descriptionInteractiveProps}
                  >
                    {/* Edit icon indicator for description */}
                    {showEditIndicators && onHeroDescriptionClick &&
                      hoveredElement === "description" && (
                        <div className="absolute top-[-7px] left-[-7px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                          <Pencil
                            className="w-3 h-3 text-white"
                            strokeWidth={2.5}
                          />
                        </div>
                      )}
                    <p className="text-content font-red-hat text-base leading-relaxed whitespace-pre-line text-inherit">
                      {description}
                    </p>
                  </div>
                ) : (
                  <p
                    className={`text-content font-red-hat text-sm sm:text-base leading-relaxed transition-all duration-600 ease-out opacity-100 translate-y-0 w-full sm:w-4/5 relative z-10 ${onHeroDescriptionClick
                      ? `cursor-pointer transition-all ${showEditIndicators ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 " : ""}${showEditIndicators && hoveredElement === "description"
                        ? "opacity-90 ring-2 ring-blue-500/50 rounded-lg px-2 -mx-2"
                        : showEditIndicators ? "hover:opacity-90" : ""
                      }`
                      : ""
                      }`}
                    style={{
                      color: containerInverted ? "#020617" : "#ffffff",
                      pointerEvents: onHeroDescriptionClick ? "auto" : "auto",
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      if (showEditIndicators && onHeroDescriptionClick) {
                        setHoveredElement("description");
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      if (hoveredElement === "description") {
                        setHoveredElement(null);
                      }
                    }}
                    {...descriptionInteractiveProps}
                  >
                    {/* Edit icon indicator for single paragraph */}
                    {showEditIndicators && onHeroDescriptionClick &&
                      hoveredElement === "description" && (
                        <div className="absolute top-[-7px] left-[-7px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                          <Pencil
                            className="w-3 h-3 text-white"
                            strokeWidth={2.5}
                          />
                        </div>
                      )}
                    {description}
                  </p>
                );
              })()}
          </div>
        </div>
      </div>

      {/* Scroll Arrow */}
      <button
        onClick={handleScrollDown}
        className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 z-20 cursor-pointer group"
        aria-label="Scroll to mission section"
      >
        <ChevronDown
          className="w-12 h-8 sm:w-24 sm:h-16 text-white animate-bounce-slow transition-transform group-hover:scale-110"
          strokeWidth={1}
        />
      </button>
    </section>
  );
}
