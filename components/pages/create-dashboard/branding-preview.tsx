"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { BrandingImage } from "@/components/ui/branding-image"

interface BrandingPreviewProps {
  companyName: string
  planName: string
  companyLogo: string
  accentColor: string
  accentColorImage?: string
  backgroundImage: string
  avatarChoice: string
  logoSize: { width: number; height: number }
  onEdit: () => void
  onConfirm: () => void
  imageOnly?: boolean
}

import { forwardRef } from "react";

export const BrandingPreview = forwardRef<HTMLDivElement, BrandingPreviewProps>(({
  companyName,
  planName,
  companyLogo,
  accentColor,
  accentColorImage,
  backgroundImage,
  avatarChoice,
  logoSize,
  onEdit,
  onConfirm,
  imageOnly = false,
}, ref) => {

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

  // If imageOnly is true, render just the content without header, avatar, and bottom bar
  if (imageOnly) {
    return (
      <div className="space-y-4">
        <div 
          className="relative w-full h-full bg-transparent"
          ref={ref}
          style={{ 
            background: 'transparent',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px'
          }}
        >
                     <div className="text-center space-y-4">
             <div className="flex items-center justify-center mx-auto relative">
               <BrandingImage
                 src={companyLogo || "/placeholder.svg"}
                 alt={`${companyName} Company Logo`}
                 className="object-contain"
                 style={{ 
                   width: `${logoSize.width}px`, 
                   height: `${logoSize.height}px`,
                   objectFit: 'contain'
                 }}
               />
             </div>
            <h1 className="text-7xl font-bold text-black tracking-tight">{planName || "Sample Title"}</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={ref}>
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Branding Preview</h2>
        <p className="text-gray-500 mt-1">Review how your branding will appear</p>
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

                     {/* Logo positioned lower */}
           <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: "10%" }}>
             <div className="flex items-center justify-center relative">
               <BrandingImage
                 src={companyLogo || "/placeholder.svg"}
                 alt={`${companyName} Company Logo`}
                 className="object-contain"
                 style={{ 
                   width: `${logoSize.width}px`, 
                   height: `${logoSize.height}px`,
                   objectFit: 'contain'
                 }}
               />
             </div>
           </div>

          {/* Sample title positioned lower */}
          <div className="absolute top-[20%] w-full text-center">
            <h1 className="text-7xl font-bold text-black tracking-tight">{planName || "Sample Title"}</h1>
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
              <div style={{ backgroundColor: accentColor }} className="w-full h-full" />
            )}
            {/* Avatar on the bottom left - much larger size and more to the left */}
            {avatarSrc && (
              <div className="absolute bottom-0 left-0 h-[350%] -ml-5" style={{ transform: "scale(1.2)" }}>
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

      <div className="mt-6 flex justify-between">
        <Button
          onClick={onEdit}
          variant="outline"
          className="border-2 border-gray-300 hover:border-gray-400 transition-colors"
        >
          Edit
        </Button>
                 <Button onClick={onConfirm} className="!bg-[#005F73] hover:!bg-[#004D5D] text-white">
           Confirm & Continue
         </Button>
      </div>
    </div>
  )
});

BrandingPreview.displayName = "BrandingPreview";
