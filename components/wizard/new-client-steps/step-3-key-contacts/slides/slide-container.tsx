"use client";

import { ReactNode, useCallback, useMemo, useRef } from "react";
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
  const motionRef = useRef<HTMLDivElement>(null);

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
          ref={motionRef}
          key={slides[currentIndex]?.id ?? currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
          className="w-full"
          onAnimationComplete={() => {
            // After the slide animation finishes, clear Framer Motion's transform
            // so it doesn't create a containing block that breaks position:sticky
            // in descendant components.
            if (motionRef.current) {
              motionRef.current.style.transform = "";
            }
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }, [currentIndex, direction, slides, children]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Text Tabs with Underline — distinct from the circular wizard stepper */}
      <div className="flex items-stretch justify-center mx-auto max-w-md">
        {slides.map((slide, index) => {
          const isCurrent = index === currentIndex;
          const isPast = index < currentIndex;
          const isClickable = isPast && onDotClick;

          return (
            <div key={slide.id} className="flex items-stretch flex-1">
              {/* Step label */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => handleDotClick(index)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-all duration-200 relative",
                  isCurrent
                    ? "text-accent-blue"
                    : isPast
                      ? "text-gray-500 dark:text-gray-400 cursor-pointer hover:text-accent-blue/70"
                      : "text-gray-300 dark:text-gray-600 cursor-default",
                )}
                aria-label={`Go to ${slide.label}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200",
                  isCurrent && "text-accent-blue",
                )}>
                  {slide.label}
                </span>
              </button>

              {/* Connector line between tabs */}
              {index < slides.length - 1 && (
                <div className="flex items-center px-1">
                  <div className={cn(
                    "w-1 sm:w-2 h-px transition-colors duration-200",
                    isPast ? "bg-accent-blue/40" : "bg-gray-200 dark:bg-gray-700",
                  )} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Thin underline indicator */}
      <div className="relative mx-auto max-w-md h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-accent-blue rounded-full transition-all duration-300 ease-in-out"
          style={{
            width: `${100 / slides.length}%`,
            transform: `translateX(${currentIndex * 100}%)`,
          }}
        />
      </div>

      {/* Slide Content */}
      <div className="relative overflow-hidden">{content}</div>
    </div>
  );
}
