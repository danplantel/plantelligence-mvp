"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { designationAcronym } from "@/config/onboarding/designations";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { BrandingImage } from "@/components/ui/branding-image";
import { PortalSectionEditButton } from "@/components/portal-editing/portal-section-edit-button";
import { toNextImageSrc } from "@/lib/branding-image-url";
import { resolvePortalPrimaryContact } from "@/lib/portal-primary-contact";
import {
  portalPortraitRadius,
  portalRadiusValue,
} from "@/lib/typography-themes";
import {
  DEFAULT_WELCOME_BG,
  CATEGORY_DEFAULT_BGS,
} from "@/lib/portal-category-hero-background";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { fetchProfileOnce } from "@/lib/fetch-profile";

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
    /** The portrait chosen in the Editing Panel. Falls back to the key contact's headshot. */
    heroPortraitImage?: string;
    /** The plan's typography theme, which decides the portrait frame's shape. */
    typographyTheme?: string | null;
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
  /**
   * The contact the benefit editor's Section 1 named as this category's Key
   * Contact (`Benefit.supportContacts[].isPrimary`).
   *
   * The plan's contact records carry their own `isPrimaryByCategory` flags from
   * Edit Client → Key Contacts, and nothing keeps the two records in step — so
   * without this the banner kept signing whichever person THAT screen had
   * flagged, even after the benefit's Key Contact was changed.
   */
  primaryContactId?: string | null;
  /**
   * When set, "Schedule with …" becomes a button that runs this instead of opening
   * the contact's scheduling URL. The hub pages use it to scroll to the
   * "Have Questions?" band, where that contact's card lives.
   */
  onScheduleClick?: () => void;
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
  /**
   * Advisor profile (name, designations, organization name, email). When provided
   * (e.g. fetched alongside the client data by the parent), the signature fields
   * render immediately instead of the banner fetching /api/profile itself (which
   * would resolve after first paint and pop the designations/company in late).
   */
  profile?: {
    name?: string;
    designations?: string[];
    organizationName?: string;
    email?: string;
  } | null;
  customImage?: string; // Override right-side Benefits Logo
  customImageAlt?: string;
  /**
   * An image the advisor chose for the banner's portrait. Takes precedence over
   * the key contact's headshot, which stays the default.
   */
  portraitImage?: string;
  /**
   * The plan's typography theme. The live portal also carries it on `clientData`;
   * the editor previews pass it here because their hand-built `clientData` has
   * no theme. Either way it decides the portrait frame: a circle on a `round`
   * theme, a square on a `sharp` one.
   */
  typographyTheme?: string | null;
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
  /**
   * Where each editable element of the banner is changed, as an Edit Panel anchor.
   *
   * The banner is shared: on a benefit hub the headline and description live in the
   * benefit panel's "Benefit Messaging", the portrait and provider logo in
   * "Branding". The host knows that, so it passes the anchors and this component
   * only draws a pencil on each one it is given. Anything omitted gets no pencil —
   * and with no editing provider mounted (previews, participants) the button draws
   * nothing at all.
   */
  editTargets?: {
    /** The headline (Section 4's intro headline). */
    title?: string;
    /** The description paragraphs. */
    description?: string;
    /** The closing line and the signature block under it. */
    closing?: string;
    /** The circular key-contact portrait. */
    portrait?: string;
    /** The provider logo printed beneath the portrait. */
    logo?: string;
  };
}

export function PortalWelcomeBanner({
  clientData,
  brandColor = "#1F3A60",
  onTitleClick,
  onDescriptionClick,
  customHeadline,
  customDescription,
  customClosing,
  customSignature,
  customSignatureCompany,
  customDesignations,
  profile,
  customImage,
  customImageAlt,
  portraitImage,
  typographyTheme,
  category,
  primaryContactId,
  onScheduleClick,
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
  editTargets,
}: PortalWelcomeBannerProps) {
  // Auto-fetch the logged-in user's profile data from /api/profile when the
  // caller doesn't pass them explicitly (e.g. live portal pages). The Step 2
  // preview passes `customDesignations` directly, so this fetch is skipped.
  const [autoDesignations, setAutoDesignations] = useState<string[]>([]);
  const [autoOrganizationName, setAutoOrganizationName] = useState<string>("");
  const [autoEmail, setAutoEmail] = useState<string>("");
  useEffect(() => {
    // The parent supplies profile data (fetched alongside the client) — skip the
    // extra /api/profile request so the signature fields don't populate late.
    if (profile !== undefined) return;
    let cancelled = false;
    // Single-flight + TTL (lib/fetch-profile) — the surrounding dashboard / preview
    // already fetched the profile, so this reuses it. It resolves to null (never throws)
    // when the viewer is anonymous, which is the same outcome the old `.catch(() => {})`
    // produced on the public portal.
    fetchProfileOnce()
      .then((data) => {
        if (cancelled || !data) return;
        const arr = Array.isArray((data as any)?.designations)
          ? (data as any).designations
          : (data as any)?.user?.designations || [];
        setAutoDesignations(arr);
        setAutoOrganizationName(
          (data as any)?.organizationName ||
            (data as any)?.user?.organizationName ||
            "",
        );
        setAutoEmail((data as any)?.email || (data as any)?.user?.email || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile]);

  // Stored designations are ids. The signature row shows their acronyms (CFP®,
  // AIF®); legacy full labels and genuinely free-text values pass through the
  // resolver unchanged, so custom entries still display.
  const designationValues =
    customDesignations !== undefined
      ? customDesignations
      : profile?.designations ?? autoDesignations;
  const effectiveDesignationAcronyms = designationValues
    .map(designationAcronym)
    .filter(Boolean);
  const effectiveOrganizationName =
    profile?.organizationName ?? autoOrganizationName;
  const effectiveEmail = profile?.email ?? autoEmail;

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

  // The category's key contact. Shared with the video section's Schedule button
  // so both name the same person for the same benefit.
  //
  // The benefit's own pick wins (`primaryContactId`); the legacy mirror carries
  // the same id as `benefits[].contactId`, which covers the previews and any page
  // that predates the prop.
  const primaryContact = resolvePortalPrimaryContact(
    clientData?.keyContacts,
    category,
    primaryContactId ?? (categoryBenefit as any)?.contactId ?? null,
  );

  // Hero CTAs. The schedule button names the category's key contact (first name
  // only) and uses that contact's scheduling link, falling back to the plan's
  // appointment link. Without a name it stays a generic "Schedule a Meeting".
  const contactFirstName =
    String(primaryContact?.fullName || primaryContact?.name || "")
      .trim()
      .split(/\s+/)[0] || "";
  const scheduleLabel = contactFirstName
    ? `Schedule with ${contactFirstName}`
    : "Schedule a Meeting";
  const scheduleHref =
    (primaryContact as any)?.schedulingUrl ||
    (clientData as any)?.appointmentLink ||
    "";

  // Determine whether the primary contact is the logged-in user (advisor).
  // Compare by email — the key contact linked to the advisor account will
  // have the same email as the profile.
  const isPrimaryContactLoggedInUser = !!(
    effectiveEmail &&
    primaryContact &&
    (primaryContact as any).email?.toLowerCase() ===
      effectiveEmail.toLowerCase()
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
      ? [primaryContact.fullName || primaryContact.name, primaryContact.title]
          .filter((part) => !!part && part.trim() !== "")
          .join(" · ")
      : "");

  // If the key contact is the logged-in user, use their organization name
  // from the profile. Otherwise, use the contact's own company name.
  const signatureCompany =
    customSignatureCompany ||
    // When customSignature is explicitly provided (Step 2 preview "user"
    // mode) or the primary contact matches the logged-in user's email,
    // use the user's organization name from their profile.
    (customSignature || isPrimaryContactLoggedInUser
      ? effectiveOrganizationName
      : primaryContact?.companyName) ||
    effectiveOrganizationName ||
    "Company Name";

  // The banner's left-column portrait. Two sources, in order:
  //
  //  1. the image the advisor chose in the Editing Panel (benefit or plan);
  //  2. the category's key contact headshot — the DEFAULT.
  //
  // There is deliberately no stock-image fallback any more: the old "Inner Header
  // Image" defaults (one per category) made every banner look alike and hid the
  // fact that a headshot was missing. With neither source the circular frame shows
  // its own BENEFITS LOGO placeholder.
  const chosenPortrait = String(
    portraitImage || clientData?.heroPortraitImage || "",
  ).trim();
  const chosenPortraitUrl = chosenPortrait
    ? toNextImageSrc(chosenPortrait, "")
    : "";
  const contactHeadshotUrl = primaryContact?.headshot
    ? toNextImageSrc(String(primaryContact.headshot), "")
    : "";
  const portraitSrc = chosenPortraitUrl || contactHeadshotUrl;
  const portraitAlt =
    chosenPortraitUrl || contactHeadshotUrl
      ? String(primaryContact?.fullName || primaryContact?.name || "")
      : "";

  const wizardStep1Data = useBenefitsWizardStore(
    (s) => s.stepData?.step1 as any,
  );

  // Handle description as string or array of paragraphs
  const descriptionParagraphs = Array.isArray(description)
    ? description
    : [description];

  // Resolve overlay settings: persisted API values (employeePortalPreview) take precedence over props
  const epPreview = clientData?.employeePortalPreview as any;
  const effectiveBackgroundOpacity =
    epPreview?.heroBackgroundOpacity ?? backgroundOpacity;
  const effectiveContainerBlockOpacity =
    epPreview?.heroContainerBlockOpacity ?? containerBlockOpacity;
  const effectiveContainerInverted =
    epPreview?.heroContainerInverted ?? containerInverted;
  const effectiveBackgroundInverted =
    epPreview?.heroBackgroundInverted ?? backgroundInverted;
  const effectiveUseGradient = epPreview?.heroUseGradient ?? useGradient;

  // The portrait frame's shape, from the plan's Typography Theme: a circle on a
  // `round` theme, a square on a `sharp` one (see `portalPortraitRadius`).
  const portraitRadius = portalPortraitRadius(
    typographyTheme ?? clientData?.typographyTheme,
  );

  // Compute dynamic overlay styles
  const backgroundOverlayStyle = effectiveBackgroundInverted
    ? {
        backgroundColor: `rgba(255, 255, 255, ${
          1 - effectiveBackgroundOpacity
        })`,
      }
    : { backgroundColor: `rgba(0, 0, 0, ${1 - effectiveBackgroundOpacity})` };

  /**
   * The wash colour as an RGB triplet — white when the plan inverted the
   * container, black otherwise. The card plate and the phone-wide wash below
   * are both built from it so the two can never drift apart.
   */
  const washRgb = effectiveContainerInverted ? "255, 255, 255" : "0, 0, 0";

  // Container background: solid color when gradient is off, a top-down gradient when on.
  const containerBgStyle = effectiveUseGradient
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(${washRgb}, ${effectiveContainerBlockOpacity}), rgba(${washRgb}, ${
          effectiveContainerBlockOpacity * 0.3
        }))`,
      }
    : { backgroundColor: `rgba(${washRgb}, ${effectiveContainerBlockOpacity})` };

  /**
   * What a phone paints across the WHOLE hero — the same treatment the landing
   * hero gives its section (`portal-hero`). Below `sm` the card is nearly the
   * page's width, so its plate read as a hard-edged rectangle floating in the
   * artwork. Full-bleed reads as the image's own treatment instead, and the
   * gradient keeps the copy legible while clearing towards the bottom.
   */
  const mobileWash = `linear-gradient(to bottom, rgba(${washRgb}, ${effectiveContainerBlockOpacity}), rgba(${washRgb}, ${
    effectiveContainerBlockOpacity * 0.3
  }))`;

  /** True when this region can be opened in an Edit Panel at all. */
  const editableTitle = Boolean(onTitleClick || editTargets?.title);
  const editableDescription = Boolean(
    onDescriptionClick || editTargets?.description,
  );

  // ── Full-bleed welcome banner background ────────────────────────────────
  // Priority (matches the live hub): persisted per-category benefit image →
  // the wizard Step 1 header image (when its category matches the one being
  // previewed) → the per-category default hero image.
  const categoryDefaultBg =
    CATEGORY_DEFAULT_BGS[category || ""] || DEFAULT_WELCOME_BG;
  const benefits = clientData?.employeePortalPreview?.benefits ?? [];
  const catBenefit = benefits.find(
    (b: any) =>
      (b.category || "").toLowerCase() === (category || "").toLowerCase(),
  );
  const persistedImage = catBenefit?.image;
  const wizardImage = wizardStep1Data?.brandImages?.header?.url;
  const wizardMatch =
    wizardStep1Data?.benefitCategory &&
    category &&
    wizardStep1Data.benefitCategory === category
      ? wizardImage
      : undefined;
  const backgroundRawForBanner =
    persistedImage || wizardMatch || categoryDefaultBg;

  // R2 keys (org/...) are streamed through the same-origin /api/r2/object proxy
  // (session-authenticated on the dashboard, plan-scoped on the public portal)
  // rather than a presigned URL. Presigned R2 URLs can fail to render
  // inside an <img> on production even when /api/r2/signed-url returns 200 (see
  // useBrandingImageUrl) — which is why the same dev flow shows locally but not
  // after deploy. The proxy returns the original full-quality bytes. Absolute
  // URLs, data URLs, and local default assets pass through unchanged.
  const { url: resolvedBannerBgUrl } = useBrandingImageUrl(
    backgroundRawForBanner || null,
  );
  const backgroundSrc =
    resolvedBannerBgUrl || backgroundRawForBanner || categoryDefaultBg;

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

      {/* Phone-only wash, across the whole section — see `mobileWash`. Above
          `sm` this layer is off and the hero card carries the wash instead. */}
      <div
        aria-hidden="true"
        data-testid="welcome-banner-mobile-gradient"
        className="pointer-events-none absolute inset-0 z-[1] sm:hidden"
        style={{ background: mobileWash }}
      />

      {/* Benefit Hub Header (for all Categories) */}
      <div
        className="relative z-10 flex flex-col justify-center mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-12 lg:py-20"
        style={{ maxWidth: "72rem" }}
      >
        <div
          data-testid="welcome-banner-hero-card"
          className={`relative overflow-hidden backdrop-blur-sm ${
            effectiveContainerInverted
              ? "border border-gray-300"
              : "border border-white/15"
          }`}
          // The hero card is the banner's headline surface, so it wears the
          // typography theme's corner treatment: rounded for a round theme,
          // perfectly square for a sharp one (see `portalRadiusValue`).
          style={{ borderRadius: portalRadiusValue(2) }}
        >
          {/* The card's own plate. Tablet and desktop only: on phones the wash
              is the section-wide layer above, and painting this too would
              double it over the text. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden sm:block"
            style={{
              ...containerBgStyle,
              borderRadius: portalRadiusValue(2),
            }}
          />
          {/* `relative z-10`: the plate above is absolutely positioned, and the
              card's `backdrop-blur` makes it a stacking context — without this
              the wash would paint OVER the copy and the brand-coloured CTA. */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            // No min-height on the stacked (mobile/tablet) layout: the two rows
            // size to their content, so a short benefit does not get a card
            // padded out with empty space. The desktop split keeps its band.
            className="relative z-10 grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] lg:min-h-[30rem]"
          >
            {/* RIGHT: Text content (left on mobile, where the image leads) */}
            {/* Mobile keeps a tight seam under the portrait block (it is the row
                directly above); `sm` and `lg` restore the roomier spacing. */}
            <div className="order-2 flex flex-col px-6 pb-8 pt-4 sm:px-12 sm:pb-10 sm:pt-8 lg:order-2 lg:py-12">
              {/* Title */}
              <div
                className={`relative ${
                  editableTitle ? "cursor-pointer group" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTitleClick?.();
                }}
              >
                {/* The pencil is a BUTTON of its own: the headline's wrapper opens
                    the editor too, but the pencil names the exact panel section.
                    Revealed on hover through CSS rather than state — a
                    state-rendered button unmounts the moment the pointer leaves
                    the region to reach it. */}
                {editTargets?.title && (
                  <PortalSectionEditButton
                    sectionId={editTargets.title}
                    label="Edit headline"
                    iconOnly
                    className="-left-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  />
                )}
                <h1
                  className={`font-unna font-dm-serif text-3xl leading-tight sm:text-4xl lg:text-5xl ${
                    effectiveContainerInverted ? "text-gray-900" : "text-white"
                  }`}
                >
                  {headline}
                </h1>
              </div>

              {/* Description paragraphs */}
              <div
                className={`relative ${
                  editableDescription
                    ? "cursor-pointer group mt-6"
                    : "mt-6"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDescriptionClick?.();
                }}
              >
                {editTargets?.description && (
                  <PortalSectionEditButton
                    sectionId={editTargets.description}
                    label="Edit description"
                    iconOnly
                    className="-left-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  />
                )}
                <div className="text-base font-red-hat space-y-4">
                  {descriptionParagraphs.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Closing & Signature */}
              <div className="group relative pt-5">
                {editTargets?.closing && (
                  <PortalSectionEditButton
                    sectionId={editTargets.closing}
                    label="Edit closing and signature"
                    iconOnly
                    className="-left-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  />
                )}
                <p
                  className={`text-lg font-red-hat ${
                    customClosingBold ? "font-bold" : "font-normal"
                  } ${customClosingItalic ? "italic" : ""}`}
                >
                  {closing}
                </p>

                {/* Signature — row 1: a short 30px rule + the key contact's
                    name. Row 2: designations - company/plan name. */}
                <div className="mt-3 space-y-1.5">
                  {signatureName && (
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`h-px w-[30px] shrink-0 ${
                          effectiveContainerInverted
                            ? "bg-gray-400"
                            : "bg-white/60"
                        }`}
                      />
                      <p
                        className={`text-xl font-red-hat font-bold sm:text-2xl ${
                          effectiveContainerInverted
                            ? "text-gray-900"
                            : "text-white"
                        } ${customSignatureNameBold ? "font-bold" : ""} ${
                          customSignatureNameItalic ? "italic" : ""
                        }`}
                      >
                        {signatureName}
                      </p>
                    </div>
                  )}

                  {(effectiveDesignationAcronyms.length > 0 ||
                    signatureCompany) && (
                    <p
                      className={`flex flex-nowrap items-center gap-x-2 whitespace-nowrap ${
                        signatureName ? "pl-[38px]" : ""
                      }`}
                    >
                      {effectiveDesignationAcronyms.length > 0 && (
                        <span
                          className={`shrink-0 text-sm font-red-hat font-normal ${
                            effectiveContainerInverted
                              ? "text-gray-700"
                              : "text-white/70"
                          }`}
                        >
                          {effectiveDesignationAcronyms.join(", ")}
                        </span>
                      )}
                      {effectiveDesignationAcronyms.length > 0 &&
                        signatureCompany && (
                          <span
                            className={`shrink-0 ${
                              effectiveContainerInverted
                                ? "text-gray-400"
                                : "text-white/40"
                            }`}
                          >
                            -
                          </span>
                        )}
                      {signatureCompany && (
                        <span
                          title={signatureCompany}
                          className={`min-w-0 truncate text-xs uppercase tracking-[0.2em] font-red-hat font-normal ${
                            effectiveContainerInverted
                              ? "text-gray-500"
                              : "text-white/90"
                          } ${customSignatureCompanyBold ? "font-bold" : ""} ${
                            customSignatureCompanyItalic ? "italic" : ""
                          }`}
                        >
                          {signatureCompany}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* CTA row. On phones the Schedule button spans the column: it is
                  the only action in the row, and a half-width tap target on a
                  narrow screen reads as a stray fragment. From `sm` up it keeps
                  the half-row width it had when it shared this row with the
                  (now removed) "Meet the Team" link, so it does not stretch
                  across the whole info column. */}
              <div className="mt-auto flex flex-row gap-3 pt-6 sm:pt-8">
                {onScheduleClick ? (
                  <button
                    type="button"
                    onClick={onScheduleClick}
                    className="inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90 sm:w-[calc(50%_-_0.375rem)]"
                    style={{
                      background: brandColor,
                      borderRadius: portalRadiusValue(),
                    }}
                  >
                    {scheduleLabel}
                  </button>
                ) : scheduleHref ? (
                  <a
                    href={scheduleHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90 sm:w-[calc(50%_-_0.375rem)]"
                    style={{
                      background: brandColor,
                      borderRadius: portalRadiusValue(),
                    }}
                  >
                    {scheduleLabel}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90 sm:w-[calc(50%_-_0.375rem)]"
                    style={{
                      background: brandColor,
                      borderRadius: portalRadiusValue(),
                    }}
                  >
                    {scheduleLabel}
                  </button>
                )}
              </div>
            </div>

            {/* LEFT: key contact headshot (falls back to the category's stock
                image) in a circular frame, with the company logo beneath it. */}
            <div className="order-1 flex flex-col items-center justify-center gap-4 px-4 pb-4 pt-8 sm:gap-5 sm:pb-6 sm:pt-10 lg:order-1 lg:py-10 lg:pl-16 lg:pr-4">
              <div className="group relative">
                {editTargets?.portrait && (
                  <PortalSectionEditButton
                    sectionId={editTargets.portrait}
                    label="Edit key contact portrait"
                    iconOnly
                    className="-left-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  />
                )}
                {/* Circle for a `round` theme, square for a `sharp` one. */}
                <div
                  data-testid="welcome-banner-portrait-frame"
                  className={`h-[176px] w-[176px] shrink-0 overflow-hidden shadow-2xl ring-4 sm:h-[200px] sm:w-[200px] ${
                    effectiveContainerInverted
                      ? "ring-gray-200"
                      : "ring-white/30"
                  }`}
                  style={{ borderRadius: portraitRadius }}
                >
                  {portraitSrc ? (
                    <img
                      src={portraitSrc}
                      alt={portraitAlt}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/10">
                      <span
                        className={`text-xs font-semibold tracking-wider ${
                          effectiveContainerInverted
                            ? "text-gray-400"
                            : "text-white/50"
                        }`}
                      >
                        BENEFITS LOGO
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Company logo — beneath the circular key-contact portrait.
                  Priority: per-category partnerLogo (set via wizard Provider Logo
                  upload) → plan-level companyLogo → fallback "LOGO HERE". */}
              <div className="group relative">
              {editTargets?.logo && (
                <PortalSectionEditButton
                  sectionId={editTargets.logo}
                  label="Edit provider logo"
                  iconOnly
                  className="-left-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                />
              )}
              {(() => {
                const resolvedLogo =
                  categoryBenefit?.partnerLogo || clientData?.companyLogo;
                if (resolvedLogo) {
                  return (
                    <BrandingImage
                      src={resolvedLogo}
                      alt={`${clientData?.companyName || "Company"} logo`}
                      className="h-10 w-auto max-w-[180px] object-contain sm:h-14 sm:max-w-[200px]"
                    />
                  );
                }
                return (
                  <p
                    className={`text-xs font-semibold tracking-[0.4em] ${
                      effectiveContainerInverted
                        ? "text-gray-400"
                        : "text-white/70"
                    }`}
                  >
                    LOGO HERE
                  </p>
                );
              })()}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* No bottom accent bar: the banner used to end on a 2px strip of the plan's
          PRIMARY colour, which read as a stray brand-coloured rule hanging off the
          bottom of the section (and, at full-bleed width, wider than the hero card it
          was meant to underline). The section now ends on its own artwork. */}
    </section>
  );
}
