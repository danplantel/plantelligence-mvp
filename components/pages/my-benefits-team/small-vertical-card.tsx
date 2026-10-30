"use client";

import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";
import { Mail, Phone, Clock } from "lucide-react";
import { getSupportIcon } from "@/lib/support-icons";
import { designationAcronym } from "@/config/onboarding/designations";
import { motion } from "framer-motion";
import { ContactAvatar } from "@/components/pages/my-benefits-team/contact-avatar";
import { formatPhone } from "@/components/pages/my-benefits-team/utils";
import { cn } from "@/lib/utils";
import { readableColor, mix } from "polished";
import {
  formatPhoneWithExtension,
  getBasePhoneForDialing,
} from "@/lib/phone-utils";
import { withContactFormAvatar } from "@/lib/url-utils";
import { resolveContactFormUrl } from "@/lib/contact-form-link";
import { ContactCategoryBadge } from "@/components/ui/contact-category-badge";
import { portalRadiusValue } from "@/lib/typography-themes";
import type { SupportCardSize } from "@/lib/support-card-layout";

interface Contact {
  id?: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  /** Free-text designations, each rendered directly under the job title. */
  designations?: string[];
  customRole?: string;
  email?: string;
  phone?: string;
  phoneExtension?: string;
  headshot?: string;
  logo?: string;
  companyName?: string;
  companyLogo?: string;
  benefitsCategory?:
    | "Retirement"
    | "Health Insurance"
    | "Life Insurance"
    | "Company / Plan Sponsor"
    | "Other";
  benefitsCategoryOther?: string;
  isPrimary?: boolean;
  displayEmail?: boolean;
  displayPhone?: boolean;
  displayUrl?: boolean;
  displayScheduleAppointment?: boolean;
  schedulingUrl?: string;
  websiteUrl?: string;
  enableContactButton?: boolean;
  contactButtonType?: string;
  contactType?: "individual" | "team_support";
  supportHours?: string;
  departmentLabel?: string;
  displayName?: string;
  cardPrimaryColor?: string;
  cardSecondaryColor?: string;
  cardBackgroundColor?: string;
  logoScale?: number;
  teamImage?: string;
  /** Advisor-selected badge icon for Team / Support Line contacts. */
  supportIcon?: string;
}

interface SmallVerticalCardProps {
  contact: Contact;
  brandColor: string;
  secondaryColor: string;
  /**
   * Background for the card's primary CTA button. Defaults to `secondaryColor`
   * (the long-standing card design); the benefit hubs pass the plan's primary
   * colour so their support CTAs match the rest of the hub's buttons.
   */
  ctaColor?: string;
  appointmentLink: string;
  companyName?: string;
  width?: string; // Optional custom width
  index?: number; // For animation delay
  disableAnimation?: boolean; // Disable animation for preview
  baselineBackgroundColor?: string;
  baselineLogoScale?: number;
  /** When true, reduces padding, margins, avatar, text, and min-height for compact
   *  display in constrained containers such as the mobile wizard preview grid. */
  compact?: boolean;
  /**
   * Stretch to the height of the tallest card in the row.
   *
   * Without it the card hugs its content (`self-start`), which is what removes
   * the empty block under the last row — but a row where only SOME cards draw a
   * CTA then reads ragged. The support row turns this on as soon as any card has
   * a button, so every card in that row is level and the slack sits where the
   * button would be.
   */
  equalHeight?: boolean;
  /**
   * Element tier. Set by the benefit hub's "Have Questions?" row, where the
   * number of support contacts decides how big each card is (`sm` 4-up, `md`
   * 3-up, `lg` 2-up / a lone card). Omitted everywhere else, where `compact`
   * picks the tier instead — the My Benefits Team layouts keep the `md` look
   * they have always had.
   */
  size?: SupportCardSize;
  /** When true, renders muted [placeholder] labels for any missing card data
   *  (used only by the wizard's live Portal Preview — never real portal cards). */
  previewPlaceholders?: boolean;
  /**
   * Render the Contact Form CTA ("Contact") as a non-interactive label.
   *
   * Set by the wizard's Portal Previews. The button still has to look like the
   * published card, so it is drawn rather than hidden or dimmed — but clicking it
   * must not navigate, because it opens the live Plantelligence `/contact` page in
   * a new tab and would take the advisor out of the form they are editing.
   *
   * Never set on a real portal card: there the button is the contact's actual way
   * for a participant to reach them.
   */
  disableContactFormButton?: boolean;
  /**
   * Phone-sized card design. Set ONLY by the mobile layouts (My Benefits Team's
   * mobile renderer and the Step 3 / Contacts mobile preview), which are the two
   * surfaces that must stay in lockstep:
   *
   *  - `wide`    — the full-width card in the Stacked and Hero mobile layouts;
   *  - `compact` — the narrower card in the 2-column (and Hero + Grid) mobile layouts.
   *
   * Undefined keeps the existing compact/regular card, which is what the benefit
   * hub pages and every desktop layout render.
   */
  mobileVariant?: "wide" | "compact";
  /**
   * Benefit category this contact speaks for, shown as a tag at the top of the card.
   * Supplied by `BenefitContactCard` on the My Benefits Team page; omitted (undefined)
   * on the benefit category pages and in the wizard previews, where the surrounding
   * page already names the benefit.
   */
  categoryLabel?: string;
  /**
   * Every category the contact serves. When more than one is supplied the tag reads
   * "Multiple Categories" and lists them on hover, rather than stretching the card to
   * fit every name. `categoryLabel` is still honoured for callers that only have the
   * joined string.
   */
  categoryList?: string[];
}

/**
 * The card's element sizes, one set per tier.
 *
 * `sm` is the original compact card (a full row of four on a benefit hub), `md`
 * is the long-standing My Benefits Team card, and `lg` is the card a hub shows
 * when its row holds only two contacts — or one. Sizes that only make sense on
 * a wide card are gated to `lg` so the same tier still reads correctly on a
 * phone, where every card is full width.
 */
const CARD_SIZE_STYLES: Record<
  SupportCardSize,
  {
    padding: string;
    avatar: string;
    name: string;
    body: string;
    company: string;
    iconSize: number;
    logoHeight: number;
    infoGap: string;
    dividerGap: string;
    chip: string;
    cta: string;
    ctaSpacing: string;
  }
> = {
  sm: {
    padding: "p-3 sm:p-4",
    avatar: "h-14 w-14",
    name: "text-sm",
    body: "text-[11px]",
    company: "text-[10px]",
    iconSize: 12,
    logoHeight: 40,
    infoGap: "gap-x-3 gap-y-0.5",
    dividerGap: "mt-2 gap-2",
    chip: "px-1 text-[8px]",
    cta: "py-2 text-[10px]",
    ctaSpacing: "pt-1.5",
  },
  md: {
    padding: "p-4 sm:p-6",
    avatar: "h-16 w-16 sm:h-20 sm:w-20",
    name: "text-base sm:text-lg",
    body: "text-xs sm:text-sm",
    company: "text-xs sm:text-sm",
    iconSize: 14,
    logoHeight: 60,
    infoGap: "gap-x-4 gap-y-1",
    dividerGap: "mt-3 gap-3",
    chip: "px-1.5 text-[9px]",
    cta: "py-2 text-xs sm:text-sm",
    ctaSpacing: "pt-2",
  },
  lg: {
    padding: "p-4 sm:p-6 lg:p-7",
    avatar: "h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24",
    name: "text-base sm:text-lg lg:text-xl",
    body: "text-xs sm:text-sm lg:text-base",
    company: "text-xs sm:text-sm",
    iconSize: 16,
    logoHeight: 72,
    infoGap: "gap-x-4 gap-y-1 lg:gap-x-6 lg:gap-y-1.5",
    dividerGap: "mt-3 gap-3 lg:mt-4 lg:gap-4",
    chip: "px-1.5 text-[9px] lg:text-[10px]",
    cta: "py-2 text-xs sm:text-sm lg:py-2.5 lg:text-sm",
    ctaSpacing: "pt-2 lg:pt-2.5",
  },
};

export function SmallVerticalCard({
  contact,
  brandColor,
  secondaryColor,
  ctaColor,
  appointmentLink,
  companyName,
  width,
  index = 0,
  disableAnimation = false,
  baselineBackgroundColor,
  baselineLogoScale,
  compact = false,
  equalHeight = false,
  size,
  previewPlaceholders = false,
  disableContactFormButton = false,
  mobileVariant,
  categoryLabel,
  categoryList,
}: SmallVerticalCardProps) {
  const categoryListValues =
    categoryList && categoryList.length > 0
      ? categoryList
      : categoryLabel
      ? [categoryLabel]
      : [];
  const isPrimary = contact.isPrimary || false;
  const effectiveBrandColor = contact.cardPrimaryColor || brandColor;
  const effectiveSecondaryColor = contact.cardSecondaryColor || secondaryColor;
  const backgroundColor =
    contact.cardBackgroundColor || baselineBackgroundColor || "#ffffff";
  const textColor =
    isPrimary ||
    (backgroundColor &&
      backgroundColor !== "#ffffff" &&
      backgroundColor !== "white")
      ? readableColor(backgroundColor)
      : undefined;
  const cardWidth = width || "w-full";

  // Determine which buttons to show and which is primary (first checked button becomes primary)
  // Use saved orders from contact or default orders
  type ContactInfoType = "phone" | "email";
  type ActionButtonType = "schedule" | "website";

  // Get contact info order (for phone/email display order)
  const defaultContactInfoOrder: ContactInfoType[] = ["phone", "email"];
  const contactInfoOrder =
    (contact as any).contactInfoOrder || defaultContactInfoOrder;

  // Get action button order (for schedule/website buttons)
  const defaultActionButtonOrder: ActionButtonType[] = ["schedule", "website"];
  // Support backward compatibility: if old actionButtonOrder exists, extract button order
  const oldOrder = (contact as any).actionButtonOrder as string[] | undefined;
  const actionButtonOrder = (contact as any).actionButtonOrder
    ? Array.isArray((contact as any).actionButtonOrder) &&
      (contact as any).actionButtonOrder.every(
        (item: string) => item === "schedule" || item === "website",
      )
      ? ((contact as any).actionButtonOrder as ActionButtonType[])
      : defaultActionButtonOrder
    : defaultActionButtonOrder;

  // Explicitly typed: the list is read inside nested render helpers below, and an
  // evolving `any[]` cannot be inferred through a closure.
  type CardActionButton = {
    type: "schedule" | "website" | "call" | "email";
    label: string;
    url: string;
    /** Marks the first-party Contact Form CTA (drawn inert in previews). */
    isContactForm?: boolean;
  };
  const buttons: CardActionButton[] = [];
  let primaryIndex = -1;
  const isTeamSupport = contact.contactType === "team_support";
  // Team / Support Line cards show an advisor-selected icon in the badge slot.
  const SupportIcon = getSupportIcon(contact.supportIcon);

  const showPlaceholders = previewPlaceholders === true;

  // Resolved display values — used by both render paths below. When
  // `showPlaceholders` is true and a value is missing, a muted [placeholder]
  // label is rendered so the wizard's Portal Preview communicates what data
  // is expected (e.g. [First & Last Name], [Company Name], [Headshot]).
  const resolvedCardName = isTeamSupport
    ? contact.displayName || contact.name
    : `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
      contact.name;
  const displayNameText =
    resolvedCardName ||
    (showPlaceholders
      ? isTeamSupport
        ? "[Team Name]"
        : "[First & Last Name]"
      : "");

  const resolvedCardTitle = isTeamSupport
    ? contact.departmentLabel || contact.customRole
    : contact.title || contact.customRole;
  const displayTitleText =
    resolvedCardTitle ||
    (showPlaceholders ? (isTeamSupport ? "[Department]" : "[Job Title]") : "");

  const resolvedCardCompany = contact.companyName || companyName;
  const displayCompanyText =
    resolvedCardCompany || (showPlaceholders ? "[Company / Organization]" : "");

  const hasAvatarImage = Boolean(contact.headshot || contact.teamImage);
  // Team/Support Line contacts have no headshot and render their company logo
  // in the avatar slot instead, so never show a [Headshot] placeholder for them.
  const showHeadshotPlaceholder =
    showPlaceholders && !isTeamSupport && !hasAvatarImage;
  // Team/Support Line contacts show their Company Logo in the logo bar (top) and
  // the support-line icon in the avatar slot, so the avatar slot never needs a
  // text placeholder of its own — only a missing headshot does.
  const showAvatarPlaceholder = showHeadshotPlaceholder;

  // Check if a CTA button was explicitly configured via the wizard
  const hasEnabledCta = contact.enableContactButton === true;
  const ctaBtnType = contact.contactButtonType as string | undefined;

  // Build buttons based on CTA configuration
  if (hasEnabledCta && ctaBtnType) {
    // Explicit CTA button configured via wizard
    if (ctaBtnType === "calendar") {
      if (primaryIndex === -1) primaryIndex = buttons.length;
      buttons.push({
        type: "schedule",
        label: "Schedule Appt.",
        url: contact.schedulingUrl || appointmentLink,
      });
    } else if (ctaBtnType === "phone") {
      if (primaryIndex === -1) primaryIndex = buttons.length;
      buttons.push({
        type: "call",
        label: "Call Now",
        // `getBasePhoneForDialing` already returns the `tel:` scheme, so adding
        // one here produced `tel:tel:+1…` and the button dialled nothing.
        url: contact.phone ? getBasePhoneForDialing(contact.phone) : "",
      });
    } else if (ctaBtnType === "email") {
      if (primaryIndex === -1) primaryIndex = buttons.length;
      buttons.push({
        type: "email",
        label: "Send Email",
        url: contact.email ? `mailto:${contact.email}` : "",
      });
    } else if (ctaBtnType === "url") {
      // `url` corresponds to the first-party Contact Form CTA — the button
      // opens the branded /contact form (the saved websiteUrl is derived from
      // the contact's email). Match the "Contact" label used by the other card
      // variants.
      if (primaryIndex === -1) primaryIndex = buttons.length;
      buttons.push({
        type: "website",
        // Same CTA label for both contact types — Team/Support Line cards use
        // "Contact" (not "Contact Support").
        label: "Contact",
        url: withContactFormAvatar(contact.websiteUrl || "", contact.headshot),
        // Marks this button as the Contact Form CTA, so a preview can render it
        // inert (see `disableContactFormButton`). The legacy website button below is
        // also type "website" but is a real outbound link, and must keep working.
        isContactForm: true,
      });
    }
  } else {
    // Legacy/fallback: use display flags for backward compatibility
    for (const buttonType of actionButtonOrder) {
      if (
        buttonType === "schedule" &&
        contact.displayScheduleAppointment === true
      ) {
        if (primaryIndex === -1) primaryIndex = buttons.length;
        buttons.push({
          type: "schedule",
          label: "Schedule Appt.",
          url: contact.schedulingUrl || appointmentLink,
        });
      } else if (
        buttonType === "website" &&
        contact.displayUrl === true &&
        contact.websiteUrl &&
        contact.websiteUrl.trim() !== ""
      ) {
        if (primaryIndex === -1) primaryIndex = buttons.length;
        buttons.push({
          type: "website",
          label: isTeamSupport ? "Visit Support Site" : "Visit Website",
          url: withContactFormAvatar(contact.websiteUrl, contact.headshot),
        });
      }
    }
  }

  // No CTA is ever invented: a contact that was never given one (no
  // `enableContactButton`, no legacy display flag) renders NO button. A default
  // "Schedule Appt." used to fill that gap, which put a booking button on people
  // the advisor never configured — the plan's contacts showed one everywhere.
  const hasAnyButton = buttons.some((b) => !!b.url);

  /**
   * PHONE CARD DESIGN — see `mobileVariant`.
   *
   * A full-width phone card used to be a centred vertical stack (logo, avatar,
   * name, title, company, two contact lines, then buttons), so most of the card's
   * width was empty and the card grew very tall. Here the identity (logo + photo)
   * sits in a fixed left column and the details fill the rest, with the actions
   * along the bottom — the same content at roughly half the height.
   *
   * The 2-column card has no room for two columns at ~150px, so it keeps the
   * vertical order but drops the desktop spacing that made it read as sparse.
   */
  if (mobileVariant) {
    const isWide = mobileVariant === "wide";

    /** Designation pills — one row, acronyms only, as on every other variant. */
    const designationChips = (sizeClass: string) =>
      !isTeamSupport &&
      (contact.designations || []).some((value) => value && value.trim()) ? (
        <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className={cn(
              "flex w-max items-center gap-px",
              !isWide && "mx-auto",
            )}
          >
            {(contact.designations || [])
              .filter((value) => value && value.trim())
              .map((value, chipIndex) => (
                <span
                  key={chipIndex}
                  className={cn(
                    "inline-block shrink-0 whitespace-nowrap rounded-full py-px text-center leading-none tracking-tight",
                    sizeClass,
                  )}
                  style={{
                    color: textColor || "#4B5563",
                    backgroundColor: textColor
                      ? "rgba(255,255,255,0.16)"
                      : "#F3F4F6",
                  }}
                >
                  {designationAcronym(value)}
                </span>
              ))}
          </div>
        </div>
      ) : null;

    /** Email / phone / support hours, at the size the variant can afford. */
    const contactRows = (iconSize: number, alignCenter: boolean) => (
      <>
        {contactInfoOrder.map((infoType: ContactInfoType) => {
          if (infoType === "email") {
            if (contact.displayEmail === false) return null;
            if (!contact.email && !showPlaceholders) return null;
            return (
              <p
                key="email"
                className={cn(
                  "flex min-w-0 items-center gap-1.5",
                  alignCenter && "justify-center",
                )}
              >
                <Mail
                  size={iconSize}
                  strokeWidth={1.5}
                  className="shrink-0"
                  style={{ color: effectiveSecondaryColor }}
                />
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="truncate"
                    style={{ color: textColor || "#4B5563" }}
                  >
                    {contact.email}
                  </a>
                ) : (
                  <span className="truncate italic text-gray-400">[Email]</span>
                )}
              </p>
            );
          }
          if (infoType === "phone") {
            if (contact.displayPhone === false) return null;
            if (!contact.phone && !showPlaceholders) return null;
            return (
              <p
                key="phone"
                className={cn(
                  "flex min-w-0 items-center gap-1.5",
                  alignCenter && "justify-center",
                )}
              >
                <Phone
                  size={iconSize}
                  strokeWidth={1.5}
                  className="shrink-0"
                  style={{ color: effectiveSecondaryColor }}
                />
                {contact.phone ? (
                  <a
                    href={getBasePhoneForDialing(contact.phone)}
                    className="truncate"
                    style={{ color: textColor || "#4B5563" }}
                  >
                    {formatPhoneWithExtension(
                      contact.phone,
                      contact.phoneExtension,
                    )}
                  </a>
                ) : (
                  <span className="truncate italic text-gray-400">[Phone]</span>
                )}
              </p>
            );
          }
          return null;
        })}
        {isTeamSupport && contact.supportHours && (
          <p
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              alignCenter && "justify-center",
            )}
            style={{ color: textColor || "#6B7280" }}
          >
            <Clock
              size={iconSize}
              strokeWidth={1.5}
              className="shrink-0"
              style={{ color: textColor || effectiveSecondaryColor }}
            />
            <span className="truncate">{contact.supportHours}</span>
          </p>
        )}
      </>
    );

    /** Actions: side by side on the wide card, stacked on the narrow one. */
    const actionButtons = (opts: {
      twoUp: boolean;
      text: string;
      pad: string;
    }) => {
      if (!hasAnyButton) return null;
      return (
        <div
          className={cn(
            "grid w-full gap-1.5",
            opts.twoUp && buttons.length > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {buttons.map((button, idx) => {
            const isPrimaryButton = idx === primaryIndex;
            const buttonBg = isPrimaryButton
              ? ctaColor || effectiveSecondaryColor
              : isPrimary
                ? mix(0.2, "#ffffff", effectiveBrandColor)
                : "#F3F4F6";
            const buttonColor = isPrimaryButton
              ? "#ffffff"
              : readableColor(buttonBg);
            const contactFormInert =
              disableContactFormButton && button.isContactForm === true;
            const actionClassName = cn(
              "inline-flex w-full items-center justify-center rounded-lg text-center leading-tight font-semibold uppercase tracking-wide font-red-hat",
              opts.text,
              opts.pad,
            );
            const actionStyle = {
              backgroundColor: buttonBg,
              color: buttonColor,
              border: isPrimaryButton ? "none" : "1px solid #E5E7EB",
              // The CTA follows the portal's corner treatment, like the card.
              borderRadius: portalRadiusValue(),
            };

            if (contactFormInert) {
              return (
                <span
                  key={idx}
                  className={cn(actionClassName, "cursor-default")}
                  style={actionStyle}
                >
                  {button.label}
                </span>
              );
            }

            return (
              <Button
                key={idx}
                className={actionClassName}
                style={actionStyle}
                onClick={async () => {
                  if (
                    button.type === "schedule" ||
                    button.type === "website" ||
                    button.type === "call" ||
                    button.type === "email"
                  ) {
                    const target =
                      button.type === "website"
                        ? await resolveContactFormUrl(button.url, contact)
                        : button.url;
                    window.open(target, "_blank");
                  }
                }}
              >
                {button.label}
              </Button>
            );
          })}
        </div>
      );
    };

    const logoScaleValue = contact.logoScale || baselineLogoScale || 1;

    if (isWide) {
      return (
        <motion.div
          initial={disableAnimation ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.35,
            delay: disableAnimation ? 0 : index * 0.06,
            ease: "easeOut",
          }}
          className={cn(
            cardWidth,
            "flex h-full flex-col rounded-xl border border-[#E5E5E5] shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md",
          )}
          // The typography theme owns the card's corners (the `rounded-xl`
          // class is only a fallback for surfaces outside the portal).
          style={{ backgroundColor, borderRadius: portalRadiusValue(1.5) }}
          data-testid="contact-card"
          data-mobile-variant="wide"
        >
          <div className="flex min-w-0 items-start gap-3 p-3">
            {/* IDENTITY COLUMN — logo above a photo. Slightly narrower than the photo
                so the details column keeps most of the card's width. */}
            <div className="flex w-[104px] shrink-0 flex-col items-center gap-1.5">
              {(contact.companyLogo || contact.logo) && (
                <BrandingImage
                  src={contact.companyLogo || contact.logo || ""}
                  alt="Logo"
                  className="w-auto max-w-full object-contain"
                  style={{ height: `${28 * logoScaleValue}px` }}
                />
              )}
              {showPlaceholders && !(contact.companyLogo || contact.logo) && (
                <div className="flex h-6 w-full items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 px-1">
                  <span className="text-center text-[8px] font-medium leading-none text-gray-400">
                    [Logo]
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "relative h-[84px] w-[84px] overflow-hidden rounded-full",
                  showAvatarPlaceholder &&
                    "flex items-center justify-center bg-gray-50",
                )}
              >
                {showHeadshotPlaceholder ? (
                  <span className="text-[8px] font-medium italic text-gray-400">
                    [Headshot]
                  </span>
                ) : isTeamSupport ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <SupportIcon
                      className="h-1/2 w-1/2"
                      style={{ color: effectiveBrandColor }}
                    />
                  </div>
                ) : (
                  <ContactAvatar contact={contact} />
                )}
              </div>
            </div>

            {/* DETAILS COLUMN */}
            <div className="min-w-0 flex-1">
              <ContactCategoryBadge
                categories={categoryListValues}
                className="mb-1 text-[9px] px-1.5 py-0"
              />
              <h3
                className="truncate font-dm-serif text-sm font-semibold leading-tight"
                style={{
                  color:
                    showPlaceholders && !resolvedCardName
                      ? "#9CA3AF"
                      : effectiveBrandColor,
                }}
              >
                {displayNameText}
              </h3>
              {designationChips("text-[7px] px-1")}
              {!isTeamSupport && (
                <p
                  className="truncate text-[11px] font-medium leading-snug font-red-hat"
                  style={{
                    color:
                      showPlaceholders && !resolvedCardTitle
                        ? "#9CA3AF"
                        : textColor || "#374151",
                  }}
                >
                  {displayTitleText}
                </p>
              )}
              {(resolvedCardCompany || showPlaceholders) && (
                <p
                  className="truncate text-[11px] font-semibold leading-snug font-dm-serif"
                  style={{
                    color:
                      showPlaceholders && !resolvedCardCompany
                        ? "#9CA3AF"
                        : effectiveBrandColor,
                  }}
                >
                  {displayCompanyText}
                </p>
              )}
              <div
                className="mt-1.5 space-y-0.5 text-[11px] font-red-hat"
                style={{ color: textColor || "#374151" }}
              >
                {contactRows(13, false)}
              </div>
            </div>
          </div>

          {hasAnyButton && (
            <div className="mt-auto px-3 pb-3">
              {actionButtons({ twoUp: true, text: "text-[9px]", pad: "py-1.5" })}
            </div>
          )}
        </motion.div>
      );
    }

    // 2-column ("compact") card — every row tightened, one action per line.
    return (
      <motion.div
        initial={disableAnimation ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.35,
          delay: disableAnimation ? 0 : index * 0.06,
          ease: "easeOut",
        }}
        className={cn(
          cardWidth,
          "flex h-full flex-col rounded-xl border border-[#E5E5E5] p-2 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md",
        )}
        style={{ backgroundColor, borderRadius: portalRadiusValue(1.5) }}
        data-testid="contact-card"
        data-mobile-variant="compact"
      >
        <ContactCategoryBadge
          categories={categoryListValues}
          className="mb-1 self-center text-[8px] px-1.5 py-0"
        />

        {(contact.companyLogo || contact.logo) && (
          <BrandingImage
            src={contact.companyLogo || contact.logo || ""}
            alt="Logo"
            className="mx-auto w-auto max-w-full object-contain"
            style={{ height: `${18 * logoScaleValue}px` }}
          />
        )}
        {showPlaceholders && !(contact.companyLogo || contact.logo) && (
          <div className="mx-auto flex h-4 w-full items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 px-1">
            <span className="text-center text-[8px] font-medium leading-none text-gray-400">
              [Logo]
            </span>
          </div>
        )}

        <div
          className={cn(
            "relative mx-auto mt-1 h-[46px] w-[46px] overflow-hidden rounded-full",
            showAvatarPlaceholder &&
              "flex items-center justify-center bg-gray-50",
          )}
        >
          {showHeadshotPlaceholder ? (
            <span className="text-[8px] font-medium italic text-gray-400">
              [Headshot]
            </span>
          ) : isTeamSupport ? (
            <div className="flex h-full w-full items-center justify-center">
              <SupportIcon
                className="h-1/2 w-1/2"
                style={{ color: effectiveBrandColor }}
              />
            </div>
          ) : (
            <ContactAvatar contact={contact} />
          )}
        </div>

        <h3
          className="mt-1 w-full truncate text-center font-dm-serif text-[11px] font-semibold leading-tight"
          style={{
            color:
              showPlaceholders && !resolvedCardName
                ? "#9CA3AF"
                : effectiveBrandColor,
          }}
        >
          {displayNameText}
        </h3>
        {designationChips("text-[6px] px-1")}
        {!isTeamSupport && (
          <p
            className="w-full truncate text-center text-[9px] font-medium leading-snug font-red-hat"
            style={{
              color:
                showPlaceholders && !resolvedCardTitle
                  ? "#9CA3AF"
                  : textColor || "#374151",
            }}
          >
            {displayTitleText}
          </p>
        )}
        {(resolvedCardCompany || showPlaceholders) && (
          <p
            className="w-full truncate text-center text-[9px] font-semibold leading-snug font-dm-serif"
            style={{
              color:
                showPlaceholders && !resolvedCardCompany
                  ? "#9CA3AF"
                  : effectiveBrandColor,
            }}
          >
            {displayCompanyText}
          </p>
        )}

        <div
          className="mt-1 space-y-0.5 text-[9px] font-red-hat"
          style={{ color: textColor || "#374151" }}
        >
          {contactRows(10, true)}
        </div>

        {hasAnyButton && (
          <div className="mt-auto pt-1.5">
            {actionButtons({ twoUp: false, text: "text-[8px]", pad: "py-1" })}
          </div>
        )}
      </motion.div>
    );
  }

  // ── DESKTOP CARD — THREE ROWS ─────────────────────────────────────────────
  //
  //   1. profile picture (start) … company logo + name (end)
  //   2. two columns and two rows: name / title (left), email / phone (right)
  //   3. the advisor-configured CTA, when there is one
  //
  // The benefit hubs, My Benefits Team and every wizard preview render this
  // card, so the structure is identical everywhere. `size` — the hub's
  // count-driven tier — decides how big everything inside it is; without one,
  // `compact` picks the tier so the existing surfaces keep their look.
  const cardSize: SupportCardSize = size ?? (compact ? "sm" : "md");
  const cardStyles = CARD_SIZE_STYLES[cardSize];
  const cardPadding = cardStyles.padding;
  const avatarSize = cardStyles.avatar;
  const nameSize = cardStyles.name;
  const bodySize = cardStyles.body;
  const companySize = cardStyles.company;
  const infoIconSize = cardStyles.iconSize;
  const logoBoxHeight = cardStyles.logoHeight;
  const logoScaleValue = contact.logoScale || baselineLogoScale || 1;

  // Email sits above the phone on this card. A contact that saved an explicit
  // order still wins, so the wizard's ordering is honoured.
  const infoOrder: ContactInfoType[] =
    ((contact as any).contactInfoOrder as ContactInfoType[] | undefined) || [
      "email",
      "phone",
    ];

  /** One row of the right-hand column: the address, the number or neither. */
  const infoRow = (infoType: ContactInfoType) => {
    if (infoType === "email") {
      if (contact.displayEmail === false) return null;
      if (!contact.email && !showPlaceholders) return null;
      return (
        <p key="email" className="flex min-w-0 items-center gap-1.5">
          <Mail
            size={infoIconSize}
            strokeWidth={1.5}
            className="shrink-0"
            style={{ color: effectiveSecondaryColor }}
          />
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="truncate transition-colors duration-200 hover:underline"
              style={{ color: textColor || "#4B5563" }}
              title={contact.email}
            >
              {contact.email}
            </a>
          ) : (
            <span className="truncate italic text-gray-400">[Email]</span>
          )}
        </p>
      );
    }
    if (infoType === "phone") {
      if (contact.displayPhone === false) return null;
      if (!contact.phone && !showPlaceholders) return null;
      return (
        <p key="phone" className="flex min-w-0 items-center gap-1.5">
          <Phone
            size={infoIconSize}
            strokeWidth={1.5}
            className="shrink-0"
            style={{ color: effectiveSecondaryColor }}
          />
          {contact.phone ? (
            <a
              href={getBasePhoneForDialing(contact.phone)}
              className="truncate transition-colors duration-200 hover:underline"
              style={{ color: textColor || "#4B5563" }}
              title={formatPhoneWithExtension(
                contact.phone,
                contact.phoneExtension,
              )}
            >
              {formatPhoneWithExtension(contact.phone, contact.phoneExtension)}
            </a>
          ) : (
            <span className="truncate italic text-gray-400">[Phone]</span>
          )}
        </p>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={disableAnimation ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: disableAnimation ? 0 : index * 0.06,
        ease: "easeOut",
      }}
      className={cn(
        cardWidth,
        // Spacing is set per group below rather than by one `gap`: the identity
        // block, its rule and the details stay tightly packed. `self-start`
        // keeps the card at its content height instead of being stretched to a
        // taller neighbour in the same grid row, which left a block of empty
        // card under the last row — `equalHeight` opts back in for a row whose
        // cards must line up because one of them carries a CTA.
        "flex cursor-pointer flex-col border border-[#E5E5E5] shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md",
        equalHeight ? "h-full" : "self-start",
        cardPadding,
      )}
      style={{ backgroundColor, borderRadius: portalRadiusValue(1.5) }}
      data-testid="contact-card"
      data-card-size={cardSize}
    >
      {/* BENEFIT CATEGORY TAG — the hubs are one benefit and skip it; My
          Benefits Team mixes every benefit, so each card names its own. */}
      <ContactCategoryBadge
        categories={categoryListValues}
        className="mb-2 self-start"
      />

      {/* ROW 1 — the person on the start, their company on the end. */}
      <div className="flex w-full items-start justify-between gap-3">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-full",
            avatarSize,
            showAvatarPlaceholder &&
              "flex items-center justify-center bg-gray-50",
          )}
        >
          {showHeadshotPlaceholder ? (
            <span className="text-[10px] font-medium italic text-gray-400">
              [Headshot]
            </span>
          ) : isTeamSupport ? (
            <div className="flex h-full w-full items-center justify-center">
              <SupportIcon
                className="h-1/2 w-1/2"
                style={{ color: effectiveBrandColor }}
              />
            </div>
          ) : (
            <ContactAvatar contact={contact} />
          )}
        </div>

        <div className="flex min-w-0 max-w-[58%] flex-col items-end">
          {/* COMPANY LOGO — the plan's (or the contact's own) mark. Preview-only
              placeholder when the wizard has nothing to show yet. */}
          {disableAnimation ? (
            <div
              className="flex items-center justify-end"
              style={{ height: `${logoBoxHeight * logoScaleValue}px` }}
            >
              {contact.companyLogo || contact.logo ? (
                <BrandingImage
                  src={contact.companyLogo || contact.logo || ""}
                  alt="Logo"
                  className="h-full w-auto object-contain"
                  style={{ height: "100%" }}
                />
              ) : showPlaceholders ? (
                <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 px-1">
                  <span className="text-center text-[9px] font-medium leading-none text-gray-400">
                    [Upload Company Logo]
                  </span>
                </div>
              ) : null}
            </div>
          ) : contact.companyLogo || contact.logo ? (
            <BrandingImage
              src={contact.companyLogo || contact.logo || ""}
              alt="Logo"
              className="w-auto max-w-full object-contain"
              style={{
                height: `${logoBoxHeight}px`,
                transform: `scale(${logoScaleValue})`,
              }}
            />
          ) : showPlaceholders ? (
            <div className="flex h-8 w-full items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 px-1">
              <span className="text-center text-[9px] font-medium leading-none text-gray-400">
                [Upload Company Logo]
              </span>
            </div>
          ) : null}

          {(resolvedCardCompany || showPlaceholders) && (
            <p
              className={cn(
                "mt-1 w-full truncate text-right font-dm-serif font-semibold leading-snug",
                companySize,
              )}
              style={{
                color:
                  showPlaceholders && !resolvedCardCompany
                    ? "#9CA3AF"
                    : effectiveBrandColor,
              }}
              title={displayCompanyText}
            >
              {displayCompanyText}
            </p>
          )}
        </div>
      </div>

      {/* ROW 2 — two columns, two rows.

          The rule above it separates the identity block (photo, logo, company)
          from the contact details. It travels with the details so a card with
          slack never strands the line halfway down, and the small margin above
          keeps it tucked under the identity block. */}
      <div
        className={cn("flex w-full min-w-0 flex-col", cardStyles.dividerGap)}
      >
        <div className="h-px w-full shrink-0 bg-black/10" aria-hidden />

        <div
          className={cn("grid w-full min-w-0 grid-cols-2", cardStyles.infoGap)}
        >
          {/* Left column — name, then title (designations travel with the name). */}
          <div className="min-w-0">
            <h3
              className={cn(
                "w-full truncate font-dm-serif font-semibold leading-tight",
                nameSize,
              )}
              style={{
                color:
                  showPlaceholders && !resolvedCardName
                    ? "#9CA3AF"
                    : effectiveBrandColor,
              }}
              title={displayNameText}
            >
              {displayNameText}
            </h3>

            {!isTeamSupport &&
              (contact.designations || []).some(
                (value) => value && value.trim(),
              ) && (
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                  {(contact.designations || [])
                    .filter((value) => value && value.trim())
                    .map((value, chipIndex) => (
                      <span
                        key={chipIndex}
                        className={cn(
                          "inline-block shrink-0 whitespace-nowrap rounded-full py-px text-center leading-none tracking-tight",
                          cardStyles.chip,
                        )}
                        style={{
                          color: textColor || "#4B5563",
                          backgroundColor: textColor
                            ? "rgba(255,255,255,0.16)"
                            : "#F3F4F6",
                        }}
                      >
                        {designationAcronym(value)}
                      </span>
                    ))}
                </div>
              )}

            {!isTeamSupport && (
              <p
                className={cn(
                  "mt-1 w-full truncate font-red-hat font-medium leading-snug",
                  bodySize,
                )}
                style={{
                  color:
                    showPlaceholders && !resolvedCardTitle
                      ? "#9CA3AF"
                      : textColor || "#374151",
                }}
                title={displayTitleText}
              >
                {displayTitleText}
              </p>
            )}
          </div>

          {/* Right column — email, then phone (plus support hours for a line). */}
          <div
            className={cn("min-w-0 font-red-hat", bodySize)}
            style={{ color: textColor || "#374151" }}
          >
            {infoOrder.map(infoRow)}
            {isTeamSupport && contact.supportHours && (
              <p
                className="flex min-w-0 items-center gap-1.5"
                style={{ color: textColor || "#6B7280" }}
              >
                <Clock
                  size={infoIconSize}
                  strokeWidth={1.5}
                  className="shrink-0"
                  style={{ color: textColor || effectiveSecondaryColor }}
                />
                <span className="truncate">{contact.supportHours}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ROW 3 — the CTA the advisor configured, and nothing when none was. */}
      {hasAnyButton && (
        <div
          className={cn(
            "flex w-full flex-col gap-1.5",
            cardStyles.ctaSpacing,
            // A levelled row can leave slack on EVERY card, including the one
            // that carries the button. Draining it into `mt-auto` keeps the
            // button on the card's bottom padding instead of stranding it above
            // a gap of empty card.
            equalHeight && "mt-auto",
          )}
        >
          {buttons.map((button, idx) => {
            const isPrimaryButton = idx === primaryIndex;
            const buttonBg = isPrimaryButton
              ? ctaColor || effectiveSecondaryColor
              : isPrimary
              ? mix(0.2, "#ffffff", effectiveBrandColor)
              : "#F3F4F6";
            const buttonColor = isPrimaryButton
              ? "#ffffff"
              : readableColor(buttonBg);
            // A preview draws the Contact Form CTA but does not act on it, so an
            // advisor cannot navigate out of the wizard mid-edit.
            const contactFormInert =
              disableContactFormButton && button.isContactForm === true;
            const actionClassName = cn(
              // `h-auto` overrides the shared Button's fixed `h-9`: this CTA sizes
              // itself from its own padding instead of centring a small label in a
              // tall box, which showed as slack around and under the button.
              "inline-flex h-auto w-full items-center justify-center px-4 font-semibold uppercase leading-tight tracking-wide font-red-hat hover:opacity-90",
              cardStyles.cta,
            );
            const actionStyle = {
              backgroundColor: buttonBg,
              color: buttonColor,
              border: isPrimaryButton ? "none" : "1px solid #E5E7EB",
              borderRadius: portalRadiusValue(),
            };

            if (contactFormInert) {
              return (
                <span
                  key={idx}
                  className={cn(actionClassName, "cursor-default")}
                  style={actionStyle}
                >
                  {button.label}
                </span>
              );
            }

            return (
              <Button
                key={idx}
                className={actionClassName}
                style={actionStyle}
                onClick={async () => {
                  if (
                    button.type === "schedule" ||
                    button.type === "website" ||
                    button.type === "call" ||
                    button.type === "email"
                  ) {
                    const target =
                      button.type === "website"
                        ? await resolveContactFormUrl(button.url, contact)
                        : button.url;
                    window.open(target, "_blank");
                  }
                }}
              >
                {button.label}
              </Button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
