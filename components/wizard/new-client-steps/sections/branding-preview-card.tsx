"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { BrandingPreview } from "@/components/wizard/steps/sections/branding-preview/branding-preview";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { toR2BrandingKey } from "@/lib/branding-image-url";

interface BrandingPreviewCardProps {
  missionHeadline: string;
  missionBody: string;
  userAvatar: string | null;
  onHeadshotChange: (newHeadshot: string) => void;
  onBackgroundChange: (newBackground: string) => void;
  onWelcomeMessageChange: (headline: string, bodyText: string) => void;
  onEditHeadshot: () => void;
  onEditBackground: () => void;
  onOpenTextEditor?: (field: "headline" | "body") => void;
  isEditorOpen?: boolean;
}

export function BrandingPreviewCard({
  missionHeadline,
  missionBody,
  userAvatar,
  onHeadshotChange,
  onBackgroundChange,
  onWelcomeMessageChange,
  onEditHeadshot,
  onEditBackground,
  onOpenTextEditor,
  isEditorOpen = false,
}: BrandingPreviewCardProps) {
  const { stepData } = useNewClientWizardStore();
  const [showPreview, setShowPreview] = useState(true);

  const logoRaw = stepData.companyBasics?.companyLogo;
  const logoValue = typeof logoRaw === "string" ? logoRaw : logoRaw?.url;
  const { url: logoResolved } = useBrandingImageUrl(logoValue ?? null);

  const headerUrl = stepData.companyBasics?.brandImages?.header?.url;
  const thumbnailUrl = stepData.companyBasics?.brandImages?.thumbnail?.url;
  const backgroundValue = headerUrl;
  const { url: backgroundResolved } = useBrandingImageUrl(backgroundValue ?? null);
  const { url: thumbnailResolved } = useBrandingImageUrl(thumbnailUrl ?? null);

  const logoIsR2 = toR2BrandingKey(logoValue ?? null) != null;
  const backgroundIsR2 = toR2BrandingKey(backgroundValue ?? null) != null;
  const thumbnailIsR2 = toR2BrandingKey(thumbnailUrl ?? null) != null;

  const logoForPreview = logoIsR2
    ? (logoResolved ?? "/logo-2.png")
    : (logoResolved ?? logoValue ?? "/logo-2.png");
  const backgroundForPreview = backgroundIsR2
    ? (backgroundResolved ?? "")
    : (backgroundResolved ?? backgroundValue ?? "");
  const avatarForPreview = thumbnailIsR2
    ? (thumbnailResolved ?? userAvatar ?? "/images/alicia.png")
    : (thumbnailResolved ?? thumbnailUrl ?? userAvatar ?? "/images/alicia.png");

  const [brandingPreviewScale, setBrandingPreviewScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Preview scaling to fit available width and height (same logic as banner-preview-section)
  useEffect(() => {
    const computeScale = () => {
      const baseHeight = 450;
      const baseWidth = 1200; // natural width of BrandingPreview
      const container = previewContainerRef.current;
      if (!container) return;

      const containerHeight = container.clientHeight;
      const containerWidth = container.clientWidth;

      if (!containerHeight || !containerWidth) return;

      // Calculate scale based on width (to stretch to full width)
      const scaleByWidth = containerWidth / baseWidth;
      // Calculate scale based on height (to fit height)
      const scaleByHeight = containerHeight / baseHeight;

      // Use the minimum scale to ensure everything fits, but prioritize width
      // This will stretch to full width while ensuring height fits
      const next = Math.min(scaleByWidth, scaleByHeight);
      setBrandingPreviewScale(Math.max(next, 0.1)); // Minimum scale of 0.1
    };

    computeScale();
    const resizeObserver = new ResizeObserver(computeScale);
    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current);
    }
    window.addEventListener("resize", computeScale);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", computeScale);
    };
  }, []);

  // Prevent auto-scroll to preview section on mount
  useEffect(() => {
    // Only run when preview is shown
    if (!showPreview) return;

    // Use a small delay to ensure the ref is set after render
    const timeoutId = setTimeout(() => {
      if (previewRef.current) {
        // Override scrollIntoView on the preview element to prevent auto-scrolling
        const originalScrollIntoView = previewRef.current.scrollIntoView;
        previewRef.current.scrollIntoView = () => {
          // Prevent any scroll to preview on mount
          return;
        };

        // Store original for cleanup
        (previewRef.current as any)._originalScrollIntoView =
          originalScrollIntoView;
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      // Restore original behavior on unmount
      if (
        previewRef.current &&
        (previewRef.current as any)._originalScrollIntoView
      ) {
        previewRef.current.scrollIntoView = (
          previewRef.current as any
        )._originalScrollIntoView;
      }
    };
  }, [showPreview]);

  const handleWelcomeMessageChange = (newText: string) => {
    const lines = newText.split("\n\n");
    const headline = lines[0] || "";
    const bodyText = lines.slice(1).join("\n") || "";
    onWelcomeMessageChange(headline, bodyText);
  };

  if (!showPreview) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="pt-6">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="w-4 h-4" />
            Show Preview
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      ref={previewContainerRef}
      data-preview="welcome"
      className={`flex-1 min-h-[24rem] relative w-full m-0 flex justify-center ${isEditorOpen ? "overflow-hidden" : ""
        }`}
      style={{
        margin: "0 auto",
      }}
    >
      <div
        ref={previewRef}
        style={{
          transformOrigin: "top center",
        }}
      >
        <BrandingPreview
          logo={logoForPreview}
          backgroundImage={backgroundForPreview}
          brandColor={stepData.companyBasics?.primaryColor || "#1F3A60"}
          aiAvatar={avatarForPreview}
          missionStatement={`${missionHeadline || "Mission Headline goes here"
            }\n\n${missionBody || "Your welcome message will appear here..."}`}
          headshot={avatarForPreview}
          headshotData={null}
          username={stepData.companyBasics?.companyName || "Company Name"}
          title="Advisor"
          orgName={stepData.companyBasics?.companyName || "Company Name"}
          onWelcomeMessageChange={handleWelcomeMessageChange}
          onHeadshotChange={onHeadshotChange}
          onEditHeadshot={onEditHeadshot}
          onEditBackground={onEditBackground}
          onBackgroundChange={onBackgroundChange}
          onOpenTextEditor={onOpenTextEditor}
        />
      </div>
    </div>
  );
}
