"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
  /** When true, no dark backdrop - only the loading card is shown */
  hideBackdrop?: boolean;
}

export function LoadingOverlay({
  isLoading,
  message = "Processing...",
  className,
  hideBackdrop = false,
}: LoadingOverlayProps) {
  const [animationData, setAnimationData] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Load Lottie animation data
    import("@/public/animations/loading.json")
      .then((data) => {
        setAnimationData(data.default);
      })
      .catch(() => {
        console.error("Failed to load Lottie animation, using fallback");
      });
  }, []);

  if (!isLoading) return null;

  const overlay = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center",
        hideBackdrop ? "bg-transparent" : "bg-black/50 backdrop-blur-sm",
        "cursor-wait",
        className,
      )}
      style={{ pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-lg p-8 shadow-xl flex flex-col items-center space-y-4">
        {/* Animation */}
        <div className="w-24 h-24">
          {isClient && animationData ? (
            <Lottie
              animationData={animationData}
              loop={true}
              autoplay={true}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            // Fallback CSS spinner
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
              <div
                className="absolute inset-2 border-4 border-transparent border-r-blue-400 rounded-full animate-spin"
                style={{
                  animationDirection: "reverse",
                  animationDuration: "1.5s",
                }}
              ></div>
              <div
                className="absolute inset-4 border-4 border-transparent border-b-blue-300 rounded-full animate-spin"
                style={{ animationDuration: "2s" }}
              ></div>
            </div>
          )}
        </div>

        {/* Loading message */}
        <p className="text-gray-700 font-medium text-center">{message}</p>

        {/* Additional text to prevent multiple clicks */}
        <p className="text-sm text-gray-500 text-center">
          Please wait while we process your data...
        </p>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
