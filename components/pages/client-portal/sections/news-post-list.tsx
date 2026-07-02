"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, ArrowRight } from "lucide-react";
import { useNewsPostAssets } from "@/hooks/useMarketingAssets";

interface NewsPostListProps {
  clientId?: string;
  brandColor?: string;
  secondaryColor?: string;
}

/** Map of bgImage IDs to their public paths — mirrors NEWS_POST_BG_IMAGES in marketing-asset-modal */
const BG_IMAGE_MAP: Record<string, string> = {
  bg_01: "/news-post-bg-images/news_post_bg_image_01.webp",
  bg_02: "/news-post-bg-images/news_post_bg_image_02.webp",
  bg_03: "/news-post-bg-images/news_post_bg_image_03.webp",
  bg_04: "/news-post-bg-images/news_post_bg_image_04.webp",
};

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  Announcement: "bg-white/20 text-white border-white/30 backdrop-blur-sm",
  News: "bg-white/20 text-white border-white/30 backdrop-blur-sm",
  Event: "bg-white/20 text-white border-white/30 backdrop-blur-sm",
  Reminder: "bg-white/20 text-white border-white/30 backdrop-blur-sm",
};

const FALLBACK_BADGE = "bg-white/20 text-white border-white/30 backdrop-blur-sm";

function getBadgeClass(_category: string): string {
  return CATEGORY_BADGE_STYLES[_category] || FALLBACK_BADGE;
}

export function NewsPostList({
  clientId,
  brandColor = "#1F3A60",
}: NewsPostListProps) {
  const { assets: newsPosts, isLoading } = useNewsPostAssets(clientId);

  const publishedPosts = useMemo(() => {
    return [...newsPosts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [newsPosts]);

  if (isLoading) {
    return (
      <section className="px-4 py-16 sm:px-6 lg:px-8 bg-gray-50">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="mx-auto h-10 w-48 rounded bg-gray-200" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-64 rounded-xl bg-gray-200" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (publishedPosts.length === 0) {
    return null;
  }

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 bg-gray-50">
      <div className="mx-auto max-w-7xl">
        <h2
          className="mb-12 text-center font-dm-serif text-[40px] font-normal leading-tight"
          style={{ color: brandColor }}
        >
          Announcements
        </h2>

        <div className="grid grid-cols-1 gap-6">
          {publishedPosts.map((post, index) => {
            const data = (post.data as Record<string, unknown> | null) ?? {};
            const subtitle = (data.flyerSubtitle as string) || "";
            const category = (data.category as string) || "Announcement";
            const bgImageId = (data.bgImage as string) || "";
            const bgSrc = bgImageId ? BG_IMAGE_MAP[bgImageId] || "" : "";
            const hasBg = !!bgSrc;

            const formatDate = (d: string | null | undefined) =>
              d
                ? new Date(d).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : null;

            const startDateFormatted = formatDate(post.startDate);
            const endDateFormatted = formatDate(post.endDate);
            const dateStr = [startDateFormatted, endDateFormatted ? ` - ${endDateFormatted}` : ""]
              .filter(Boolean)
              .join("");

            const fadeUp = {
              hidden: { opacity: 0, y: 40 },
              visible: { opacity: 1, y: 0 },
            };

            return (
              <motion.div
                key={post.id}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
              >
                <div
                  className="group relative h-full min-h-[360px] rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                  style={!hasBg ? { background: `linear-gradient(135deg, ${brandColor} 0%, #2c4b80 100%)` } : undefined}
                >
                  {/* Background image */}
                  {hasBg && (
                    <img
                      src={bgSrc}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}

                  {/* Dark overlay — left-to-right gradient: dark on left for text, transparent on right for image */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />

                  {/* Content — constrained to the dark left portion */}
                  <div className="relative z-10 flex flex-col h-full p-6 sm:p-8 max-w-[60%] sm:max-w-[55%]">
                    {/* Category badge + date */}
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getBadgeClass(category)}`}
                      >
                        {category}
                      </span>
                      {post.createdAt && (
                        <span className="text-xs text-white/70 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>

                    {/* Headline */}
                    <h3 className="font-dm-serif text-xl font-bold leading-tight text-white sm:text-2xl">
                      {post.headline || "Announcement"}
                    </h3>

                    {/* Subtitle */}
                    {subtitle && (
                      <p className="text-sm text-white/80 mt-1.5">{subtitle}</p>
                    )}

                    {/* Date range */}
                    {dateStr && (
                      <p className="text-xs text-white/60 mt-2 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {dateStr}
                      </p>
                    )}

                    {/* Body */}
                    {post.body && (
                      <p className="text-sm text-gray-200 leading-relaxed line-clamp-3 mt-3 flex-1">
                        {post.body}
                      </p>
                    )}

                    {/* CTA */}
                    {post.ctaText && (
                      <div className="mt-auto pt-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 backdrop-blur-sm px-4 py-2 text-xs font-semibold text-white shadow-sm border border-white/30 transition-all duration-200 group-hover:bg-white/30">
                          {post.ctaText}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
