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

const CATEGORY_COLORS: Record<string, string> = {
  Announcement: "bg-blue-100 text-blue-700 border-blue-200",
  News: "bg-green-100 text-green-700 border-green-200",
  Event: "bg-purple-100 text-purple-700 border-purple-200",
  Reminder: "bg-amber-100 text-amber-700 border-amber-200",
};

const FALLBACK_COLOR = "bg-gray-100 text-gray-700 border-gray-200";

function getCategoryBadgeClass(category: string): string {
  return CATEGORY_COLORS[category] || FALLBACK_COLOR;
}

export function NewsPostList({
  clientId,
  brandColor = "#1F3A60",
  secondaryColor = "#C9A961",
}: NewsPostListProps) {
  const { assets: newsPosts, isLoading } = useNewsPostAssets(clientId);

  const publishedPosts = useMemo(() => {
    // Filter to only published posts and sort by createdAt descending
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
                <div key={i} className="h-48 rounded-xl bg-gray-200" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {publishedPosts.map((post, index) => {
            const data = (post.data as Record<string, unknown> | null) ?? {};
            const subtitle = (data.flyerSubtitle as string) || "";
            const category = (data.category as string) || "Announcement";

            // Format start/end dates
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
                <div className="group h-full rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  <div className="p-6 flex flex-col h-full">
                    {/* Category badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getCategoryBadgeClass(category)}`}
                      >
                        {category}
                      </span>
                      {post.createdAt && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
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
                    <h3
                      className="text-lg font-bold leading-snug mb-2"
                      style={{ color: brandColor }}
                    >
                      {post.headline || "Announcement"}
                    </h3>

                    {/* Subtitle */}
                    {subtitle && (
                      <p className="text-sm text-gray-500 mb-3">{subtitle}</p>
                    )}

                    {/* Date range */}
                    {dateStr && (
                      <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {dateStr}
                      </p>
                    )}

                    {/* Body */}
                    {post.body && (
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 mb-4 flex-1">
                        {post.body}
                      </p>
                    )}

                    {/* CTA */}
                    {post.ctaText && (
                      <div className="mt-auto pt-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 group-hover:opacity-90 group-hover:scale-105"
                          style={{ background: secondaryColor || brandColor }}
                        >
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
