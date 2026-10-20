"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { designationAcronym } from "@/config/onboarding/designations";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { BrandingImage } from "@/components/ui/branding-image";
import { toNextImageSrc } from "@/lib/branding-image-url";
import { resolvePortalPrimaryContact } from "@/lib/portal-primary-contact";
import {
  DEFAULT_WELCOME_BG,
  CATEGORY_DEFAULT_BGS,
  CATEGORY_DEFAULT_INNER_IMAGES,
} from "@/lib/portal-category-hero-background";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { fetchProfileOnce } from "@/lib/fetch-profile";

interface PortalWelcomeBannerProps {
  /** Click handler for the benefit portal title (headline). Opens the editor. */
  onTitleClick?: () => void;
  /** Click handler for the summary description text. Opens the editor. */
  onDescriptionClick?: () => void;
  /** Click handler for the Inner Header Image (left column). Opens the editor. */
  onInnerHeaderImageClick?: () => void;
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
  /** Inner Header Image — full-height image for the left column of the hero section */
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
  onInnerHeaderImageClick,
  customHeadline,
  customDescription,
  customClosing,
  customSignature,
  customSignatureCompany,
  customDesignations,
  profile,
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
  // Portal base path for in-app links (e.g. My Benefits Team). Empty in the
  // wizard's preview chrome, where no plan slug is in the route.
  const params = useParams<{ id?: string }>();
  const portalBasePath =
    typeof params?.id === "string" && params.id ? `/${params.id}` : "";

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
  const primaryContact = resolvePortalPrimaryContact(
    clientData?.keyContacts,
    category,
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

  // Inner Header Image (left column, full height):
  // customInnerHeaderImage override → categoryBenefit.innerHeaderImage (per-category) →
  // category default inner image (from /benefits-hub-default-inner-images) matched to the
  // current benefit category. The default images replace the company logo in this slot.
  const categoryDefaultInnerImage =
    CATEGORY_DEFAULT_INNER_IMAGES[category || ""] ||
    CATEGORY_DEFAULT_INNER_IMAGES["Retirement"];
  // Resolve R2 keys (org/...) to a loadable URL so a stored key (e.g. the inner
  // header image) never renders as a broken relative URL.
  const innerHeaderImageUrl = toNextImageSrc(
    customInnerHeaderImage ||
      categoryBenefit?.innerHeaderImage ||
      categoryDefaultInnerImage,
    categoryDefaultInnerImage,
  );

  // The circular portrait shows the category's key contact's headshot. Without
  // one it falls back to the Inner Header Image, which keeps its in-place
  // editing affordance; a headshot is not the inner-header field, so clicking it
  // must not open that editor.
  const contactHeadshotUrl = primaryContact?.headshot
    ? toNextImageSrc(String(primaryContact.headshot), "")
    : "";
  const portraitSrc = contactHeadshotUrl || innerHeaderImageUrl;
  const portraitEditable =
    !contactHeadshotUrl && Boolean(onInnerHeaderImageClick);
  const portraitAlt = contactHeadshotUrl
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

  // Compute dynamic overlay styles
  const backgroundOverlayStyle = effectiveBackgroundInverted
    ? {
        backgroundColor: `rgba(255, 255, 255, ${
          1 - effectiveBackgroundOpacity
        })`,
      }
    : { backgroundColor: `rgba(0, 0, 0, ${1 - effectiveBackgroundOpacity})` };

  // Container background: solid backgroundColor when gradient is off, backgroundImage gradient when on
  const containerBgStyle = effectiveContainerInverted
    ? effectiveUseGradient
      ? {
          backgroundImage: `linear-gradient(to bottom, rgba(255, 255, 255, ${effectiveContainerBlockOpacity}), rgba(255, 255, 255, ${
            effectiveContainerBlockOpacity * 0.3
          }))`,
        }
      : {
          backgroundColor: `rgba(255, 255, 255, ${effectiveContainerBlockOpacity})`,
        }
    : effectiveUseGradient
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, ${effectiveContainerBlockOpacity}), rgba(0, 0, 0, ${
          effectiveContainerBlockOpacity * 0.3
        }))`,
      }
    : { backgroundColor: `rgba(0, 0, 0, ${effectiveContainerBlockOpacity})` };

  const [hoveredField, setHoveredField] = useState<string | null>(null);

  const EditPencil = () => (
    <div className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20">
      <svg
        className="w-3 h-3 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    </div>
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
            className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] min-h-[28rem] lg:min-h-[30rem]"
          >
            {/* RIGHT: Text content (left on mobile, where the image leads) */}
            <div className="order-2 flex flex-col px-8 py-10 sm:px-12 lg:order-2 lg:py-12">
              {/* Title */}
              <div
                className={`relative ${
                  onTitleClick ? "cursor-pointer group" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTitleClick?.();
                }}
                onMouseEnter={() => onTitleClick && setHoveredField("title")}
                onMouseLeave={() => onTitleClick && setHoveredField(null)}
              >
                {onTitleClick && hoveredField === "title" && <EditPencil />}
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
                  onDescriptionClick ? "cursor-pointer group mt-6" : "mt-6"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDescriptionClick?.();
                }}
                onMouseEnter={() =>
                  onDescriptionClick && setHoveredField("description")
                }
                onMouseLeave={() => onDescriptionClick && setHoveredField(null)}
              >
                {onDescriptionClick && hoveredField === "description" && (
                  <EditPencil />
                )}
                <div className="text-base font-red-hat space-y-4">
                  {descriptionParagraphs.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Closing & Signature */}
              <div className="pt-5">
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

              {/* CTA row — side by side at the bottom of the info column. */}
              <div className="mt-auto flex flex-row gap-3 pt-8">
                {scheduleHref ? (
                  <a
                    href={scheduleHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90"
                    style={{ background: secondaryColor }}
                  >
                    {scheduleLabel}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90"
                    style={{ background: secondaryColor }}
                  >
                    {scheduleLabel}
                  </button>
                )}

                <Link
                  href={`${portalBasePath}/my-benefits-team`}
                  className={`inline-flex flex-1 items-center justify-center rounded-lg border px-5 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 ${
                    effectiveContainerInverted
                      ? "border-gray-300 text-gray-900"
                      : "border-white/40 text-white"
                  }`}
                >
                  Meet the Team
                </Link>
              </div>
            </div>

            {/* LEFT: key contact headshot (falls back to the Inner Header Image)
                in a circular frame, with the company logo beneath it. The
                fallback image is editable in place, like the headline and
                description beside it. */}
            <div className="order-1 flex flex-col items-center justify-center gap-5 px-4 py-10 lg:order-1 lg:pl-16 lg:pr-4">
              <div
                // Marks the Inner Header Image as the scroll target for the
                // editor's own control, which asks the preview to reveal it when
                // focused. Only present when the fallback image is what's shown
                // and an editing panel exists — the live portal has no such
                // consumer, and the attribute is not part of its markup contract.
                data-preview-field={
                  portraitEditable ? "innerHeaderImage" : undefined
                }
                className={`relative ${
                  portraitEditable ? "cursor-pointer group" : ""
                }`}
                onClick={(e) => {
                  if (!portraitEditable) return;
                  e.stopPropagation();
                  onInnerHeaderImageClick?.();
                }}
                onMouseEnter={() =>
                  portraitEditable && setHoveredField("innerHeaderImage")
                }
                onMouseLeave={() => portraitEditable && setHoveredField(null)}
              >
                {portraitEditable && hoveredField === "innerHeaderImage" && (
                  <EditPencil />
                )}
                <div
                  className={`h-[200px] w-[200px] shrink-0 overflow-hidden rounded-full shadow-2xl ring-4 ${
                    effectiveContainerInverted
                      ? "ring-gray-200"
                      : "ring-white/30"
                  }`}
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

              {/* Company logo — beneath the circular Inner Header Image.
                  Priority: per-category partnerLogo (set via wizard Provider Logo
                  upload) → plan-level companyLogo → fallback "LOGO HERE". */}
              {(() => {
                const resolvedLogo =
                  categoryBenefit?.partnerLogo || clientData?.companyLogo;
                if (resolvedLogo) {
                  return (
                    <BrandingImage
                      src={resolvedLogo}
                      alt={`${clientData?.companyName || "Company"} logo`}
                      className="h-12 w-auto max-w-[200px] object-contain sm:h-14"
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
