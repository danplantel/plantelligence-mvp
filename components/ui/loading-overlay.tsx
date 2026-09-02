"use client";

import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
  /** When true, no dark backdrop - only the loading card is shown */
  hideBackdrop?: boolean;
  /** When true, hides the Plantelligence logo */
  hideLogo?: boolean;
}

export function LoadingOverlay({
  isLoading,
  message = "Processing...",
  className,
  hideBackdrop = false,
  hideLogo = false,
}: LoadingOverlayProps) {
  const { resolvedTheme } = useTheme();
  const mounted = true;

  if (!isLoading) return null;

  const themeMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

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
      <div className="bg-white dark:bg-gray-900 rounded-lg p-8 shadow-xl flex flex-col items-center space-y-4">
        {/* Plantelligence Logo — responds to light/dark mode */}
        {!hideLogo && (
          <img
            src={themeMode === "dark" ? "plantelligence-logos/pt_web_dark.png" : "plantelligence-logos/pt_web_light.png"}
            alt="PlanTelligence"
            className="object-contain h-10 mb-2"
          />
        )}

        {/* Simple CSS spinner — replaces Lottie animation */}
        <div className="w-16 h-16">
          <div className="relative w-full h-full">
            <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-accent-blue rounded-full animate-spin" />
          </div>
        </div>

        {/* Loading message */}
        <p className="text-gray-700 dark:text-gray-200 font-medium text-center">{message}</p>

        {/* Additional text to prevent multiple clicks */}
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
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
