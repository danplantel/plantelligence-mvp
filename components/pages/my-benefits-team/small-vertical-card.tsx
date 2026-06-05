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
}: SmallVerticalCardProps) {
  const isPrimary = contact.isPrimary || false;
  const effectiveBrandColor = contact.cardPrimaryColor || brandColor;
  const effectiveSecondaryColor = contact.cardSecondaryColor || secondaryColor;
  const backgroundColor = contact.cardBackgroundColor || baselineBackgroundColor || effectiveBrandColor;
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
        label: "Book Now",
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
          label: "Book Now",
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
      label: "Book Now",
      url: appointmentLink,
    });
    primaryIndex = 0;
  }

  if (disableAnimation) {
    return (
      <div
        className={`${cardWidth} h-auto min-h-[500px] flex flex-col items-center justify-between rounded-xl border border-[#E5E5E5] px-4 py-6 sm:px-8 sm:py-10 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer`}
        style={{ backgroundColor }}
      >
        <div className="flex flex-col items-center flex-shrink-0">
          {/* LOGO AND COMPANY NAME */}
          <div className="flex flex-col items-center gap-2 mb-6 flex-shrink-0" style={{ height: `${60 * (contact.logoScale || baselineLogoScale || 1)}px` }}>
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
          <div className="relative h-[90px] w-[90px] overflow-hidden rounded-full mb-6 flex-shrink-0">
            <ContactAvatar contact={contact} />
          </div>

          {/* NAME */}
          <h3
            className="text-xl sm:text-2xl font-semibold mb-2 text-center flex-shrink-0 font-dm-serif"
            style={{ color: textColor || effectiveBrandColor }}
          >
            {contact.contactType === "team_support"
              ? contact.displayName || contact.name
              : `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
              contact.name}
          </h3>

          {/* TITLE / DEPARTMENT LABEL */}
          <p
            className="text-sm font-medium mb-2 text-center font-red-hat flex-shrink-0"
            style={{ color: textColor || "#374151" }}
          >
            {contact.contactType === "team_support"
              ? contact.departmentLabel || contact.customRole
              : contact.title || contact.customRole}
          </p>

          {/* COMPANY NAME */}
          <p
            className="text-sm font-semibold mb-4 font-red-hat text-center flex-shrink-0"
            style={{ color: textColor || effectiveBrandColor }}
          >
            {contact.companyName}
          </p>
        </div>
        {/* CONTACT INFO - FLEXIBLE SPACE */}
        <div
          className="space-y-3 text-sm w-full font-red-hat flex-1 flex flex-col justify-end"
          style={{ color: textColor || "#374151" }}
        >
          {/* Display contact info in the specified order */}
          {contactInfoOrder.map((infoType: ContactInfoType) => {
            if (
              infoType === "email" &&
              contact.email &&
              contact.displayEmail !== false
            ) {
              return (
                <p
                  key="email"
                  className="flex items-center justify-center gap-2 group"
                >
                  <Mail
                    size={18}
                    strokeWidth={1.5}
                    className="transition-colors duration-200"
                    style={{ color: textColor || effectiveSecondaryColor }}
                  />
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
                </p>
              );
            }
            if (
              infoType === "phone" &&
              contact.phone &&
              contact.displayPhone !== false
            ) {
              return (
                <p
                  key="phone"
                  className="flex items-center justify-center gap-2 group"
                >
                  <Phone
                    size={18}
                    strokeWidth={1.5}
                    className="transition-colors duration-200"
                    style={{ color: textColor || effectiveSecondaryColor }}
                  />
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
                </p>
              );
            }
            return null;
          })}
          {contact.contactType === "team_support" && contact.supportHours && (
            <p
              className="text-sm text-center flex items-center justify-center gap-2"
              style={{ color: textColor || "#6B7280" }}
            >
              <Clock
                size={16}
                strokeWidth={1.5}
                style={{ color: textColor || effectiveSecondaryColor }}
              />
              <span>{contact.supportHours}</span>
            </p>
          )}

          {/* ACTION BUTTONS - ALWAYS AT BOTTOM */}
          <div className="w-full space-y-2 flex-shrink-0">
            {hasAnyButton && buttons.map((button, idx) => {
              const isPrimaryButton = idx === primaryIndex;
              const buttonBg = isPrimaryButton
                ? effectiveSecondaryColor
                : isPrimary
                  ? mix(0.2, "#ffffff", effectiveBrandColor)
                  : "#F3F4F6";
              const buttonColor = readableColor(buttonBg);

              return (
                <Button
                  key={idx}
                  className={cn(
                    "w-full rounded-lg px-6 text-sm font-semibold uppercase tracking-wide hover:opacity-90 font-red-hat",
                    isPrimaryButton ? "py-3" : "py-2",
                  )}
                  style={{
                    backgroundColor: isPrimaryButton
                      ? effectiveSecondaryColor
                      : isPrimary
                        ? "rgba(255,255,255,0.2)"
                        : "#F3F4F6",
                    color: buttonColor,
                    border: isPrimaryButton
                      ? "none"
                      : isPrimary
                        ? "1px solid rgba(255,255,255,0.3)"
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
      className={`${cardWidth} h-auto min-h-[580px] flex flex-col items-center justify-between rounded-xl border border-[#E5E5E5] px-4 py-6 sm:px-8 sm:py-10 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer`}
      style={{ backgroundColor }}
    >
      <div className="flex flex-col items-center flex-shrink-0">
        {/* LOGO AND COMPANY NAME */}
        <div className="flex flex-col items-center gap-2 mb-6 flex-shrink-0">
          {(contact.companyLogo || contact.logo) && (
            <BrandingImage
              src={contact.companyLogo || contact.logo || ""}
              alt="Logo"
              className="h-[60px] w-auto object-contain transition-transform duration-200"
              style={{ transform: `scale(${contact.logoScale || baselineLogoScale || 1})` }}
            />
          )}
        </div>

        {/* PROFILE PICTURE */}
        <div className="relative h-[90px] w-[90px] overflow-hidden rounded-full mb-6 flex-shrink-0">
          <ContactAvatar contact={contact} />
        </div>

        {/* NAME */}
        <h3
          className="text-2xl font-semibold mb-2 text-center flex-shrink-0 font-dm-serif"
          style={{ color: textColor || effectiveBrandColor }}
        >
          {contact.contactType === "team_support"
            ? contact.displayName || contact.name
            : `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
            contact.name}
        </h3>

        {/* TITLE / DEPARTMENT LABEL */}
        <p
          className="text-sm font-medium mb-2 text-center font-red-hat flex-shrink-0"
          style={{ color: textColor || "#374151" }}
        >
          {contact.contactType === "team_support"
            ? contact.departmentLabel || contact.customRole
            : contact.title || contact.customRole}
        </p>

        {/* COMPANY NAME */}
        <p
          className="text-sm font-semibold mb-4 font-red-hat text-center flex-shrink-0"
          style={{ color: textColor || effectiveBrandColor }}
        >
          {contact.companyName}
        </p>
      </div>
      {/* CONTACT INFO - FLEXIBLE SPACE */}
      <div
        className="space-y-3 text-sm w-full font-red-hat flex-1 flex flex-col justify-end"
        style={{ color: textColor || "#374151" }}
      >
        {/* Display contact info in the specified order */}
        {contactInfoOrder.map((infoType: ContactInfoType) => {
          if (infoType === "email" && contact.email) {
            return (
              <p
                key="email"
                className="flex items-center justify-center gap-2 group"
              >
                <Mail
                  size={18}
                  strokeWidth={1.5}
                  className="transition-colors duration-200"
                  style={{ color: textColor || effectiveSecondaryColor }}
                />
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
              </p>
            );
          }
          if (infoType === "phone" && contact.phone) {
            return (
              <p
                key="phone"
                className="flex items-center justify-center gap-2 group"
              >
                <Phone
                  size={18}
                  strokeWidth={1.5}
                  className="transition-colors duration-200"
                  style={{ color: textColor || effectiveSecondaryColor }}
                />
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
              </p>
            );
          }
          return null;
        })}
        {contact.contactType === "team_support" && contact.supportHours && (
          <p
            className="text-sm text-center flex items-center justify-center gap-2"
            style={{ color: textColor || "#6B7280" }}
          >
            <Clock
              size={16}
              strokeWidth={1.5}
              style={{ color: textColor || effectiveSecondaryColor }}
            />
            <span>{contact.supportHours}</span>
          </p>
        )}

        {/* ACTION BUTTONS - ALWAYS AT BOTTOM */}
        {hasAnyButton && (
          <div className="w-full space-y-2 flex-shrink-0">
            {buttons.map((button, idx) => {
              const isPrimaryButton = idx === primaryIndex;
              const buttonBg = isPrimaryButton
                ? effectiveSecondaryColor
                : isPrimary
                  ? mix(0.2, "#ffffff", effectiveBrandColor)
                  : "#F3F4F6";
              const buttonColor = readableColor(buttonBg);

              return (
                <Button
                  key={idx}
                  className={cn(
                    "w-full rounded-lg px-6 text-sm font-semibold uppercase tracking-wide hover:opacity-90 font-red-hat",
                    isPrimaryButton ? "py-3" : "py-2",
                  )}
                  style={{
                    backgroundColor: isPrimaryButton
                      ? effectiveSecondaryColor
                      : isPrimary
                        ? "rgba(255,255,255,0.2)"
                        : "#F3F4F6",
                    color: buttonColor,
                    border: isPrimaryButton
                      ? "none"
                      : isPrimary
                        ? "1px solid rgba(255,255,255,0.3)"
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
