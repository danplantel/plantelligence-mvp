"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  tag?: string;
  description?: string;
}

interface VideoCarouselProps {
  title: string;
  videos: VideoItem[];
  onVideoClick: (video: VideoItem) => void;
}

export function VideoCarousel({
  title,
  videos,
  onVideoClick,
}: VideoCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      const newScrollLeft =
        scrollRef.current.scrollLeft +
        (direction === "right" ? scrollAmount : -scrollAmount);
      scrollRef.current.scrollTo({ left: newScrollLeft, behavior: "smooth" });

      setTimeout(() => {
        if (scrollRef.current) {
          setCanScrollLeft(scrollRef.current.scrollLeft > 0);
          setCanScrollRight(
            scrollRef.current.scrollLeft <
              scrollRef.current.scrollWidth - scrollRef.current.clientWidth,
          );
        }
      }, 300);
    }
  };

  return (
    <div className="mb-12">
      <h3 className="font-manrope text-2xl font-bold text-[#002B5B] mb-6">
        {title}
      </h3>

      <div className="relative group">
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white hover:bg-black/70 rounded-full w-10 h-10 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {canScrollRight && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white hover:bg-black/70 rounded-full w-10 h-10 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex-shrink-0 w-80 cursor-pointer group/item"
              onClick={() => onVideoClick(video)}
            >
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-3 group-hover/item:scale-105 transition-transform duration-300">
                <img
                  src={video.thumbnail || "/placeholder.svg"}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 group-hover/item:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="bg-white/90 rounded-full p-3 group-hover/item:scale-110 transition-transform">
                    <Play className="h-6 w-6 text-[#002B5B] ml-0.5" />
                  </div>
                </div>

                {video.tag && (
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 bg-[#26A69A] text-white text-xs"
                  >
                    {video.tag}
                  </Badge>
                )}

                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {video.duration}
                </div>
              </div>

              <h4 className="font-manrope font-semibold text-[#002B5B] text-sm leading-tight group-hover/item:text-[#26A69A] transition-colors">
                {video.title}
              </h4>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
