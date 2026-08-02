"use client";

import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";
import { Mail, Phone, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { readableColor, mix } from "polished";
import { ContactAvatar } from "@/components/pages/my-benefits-team/contact-avatar";
import { formatPhone } from "@/components/pages/my-benefits-team/utils";
import { cn } from "@/lib/utils";
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

interface LargeHorizontalCardProps {
  contact: Contact;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  index?: number; // For animation delay
  disableAnimation?: boolean; // Disable animation for preview
  baselineBackgroundColor?: string;
  baselineLogoScale?: number;
}

export function LargeHorizontalCard({
  contact,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  index = 0,
  disableAnimation = false,
  baselineBackgroundColor,
  baselineLogoScale,
}: LargeHorizontalCardProps) {
  const isPrimary = contact.isPrimary || false;
  const effectiveBrandColor = contact.cardPrimaryColor || brandColor;
  const effectiveSecondaryColor = contact.cardSecondaryColor || secondaryColor;
  const backgroundColor = contact.cardBackgroundColor || baselineBackgroundColor || "#ffffff";
  const textColor = isPrimary || (backgroundColor && backgroundColor !== "#ffffff" && backgroundColor !== "white")
    ? readableColor(backgroundColor)
    : undefined;

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
        label: "Contact",
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
          label: "Contact",
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

  const logoScaleEffective =
    contact.logoScale ?? baselineLogoScale ?? 1;
  /** Taller base than 80px so "2×" reads visually on wide cards (avatar column is up to ~200px tall) */
  const logoSlotHeightPx = Math.round(120 * logoScaleEffective);

  const cardContent = (
    <div className="flex flex-row items-center h-full w-full justify-between gap-6">
      {/* LEFT: AVATAR */}
      <div className="flex-shrink-0 flex items-center justify-center w-[80px] sm:w-[120px] md:w-[150px] lg:w-[180px] xl:w-[276px]">
        <div className="relative h-[70px] w-[70px] sm:h-[90px] sm:w-[90px] md:h-[120px] md:w-[120px] lg:h-[150px] lg:w-[150px] xl:h-[200px] xl:w-[200px] overflow-hidden rounded-full">
          <ContactAvatar contact={contact} />
        </div>
      </div>

      {/* RIGHT: CONTENT — stretches vertically so action buttons are pushed to the bottom */}
      <div className="flex-1 min-w-0 text-left flex flex-col justify-start gap-4 py-1">
        {/* LOGO — full width of column so wordmarks can scale; height follows slider (1× = 120px) */}
        <div
          className="flex w-full min-w-0 items-center justify-start m-0"
          style={{ height: `${logoSlotHeightPx}px` }}
        >
          {(contact.companyLogo || contact.logo) && (
            <BrandingImage
              src={contact.companyLogo || contact.logo || ""}
              alt="Logo"
              className="object-contain w-auto max-w-full transition-all duration-200 max-h-full"
              style={{ height: "100%", maxHeight: "100%" }}
            />
          )}
        </div>

        {/* NAME */}
        <h3
          className="text-3xl font-dm-serif font-semibold m-0"
          style={{ color: textColor || "#111827" }}
        >
          {contact.contactType === "team_support"
            ? contact.displayName || contact.name
            : contact.name}
        </h3>

        {/* TITLE / DEPARTMENT LABEL */}
        <p
          className="text-sm font-medium m-0 font-red-hat"
          style={{ color: textColor || "#374151" }}
        >
          {contact.contactType === "team_support"
            ? contact.departmentLabel || contact.customRole
            : contact.title || contact.customRole}
        </p>

        {/* COMPANY NAME */}
        {(contact.companyName || companyName) && (
          <p
            className="text-base font-semibold m-0 font-dm-serif"
            style={{ color: textColor || brandColor }}
          >
            {contact.companyName || companyName}
          </p>
        )}

        {/* CONTACT INFO */}
        <div
          className="flex flex-col gap-2 text-sm m-0 font-red-hat"
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
                <p key="email" className="flex items-center gap-2 m-0">
                  <Mail
                    size={18}
                    strokeWidth={1.5}
                    style={{ color: textColor || effectiveBrandColor }}
                  />
                  <a
                    href={`mailto:${contact.email}`}
                    className="underline truncate transition-colors text-base duration-200 font-red-hat"
                    style={{
                      color: textColor || effectiveBrandColor,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
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
                  className="flex items-center gap-2 text-base font-red-hat m-0"
                >
                  <Phone
                    size={18}
                    strokeWidth={1.5}
                    style={{ color: textColor || effectiveBrandColor }}
                  />
                  <a
                    href={getBasePhoneForDialing(contact.phone)}
                    className="truncate underline transition-colors duration-200"
                    style={{
                      color: textColor || effectiveBrandColor,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    {formatPhoneWithExtension(contact.phone, contact.phoneExtension)}
                  </a>
                </p>
              );
            }
            return null;
          })}
          {contact.contactType === "team_support" && contact.supportHours && (
            <p className="flex items-center gap-2 text-base m-0">
              <Clock
                size={18}
                strokeWidth={1.5}
                style={{ color: textColor || effectiveBrandColor }}
              />
              <span style={{ color: textColor || "#374151" }}>
                {contact.supportHours}
              </span>
            </p>
          )}
        </div>

        {/* ACTION BUTTONS */}
        {hasAnyButton && (
          <div
            className={cn(
              "grid w-full gap-2 m-0",
              buttons.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {buttons.map((button, idx) => {
              const isPrimaryButton = idx === primaryIndex;
              const isLastButton = idx === buttons.length - 1;
              const shouldSpanFullWidth = buttons.length >= 3 && isLastButton;

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
                    "w-full m-0 rounded-lg px-3 py-2 sm:px-4 sm:py-2 lg:px-6 lg:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wide hover:opacity-90 font-red-hat",
                    shouldSpanFullWidth && "col-span-2",
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
    </div>
  );

  if (disableAnimation) {
    return (
      <section
        className="rounded-xl w-full h-auto min-h-[420px] flex items-start border border-[#E5E5E5] p-4 sm:p-6 lg:p-6 shadow-sm"
        style={{ backgroundColor }}
      >
        {cardContent}
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: "easeOut",
      }}
      className="rounded-xl w-full h-auto min-h-[420px] flex items-start border border-[#E5E5E5] p-4 sm:p-6 lg:p-6 shadow-sm"
      style={{ backgroundColor }}
    >
      {cardContent}
    </motion.section>
  );
}
