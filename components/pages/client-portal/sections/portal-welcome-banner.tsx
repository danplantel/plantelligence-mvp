"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { BrandingImage } from "@/components/ui/branding-image";
import { isR2BrandingKey, toNextImageSrc } from "@/lib/branding-image-url";
import {
  DEFAULT_WELCOME_BG,
  getPortalWelcomeBackgroundUrl,
} from "@/lib/portal-category-hero-background";

interface PortalWelcomeBannerProps {
  /** Click handler for the benefit portal title (headline). Opens the editor. */
  onTitleClick?: () => void;
  /** Click handler for the summary description text. Opens the editor. */
  onDescriptionClick?: () => void;
  clientData?: {
    companyName?: string;
    missionHeadline?: string;
    missionBody?: string;
    companyLogo?: string;
    backgroundImg?: string;
    secondaryBannerImg?: string;
    employeePortalPreview?: any;
    keyContacts?: {
      fullName?: string;
      name?: string;
      title?: string;
      customRole?: string;
      companyName?: string;
      headshot?: string;
      showOnPortal?: boolean;
      isPrimary?: boolean;
      benefitsCategory?: string;
      benefitsCategories?: string[];
    }[];
  } | null;
  category?: string;
  brandColor?: string;
  secondaryColor?: string;
  // Custom content overrides
  customHeadline?: string;
  customDescription?: string | string[]; // Can be single string or array of paragraphs
  customClosing?: string;
  customSignature?: string;
  customSignatureCompany?: string;
  customImage?: string; // Override right-side Benefits Logo
  customImageAlt?: string;
  // Hero overlay settings
  backgroundOpacity?: number;
  containerBlockOpacity?: number;
  containerInverted?: boolean;
  backgroundInverted?: boolean;
  useGradient?: boolean;
  /** Desktop background image focal point (percentage) */
  desktopHeroBackgroundPosition?: { x: number; y: number };
  /** Mobile background image focal point (percentage) */
  mobileHeroBackgroundPosition?: { x: number; y: number };
}

export function PortalWelcomeBanner({
  clientData,
  brandColor = "#1F3A60",
  secondaryColor = "#C89B5B",
  onTitleClick,
  onDescriptionClick,
  customHeadline,
  customDescription,
  customClosing,
  customSignature,
  customSignatureCompany,
  customImage,
  customImageAlt,
  category,
  backgroundOpacity = 1.0,
  containerBlockOpacity = 0.67,
  containerInverted = false,
  backgroundInverted = false,
  useGradient = false,
  desktopHeroBackgroundPosition,
  mobileHeroBackgroundPosition,
}: PortalWelcomeBannerProps) {
  // Look up per-category benefit data from employeePortalPreview (saved by Step 1)
  const categoryBenefit = useMemo(() => {
    if (!category || !clientData?.employeePortalPreview?.benefits) return null;
    const benefits = clientData.employeePortalPreview.benefits;
    const target = category.toLowerCase();
    return (
      benefits.find((b: any) => (b.category || "").toLowerCase() === target) ||
      null
    );
  }, [category, clientData?.employeePortalPreview?.benefits]);

  let visibleContacts: any[] = [];

  if (clientData?.keyContacts) {
    if (Array.isArray(clientData.keyContacts)) {
      visibleContacts = clientData.keyContacts.filter(
        (contact: any) => contact.showOnPortal !== false,
      );
    } else if (
      typeof clientData.keyContacts === "object" &&
      clientData.keyContacts !== null
    ) {
      const keyContactsData = clientData.keyContacts as any;
      const contactsArray = Array.isArray(keyContactsData.contacts)
        ? keyContactsData.contacts
        : [];
      visibleContacts = contactsArray.filter(
        (contact: any) => contact.showOnPortal !== false,
      );
    }
  }

  // Determine primary contact based on category if provided
  let primaryContact = null;

  if (category) {
    const target = category.toLowerCase();
    // 1. Try to find isPrimary contact for this category
    primaryContact = visibleContacts?.find(c =>
      c.isPrimary &&
      ((c.benefitsCategory || "").toLowerCase() === target ||
        (c.benefitsCategories || []).map((s: string) => s.toLowerCase()).includes(target))
    );

    // 2. Try to find any contact for this category
    if (!primaryContact) {
      primaryContact = visibleContacts?.find(c =>
        (c.benefitsCategory || "").toLowerCase() === target ||
        (c.benefitsCategories || []).map((s: string) => s.toLowerCase()).includes(target)
      );
    }
  }

  // 3. Fallback to general primary contact or first contact
  if (!primaryContact) {
    primaryContact = visibleContacts?.find((contact) => contact.isPrimary) || visibleContacts?.[0];
  }

  const companyName = clientData?.companyName?.trim() || "Waypoint";

  // Use custom content if provided, otherwise fall back to defaults
  const headline =
    customHeadline || `Welcome to ${clientData?.companyName || "Waypoint"}!`;

  const description =
    customDescription ||
    `We consider it a privilege to have been selected by ${companyName} to represent you and your ${companyName} 401(k) Plan. Regardless of if you're just beginning your employment journey or if you've been participating in the ${companyName} 401(k) Plan for years – we at Waypoint share in your company's commitment towards educating you on the importance of participating in this valuable retirement benefit.`;

  const closing =
    customClosing ||
    primaryContact?.customRole ||
    "We hope to inspire you to save!";

  // Signature split into name/title and company name
  const signatureName =
    customSignature ||
    (primaryContact
      ? `${primaryContact.fullName || primaryContact.name || "Ty G. Rogers"}${primaryContact.title ? ` ${primaryContact.title}` : ""
      }`
      : "Ty G. Rogers Managing Partner");

  const signatureCompany =
    customSignatureCompany ||
    primaryContact?.companyName ||
    "Waypoint Financial Advisors";

  // Right-side Benefits Logo: customImage override → categoryBenefit.partnerLogo (per-category, set in Step 1) → companyLogo (top-level) → null
  const benefitsLogoUrl =
    customImage ||
    categoryBenefit?.partnerLogo ||
    clientData?.companyLogo?.trim() ||
    null;

  const benefitsLogoAlt =
    customImageAlt ||
    `${clientData?.companyName || "Company"} Benefits Logo`;

  // Background image: use client-level backgroundImg (same as portal-hero uses)
  const backgroundRaw = clientData?.backgroundImg || getPortalWelcomeBackgroundUrl(clientData ?? null);
  const { url: backgroundResolved, loading: backgroundLoading } =
    useBrandingImageUrl(backgroundRaw || null);
  const isR2WelcomeBg = isR2BrandingKey(backgroundRaw);
  const background = isR2WelcomeBg
    ? backgroundResolved ?? undefined
    : (backgroundResolved ?? backgroundRaw) || undefined;

  const welcomeBannerImgSrc =
    background ??
    (!isR2WelcomeBg ? backgroundRaw : undefined) ??
    DEFAULT_WELCOME_BG;

  // Handle description as string or array of paragraphs
  const descriptionParagraphs = Array.isArray(description)
    ? description
    : [description];

  // Compute dynamic overlay styles
  const backgroundOverlayStyle = backgroundInverted
    ? { backgroundColor: `rgba(255, 255, 255, ${1 - backgroundOpacity})` }
    : { backgroundColor: `rgba(0, 0, 0, ${1 - backgroundOpacity})` };

  const containerGradientStyle = useGradient
    ? `linear-gradient(to bottom, rgba(0, 0, 0, ${containerBlockOpacity}), rgba(0, 0, 0, ${containerBlockOpacity * 0.3}))`
    : `linear-gradient(to bottom, rgba(0, 0, 0, ${containerBlockOpacity}), rgba(0, 0, 0, ${containerBlockOpacity}))`;

  const inlineBlockStyle = containerInverted
    ? `linear-gradient(to bottom, rgba(255, 255, 255, ${containerBlockOpacity}), rgba(255, 255, 255, ${containerBlockOpacity * 0.3}))`
    : containerGradientStyle;

  const [hoveredField, setHoveredField] = useState<string | null>(null);

  const EditPencil = () => (
    <div className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </div>
  );

  const heroImageSrc = toNextImageSrc(welcomeBannerImgSrc, DEFAULT_WELCOME_BG);

  return (
    <section
      id="portal-welcome-banner"
      className={`relative isolate overflow-hidden min-h-[50vh] lg:min-h-screen w-full ${
        containerInverted ? "text-gray-900" : "text-white"
      }`}
      style={{ backgroundColor: "#0F172A" }}
    >
      {/* Background Image — CSS background-image (most reliable, no gaps possible) */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundColor: "#0F172A",
          backgroundImage: heroImageSrc ? `url(${heroImageSrc})` : undefined,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: desktopHeroBackgroundPosition
            ? `${desktopHeroBackgroundPosition.x}% ${desktopHeroBackgroundPosition.y}%`
            : "center",
        }}
      >
        {mobileHeroBackgroundPosition && (
          <style>{`
            @media (max-width: 640px) {
              #portal-welcome-banner .absolute.inset-0.z-0 {
                background-position: ${mobileHeroBackgroundPosition.x}% ${mobileHeroBackgroundPosition.y}% !important;
              }
            }
          `}</style>
        )}
      </div>

      {/* Background overlay — separate element at section level with explicit z-index to ensure it renders above the background image */}
      <div
        className="absolute inset-0 z-[1]"
        style={backgroundOverlayStyle}
      />

      {/* Health-Hub UI (unified for all categories) */}
      <div
        className="relative z-10 flex flex-col justify-center mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20"
        style={{ maxWidth: "80rem" }}
      >
        <div
          className={`overflow-hidden backdrop-blur-sm ${
            containerInverted
              ? "border border-gray-300"
              : "border border-white/15"
          }`}
          style={{ backgroundImage: inlineBlockStyle }}
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
          >
            {/* LEFT: Text content */}
            <div className="order-2 lg:order-1 px-8 py-10 sm:px-12 lg:py-12">
              {/* Company Logo (top-left) — hidden on mobile */}
              {clientData?.companyLogo ? (
                <BrandingImage
                  src={clientData.companyLogo}
                  alt={`${clientData.companyName || "Company"} logo`}
                  className="mb-6 h-10 w-auto hidden lg:block"
                />
              ) : (
                <p className={`mb-6 text-xs font-semibold tracking-[0.4em] hidden lg:block ${
                  containerInverted ? "text-gray-400" : "text-white/70"
                }`}>
                  LOGO HERE
                </p>
              )}

              {/* Title */}
              <div
                className={`relative ${onTitleClick ? "cursor-pointer group" : ""}`}
                onClick={(e) => { e.stopPropagation(); onTitleClick?.(); }}
                onMouseEnter={() => onTitleClick && setHoveredField("title")}
                onMouseLeave={() => onTitleClick && setHoveredField(null)}
              >
                {onTitleClick && hoveredField === "title" && <EditPencil />}
                <h1 className={`font-unna font-dm-serif text-3xl leading-tight sm:text-4xl lg:text-5xl ${
                  containerInverted ? "text-gray-900" : "text-white"
                }`}>
                  {headline}
                </h1>
              </div>

              {/* Description paragraphs */}
              <div
                className={`relative ${onDescriptionClick ? "cursor-pointer group mt-6" : "mt-6"}`}
                onClick={(e) => { e.stopPropagation(); onDescriptionClick?.(); }}
                onMouseEnter={() => onDescriptionClick && setHoveredField("description")}
                onMouseLeave={() => onDescriptionClick && setHoveredField(null)}
              >
                {onDescriptionClick && hoveredField === "description" && <EditPencil />}
                <div className="text-base font-red-hat space-y-4">
                  {descriptionParagraphs.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Closing & Signature */}
              <div className="pt-5">
                <p className="text-lg font-dm-serif">{closing}</p>
                <div className="mt-2 space-y-1">
                  <p className={`text-base font-dm-serif ${
                    containerInverted ? "text-gray-900" : "text-white"
                  }`}>
                    {signatureName}
                  </p>
                  <p className={`text-xs uppercase tracking-[0.2em] font-red-hat ${
                    containerInverted ? "text-gray-500" : "text-white/90"
                  }`}>
                    {signatureCompany}
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT: Benefits Logo */}
            <div className="order-1 lg:order-2 relative flex items-center justify-center">
              {benefitsLogoUrl ? (
                <BrandingImage
                  src={benefitsLogoUrl}
                  alt={benefitsLogoAlt}
                  className="h-auto max-h-40 w-auto max-w-full object-contain border-0 outline-0"
                />
              ) : (
                <div className="relative flex min-h-[200px] w-full items-center justify-center">
                  <span className={`text-sm font-semibold tracking-wider ${
                    containerInverted ? "text-gray-400" : "text-white/50"
                  }`}>
                    BENEFITS LOGO
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute inset-x-0 bottom-0 h-0.5"
        style={{ background: brandColor }}
      />
    </section>
  );
}
