"use client";

import { ReactNode, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ==================== Types ====================

export type SlideDirection = 1 | -1;

export interface SlideConfig {
  id: string;
  label: string;
}

export interface SlideContainerProps {
  /** Current slide index (0-based) */
  currentIndex: number;
  /** Total number of slides */
  totalSlides: number;
  /** Direction of the last navigation (1 = forward, -1 = backward) */
  direction: SlideDirection;
  /** Slide configurations for progress dots */
  slides: SlideConfig[];
  /** The active slide content */
  children: ReactNode;
  /** Called when a progress dot is clicked (only dots before current are clickable) */
  onDotClick?: (index: number) => void;
  /** Extra CSS class */
  className?: string;
}

// ==================== Animation Variants ====================

const slideVariants = {
  enter: (direction: SlideDirection) => ({
    x: direction > 0 ? "40%" : "-40%",
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: SlideDirection) => ({
    x: direction < 0 ? "40%" : "-40%",
    opacity: 0,
    scale: 0.97,
  }),
};

const slideTransition = {
  x: { type: "spring" as const, stiffness: 320, damping: 36 },
  opacity: { duration: 0.25 },
  scale: { duration: 0.25 },
};

// ==================== Component ====================

export function SlideContainer({
  currentIndex,
  totalSlides,
  direction,
  slides,
  children,
  onDotClick,
  className,
}: SlideContainerProps) {
  const handleDotClick = useCallback(
    (index: number) => {
      if (index < currentIndex && onDotClick) {
        onDotClick(index);
      }
    },
    [currentIndex, onDotClick],
  );

  const content = useMemo(() => {
    return (
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={slides[currentIndex]?.id ?? currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }, [currentIndex, direction, slides, children]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Progress Dots - with border */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
        {slides.map((slide, index) => {
          const isCurrent = index === currentIndex;
          const isPast = index < currentIndex;
          const isClickable = isPast && onDotClick;

          return (
            <button
              key={slide.id}
              type="button"
              disabled={!isClickable}
              onClick={() => handleDotClick(index)}
              className="group flex items-center gap-1.5 p-1 -mx-1"
              aria-label={`Go to ${slide.label}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "block rounded-full transition-all duration-300",
                  isCurrent
                    ? "w-3 h-3 bg-accent-blue shadow-sm shadow-accent-blue/30"
                    : isPast
                      ? "w-2.5 h-2.5 bg-accent-blue/50 hover:bg-accent-blue/70 cursor-pointer"
                      : "w-2 h-2 bg-gray-300 dark:bg-gray-600",
                )}
              />
              <span
                className={cn(
                  "text-xs transition-colors duration-300 hidden sm:inline-block",
                  isCurrent
                    ? "text-accent-blue font-semibold"
                    : isPast
                      ? "text-accent-blue/60"
                      : "text-gray-400 dark:text-gray-500",
                )}
              >
                {slide.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slide Content */}
      <div className="relative overflow-hidden">{content}</div>
    </div>
  );
}
