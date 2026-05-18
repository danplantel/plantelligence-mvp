"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PortalHero } from "@/components/pages/client-portal/sections/portal-hero";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";

type InlineField = "title" | "description" | null;

interface EditablePortalHeroPreviewProps {
  backgroundImage?: string;
  brandColor: string;
  secondaryColor: string;
  companyName: string;
  companyLogo?: string;
  heroTitle: string;
  heroDescription: string;
  inlineField: InlineField;
  inlineValue: string;
  onInlineValueChange: (value: string) => void;
  onStartInlineEdit: (field: Exclude<InlineField, null>) => void;
  onInlineCancel: () => void;
  onInlineSave: () => void;
  backgroundOpacity?: number;
  containerBlockOpacity?: number;
  containerInverted?: boolean;
  backgroundInverted?: boolean;
  useGradient?: boolean;
  onLogoClick?: () => void;
  onContainerClick?: () => void;
  onBackgroundClick?: () => void;
}

export function EditablePortalHeroPreview({
  backgroundImage,
  brandColor,
  secondaryColor,
  companyName,
  companyLogo = "",
  heroTitle,
  heroDescription,
  inlineField,
  inlineValue,
  onInlineValueChange,
  onStartInlineEdit,
  onInlineCancel,
  onInlineSave,
  backgroundOpacity = 1.0,
  containerBlockOpacity = 0.67,
  containerInverted = false,
  backgroundInverted = false,
  useGradient = false,
  onLogoClick,
  onContainerClick,
  onBackgroundClick,
}: EditablePortalHeroPreviewProps) {
  const isEditingTitle = inlineField === "title";
  const isEditingDescription = inlineField === "description";
  const editingLabel = isEditingTitle ? "Headline" : "Description";

  const heroTitleSlot = isEditingTitle ? (
    <Textarea
      value={inlineValue}
      onChange={(e) => onInlineValueChange(e.target.value)}
      rows={3}
      autoFocus
      className="mb-6 w-4/5 text-center text-4xl font-serif font-semibold leading-snug text-gray-900 bg-white/95 rounded-2xl border border-gray-200 shadow-xl"
    />
  ) : undefined;

  const heroDescriptionSlot = isEditingDescription ? (
    <Textarea
      value={inlineValue}
      onChange={(e) => onInlineValueChange(e.target.value)}
      rows={6}
      autoFocus
      className="w-4/5 text-lg leading-relaxed text-gray-900 bg-white/95 rounded-2xl border border-gray-200 shadow-xl"
    />
  ) : undefined;

  return (
    <div className="relative overflow-hidden rounded-t-xl h-full flex-1 bg-white m-auto">
      <PortalHeader
        companyData={{
          companyLogo: companyLogo || "",
        }}
        brandColor={brandColor}
        secondaryColor={secondaryColor}
        clientId="asdas"
        enableNavigation={false}
        showAlertBanner={false}
        enableLogoHover={true}
        onLogoClick={onLogoClick}
      />

      <PortalHero
        companyData={
          {
            companyName,
            backgroundImg: backgroundImage,
            heroContainerBlockOpacity: containerBlockOpacity,
            heroContainerInverted: containerInverted,
            heroBackgroundInverted: backgroundInverted,
            heroUseGradient: useGradient,
            heroBackgroundOpacity: backgroundOpacity,
          } as any
        }
        brandColor={brandColor}
        secondaryColor={secondaryColor}
        heroTitle={heroTitle}
        heroDescription={heroDescription}
        onHeroTitleClick={() => onStartInlineEdit("title")}
        onHeroDescriptionClick={() => onStartInlineEdit("description")}
        onContainerClick={onContainerClick}
        onBackgroundClick={onBackgroundClick}
        heroTitleSlot={heroTitleSlot}
        heroDescriptionSlot={heroDescriptionSlot}
        backgroundOpacity={backgroundOpacity}
        containerBlockOpacity={containerBlockOpacity}
        containerInverted={containerInverted}
        backgroundInverted={backgroundInverted}
        useGradient={useGradient}
      />
    </div>
  );
}
