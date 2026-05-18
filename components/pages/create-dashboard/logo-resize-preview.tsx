"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { toR2BrandingKey } from "@/lib/branding-image-url";

interface LogoResizePreviewProps {
  companyName: string;
  planName: string;
  companyLogo: string;
  accentColor: string;
  accentColorImage?: string;
  backgroundImage: string;
  avatarChoice: string;
  onBack: () => void;
  onConfirm: (logoSize: { width: number; height: number }) => void;
}

import { forwardRef } from "react";

export const LogoResizePreview = forwardRef<
  HTMLDivElement,
  LogoResizePreviewProps
>(
  (
    {
      companyName,
      planName,
      companyLogo,
      accentColor,
      accentColorImage,
      backgroundImage,
      avatarChoice,
      onBack,
      onConfirm,
    },
    ref,
  ) => {
    const [logoSize, setLogoSize] = useState({ width: 200, height: 120 });
    const [isResizing, setIsResizing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [startSize, setStartSize] = useState({ width: 200, height: 120 });
    const logoRef = useRef<HTMLImageElement>(null);
    const { url: logoDisplayUrl } = useBrandingImageUrl(companyLogo || null);
    const logoIsR2 = toR2BrandingKey(companyLogo || null) != null;
    const logoSrc = logoIsR2
      ? (logoDisplayUrl ?? "/placeholder.svg")
      : (logoDisplayUrl ?? companyLogo ?? "/placeholder.svg");

    // Compute avatarSrc directly from avatarChoice
    let avatarSrc = "";
    if (avatarChoice === "alison") {
      avatarSrc = "/images/alison-trans.png";
    } else if (avatarChoice === "chad") {
      avatarSrc = "/images/chad-trans.png";
    } else if (avatarChoice === "leah") {
      avatarSrc = "/images/leah-trans.png";
    } else if (avatarChoice === "alicia") {
      avatarSrc = "/images/alicia-trans.png";
    } else if (avatarChoice === "paul") {
      avatarSrc = "/images/paul-trans.png";
    } else if (avatarChoice === "helena") {
      avatarSrc = "/images/helena-trans.png";
    } else if (avatarChoice === "maria") {
      avatarSrc = "/images/maria-trans.png";
    } else if (avatarChoice === "scott") {
      avatarSrc = "/images/scott-trans.png";
    } else if (avatarChoice === "custom") {
      avatarSrc = "/images/custom-trans.png";
    }

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSize({ ...logoSize });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;

      setLogoSize({
        width: Math.max(50, startSize.width + deltaX),
        height: Math.max(50, startSize.height + deltaY),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    useEffect(() => {
      if (isResizing) {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [isResizing, startPos]);

    return (
      <div className="space-y-6" ref={ref}>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Logo Resize Preview
          </h2>
          <p className="text-gray-500 mt-1">
            Drag the corner to resize your logo. The logo will stretch/compress
            without cropping.
          </p>
        </div>

        {/* 16:9 aspect ratio container */}
        <div
          className="relative w-full rounded-lg overflow-hidden border border-gray-200"
          style={{ paddingBottom: "56.25%" }}
        >
          {/* Background container with white base and image overlay */}
          <div className="absolute inset-0 bg-white overflow-hidden">
            {backgroundImage && (
              <div
                className="absolute inset-0 bg-no-repeat bg-center bg-cover"
                style={{
                  backgroundImage: `url(${backgroundImage})`,
                  opacity: 0.2,
                }}
              />
            )}

            {/* Logo positioned lower with resize functionality */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ paddingTop: "10%" }}
            >
              <div className="flex items-center justify-center relative">
                <img
                  ref={logoRef}
                  src={logoSrc}
                  alt={`${companyName} Company Logo`}
                  className="object-contain cursor-se-resize"
                  style={{
                    width: `${logoSize.width}px`,
                    height: `${logoSize.height}px`,
                    objectFit: "contain",
                  }}
                  onMouseDown={handleMouseDown}
                />
                <div
                  className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize"
                  onMouseDown={handleMouseDown}
                />
              </div>
            </div>

            {/* Sample title positioned lower */}
            <div className="absolute top-[20%] w-full text-center">
              <h1 className="text-7xl font-bold text-black tracking-tight">
                {planName || "Sample Title"}
              </h1>
            </div>

            {/* Color bar at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[15%]">
              {accentColorImage ? (
                <img
                  src={accentColorImage}
                  alt="Accent Color"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  style={{ backgroundColor: accentColor }}
                  className="w-full h-full"
                />
              )}
              {/* Avatar on the bottom left - much larger size and more to the left */}
              {avatarSrc && (
                <div
                  className="absolute bottom-0 left-0 h-[350%] -ml-5"
                  style={{ transform: "scale(1.2)" }}
                >
                  <img
                    src={avatarSrc || "/placeholder.svg"}
                    alt="Avatar"
                    className="h-full w-auto object-contain object-bottom"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Logo size display */}
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Current Logo Size: {logoSize.width}px × {logoSize.height}px
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Drag the blue corner to resize
          </p>
        </div>

        <div className="mt-6 flex justify-between">
          <Button
            onClick={onBack}
            variant="outline"
            className="border-2 border-gray-300 hover:border-gray-400 transition-colors"
          >
            Back
          </Button>
          <Button
            onClick={() => onConfirm(logoSize)}
            className="!bg-[#005F73] hover:!bg-[#004D5D] text-white"
          >
            Confirm & Continue
          </Button>
        </div>
      </div>
    );
  },
);

LogoResizePreview.displayName = "LogoResizePreview";
