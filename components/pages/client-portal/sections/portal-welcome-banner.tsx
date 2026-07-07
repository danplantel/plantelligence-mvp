"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { BrandingImage } from "@/components/ui/branding-image";
import { isR2BrandingKey } from "@/lib/branding-image-url";
import {
  DEFAULT_WELCOME_BG,
  getPortalWelcomeBackgroundUrl,
} from "@/lib/portal-category-hero-background";

interface PortalWelcomeBannerProps {
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
  variant?: "default" | "health-hub";
  // Custom content overrides
  customHeadline?: string;
  customDescription?: string | string[]; // Can be single string or array of paragraphs
  customClosing?: string;
  customSignature?: string;
  customImage?: string; // Override right-side Benefits Logo
  customImageAlt?: string;
  // Hero overlay settings
  backgroundOpacity?: number;
  containerBlockOpacity?: number;
  containerInverted?: boolean;
  backgroundInverted?: boolean;
  useGradient?: boolean;
}

export function PortalWelcomeBanner({
  clientData,
  brandColor = "#1F3A60",
  secondaryColor = "#C89B5B",
  variant = "default",
  customHeadline,
  customDescription,
  customClosing,
  customSignature,
  customImage,
  customImageAlt,
  category,
  backgroundOpacity = 1.0,
  containerBlockOpacity = 0.67,
  containerInverted = false,
  backgroundInverted = false,
  useGradient = false,
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
    primaryContact?.companyName || "Waypoint Financial Advisors";

  // Right-side Benefits Logo: customImage override → categoryBenefit.partnerLogo (per-category, set in Step 1) → companyLogo (top-level) → null
  const benefitsLogoUrl =
    customImage ||
    categoryBenefit?.partnerLogo ||
    clientData?.companyLogo?.trim() ||
    null;

  const benefitsLogoAlt =
    customImageAlt ||
    `${clientData?.companyName || "Company"} Benefits Logo`;

  // Background image: categoryBenefit.image (Step 1 per-category) → getPortalWelcomeBackgroundUrl chain
  const categoryBgImage = categoryBenefit?.image || "";
  const backgroundRaw = categoryBgImage || getPortalWelcomeBackgroundUrl(clientData ?? null);
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

  if (variant === "health-hub") {
    // Health Hub variant: dark teal rectangle with Benefits Logo on the right
    return (
      <section className="relative mt-10 overflow-hidden">
        {/* Background image */}
        {isR2WelcomeBg && !background && backgroundLoading ? (
          <div
            className="absolute inset-0 animate-pulse bg-muted/50"
            aria-hidden
          />
        ) : (
          <img
            src={welcomeBannerImgSrc}
            alt="Background"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Content Wrapper */}
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          {/* Dark overlay rectangle */}
          <div className="overflow-hidden border border-white/15 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
            >
              {/* LEFT: Text content */}
              <div className="order-2 lg:order-1 px-8 py-10 sm:px-10 lg:px-12 lg:py-12">
                {/* Company Logo (top-left) — hidden on mobile to avoid duplicate logo */}
                {clientData?.companyLogo ? (
                  <div className="hidden lg:flex mb-6 inline-flex items-center gap-2 rounded border border-white/30 bg-white/10 px-3 py-2">
                    <BrandingImage
                      src={clientData.companyLogo}
                      alt={`${clientData.companyName || "Company"} logo`}
                      className="h-6 w-auto"
                    />
                    <span className="text-sm font-semibold text-white">
                      {clientData.companyName || "Company"}
                    </span>
                  </div>
                ) : (
                  <div className="hidden lg:flex mb-6 inline-flex items-center gap-2 rounded border border-white/30 bg-white/10 px-3 py-2">
                    <span className="text-sm font-semibold text-white">
                      LOGO HERE
                    </span>
                  </div>
                )}

                {/* Title */}
                <h1 className="mb-6 font-serif text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                  {headline}
                </h1>

                {/* Description paragraphs */}
                <div className="space-y-4 text-base leading-relaxed text-white sm:text-lg">
                  {descriptionParagraphs.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>

              {/* RIGHT: Benefits Logo */}
              <div className="order-1 lg:order-2 relative flex items-center justify-center p-6 lg:p-8">
                {benefitsLogoUrl ? (
                  <div className="relative flex w-full items-center justify-center rounded-lg bg-white p-8 shadow-xl backdrop-blur-sm">
                    <BrandingImage
                      src={benefitsLogoUrl}
                      alt={benefitsLogoAlt}
                      className="h-auto max-h-40 w-auto max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="relative flex min-h-[200px] w-full items-center justify-center rounded-lg bg-white/5 shadow-xl">
                    <span className="text-sm font-semibold tracking-wider text-white/50">
                      BENEFITS LOGO
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    );
  }

  // Default variant: Benefits Logo on the right, background image for the hero
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

  return (
    <section className="relative overflow-hidden mt-10 text-white">
      {/* Background image */}
      {isR2WelcomeBg && !background && backgroundLoading ? (
        <div
          className="absolute inset-0 animate-pulse bg-muted/50"
          aria-hidden
        />
      ) : (
        <img
          src={welcomeBannerImgSrc}
          alt="Background"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: backgroundOpacity }}
        />
      )}
      <div className="absolute inset-0" style={backgroundOverlayStyle} />

      {/* CONTENT WRAPPER */}
      <div className="relative mx-auto mt-8 max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="overflow-hidden"
          style={{
            background: inlineBlockStyle,
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* LEFT: Text content */}
            <div className="order-2 lg:order-1 px-8 py-10 sm:px-12 lg:py-12">
              {/* Company Logo (top-left) — hidden on mobile to avoid duplicate logo */}
              {clientData?.companyLogo ? (
                <BrandingImage
                  src={clientData.companyLogo}
                  alt={`${clientData.companyName || "Company"} logo`}
                  className="mb-6 h-10 w-auto hidden lg:block"
                />
              ) : (
                <p className="mb-6 text-xs font-semibold tracking-[0.4em] text-white/70 hidden lg:block">
                  LOGO HERE
                </p>
              )}

              <h1 className="font-unna font-dm-serif text-3xl leading-tight text-white sm:text-4xl lg:text-5xl">
                {headline}
              </h1>

              <div className="mt-6 text-base font-red-hat space-y-4">
                {descriptionParagraphs.map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>

              <div className="pt-5">
                <p className="text-lg font-dm-serif">{closing}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-base font-dm-serif text-white">
                    {signatureName}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/90 font-red-hat">
                    {signatureCompany}
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT: Benefits Logo */}
            <div className="order-1 lg:order-2 relative flex w-full items-center justify-center p-6 lg:p-8">
              {benefitsLogoUrl ? (
                <div className="relative flex w-full items-center justify-center rounded-lg bg-white p-8 shadow-xl backdrop-blur-sm">
                  <BrandingImage
                    src={benefitsLogoUrl}
                    alt={benefitsLogoAlt}
                    className="h-auto max-h-40 w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="relative flex min-h-[200px] w-full items-center justify-center rounded-lg bg-white/5 shadow-xl">
                  <span className="text-sm font-semibold tracking-wider text-white/50">
                    BENEFITS LOGO
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-0.5"
        style={{ background: brandColor }}
      />
    </section>
  );
}
