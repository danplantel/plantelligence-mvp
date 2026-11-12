"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, Pencil, Search } from "lucide-react";
import { useRef, KeyboardEvent, ReactNode, useMemo, useState } from "react";
import {
  ASSISTANT_ASK_EVENT,
  buildAssistantCorpus,
  searchAssistantTopics,
  type AssistantTopic,
} from "@/lib/topics/assistant";
import { PortalSectionEditButton } from "@/components/portal-editing/portal-section-edit-button";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { isR2BrandingKey } from "@/lib/branding-image-url";
import { PORTAL_SECTION_IDS } from "@/lib/portal-editor-sections";
import { portalRadiusValue } from "@/lib/typography-themes";
import { readableColor } from "polished";

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
  /** Desktop-specific background image position (percentage-based).
   *  Applied via object-position on the hero background <img>. */
  desktopHeroBackgroundPosition?: { x: number; y: number };
  /** Mobile-specific background image position (percentage-based).
   *  Applied via object-position on the hero background <img>. */
  mobileHeroBackgroundPosition?: { x: number; y: number };
}

/** Extra breathing room between the fixed chrome and the lifted Ask bar. */
const ASK_BAR_TOP_GAP = 10;

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
  desktopHeroBackgroundPosition,
  mobileHeroBackgroundPosition,
}: PortalHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const askBarRef = useRef<HTMLDivElement>(null);
  const [hoveredElement, setHoveredElement] = useState<
    "background" | "container" | "title" | "description" | null
  >(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── The Ask bar, backed by the shipped topic library ──
  // The index is built once: the same library the assistant and the hubs read.
  const topicIndex = useMemo(() => buildAssistantCorpus(), []);
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestions = useMemo<AssistantTopic[]>(() => {
    const needle = query.trim();
    if (needle.length < 2) return [];
    return searchAssistantTopics(topicIndex, needle, 5)
      .matches.filter((match) => match.score >= 20)
      .map((match) => match.topic);
  }, [query, topicIndex]);

  /**
   * Hand the question to the assistant, which holds this plan's placements and can
   * answer with the topic's own copy, CTA and deep link. One window event keeps the
   * hero and the sheet decoupled.
   */
  const askQuestion = (question: string) => {
    const text = question.trim();
    if (!text) return;
    window.dispatchEvent(
      new CustomEvent(ASSISTANT_ASK_EVENT, { detail: { question: text } }),
    );
    setQuery("");
    setSuggestionsOpen(false);
  };

  /**
   * Lift the Ask bar to the top of the viewport when the field takes focus, so the
   * suggestion list opens into clear space instead of below the fold.
   *
   * The portal's banner + header are fixed, so their height is subtracted; without
   * that chrome (a preview, a test) the bar simply goes to the viewport's top. The
   * maths stays in viewport coordinates, which keeps it correct inside the scaled
   * editing preview. Works the same on a phone: the input stays at the top and the
   * keyboard rises beneath it.
   */
  const pinAskBar = () => {
    const bar = askBarRef.current;
    if (!bar) return;
    const chrome = document.querySelector<HTMLElement>("[data-portal-header]");
    const chromeHeight = chrome
      ? Math.max(0, chrome.getBoundingClientRect().bottom)
      : 0;
    const top =
      bar.getBoundingClientRect().top +
      window.scrollY -
      chromeHeight -
      ASK_BAR_TOP_GAP;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const defaultTitle = `Welcome to the ${
    companyData?.companyName || "Company Name"
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
    "";
  const { url: backgroundImg, loading: backgroundImgLoading } =
    useBrandingImageUrl(backgroundImgRaw || null);
  const isR2Background = isR2BrandingKey(backgroundImgRaw);
  const displayBackgroundSrc = isR2Background
    ? backgroundImg ?? undefined
    : (backgroundImg ?? backgroundImgRaw) || undefined;
  const hasBackgroundImage = Boolean(backgroundImgRaw?.trim());

  /**
   * The wash colour, as an RGB triplet — white when the plan inverted the
   * container, black otherwise. Both washes below are built from it so they can
   * never drift apart.
   */
  const washRgb = containerInverted ? "255, 255, 255" : "0, 0, 0";
  /**
   * What the text card paints behind itself, from `sm` up: the plan's gradient
   * when it asked for one, a flat plate when it did not.
   */
  const cardWash = useGradient
    ? `linear-gradient(to bottom, rgb(${washRgb}), rgba(${washRgb}, 0.2))`
    : `rgb(${washRgb})`;
  /**
   * What a phone paints across the WHOLE hero — always the gradient form.
   *
   * On a narrow screen the card is nearly the page's width, so its plate read as
   * a hard-edged rectangle floating in the middle of the photograph. Full-bleed
   * reads as the image's own treatment instead. It is always the gradient, even
   * for a plan that chose a flat plate: a flat fill stretched over 600px of
   * photograph would black it out, while the gradient keeps the image legible
   * under the text and clears towards the bottom.
   */
  const mobileWash = `linear-gradient(to bottom, rgb(${washRgb}), rgba(${washRgb}, 0.2))`;

  // Use a unique ID so the media‑query style can target this section precisely
  const sectionId = "hero-bg-section";

  const isEditable = Boolean(
    showEditIndicators &&
      (onHeroTitleClick ||
        onHeroDescriptionClick ||
        onContainerClick ||
        // The photograph behind the banner is its own region — the "Hero Banner
        // Image" card — so a hero wired ONLY to it must still show the ring and
        // the pencil, or the affordance would exist without ever appearing.
        onBackgroundClick),
  );

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
      className={`px-4 sm:px-6 lg:px-20 min-h-[600px] sm:min-h-[700px] lg:min-h-screen sm:pt-0 relative isolate overflow-hidden flex justify-center items-center ${
        hasBackgroundImage ? "bg-[#FEFCF7]" : "bg-white"
      }`}
    >
      <div className="absolute inset-0">
        {hasBackgroundImage ? (
          <>
            {/* Background Image Container - uses opacity for full transparency control */}
            <div
              className={`absolute inset-0 transition-all z-0 ${
                isEditable && hoveredElement === "background"
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
              {isR2Background &&
              !displayBackgroundSrc &&
              backgroundImgLoading ? (
                <div
                  className="absolute inset-0 animate-pulse bg-muted/50"
                  aria-hidden
                />
              ) : displayBackgroundSrc ? (
                <>
                  <img
                    id="hero-bg-img"
                    src={displayBackgroundSrc}
                    alt="Company background"
                    className="w-full h-full object-cover pointer-events-none"
                    style={
                      desktopHeroBackgroundPosition
                        ? {
                            objectPosition: `${desktopHeroBackgroundPosition.x}% ${desktopHeroBackgroundPosition.y}%`,
                          }
                        : undefined
                    }
                  />
                  {mobileHeroBackgroundPosition && (
                    <style>{`
                      @media (max-width: 640px) {
                        #hero-bg-img {
                          object-position: ${mobileHeroBackgroundPosition.x}% ${mobileHeroBackgroundPosition.y}% !important;
                        }
                      }
                    `}</style>
                  )}
                </>
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

            </div>
          </>
        ) : (
          <div className="w-full h-full bg-white" />
        )}
      </div>

      {/* The photograph's own affordance, on the left like the pencil it replaces:
          a labelled button, because "the photograph" is not guessable from a bare
          icon, and it names the card it opens — "Hero Banner Image", the second
          card of the panel's Images section. Renders only for an advisor; see
          PortalSectionEditButton. */}
      {hasBackgroundImage && (
        <PortalSectionEditButton
          sectionId={PORTAL_SECTION_IDS.heroBackground}
          label="Edit Hero Banner Image"
          // `top-4`, not a header-sized offset: the layout already pads the page
          // by the fixed header's height, so the hero's own top edge is clear.
          className="left-4 top-4"
        />
      )}

      {/* Phone-only wash, across the whole hero — see `mobileWash`. Above `sm`
          this layer is off and the text card carries the wash instead. */}
      <div
        aria-hidden="true"
        data-testid="hero-mobile-gradient"
        className="pointer-events-none absolute inset-0 z-[1] sm:hidden"
        style={{ background: mobileWash, opacity: containerBlockOpacity }}
      />

      <div className="z-10 relative flex justify-center items-center px-2 sm:px-6 lg:px-8 box-border h-full w-full">
        <div
          data-container="true"
          className={`text-container relative lg:bottom-20 flex items-center justify-center px-4 sm:px-6 lg:px-10 box-border min-h-[280px] sm:min-h-[320px] w-full max-w-[900px] mx-auto transition-all relative ${
            isEditable && onContainerClick
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
          {/* Container background layer - separate layer with opacity.
              Desktop and tablet only: on phones the wash is the hero-wide layer
              above, and painting this too would double it over the text. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden rounded-md pointer-events-none sm:block"
            style={{
              borderRadius: portalRadiusValue(),
              background: cardWash,
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
            className="text-content p-4 text-center flex flex-col items-center justify-center relative z-10 w-full max-w-full min-w-0"
            style={{
              color: containerInverted ? "#020617" : brandColor,
            }}
          >
            {heroTitleSlot || (
              <h1
                className={`text-content mb-4 sm:mb-6 font-dm-serif text-3xl sm:text-4xl md:text-5xl lg:text-[48px] w-full sm:w-4/5 relative z-10 ${
                  onHeroTitleClick
                    ? `cursor-pointer transition-all ${
                        showEditIndicators
                          ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 "
                          : ""
                      }${
                        showEditIndicators && hoveredElement === "title"
                          ? "opacity-90 ring-2 ring-blue-500/50 rounded-md px-2 -mx-2"
                          : showEditIndicators
                          ? "hover:opacity-90"
                          : ""
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
                {showEditIndicators &&
                  onHeroTitleClick &&
                  hoveredElement === "title" && (
                    <div className="absolute top-[-7px] left-[-7px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                      <Pencil
                        className="w-3 h-3 text-white"
                        strokeWidth={2.5}
                      />
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
            {/* Phone: the body copy is left-aligned so it sits flush against
                the image's edge instead of floating in a centred column; from
                `sm` up it returns to the centred layout the card was built
                for. */}
            {heroDescriptionSlot ||
              (() => {
                const description = heroDescription || defaultDescription;
                const paragraphs = description
                  .split("\n\n")
                  .filter((p) => p.trim());

                return paragraphs.length > 1 ? (
                  <div
                    className={`w-full text-left sm:text-center relative z-10 ${
                      onHeroDescriptionClick
                        ? `cursor-pointer transition-all ${
                            showEditIndicators
                              ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 "
                              : ""
                          }${
                            showEditIndicators &&
                            hoveredElement === "description"
                              ? "opacity-90 ring-2 ring-blue-500/50 rounded-lg px-2 -mx-2"
                              : showEditIndicators
                              ? "hover:opacity-90"
                              : ""
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
                    {showEditIndicators &&
                      onHeroDescriptionClick &&
                      hoveredElement === "description" && (
                        <div className="absolute top-[-7px] left-[-7px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                          <Pencil
                            className="w-3 h-3 text-white"
                            strokeWidth={2.5}
                          />
                        </div>
                      )}
                    <p className="text-content font-red-hat text-lg leading-relaxed whitespace-pre-line break-words text-inherit w-full max-w-full">
                      {description}
                    </p>
                  </div>
                ) : (
                  <p
                    className={`text-content font-red-hat text-sm sm:text-base leading-relaxed transition-all duration-600 ease-out opacity-100 translate-y-0 w-full text-left sm:w-4/5 sm:text-center relative z-10 ${
                      onHeroDescriptionClick
                        ? `cursor-pointer transition-all ${
                            showEditIndicators
                              ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 "
                              : ""
                          }${
                            showEditIndicators &&
                            hoveredElement === "description"
                              ? "opacity-90 ring-2 ring-blue-500/50 rounded-lg px-2 -mx-2"
                              : showEditIndicators
                              ? "hover:opacity-90"
                              : ""
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
                    {showEditIndicators &&
                      onHeroDescriptionClick &&
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

            {/* Ask / search bar — searches the shipped topic library as the visitor
                types, and hands the chosen question to the assistant (see
                `ASSISTANT_ASK_EVENT`). Clicks are stopped here so using the field in
                the editing preview never opens the container editor. */}
            <div
              ref={askBarRef}
              data-testid="portal-hero-ask-bar"
              className="relative z-10 mt-6 w-full"
              onClick={(event) => event.stopPropagation()}
            >
              <form
                role="search"
                className="flex w-full items-center gap-2 rounded-xl bg-white p-1.5 pl-4 shadow-lg"
                onSubmit={(event) => {
                  event.preventDefault();
                  askQuestion(query);
                }}
                style={{ borderRadius: portalRadiusValue(1.5) }}
              >
                <Search
                  className="h-4 w-4 shrink-0 text-gray-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => {
                    setSuggestionsOpen(true);
                    pinAskBar();
                  }}
                  onBlur={() =>
                    setTimeout(() => setSuggestionsOpen(false), 120)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setSuggestionsOpen(false);
                  }}
                  aria-label="Ask a question or search for your benefits"
                  aria-controls="portal-hero-topic-suggestions"
                  autoComplete="off"
                  placeholder="Ask a question or search for your benefits ..."
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                />
                <Button
                  type="submit"
                  // Primary brand colour like every other CTA on the landing page,
                  // with the readable colour for the label instead of a fixed white.
                  className="h-9 shrink-0 rounded-lg px-5 text-sm font-semibold shadow-none"
                  style={{
                    backgroundColor: brandColor,
                    color: readableColor(brandColor),
                    borderRadius: portalRadiusValue(),
                  }}
                >
                  Ask
                </Button>
              </form>

              {suggestionsOpen && suggestions.length > 0 ? (
                <div
                  id="portal-hero-topic-suggestions"
                  data-testid="hero-topic-suggestions"
                  aria-label="Matching benefit topics"
                  // Keep the input focused so a click lands before the blur timer.
                  onMouseDown={(event) => event.preventDefault()}
                  className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-black/5 bg-white text-left shadow-xl"
                >
                  <p className="px-4 pb-1 pt-2.5 font-red-hat text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Topics in your benefits library
                  </p>
                  <ul>
                    {suggestions.map((topic) => (
                      <li key={`${topic.location}:${topic.slug}`}>
                        <button
                          type="button"
                          onClick={() => askQuestion(topic.title)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-red-hat text-sm font-medium text-gray-900">
                              {topic.title}
                            </span>
                            <span className="block truncate font-red-hat text-[11px] text-gray-500">
                              {topic.locationLabel}
                              {topic.group ? ` · ${topic.group}` : ""}
                            </span>
                          </span>
                          <Search
                            className="h-3.5 w-3.5 shrink-0 text-gray-300"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
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
