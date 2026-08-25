"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { BrandingImage } from "@/components/ui/branding-image";
import { isR2BrandingKey, toNextImageSrc } from "@/lib/branding-image-url";
import {
  DEFAULT_WELCOME_BG,
  CATEGORY_DEFAULT_BGS,
  getPortalWelcomeBackgroundUrl,
} from "@/lib/portal-category-hero-background";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

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
  /** User's professional designations (e.g. CFP, AIF) shown after the signature name. */
  customDesignations?: string[];
  customImage?: string; // Override right-side Benefits Logo
  customImageAlt?: string;
  /** Inner Header Image — full-height image for the right column of the hero section */
  customInnerHeaderImage?: string;
  // Hero overlay settings
  backgroundOpacity?: number;
  containerBlockOpacity?: number;
  containerInverted?: boolean;
  backgroundInverted?: boolean;
  useGradient?: boolean;
  // Closing & Signature style flags (per-line bold/italic)
  customClosingBold?: boolean;
  customClosingItalic?: boolean;
  customSignatureNameBold?: boolean;
  customSignatureNameItalic?: boolean;
  customSignatureCompanyBold?: boolean;
  customSignatureCompanyItalic?: boolean;
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
  customDesignations,
  customImage,
  customImageAlt,
  customInnerHeaderImage,
  category,
  backgroundOpacity = 1.0,
  containerBlockOpacity = 0.67,
  containerInverted = false,
  backgroundInverted = false,
  useGradient = false,
  customClosingBold = true,
  customClosingItalic = false,
  customSignatureNameBold = false,
  customSignatureNameItalic = false,
  customSignatureCompanyBold = false,
  customSignatureCompanyItalic = true,
  desktopHeroBackgroundPosition,
  mobileHeroBackgroundPosition,
}: PortalWelcomeBannerProps) {
  // Auto-fetch the logged-in user's profile data from /api/profile when the
  // caller doesn't pass them explicitly (e.g. live portal pages). The Step 2
  // preview passes `customDesignations` directly, so this fetch is skipped.
  const [autoDesignations, setAutoDesignations] = useState<string[]>([]);
  const [autoOrganizationName, setAutoOrganizationName] = useState<string>("");
  const [autoEmail, setAutoEmail] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray((data as any)?.designations)
          ? (data as any).designations
          : ((data as any)?.user?.designations || []);
        setAutoDesignations(arr);
        setAutoOrganizationName(
          (data as any)?.organizationName ||
            (data as any)?.user?.organizationName ||
            "",
        );
        setAutoEmail(
          (data as any)?.email ||
            (data as any)?.user?.email ||
            "",
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const effectiveDesignations =
    customDesignations !== undefined ? customDesignations : autoDesignations;

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

  // Determine whether the primary contact is the logged-in user (advisor).
  // Compare by email — the key contact linked to the advisor account will
  // have the same email as the profile.
  const isPrimaryContactLoggedInUser = !!(
    autoEmail &&
    primaryContact &&
    ((primaryContact as any).email?.toLowerCase() === autoEmail.toLowerCase())
  );

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

  // If the key contact is the logged-in user, use their organization name
  // from the profile. Otherwise, use the contact's own company name.
  const signatureCompany =
    customSignatureCompany ||
    // When customSignature is explicitly provided (Step 2 preview "user"
    // mode) or the primary contact matches the logged-in user's email,
    // use the user's organization name from their profile.
    (customSignature || isPrimaryContactLoggedInUser
      ? autoOrganizationName
      : primaryContact?.companyName) ||
    autoOrganizationName ||
    "Company Name";

  // Right-side Benefits Logo: customImage override → categoryBenefit.partnerLogo (per-category, set in Step 1) → companyLogo (top-level) → null
  const benefitsLogoUrl =
    customImage ||
    categoryBenefit?.partnerLogo ||
    clientData?.companyLogo?.trim() ||
    null;

  const benefitsLogoAlt =
    customImageAlt ||
    `${clientData?.companyName || "Company"} Benefits Logo`;

  // Inner Header Image (right column, full height):
  // customInnerHeaderImage override → categoryBenefit.innerHeaderImage (per-category) → null
  const innerHeaderImageUrl =
    customInnerHeaderImage ||
    categoryBenefit?.innerHeaderImage ||
    null;

  // Background image: prioritize the wizard Editor Panel upload (Step 2) over
  // the API's backgroundImg. Falls back to DEFAULT_WELCOME_BG when no custom
  // image is available (the Unsplash beach photo).
  const wizardStep1Data = useBenefitsWizardStore((s) => s.stepData?.step1 as any);
  const backgroundRaw =
    wizardStep1Data?.brandImages?.header?.url
    || clientData?.backgroundImg
    || getPortalWelcomeBackgroundUrl(clientData ?? null);
  const { url: backgroundResolved, loading: backgroundLoading } =
    useBrandingImageUrl(backgroundRaw || null);
  const isR2WelcomeBg = isR2BrandingKey(backgroundRaw);
  const background = isR2WelcomeBg
    ? backgroundResolved ?? undefined
    : (backgroundResolved ?? backgroundRaw) || undefined;

  const welcomeBannerImgSrc = background ?? (!isR2WelcomeBg ? backgroundRaw : undefined);

  // Handle description as string or array of paragraphs
  const descriptionParagraphs = Array.isArray(description)
    ? description
    : [description];

  // Resolve overlay settings: persisted API values (employeePortalPreview) take precedence over props
  const epPreview = clientData?.employeePortalPreview as any;
  const effectiveBackgroundOpacity = epPreview?.heroBackgroundOpacity ?? backgroundOpacity;
  const effectiveContainerBlockOpacity = epPreview?.heroContainerBlockOpacity ?? containerBlockOpacity;
  const effectiveContainerInverted = epPreview?.heroContainerInverted ?? containerInverted;
  const effectiveBackgroundInverted = epPreview?.heroBackgroundInverted ?? backgroundInverted;
  const effectiveUseGradient = epPreview?.heroUseGradient ?? useGradient;

  // Compute dynamic overlay styles
  const backgroundOverlayStyle = effectiveBackgroundInverted
    ? { backgroundColor: `rgba(255, 255, 255, ${1 - effectiveBackgroundOpacity})` }
    : { backgroundColor: `rgba(0, 0, 0, ${1 - effectiveBackgroundOpacity})` };

  // Container background: solid backgroundColor when gradient is off, backgroundImage gradient when on
  const containerBgStyle = effectiveContainerInverted
    ? effectiveUseGradient
      ? { backgroundImage: `linear-gradient(to bottom, rgba(255, 255, 255, ${effectiveContainerBlockOpacity}), rgba(255, 255, 255, ${effectiveContainerBlockOpacity * 0.3}))` }
      : { backgroundColor: `rgba(255, 255, 255, ${effectiveContainerBlockOpacity})` }
    : effectiveUseGradient
      ? { backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, ${effectiveContainerBlockOpacity}), rgba(0, 0, 0, ${effectiveContainerBlockOpacity * 0.3}))` }
      : { backgroundColor: `rgba(0, 0, 0, ${effectiveContainerBlockOpacity})` };

  const [hoveredField, setHoveredField] = useState<string | null>(null);

  const EditPencil = () => (
    <div className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </div>
  );

  const heroImageSrc = toNextImageSrc(welcomeBannerImgSrc, DEFAULT_WELCOME_BG);

  // Compute the default background image per category
  const categoryDefaultBg = CATEGORY_DEFAULT_BGS[category || ""] || DEFAULT_WELCOME_BG;

  // Resolve the full-bleed background image URL
  const benefits = clientData?.employeePortalPreview?.benefits ?? [];
  const catBenefit = benefits.find((b: any) => (b.category || "").toLowerCase() === (category || "").toLowerCase());
  const persistedImage = catBenefit?.image;
  const wizardImage = wizardStep1Data?.brandImages?.header?.url;
  const wizardMatch = wizardStep1Data?.benefitCategory && category && wizardStep1Data.benefitCategory === category ? wizardImage : undefined;
  // Resolve R2 keys (org/...) to the same-origin proxy so a header background
  // pre-populated from the User profile in Step 1 displays correctly.
  const backgroundSrc = toNextImageSrc(
    persistedImage || wizardMatch || categoryDefaultBg,
    categoryDefaultBg,
  );

  return (
    <section
      id="portal-welcome-banner"
      className={`relative isolate overflow-hidden min-h-[50vh] lg:min-h-screen w-full ${
        effectiveContainerInverted ? "text-gray-900" : "text-white"
      }`}
      style={{
        backgroundColor: "#0F172A",
        backgroundImage: backgroundSrc ? `url(${backgroundSrc})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: desktopHeroBackgroundPosition
          ? `${desktopHeroBackgroundPosition.x}% ${desktopHeroBackgroundPosition.y}%`
          : "center",
        backgroundRepeat: "no-repeat",
      }}
      data-bg-src={backgroundSrc || "(none)"}
      data-bg-category={category || "(none)"}
    >
      {/* Guaranteed edge-to-edge background layer. Rendered as an <img> with
          object-cover (in addition to the CSS background) so the header background
          ALWAYS fills the banner — some R2-proxied images render at natural size
          as a CSS background, leaving the navy color visible on the sides. */}
      {backgroundSrc && (
        <img
          src={backgroundSrc}
          alt=""
          aria-hidden
          className="portal-welcome-bg-img absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition: desktopHeroBackgroundPosition
              ? `${desktopHeroBackgroundPosition.x}% ${desktopHeroBackgroundPosition.y}%`
              : "center",
          }}
        />
      )}
      {mobileHeroBackgroundPosition && (
        <style>{`
          @media (max-width: 640px) {
            #portal-welcome-banner {
              background-position: ${mobileHeroBackgroundPosition.x}% ${mobileHeroBackgroundPosition.y}% !important;
            }
            #portal-welcome-banner .portal-welcome-bg-img {
              object-position: ${mobileHeroBackgroundPosition.x}% ${mobileHeroBackgroundPosition.y}% !important;
            }
          }
        `}</style>
      )}

      {/* Background darken/lighten overlay — controlled by "Background Opacity".
          Painted above the CSS background AND the object-cover <img> layer, but
          below the content (z-10). */}
      <div
        className="absolute inset-0 z-[1]"
        style={backgroundOverlayStyle}
        aria-hidden
      />

      {/* Benefit Hub Header (for all Categories) */}
      <div
        className="relative z-10 flex flex-col justify-center mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-12 lg:py-20"
        style={{ maxWidth: "72rem" }}
      >
        <div
          className={`overflow-hidden backdrop-blur-sm ${
            effectiveContainerInverted
              ? "border border-gray-300"
              : "border border-white/15"
          }`}
          style={containerBgStyle}
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] min-h-[28rem] lg:min-h-[30rem]"
          >
            {/* LEFT: Text content */}
            <div className="order-2 lg:order-1 px-8 py-10 sm:px-12 lg:py-12">
              {/* Company Logo (top-left) — hidden on mobile.
                  Priority: per-category partnerLogo (set via wizard Provider Logo upload)
                  → plan-level companyLogo → fallback "LOGO HERE" placeholder */}
              {(() => {
                const resolvedLogo = categoryBenefit?.partnerLogo || clientData?.companyLogo;
                if (resolvedLogo) {
                  return (
                    <BrandingImage
                      src={resolvedLogo}
                      alt={`${clientData?.companyName || "Company"} logo`}
                      className="mb-6 h-16 w-auto hidden lg:block"
                    />
                  );
                }
                return (
                  <p className={`mb-6 text-xs font-semibold tracking-[0.4em] hidden lg:block ${
                    effectiveContainerInverted ? "text-gray-400" : "text-white/70"
                  }`}>
                    LOGO HERE
                  </p>
                );
              })()}

              {/* Title */}
              <div
                className={`relative ${onTitleClick ? "cursor-pointer group" : ""}`}
                onClick={(e) => { e.stopPropagation(); onTitleClick?.(); }}
                onMouseEnter={() => onTitleClick && setHoveredField("title")}
                onMouseLeave={() => onTitleClick && setHoveredField(null)}
              >
                {onTitleClick && hoveredField === "title" && <EditPencil />}
                <h1 className={`font-unna font-dm-serif text-3xl leading-tight sm:text-4xl lg:text-5xl ${
                  effectiveContainerInverted ? "text-gray-900" : "text-white"
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
                <p className={`text-lg font-red-hat ${customClosingBold ? "font-bold" : "font-normal"} ${customClosingItalic ? "italic" : ""}`}>{closing}</p>
                <div className="mt-2 space-y-1">
                  <p className={`text-base font-red-hat font-normal ${
                    effectiveContainerInverted ? "text-gray-900" : "text-white"
                  } ${customSignatureNameBold ? "font-bold" : ""} ${customSignatureNameItalic ? "italic" : ""}`}>
                    {signatureName}
                  </p>
                  {effectiveDesignations.length > 0 && (
                    <p className={`text-sm font-red-hat font-normal ${
                      effectiveContainerInverted ? "text-gray-700" : "text-white/70"
                    }`}>
                      {effectiveDesignations.join(", ")}
                    </p>
                  )}
                  <p className={`text-xs uppercase tracking-[0.2em] font-red-hat font-normal ${
                    effectiveContainerInverted ? "text-gray-500" : "text-white/90"
                  } ${customSignatureCompanyBold ? "font-bold" : ""} ${customSignatureCompanyItalic ? "italic" : ""}`}>
                    {signatureCompany}
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT: Inner Header Image */}
            <div className="order-1 lg:order-2 relative">
              {innerHeaderImageUrl ? (
                <img
                  src={innerHeaderImageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : benefitsLogoUrl ? (
                <div className="relative flex items-center justify-center h-full min-h-[200px]">
                  <BrandingImage
                    src={benefitsLogoUrl}
                    alt={benefitsLogoAlt}
                    className="h-auto max-h-40 w-auto max-w-full object-contain border-0 outline-0"
                  />
                </div>
              ) : (
                <div className="relative flex min-h-[200px] w-full items-center justify-center">
                  <span className={`text-sm font-semibold tracking-wider ${
                    effectiveContainerInverted ? "text-gray-400" : "text-white/50"
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
