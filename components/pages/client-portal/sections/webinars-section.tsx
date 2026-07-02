"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import {
  ArrowUpRight,
  Calendar,
  Clock,
  MapPin,
  MessageCircle,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";

export interface UpcomingWebinar {
  id?: number | string;
  title: string;
  date: string;
  time?: string;
  format?: string;
  platform?: string;
  link?: string;
  location?: string;
  /** Prefer this for REGISTER when set (plan meetings). */
  registrationLink?: string;
  replayLink?: string;
  isPast?: boolean;
}

type WebinarLanguage = "EN" | "ES";

interface WebinarReplay {
  id: number | string;
  title: string;
  duration?: string;
  isPopular?: boolean;
  thumbnail?: string;
  videoUrl?: string | null;
  videoFileUrl?: string | null;
  eventDate?: Date | string;
  language?: WebinarLanguage;
}

interface RecentMessage {
  id: number;
  sender: string;
  time: string;
  message: string;
  avatar: string;
}

interface WebinarsSectionProps {
  secondaryColor?: string;
  clientId?: string;
  onLoadComplete?: () => void;
}

const parseLocalDate = (dateStr: string): Date => {
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};

function hubDateKey(iso: string) {
  if (iso.match(/^\d{4}-\d{2}-\d{2}$/)) return iso;
  return iso.slice(0, 10);
}

/** True when the value is a usable web URL for the Register/Join CTA. */
function hasWebUrlPrefix(s: string) {
  return /^https?:\/\//i.test(s);
}

/**
 * Pasted links often omit https://. Turn bare host/path forms into a valid
 * `https://…` URL so the portal Register button can enable and navigate.
 */
function coerceToHttpUrl(s: string): string | undefined {
  const t = s.trim();
  if (!t) return undefined;
  if (hasWebUrlPrefix(t)) return t;
  if (/\s/.test(t) || t.length < 4 || !t.includes(".")) return undefined;
  if (/^[\w+.-]+:/.test(t)) return undefined;
  return `https://${t}`;
}

function firstRegisterableUrl(...candidates: (string | undefined)[]) {
  for (const c of candidates) {
    if (!c) continue;
    const u = hasWebUrlPrefix(c) ? c.trim() : coerceToHttpUrl(c);
    if (u && hasWebUrlPrefix(u)) return u;
  }
  return undefined;
}

/** Convert 24h time string to 12h AM/PM format */
function formatTime12h(time24: string): string {
  if (!time24) return "";
  const [hour24, minute] = time24.split(":").map(Number);
  if (isNaN(hour24) || isNaN(minute)) return time24;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

function mapHubMeetingToWebinar(
  m: Record<string, unknown>,
  isPast: boolean,
): UpcomingWebinar | null {
  const title = typeof m.meeting === "string" ? m.meeting : "";
  const dateRaw = typeof m.date === "string" ? m.date : "";
  const time = typeof m.time === "string" ? m.time : "";
  if (!title || !dateRaw || !time) return null;

  const reg =
    typeof m.registrationUrl === "string" ? m.registrationUrl.trim() : "";
  const meetLink =
    typeof m.meetingLink === "string" ? m.meetingLink.trim() : "";
  const loc =
    typeof m.hubLocation === "string" ? m.hubLocation.trim() : "";
  const replay =
    typeof m.replayUrl === "string" ? m.replayUrl.trim() : "";
  const meetingType =
    typeof m.meetingType === "string" ? m.meetingType : "General";
  const tz =
    typeof m.timezone === "string" && m.timezone.trim()
      ? m.timezone.trim()
      : "";

  const isUrl = (s: string) => hasWebUrlPrefix(s);
  const locAsLink = loc && isUrl(loc) ? loc : undefined;
  const registerUrl = firstRegisterableUrl(reg, meetLink, locAsLink);

  return {
    id: typeof m.id === "string" ? m.id : undefined,
    title,
    date: format(parseLocalDate(hubDateKey(dateRaw)), "MM/dd/yyyy"),
    time: tz ? `${formatTime12h(time)} (${tz})` : formatTime12h(time),
    format: meetingType,
    link: locAsLink,
    registrationLink: registerUrl,
    location: loc && !isUrl(loc) ? loc : undefined,
    replayLink: replay || undefined,
    isPast,
  };
}

function isHttpUrl(s: string | undefined): s is string {
  return Boolean(s && /^https?:\/\//i.test(s.trim()));
}

export function UpcomingWebinarCard({
  webinar,
  secondaryColor,
}: {
  webinar: UpcomingWebinar;
  secondaryColor?: string;
}) {
  const accentColor = secondaryColor ?? "#C9A961";
  const registerHref =
    (webinar.registrationLink?.trim() || webinar.link?.trim() || "").trim();
  const canRegister = isHttpUrl(registerHref);
  const locationLabel = webinar.location?.trim();
  const timeLabel = webinar.time || "";
  const formatLabel = webinar.format || "Group Sessions";
  const isPast = Boolean(webinar.isPast);
  const replayHref = webinar.replayLink?.trim();
  const canReplay = isHttpUrl(replayHref);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Top accent bar */}
      <div style={{ backgroundColor: accentColor }} className="h-2 w-full shrink-0" />

      {/* Calendar icon + session type row */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-3">
        <div
          className="inline-flex p-2.5 rounded-lg shrink-0"
          style={{ backgroundColor: accentColor + "18" }}
        >
          <Calendar className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
          {formatLabel}
        </span>
      </div>

      {/* Content body */}
      <div className="px-6 pb-4 flex-1 space-y-4">
        <h3 className="text-xl font-bold text-[#002B5B] leading-snug">
          {webinar.title}
        </h3>

        {/* Description placeholder */}
        <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
          <p>
            Join us for this informative session covering key plan features and strategies
            to help you make informed decisions about your benefits.
          </p>
          <p className="font-semibold text-gray-800">What we&rsquo;ll cover:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Plan features and investment options</li>
            <li>How to make the most of your benefits</li>
            <li>Key dates and deadlines</li>
            <li>Resources available to help</li>
          </ul>
        </div>

        {/* Details */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          {webinar.date && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <Calendar className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              <span className="font-medium">{webinar.date}</span>
            </div>
          )}
          {timeLabel && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <Clock className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              <span>{timeLabel}</span>
            </div>
          )}
          {locationLabel && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <MapPin className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              <span>{locationLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA footer */}
      <div className="px-6 pb-6 pt-0">
        {isPast ? (
          canReplay ? (
            <a
              href={replayHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              <Clock className="w-4 h-4" />
              Watch replay
            </a>
          ) : (
            <p className="text-xs text-gray-400">Replay not available</p>
          )
        ) : canRegister ? (
          <a
            href={registerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            <ArrowUpRight className="w-4 h-4" />
            Register for this Session
          </a>
        ) : (
          <button
            disabled
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white rounded-lg opacity-50 cursor-not-allowed"
            style={{ backgroundColor: accentColor }}
          >
            <ArrowUpRight className="w-4 h-4" />
            Register for this Session
          </button>
        )}
      </div>
    </div>
  );
}

// Example usage
export default function WebinarCardExample() {
  const exampleWebinar: UpcomingWebinar = {
    title: "Retirement Planning 101",
    date: "July 15, 2024",
    time: "2:00 PM ES",
    format: "On site, Virtual, Webinar",
    location: "Location or link",
    link: "#",
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-[#002B5B] mb-8 text-center">
          Upcoming Meetings & Webinars
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <UpcomingWebinarCard
            webinar={exampleWebinar}
            secondaryColor="#C9A961"
          />
          <UpcomingWebinarCard
            webinar={exampleWebinar}
            secondaryColor="#C9A961"
          />
          <UpcomingWebinarCard
            webinar={exampleWebinar}
            secondaryColor="#C9A961"
          />
          <UpcomingWebinarCard
            webinar={exampleWebinar}
            secondaryColor="#C9A961"
          />
          <UpcomingWebinarCard
            webinar={exampleWebinar}
            secondaryColor="#C9A961"
          />
          <UpcomingWebinarCard
            webinar={exampleWebinar}
            secondaryColor="#C9A961"
          />
        </div>
      </div>
    </div>
  );
}
// Helper function to detect language from webinar title
function guessLanguageFromWebinar(webinar: any): WebinarLanguage {
  const source = `${webinar.webinarTitle || ""} ${
    webinar.description || ""
  }`.toLowerCase();

  // Check for Spanish markers (more comprehensive)
  const spanishMarkers = [
    "[es]",
    "(es)",
    " español",
    "spanish",
    "español",
    "espanol", // without accent
    "castellano",
    "hispano",
  ];

  // Check if any Spanish marker is found
  const hasSpanishMarker = spanishMarkers.some((marker) =>
    source.includes(marker),
  );

  if (hasSpanishMarker) {
    return "ES";
  }

  // Check for common Spanish words/patterns
  const spanishWords = [
    "aquí",
    "puedes",
    "ver",
    "video",
    "guía",
    "completa",
    "opciones",
    "plan",
    "jubilación",
    "beneficios",
    "seguro",
    "vida",
    "salud",
    "bienestar",
  ];

  const hasSpanishWords = spanishWords.some((word) => source.includes(word));

  if (hasSpanishWords) {
    return "ES";
  }

  // Default to English
  return "EN";
}

// Helper function to convert YouTube/Vimeo URLs to embed format
function getEmbedUrl(url: string): string | null {
  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
  );
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

function WebinarReplayCard({
  replay,
  secondaryColor = "#FBBF24",
}: {
  replay: WebinarReplay;
  secondaryColor?: string;
}) {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const hasVideo = Boolean(replay.videoUrl || replay.videoFileUrl);

  const handleVideoClick = () => {
    if (hasVideo) {
      setIsVideoModalOpen(true);
    }
  };

  const getVideoSrc = () => {
    if (replay.videoUrl) {
      const embedUrl = getEmbedUrl(replay.videoUrl);
      return embedUrl || replay.videoUrl;
    }
    if (replay.videoFileUrl) {
      return `data:video/mp4;base64,${replay.videoFileUrl}`;
    }
    return null;
  };

  const isEmbedUrl = (url: string | null) => {
    if (!url) return false;
    return (
      url.includes("youtube.com/embed") ||
      url.includes("vimeo.com/video") ||
      url.includes("player.vimeo.com")
    );
  };

  const videoSrc = getVideoSrc();
  const isEmbed = videoSrc ? isEmbedUrl(videoSrc) : false;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
        <div
          className="relative aspect-video bg-gray-900"
          onClick={handleVideoClick}
        >
          {hasVideo ? (
            replay.videoUrl ? (
              (() => {
                const embedUrl = getEmbedUrl(replay.videoUrl);
                if (embedUrl) {
                  // YouTube or Vimeo embed - thumbnail preview
                  return (
                    <>
                      <img
                        src={`https://img.youtube.com/vi/${
                          embedUrl.match(/embed\/([^?]+)/)?.[1] || ""
                        }/maxresdefault.jpg`}
                        alt={replay.title}
                        className="w-full h-full object-cover opacity-90"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="bg-red-600 rounded-full w-20 h-20 flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg">
                          <div className="w-0 h-0 border-l-[24px] border-l-white border-t-[15px] border-t-transparent border-b-[15px] border-b-transparent ml-1"></div>
                        </div>
                      </div>
                    </>
                  );
                } else {
                  // Direct video URL - show video preview
                  return (
                    <video
                      className="absolute top-0 left-0 w-full h-full"
                      controls={false}
                      src={replay.videoUrl}
                      muted
                      playsInline
                    >
                      Your browser does not support the video tag.
                    </video>
                  );
                }
              })()
            ) : replay.videoFileUrl ? (
              // Base64 uploaded video - show video preview
              <video
                className="absolute top-0 left-0 w-full h-full"
                controls={false}
                src={`data:video/mp4;base64,${replay.videoFileUrl}`}
                muted
                playsInline
              >
                Your browser does not support the video tag.
              </video>
            ) : null
          ) : replay.thumbnail ? (
            // Thumbnail with play button
            <>
              <img
                src={replay.thumbnail}
                alt={replay.title}
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-red-600 rounded-full w-20 h-20 flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg">
                  <div className="w-0 h-0 border-l-[24px] border-l-white border-t-[15px] border-t-transparent border-b-[15px] border-b-transparent ml-1"></div>
                </div>
              </div>
            </>
          ) : (
            // Placeholder
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <div className="bg-red-600 rounded-full w-20 h-20 flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg">
                <div className="w-0 h-0 border-l-[24px] border-l-white border-t-[15px] border-t-transparent border-b-[15px] border-b-transparent ml-1"></div>
              </div>
            </div>
          )}
        </div>
        <div className="p-6 space-y-4">
          <h3 className="text-2xl font-bold text-[#002B5B] leading-tight">
            {replay.title}
          </h3>
          <div className="flex items-center gap-4">
            {replay.duration && (
              <div className="flex items-center gap-2 text-gray-600 text-base">
                <Clock className="w-5 h-5" />
                <span>{replay.duration}</span>
              </div>
            )}
            {replay.isPopular && (
              <span className="bg-blue-50 text-blue-700 text-sm px-4 py-1.5 rounded-full font-medium border border-blue-200">
                Popular
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setIsVideoModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg overflow-hidden max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b bg-white">
              <h3 className="text-lg font-semibold text-[#002B5B]">
                {replay.title}
              </h3>
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {videoSrc && (
              <div className="relative w-full pt-[56.25%] bg-black">
                {isEmbed ? (
                  <iframe
                    src={videoSrc}
                    className="absolute top-0 left-0 w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={replay.title}
                  />
                ) : (
                  <video
                    className="absolute top-0 left-0 w-full h-full"
                    controls
                    autoPlay
                    playsInline
                    src={videoSrc}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function RecentMessageCard({
  message,
  secondaryColor = "#FBBF24",
}: {
  message: RecentMessage;
  secondaryColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="bg-gray-200 rounded-full w-12 h-12 flex items-center justify-center text-gray-600 font-semibold flex-shrink-0">
          {message.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="font-semibold" style={{ color: secondaryColor }}>
              {message.sender}
            </h3>
            <span className="text-sm text-gray-500">{message.time}</span>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">
            {message.message}
          </p>
        </div>
      </div>
      <button
        className="flex items-center gap-2 font-medium transition-colors"
        style={{ color: secondaryColor }}
      >
        <MessageCircle className="w-4 h-4" />
        Reply
      </button>
    </div>
  );
}

export function WebinarsSection({
  secondaryColor,
  clientId,
  onLoadComplete,
}: WebinarsSectionProps) {
  const loadCompleteCalled = useRef(false);
  const [upcomingWebinars, setUpcomingWebinars] = useState<UpcomingWebinar[]>(
    [],
  );
  const [pastMeetings, setPastMeetings] = useState<UpcomingWebinar[]>([]);
  const [webinarReplays, setWebinarReplays] = useState<WebinarReplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReplays, setIsLoadingReplays] = useState(true);

  useEffect(() => {
    const fetchPlanMeetings = async () => {
      if (!clientId) {
        setUpcomingWebinars([]);
        setPastMeetings([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/clients/${clientId}/meetings?forHub=1`,
          { credentials: "include", cache: "no-store" },
        );
        const result = await response.json();

        if (
          response.ok &&
          result.success &&
          result.data &&
          typeof result.data === "object" &&
          Array.isArray(result.data.upcoming) &&
          Array.isArray(result.data.past)
        ) {
          const upcoming = result.data.upcoming
            .map((m: Record<string, unknown>) =>
              mapHubMeetingToWebinar(m, false),
            )
            .filter(
              (w: UpcomingWebinar | null): w is UpcomingWebinar => Boolean(w),
            );
          const past = result.data.past
            .map((m: Record<string, unknown>) =>
              mapHubMeetingToWebinar(m, true),
            )
            .filter(
              (w: UpcomingWebinar | null): w is UpcomingWebinar => Boolean(w),
            );
          setUpcomingWebinars(upcoming);
          setPastMeetings(past);
        } else {
          setUpcomingWebinars([]);
          setPastMeetings([]);
        }
      } catch (error) {
        console.error("Failed to load plan meetings for hub:", error);
        setUpcomingWebinars([]);
        setPastMeetings([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlanMeetings();
  }, [clientId]);

  useEffect(() => {
    const fetchWebinarReplays = async () => {
      if (!clientId) {
        setWebinarReplays([]);
        return;
      }

      setIsLoadingReplays(true);
      try {
        const response = await fetch(`/api/webinars`, {
          cache: "no-store",
        });
        const result = await response.json();

        if (response.ok && result.success && Array.isArray(result.data)) {
          // Filter webinars by clientId (plan ID) - only show webinars assigned to this client
          const filtered = result.data.filter(
            (webinar: any) => webinar.clientId === clientId,
          );

          // Transform to WebinarReplay format with language detection
          const transformed: WebinarReplay[] = filtered.map((webinar: any) => ({
            id: webinar.id,
            title: webinar.webinarTitle,
            eventDate: webinar.eventDate,
            videoUrl: webinar.videoUrl,
            videoFileUrl: webinar.videoFileUrl,
            language: guessLanguageFromWebinar(webinar),
            // Optional: calculate duration if available
            // duration: webinar.duration || "N/A",
          }));

          setWebinarReplays(transformed);
        } else {
          setWebinarReplays([]);
        }
      } catch (error) {
        console.error("Failed to load webinar replays:", error);
        setWebinarReplays([]);
      } finally {
        setIsLoadingReplays(false);
      }
    };

    fetchWebinarReplays();
  }, [clientId]);

  // Notify parent when all sections have finished loading
  useEffect(() => {
    if (!isLoading && !isLoadingReplays && onLoadComplete && !loadCompleteCalled.current) {
      loadCompleteCalled.current = true;
      onLoadComplete();
    }
  }, [isLoading, isLoadingReplays]);

  const recentMessages: RecentMessage[] = [
    {
      id: 1,
      sender: "Sarah Johnson",
      time: "2 hours ago",
      message: "Don't forget...",
      avatar: "SJ",
    },
    {
      id: 2,
      sender: "Lisa Rodriguez",
      time: "1 day ago",
      message: "New wellness...",
      avatar: "LR",
    },
  ];

  return (
    <div className="bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Upcoming Meetings & Webinars Section */}
        <div className="space-y-8">
          <h2 className="font-dm-serif text-center text-[40px] font-normal leading-tight text-[#002B5B]">
            Upcoming Meetings & Webinars
          </h2>
          {isLoading && (
            <p className="text-sm text-gray-500">Loading upcoming sessions…</p>
          )}
          {!isLoading && upcomingWebinars.length === 0 && (
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-gray-200 bg-white/70 p-4 text-gray-600">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-gray-400"
              >
                <rect
                  x="6"
                  y="10"
                  width="36"
                  height="32"
                  rx="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="6"
                  y1="18"
                  x2="42"
                  y2="18"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16 6V12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M32 6V12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle
                  cx="24"
                  cy="30"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M24 27V30L26 32"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <p className="font-semibold text-gray-800">
                  No meetings currently scheduled
                </p>
                <p className="text-sm">
                  New sessions will appear here as soon as they are added.
                </p>
              </div>
            </div>
          )}
          {upcomingWebinars.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingWebinars.map((webinar: UpcomingWebinar) => (
                <UpcomingWebinarCard
                  key={webinar.id}
                  webinar={webinar}
                  secondaryColor={secondaryColor}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Past plan meetings */}
        <div className="space-y-8">
          <h2 className="font-dm-serif text-center text-[40px] font-normal leading-tight text-[#002B5B]">
            Past Meetings
          </h2>
          {isLoading && (
            <p className="text-sm text-gray-500 text-center">
              Loading past sessions…
            </p>
          )}
          {!isLoading && pastMeetings.length === 0 && clientId && (
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-gray-200 bg-white/70 p-4 text-gray-600">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-gray-400 shrink-0"
              >
                <rect x="6" y="10" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
                <line x1="6" y1="18" x2="42" y2="18" stroke="currentColor" strokeWidth="2" />
                <path d="M16 6V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M32 6V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="24" cy="30" r="6" stroke="currentColor" strokeWidth="2" />
                <path d="M24 27V30L26 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <p className="font-semibold text-gray-800">No past meetings</p>
                <p className="text-sm">
                  Completed sessions will appear here for this plan.
                </p>
              </div>
            </div>
          )}
          {!isLoading && pastMeetings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastMeetings.map((webinar: UpcomingWebinar) => (
                <UpcomingWebinarCard
                  key={webinar.id}
                  webinar={webinar}
                  secondaryColor={secondaryColor}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Webinar Replays Section */}
        <div className="space-y-8">
          <h2 className="font-dm-serif text-center text-[40px] font-normal leading-tight text-[#002B5B]">
            Webinar Replays
          </h2>

          {isLoadingReplays && (
            <p className="text-sm text-gray-500">Loading replays…</p>
          )}
          {!isLoadingReplays && webinarReplays.length === 0 && (
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-gray-200 bg-white/70 p-4 text-gray-600">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-gray-400"
              >
                <rect
                  x="6"
                  y="10"
                  width="36"
                  height="32"
                  rx="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="6"
                  y1="18"
                  x2="42"
                  y2="18"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16 6V12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M32 6V12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle
                  cx="24"
                  cy="30"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M24 27V30L26 32"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <p className="font-semibold text-gray-800">
                  No webinar replays available
                </p>
                <p className="text-sm">
                  Replays will appear here once webinars are added to this plan.
                </p>
              </div>
            </div>
          )}
          {webinarReplays.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {webinarReplays.map((replay) => (
                <WebinarReplayCard
                  key={replay.id}
                  replay={replay}
                  secondaryColor={secondaryColor}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
