"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { EditablePortalHeroPreview } from "./editable-portal-hero-preview";
import { usePreviewSticky } from "../hooks/use-preview-sticky";

type InlineField = "title" | "description" | null;

interface BannerPreviewCardProps {
  heroBackgroundUrl: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  companyLogo: string;
  heroTitle: string;
  heroDescription: string;
  inlineField: InlineField;
  inlineValue: string;
  onInlineValueChange: (value: string) => void;
  onStartInlineEdit: (field: Exclude<InlineField, null>) => void;
  onInlineCancel: () => void;
  onInlineSave: () => void;
  backgroundOpacity: number;
  containerBlockOpacity: number;
  containerInverted: boolean;
  backgroundInverted: boolean;
  useGradient: boolean;
  isPreviewSticky: boolean;
  hidePreviewCard: boolean;
  isEditorOpen?: boolean;
  onLogoClick?: () => void;
  onContainerClick?: () => void;
  onBackgroundClick?: () => void;
}

export function BannerPreviewCard({
  heroBackgroundUrl,
  primaryColor,
  secondaryColor,
  companyName,
  companyLogo,
  heroTitle,
  heroDescription,
  inlineField,
  inlineValue,
  onInlineValueChange,
  onStartInlineEdit,
  onInlineCancel,
  onInlineSave,
  backgroundOpacity,
  containerBlockOpacity,
  containerInverted,
  backgroundInverted,
  useGradient,
  isPreviewSticky,
  hidePreviewCard,
  isEditorOpen = false,
  onLogoClick,
  onContainerClick,
  onBackgroundClick,
}: BannerPreviewCardProps) {
  const [showPreview, setShowPreview] = useState(true);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewCardWrapperRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const overlaySettingsCardRef = useRef<HTMLDivElement | null>(null);
  const {
    isPreviewVisible,
    previewTranslateYPx,
    isCardFixed,
    previewCardRef,
    cardInitialLeftRef,
    cardInitialWidthRef,
  } = usePreviewSticky(
    showPreview,
    isPreviewSticky,
    hidePreviewCard,
    overlaySettingsCardRef,
  );

  useEffect(() => {
    if (hidePreviewCard) return;

    const computeScale = () => {
      const baseHeight = 450;
      const baseWidth = 1920;
      const container = previewContainerRef.current;
      if (!container) return;

      const containerHeight = container.clientHeight;
      const containerWidth = container.clientWidth;

      if (!containerHeight || !containerWidth) return;

      const scaleByWidth = containerWidth / baseWidth;
      const scaleByHeight = containerHeight / baseHeight;
      const next = Math.min(scaleByWidth, scaleByHeight);
      setPreviewScale(Math.max(next, 0.1));
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
  }, [hidePreviewCard]);

  const shouldUseStickyPreview = isPreviewSticky && showPreview;

  if (hidePreviewCard) return null;

  return (
    <>
      {showPreview && (
        <>
          {shouldUseStickyPreview && isCardFixed && (
            <div className="h-[32rem]" aria-hidden="true" />
          )}
          <div
            ref={previewCardWrapperRef}
            className={`w-full z-10 transition-opacity duration-300 ease-in-out ${isPreviewVisible
              ? "opacity-100 m-0"
              : "opacity-0 pointer-events-none"
              } ${isEditorOpen
                ? "fixed right-4 top-4 bottom-4 pointer-events-none max-w-[calc(100%-37rem)]"
                : ""
              }`}
            style={{
              transform:
                shouldUseStickyPreview && !isEditorOpen
                  ? `translateY(${previewTranslateYPx}px)`
                  : undefined,
              transition: "opacity 0.3s ease-in-out",
              ...(shouldUseStickyPreview &&
                isCardFixed &&
                !isEditorOpen &&
                cardInitialLeftRef.current !== null &&
                cardInitialWidthRef.current !== null
                ? {
                  left: `${cardInitialLeftRef.current}px`,
                  width: `${cardInitialWidthRef.current}px`,
                  right: "auto",
                }
                : {}),
            }}
          >
            <div
              ref={previewContainerRef}
              className={`w-full flex-1 ${isEditorOpen ? "overflow-hidden" : ""
                }`}
            >
              <div
                className={`w-full h-full ${isEditorOpen ? "overflow-hidden" : ""
                  }`}
              >
                <div
                  className={`w-full h-full bg-muted/30 ${isEditorOpen ? "overflow-hidden" : ""
                    }`}
                >
                  <EditablePortalHeroPreview
                    backgroundImage={heroBackgroundUrl}
                    brandColor={primaryColor}
                    secondaryColor={secondaryColor}
                    companyName={companyName}
                    companyLogo={companyLogo}
                    heroTitle={heroTitle}
                    heroDescription={heroDescription}
                    inlineField={inlineField}
                    inlineValue={inlineValue}
                    onInlineValueChange={onInlineValueChange}
                    onStartInlineEdit={onStartInlineEdit}
                    onInlineCancel={onInlineCancel}
                    onInlineSave={onInlineSave}
                    backgroundOpacity={backgroundOpacity}
                    containerBlockOpacity={containerBlockOpacity}
                    containerInverted={containerInverted}
                    backgroundInverted={backgroundInverted}
                    useGradient={useGradient}
                    onLogoClick={onLogoClick}
                    onContainerClick={onContainerClick}
                    onBackgroundClick={onBackgroundClick}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!showPreview && (
        <Card className="sticky top-0 z-10 bg-white shadow-lg">
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
      )}
    </>
  );
}
