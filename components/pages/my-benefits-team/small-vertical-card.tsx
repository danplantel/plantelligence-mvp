"use client";

import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";
import { Mail, Phone, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { ContactAvatar } from "@/components/pages/my-benefits-team/contact-avatar";
import { formatPhone } from "@/components/pages/my-benefits-team/utils";
import { cn } from "@/lib/utils";
import { readableColor, mix } from "polished";
import { formatPhoneWithExtension, getBasePhoneForDialing } from "@/lib/phone-utils";

interface Contact {
  id?: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
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
}

interface SmallVerticalCardProps {
  contact: Contact;
  brandColor: string;
  secondaryColor: string;
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
  /** When true, renders muted [placeholder] labels for any missing card data
   *  (used only by the wizard's live Portal Preview — never real portal cards). */
  previewPlaceholders?: boolean;
}

export function SmallVerticalCard({
  contact,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  width,
  index = 0,
  disableAnimation = false,
  baselineBackgroundColor,
  baselineLogoScale,
  compact = false,
  previewPlaceholders = false,
}: SmallVerticalCardProps) {
  const isPrimary = contact.isPrimary || false;
  const effectiveBrandColor = contact.cardPrimaryColor || brandColor;
  const effectiveSecondaryColor = contact.cardSecondaryColor || secondaryColor;
  const backgroundColor = contact.cardBackgroundColor || baselineBackgroundColor || "#ffffff";
  const textColor = isPrimary || (backgroundColor && backgroundColor !== "#ffffff" && backgroundColor !== "white")
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

  const buttons = [];
  let primaryIndex = -1;
  const isTeamSupport = contact.contactType === "team_support";

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
    (showPlaceholders
      ? isTeamSupport
        ? "[Department]"
        : "[Job Title]"
      : "");

  const resolvedCardCompany = contact.companyName || companyName;
  const displayCompanyText =
    resolvedCardCompany || (showPlaceholders ? "[Company Name]" : "");

  const hasAvatarImage = Boolean(contact.headshot || contact.teamImage);
  const showHeadshotPlaceholder = showPlaceholders && !hasAvatarImage;

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
        url: contact.phone ? `tel:${getBasePhoneForDialing(contact.phone)}` : "",
      });
    } else if (ctaBtnType === "email") {
      if (primaryIndex === -1) primaryIndex = buttons.length;
      buttons.push({
        type: "email",
        label: "Send Email",
        url: contact.email ? `mailto:${contact.email}` : "",
      });
    } else if (ctaBtnType === "url") {
      if (primaryIndex === -1) primaryIndex = buttons.length;
      buttons.push({
        type: "website",
        label: isTeamSupport ? "Visit Support Site" : "Visit Website",
        url: contact.websiteUrl || "",
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
          url: contact.websiteUrl,
        });
      }
    }
  }

  const hasAnyButton = buttons.some((b) => !!b.url);

  // Legacy fallback: only show default Schedule button when no CTA system data exists at all
  if (buttons.length === 0 && contact.enableContactButton === undefined) {
    buttons.push({
      type: "schedule",
      label: "Schedule Appt.",
      url: appointmentLink,
    });
    primaryIndex = 0;
  }

  if (disableAnimation) {
    const cardPadding = compact
      ? "px-2 py-3 sm:px-3 sm:py-4"
      : "px-4 py-6 sm:px-8 sm:py-10";
    const avatarSize = compact
      ? "h-[60px] w-[60px]"
      : "h-[90px] w-[90px]";
    const nameSize = compact
      ? "text-xs sm:text-sm"
      : "text-base sm:text-lg";
    const subtitleSize = compact ? "text-xs" : "text-sm";
    const gapLogo = compact ? "mb-3" : "mb-6";
    const gapAvatar = compact ? "mb-3" : "mb-6";
    const gapName = compact ? "mb-1" : "mb-2";
    const gapTitle = compact ? "mb-1" : "mb-2";
    const gapCompany = compact ? "mb-2" : "mb-4";
    const contactInfoGap = compact ? "space-y-1" : "space-y-1.5";
    const buttonGap = compact ? "space-y-1" : "space-y-2";
    const iconSize = compact ? 14 : 18;
    const buttonSize = compact ? "py-2" : "py-3";
    const logoHeight = compact ? 40 : 60;
    const minH = compact ? "min-h-0" : "min-h-[500px]";

    return (
      <div
        className={`${cardWidth} h-full ${minH} flex flex-col items-center rounded-xl border border-[#E5E5E5] ${cardPadding} shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer`}
        style={{ backgroundColor }}
      >
        <div className="flex flex-col items-center flex-1 w-full">
          {/* LOGO AND COMPANY NAME */}
          <div className={`flex flex-col items-center gap-2 ${gapLogo} flex-shrink-0`} style={{ height: `${logoHeight * (contact.logoScale || baselineLogoScale || 1)}px` }}>
            {(contact.companyLogo || contact.logo) && (
              <BrandingImage
                src={contact.companyLogo || contact.logo || ""}
                alt="Logo"
                className="w-auto object-contain transition-all duration-200"
                style={{ height: "100%" }}
              />
            )}
          </div>

          {/* PROFILE PICTURE */}
          <div
            className={`relative ${
              showHeadshotPlaceholder ? "h-[90px] w-[90px]" : avatarSize
            } overflow-hidden rounded-full ${gapAvatar} flex-shrink-0 ${
              showHeadshotPlaceholder
                ? "flex items-center justify-center bg-gray-50"
                : ""
            }`}
          >
            {showHeadshotPlaceholder ? (
              <span className="text-[10px] sm:text-xs font-medium italic text-gray-400">
                [Headshot]
              </span>
            ) : (
              <ContactAvatar contact={contact} />
            )}
          </div>

          {/* NAME */}
          <h3
            className={`${nameSize} font-semibold ${gapName} text-center flex-shrink-0 font-dm-serif w-full max-w-full whitespace-nowrap overflow-hidden text-ellipsis px-1`}
            style={{
              color:
                showPlaceholders && !resolvedCardName
                  ? "#9CA3AF"
                  : effectiveBrandColor,
            }}
          >
            {displayNameText}
          </h3>

          {/* TITLE / DEPARTMENT LABEL */}
          <p
            className={`${subtitleSize} font-medium ${gapTitle} text-center font-red-hat flex-shrink-0`}
            style={{
              color:
                showPlaceholders && !resolvedCardTitle
                  ? "#9CA3AF"
                  : textColor || "#374151",
            }}
          >
            {displayTitleText}
          </p>

          {/* COMPANY NAME */}
          {(resolvedCardCompany || showPlaceholders) && (
            <p
              className={`${subtitleSize} font-semibold ${gapCompany} text-center flex-shrink-0 font-dm-serif`}
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
        </div>
        {/* CONTACT INFO */}
        <div
          className={`${contactInfoGap} ${subtitleSize} w-full font-red-hat`}
          style={{ color: textColor || "#374151" }}
        >
          {/* Display contact info in the specified order */}
          {contactInfoOrder.map((infoType: ContactInfoType) => {
            if (infoType === "email") {
              if (contact.displayEmail === false) return null;
              const hasEmail = Boolean(contact.email);
              if (!hasEmail && !showPlaceholders) return null;
              return (
                <p
                  key="email"
                  className="flex items-center justify-center gap-2 group"
                >
                  <Mail
                    size={18}
                    strokeWidth={1.5}
                    className="w-[18px] h-[18px] shrink-0 transition-colors duration-200"
                    style={{ color: effectiveSecondaryColor }}
                  />
                  {contact.email ? (
                    <a
                      className="underline text-center transition-colors duration-200"
                      style={
                        {
                          color: textColor || "#4B5563",
                          "--hover-color": isPrimary
                            ? "rgba(255,255,255,0.8)"
                            : effectiveBrandColor,
                        } as React.CSSProperties & { "--hover-color": string }
                      }
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = isPrimary
                          ? "rgba(255,255,255,0.8)"
                          : effectiveBrandColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = textColor || "#4B5563";
                      }}
                      href={`mailto:${contact.email}`}
                    >
                      {contact.email}
                    </a>
                  ) : (
                    <span className="text-center italic text-gray-400">
                      [Email]
                    </span>
                  )}
                </p>
              );
            }
            if (infoType === "phone") {
              if (contact.displayPhone === false) return null;
              const hasPhone = Boolean(contact.phone);
              if (!hasPhone && !showPlaceholders) return null;
              return (
                <p
                  key="phone"
                  className="flex items-center justify-center gap-2 group"
                >
                  <Phone
                    size={18}
                    strokeWidth={1.5}
                    className="w-[18px] h-[18px] shrink-0 transition-colors duration-200"
                    style={{ color: effectiveSecondaryColor }}
                  />
                  {contact.phone ? (
                    <a
                      className="underline text-center transition-colors duration-200"
                      style={
                        {
                          color: textColor || "#4B5563",
                          "--hover-color": isPrimary
                            ? "rgba(255,255,255,0.8)"
                            : effectiveBrandColor,
                        } as React.CSSProperties & { "--hover-color": string }
                      }
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = isPrimary
                          ? "rgba(255,255,255,0.8)"
                          : effectiveBrandColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = textColor || "#4B5563";
                      }}
                      href={getBasePhoneForDialing(contact.phone)}
                    >
                      {formatPhoneWithExtension(contact.phone, contact.phoneExtension)}
                    </a>
                  ) : (
                    <span className="text-center italic text-gray-400">
                      [Phone]
                    </span>
                  )}
                </p>
              );
            }
            return null;
          })}
          {contact.contactType === "team_support" && contact.supportHours && (
            <p
              className={`${subtitleSize} text-center flex items-center justify-center gap-2`}
              style={{ color: textColor || "#6B7280" }}
            >
              <Clock
                size={compact ? 12 : 16}
                strokeWidth={1.5}
                style={{ color: textColor || effectiveSecondaryColor }}
              />
              <span>{contact.supportHours}</span>
            </p>
          )}

          {/* ACTION BUTTONS */}
          <div className={`w-full ${buttonGap} flex-shrink-0 pt-2 mt-auto`}>
            {hasAnyButton && buttons.map((button, idx) => {
              const isPrimaryButton = idx === primaryIndex;
              const buttonBg = isPrimaryButton
                ? effectiveSecondaryColor
                : isPrimary
                  ? mix(0.2, "#ffffff", effectiveBrandColor)
                  : "#F3F4F6";
              const buttonColor = isPrimaryButton ? "#ffffff" : readableColor(buttonBg);

              return (
                <Button
                  key={idx}
                  className={cn(
                    `w-full rounded-lg px-4 ${subtitleSize} font-semibold uppercase tracking-wide hover:opacity-90 font-red-hat`,
                    isPrimaryButton ? buttonSize : "py-1.5",
                  )}
                  style={{
                    backgroundColor: buttonBg,
                    color: buttonColor,
                    border: isPrimaryButton
                      ? "none"
                      : isPrimary
                        ? "1px solid #E5E7EB"
                        : "1px solid #E5E7EB",
                  }}
                  onClick={() => {
                    if (
                      button.type === "schedule" ||
                      button.type === "website" ||
                      button.type === "call" ||
                      button.type === "email"
                    ) {
                      window.open(button.url, "_blank");
                    }
                  }}
                >
                  {button.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: "easeOut",
      }}
      className={`${cardWidth} h-auto min-h-0 sm:min-h-[420px] flex flex-col items-center rounded-xl border border-[#E5E5E5] px-4 py-6 sm:px-8 sm:py-10 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer`}
      style={{ backgroundColor }}
    >
      <div className="flex flex-col items-center flex-1 w-full">
        {/* LOGO AND COMPANY NAME */}
        <div className="flex flex-col items-center gap-2 mb-3 sm:mb-6 flex-shrink-0">
          {(contact.companyLogo || contact.logo) && (
            <BrandingImage
              src={contact.companyLogo || contact.logo || ""}
              alt="Logo"
              className="h-[40px] sm:h-[60px] w-auto object-contain transition-transform duration-200"
              style={{ transform: `scale(${contact.logoScale || baselineLogoScale || 1})` }}
            />
          )}
        </div>

        {/* PROFILE PICTURE */}
        <div
          className={`relative ${
            showHeadshotPlaceholder
              ? "h-[90px] w-[90px] sm:h-[135px] sm:w-[135px]"
              : "h-[60px] w-[60px] sm:h-[90px] sm:w-[90px]"
          } overflow-hidden rounded-full mb-3 sm:mb-6 flex-shrink-0 ${
            showHeadshotPlaceholder
              ? "flex items-center justify-center bg-gray-50"
              : ""
          }`}
        >
          {showHeadshotPlaceholder ? (
            <span className="text-xs sm:text-sm font-medium italic text-gray-400">
              [Headshot]
            </span>
          ) : (
            <ContactAvatar contact={contact} />
          )}
        </div>

        {/* NAME */}
        <h3
          className="text-sm sm:text-lg font-semibold mb-1 sm:mb-2 text-center flex-shrink-0 font-dm-serif w-full max-w-full whitespace-nowrap overflow-hidden text-ellipsis px-1"
          style={{
            color:
              showPlaceholders && !resolvedCardName
                ? "#9CA3AF"
                : effectiveBrandColor,
          }}
        >
          {displayNameText}
        </h3>

        {/* TITLE / DEPARTMENT LABEL */}
        <p
          className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-center font-red-hat flex-shrink-0"
          style={{
            color:
              showPlaceholders && !resolvedCardTitle
                ? "#9CA3AF"
                : textColor || "#374151",
          }}
        >
          {displayTitleText}
        </p>

        {/* COMPANY NAME */}
        {(resolvedCardCompany || showPlaceholders) && (
          <p
            className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 text-center flex-shrink-0 font-dm-serif"
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
      </div>
      {/* CONTACT INFO */}
      <div
        className="space-y-1 sm:space-y-1.5 text-xs sm:text-sm w-full font-red-hat"
        style={{ color: textColor || "#374151" }}
      >
        {/* Display contact info in the specified order */}
        {contactInfoOrder.map((infoType: ContactInfoType) => {
          if (infoType === "email") {
            const hasEmail = Boolean(contact.email);
            if (!hasEmail && !showPlaceholders) return null;
            return (
              <p
                key="email"
                className="flex items-center justify-center gap-2 group"
              >
                <Mail
                  size={18}
                  strokeWidth={1.5}
                  className="w-[18px] h-[18px] shrink-0 transition-colors duration-200"
                  style={{ color: effectiveSecondaryColor }}
                />
                {contact.email ? (
                  <a
                    className="underline text-center transition-colors duration-200"
                    style={
                      {
                        color: textColor || "#4B5563",
                        "--hover-color": isPrimary
                          ? "rgba(255,255,255,0.8)"
                          : effectiveBrandColor,
                      } as React.CSSProperties & { "--hover-color": string }
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = isPrimary
                        ? "rgba(255,255,255,0.8)"
                        : effectiveBrandColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = textColor || "#4B5563";
                    }}
                    href={`mailto:${contact.email}`}
                  >
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-center italic text-gray-400">
                    [Email]
                  </span>
                )}
              </p>
            );
          }
          if (infoType === "phone") {
            const hasPhone = Boolean(contact.phone);
            if (!hasPhone && !showPlaceholders) return null;
            return (
              <p
                key="phone"
                className="flex items-center justify-center gap-2 group"
              >
                <Phone
                  size={18}
                  strokeWidth={1.5}
                  className="w-[18px] h-[18px] shrink-0 transition-colors duration-200"
                  style={{ color: effectiveSecondaryColor }}
                />
                {contact.phone ? (
                  <a
                    className="underline text-center transition-colors duration-200"
                    style={
                      {
                        color: textColor || "#4B5563",
                        "--hover-color": isPrimary
                          ? "rgba(255,255,255,0.8)"
                          : effectiveBrandColor,
                      } as React.CSSProperties & { "--hover-color": string }
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = isPrimary
                        ? "rgba(255,255,255,0.8)"
                        : effectiveBrandColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = textColor || "#4B5563";
                    }}
                    href={getBasePhoneForDialing(contact.phone)}
                  >
                    {formatPhoneWithExtension(contact.phone, contact.phoneExtension)}
                  </a>
                ) : (
                  <span className="text-center italic text-gray-400">
                    [Phone]
                  </span>
                )}
              </p>
            );
          }
          return null;
        })}
        {contact.contactType === "team_support" && contact.supportHours && (
          <p
            className="text-xs sm:text-sm text-center flex items-center justify-center gap-2"
            style={{ color: textColor || "#6B7280" }}
          >
            <Clock
              strokeWidth={1.5}
              className="w-[13px] h-[13px] sm:w-4 sm:h-4"
              style={{ color: textColor || effectiveSecondaryColor }}
            />
            <span>{contact.supportHours}</span>
          </p>
        )}

        {/* ACTION BUTTONS - ALWAYS AT BOTTOM */}
        {hasAnyButton && (
          <div className="w-full space-y-1 sm:space-y-2 flex-shrink-0 mt-auto">
            {buttons.map((button, idx) => {
              const isPrimaryButton = idx === primaryIndex;
              const buttonBg = isPrimaryButton
                ? effectiveSecondaryColor
                : isPrimary
                  ? mix(0.2, "#ffffff", effectiveBrandColor)
                  : "#F3F4F6";
              const buttonColor = isPrimaryButton ? "#ffffff" : readableColor(buttonBg);

              return (
                <Button
                  key={idx}
                  className={cn(
                    "w-full rounded-lg px-6 text-xs sm:text-sm font-semibold uppercase tracking-wide hover:opacity-90 font-red-hat",
                    isPrimaryButton ? "py-2 sm:py-3" : "py-1.5 sm:py-2",
                  )}
                  style={{
                    backgroundColor: buttonBg,
                    color: buttonColor,
                    border: isPrimaryButton
                      ? "none"
                      : isPrimary
                        ? "1px solid #E5E7EB"
                        : "1px solid #E5E7EB",
                  }}
                  onClick={() => {
                    if (
                      button.type === "schedule" ||
                      button.type === "website" ||
                      button.type === "call" ||
                      button.type === "email"
                    ) {
                      window.open(button.url, "_blank");
                    }
                  }}
                >
                  {button.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
