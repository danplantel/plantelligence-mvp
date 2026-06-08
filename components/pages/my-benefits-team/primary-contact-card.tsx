"use client";

import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";
import { Mail, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { PrimaryVisual } from "@/components/pages/my-benefits-team/primary-visual";
import { formatPhone } from "@/components/pages/my-benefits-team/utils";
import { readableColor, mix } from "polished";
import { getBasePhoneForDialing } from "@/lib/phone-utils";

interface Contact {
  id?: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  customRole?: string;
  email?: string;
  phone?: string;
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
}

interface PrimaryContactCardProps {
  contact: Contact;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  logoScale?: number;
  baselineBackgroundColor?: string;
  /** When true, reduces vertical spacing/padding between text/info elements
   *  so they sit closer together instead of being spaced out. */
  compact?: boolean;
}

export function PrimaryContactCard({
  contact,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  baselineBackgroundColor,
  compact = false,
}: PrimaryContactCardProps) {
  const effectiveBrandColor = contact.cardPrimaryColor || brandColor;
  const effectiveSecondaryColor = contact.cardSecondaryColor || secondaryColor;
  const backgroundColor = contact.cardBackgroundColor || baselineBackgroundColor || "#ffffff";
  const textColor = readableColor(backgroundColor);
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
      label: "Book Now",
      url: appointmentLink,
    });
    primaryIndex = 0;
  }

  const gridGap = compact
    ? "gap-4 sm:gap-6 lg:gap-8"
    : "gap-6 sm:gap-8 lg:gap-12";
  const logoMargin = compact ? "mb-2" : "mb-6";
  const contentLayout = compact
    ? "flex flex-col justify-center font-red-hat"
    : "flex flex-col justify-between font-red-hat";
  const contactInfoSpacing = compact ? "space-y-1" : "space-y-3";
  const headingSize = compact
    ? "text-xl sm:text-2xl"
    : "text-2xl sm:text-3xl";

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        ease: "easeOut",
      }}
      className="mt-10 w-full rounded-xl p-4 sm:p-8 lg:p-12 shadow-lg relative overflow-hidden"
      style={{ backgroundColor: backgroundColor }}
    >
      <div className={`grid ${gridGap} grid-cols-1 lg:grid-cols-2 relative z-10`}>
        {/* LEFT: HEADSHOT */}
        <div className="flex items-center justify-center">
          <div className="relative h-[200px] w-[200px] sm:h-[300px] sm:w-[300px] lg:h-[400px] lg:w-[400px] overflow-hidden rounded-full">
            <PrimaryVisual contact={contact} />
          </div>
        </div>

        {/* RIGHT: CONTENT */}
        {compact ? (
          <div className="flex flex-col justify-center items-center font-red-hat" style={{ color: textColor }}>
            {/* LOGO - horizontally centered */}
            <div className="flex m-0 flex-col gap-2 mb-2 items-center" style={{ height: `${80 * (contact.logoScale || 1)}px` }}>
              {(contact.companyLogo || contact.logo) && (
                <BrandingImage
                  src={contact.companyLogo || contact.logo || ""}
                  alt="Logo"
                  className="object-contain w-auto transition-all duration-200 max-h-full"
                  style={{ height: "100%", maxHeight: "100%" }}
                />
              )}
            </div>

            {/* Fixed-width text/info block — text left-aligned, CTA button full-width */}
            <div className="w-80 max-w-full flex flex-col items-start">
              {/* NAME */}
              <h2
                className={`${headingSize} font-semibold font-dm-serif text-left w-full`}
                style={{ color: effectiveBrandColor }}
              >
                {contact.contactType === "team_support"
                  ? contact.displayName || contact.name
                  : contact.name}
              </h2>

              {/* TITLE / DEPARTMENT LABEL */}
              <p
                className="text-sm font-medium m-0 font-red-hat text-left w-full"
                style={{ color: textColor }}
              >
                {contact.contactType === "team_support"
                  ? contact.departmentLabel || contact.customRole
                  : contact.title || contact.customRole}
              </p>

              {/* CONTACT INFO */}
              <div
                className={`${contactInfoSpacing} text-base font-red-hat text-left w-full`}
                style={{ color: textColor }}
              >
                {contactInfoOrder.map((infoType: ContactInfoType) => {
                  if (
                    infoType === "email" &&
                    contact.email &&
                    contact.displayEmail !== false
                  ) {
                    return (
                      <p
                        key="email"
                        className="flex items-center justify-start gap-2 font-red-hat"
                      >
                        <Mail size={18} strokeWidth={1.5} color={textColor} />
                        <a
                          href={`mailto:${contact.email}`}
                          className="underline hover:opacity-80 font-red-hat"
                          style={{ color: textColor }}
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
                        className="flex items-center justify-start gap-2 font-red-hat"
                      >
                        <Phone size={18} strokeWidth={1.5} color={textColor} />
                        <span className="font-red-hat">
                          {formatPhone(contact.phone)}
                        </span>
                      </p>
                    );
                  }
                  return null;
                })}
                {contact.contactType === "team_support" && contact.supportHours && (
                  <p className="flex items-center justify-start gap-2 font-red-hat text-sm">
                    <span>Support Hours: {contact.supportHours}</span>
                  </p>
                )}
              </div>

              {/* ACTION BUTTONS - full width matching the text block */}
              {hasAnyButton && (
                <div className="w-full pt-1 mt-2">
                  {buttons.map((button, idx) => {
                    const isPrimaryButton = idx === primaryIndex;
                    const buttonBg = isPrimaryButton
                      ? effectiveSecondaryColor
                      : "#F3F4F6";
                    const buttonColor = isPrimaryButton ? "#ffffff" : readableColor(buttonBg);

                    return (
                      <Button
                        key={idx}
                        className="w-full rounded-lg px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wide hover:opacity-90 font-red-hat"
                        style={{
                          backgroundColor: buttonBg,
                          color: buttonColor,
                          border: isPrimaryButton
                            ? "none"
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
        ) : (
          <div
            className={contentLayout}
            style={{ color: textColor }}
          >
            {/* LOGO AND COMPANY NAME */}
            <div className={`flex m-0 flex-col gap-2 ${logoMargin} items-start`} style={{ height: `${80 * (contact.logoScale || 1)}px` }}>
              {(contact.companyLogo || contact.logo) && (
                <BrandingImage
                  src={contact.companyLogo || contact.logo || ""}
                  alt="Logo"
                  className="object-contain w-auto transition-all duration-200 max-h-full"
                  style={{ height: "100%", maxHeight: "100%" }}
                />
              )}
            </div>

            {/* NAME */}
            <h2
              className={`${headingSize} font-semibold font-dm-serif`}
              style={{ color: effectiveBrandColor }}
            >
              {contact.contactType === "team_support"
                ? contact.displayName || contact.name
                : contact.name}
            </h2>

            {/* TITLE / DEPARTMENT LABEL */}
            <p
              className="text-sm font-medium m-0 font-red-hat"
              style={{ color: textColor }}
            >
              {contact.contactType === "team_support"
                ? contact.departmentLabel || contact.customRole
                : contact.title || contact.customRole}
            </p>

            {/* CONTACT INFO */}
            <div
              className={`${contactInfoSpacing} text-base font-red-hat`}
              style={{ color: textColor }}
            >
              {contactInfoOrder.map((infoType: ContactInfoType) => {
                if (
                  infoType === "email" &&
                  contact.email &&
                  contact.displayEmail !== false
                ) {
                  return (
                    <p
                      key="email"
                      className="flex items-center gap-2 font-red-hat"
                    >
                      <Mail size={18} strokeWidth={1.5} color={textColor} />
                      <a
                        href={`mailto:${contact.email}`}
                        className="underline hover:opacity-80 font-red-hat"
                        style={{ color: textColor }}
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
                      className="flex items-center gap-2 font-red-hat"
                    >
                      <Phone size={18} strokeWidth={1.5} color={textColor} />
                      <span className="font-red-hat">
                        {formatPhone(contact.phone)}
                      </span>
                    </p>
                  );
                }
                return null;
              })}
              {contact.contactType === "team_support" && contact.supportHours && (
                <p className="flex items-center gap-2 font-red-hat text-sm">
                  <span>Support Hours: {contact.supportHours}</span>
                </p>
              )}
            </div>

            {/* ACTION BUTTONS */}
            {hasAnyButton && (
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                {buttons.map((button, idx) => {
                  const isPrimaryButton = idx === primaryIndex;
                  const buttonBg = isPrimaryButton
                    ? effectiveSecondaryColor
                    : "#F3F4F6";
                  const buttonColor = isPrimaryButton ? "#ffffff" : readableColor(buttonBg);

                  return (
                    <Button
                      key={idx}
                      className="rounded-lg px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wide hover:opacity-90 font-red-hat"
                      style={{
                        backgroundColor: buttonBg,
                        color: buttonColor,
                        border: isPrimaryButton
                          ? "none"
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
        )}
      </div>
    </motion.section>
  );
}
