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
      label: "Schedule Appt.",
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
      className="mt-10 w-full rounded-xl p-6 sm:p-10 shadow-lg relative overflow-hidden"
      style={{ backgroundColor: backgroundColor }}
    >
      <div className="grid gap-8 sm:gap-10 lg:gap-14 grid-cols-1 lg:grid-cols-2 relative z-10">
        {/* LEFT: HEADSHOT */}
        <div className="flex items-center justify-center">
          <div className="relative h-[220px] w-[220px] sm:h-[300px] sm:w-[300px] lg:h-[360px] lg:w-[360px] overflow-hidden rounded-full shadow-md">
            <PrimaryVisual contact={contact} />
          </div>
        </div>

        {/* RIGHT: CONTENT — uses flex-1 + mt-auto to push CTA buttons to the bottom */}
        <div className="flex flex-col font-red-hat gap-2 h-full min-w-0" style={{ color: textColor }}>
          {/* COMPANY LOGO */}
          {(contact.companyLogo || contact.logo) && (
            <div className="mb-1">
              <BrandingImage
                src={contact.companyLogo || contact.logo || ""}
                alt="Company Logo"
                className="object-contain w-auto"
                style={{ height: `${48 * (contact.logoScale || 1)}px`, maxHeight: "60px" }}
              />
            </div>
          )}

          {/* NAME */}
          <h2
            className="text-xl sm:text-2xl lg:text-3xl font-semibold font-dm-serif leading-tight w-full max-w-full whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ color: effectiveBrandColor }}
          >
            {contact.contactType === "team_support"
              ? contact.displayName || contact.name
              : contact.name}
          </h2>

          {/* TITLE */}
          <p className="text-base sm:text-lg font-medium font-red-hat" style={{ color: textColor }}>
            {contact.contactType === "team_support"
              ? contact.departmentLabel || contact.customRole
              : contact.title || contact.customRole}
          </p>

          {/* COMPANY NAME */}
          {(contact.companyName || companyName) && (
            <p className="text-sm sm:text-base font-semibold font-dm-serif" style={{ color: effectiveBrandColor }}>
              {contact.companyName || companyName}
            </p>
          )}

          {/* EMAIL (clickable) */}
          {contact.email && contact.displayEmail !== false && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2.5 text-sm sm:text-base font-red-hat hover:opacity-80 transition-opacity group"
              style={{ color: textColor }}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 shrink-0 group-hover:scale-110 transition-transform">
                <Mail size={16} strokeWidth={1.5} />
              </span>
              {contact.email}
            </a>
          )}

          {/* PHONE (clickable) */}
          {contact.phone && contact.displayPhone !== false && (
            <a
              href={`tel:${getBasePhoneForDialing(contact.phone)}`}
              className="flex items-center gap-2.5 text-sm sm:text-base font-red-hat hover:opacity-80 transition-opacity group"
              style={{ color: textColor }}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 shrink-0 group-hover:scale-110 transition-transform">
                <Phone size={16} strokeWidth={1.5} />
              </span>
              {formatPhone(contact.phone)}
            </a>
          )}

          {/* SUPPORT HOURS */}
          {contact.contactType === "team_support" && contact.supportHours && (
            <p className="text-sm font-red-hat mt-1" style={{ color: textColor }}>
              Support Hours: {contact.supportHours}
            </p>
          )}

          {/* SCHEDULE APPOINTMENT BUTTON */}
          <div className="mt-auto w-full pt-4">
            {buttons.length > 0 ? (
              buttons.map((button, idx) => {
                const isPrimaryButton = idx === primaryIndex;
                const buttonBg = isPrimaryButton
                  ? effectiveSecondaryColor
                  : "#F3F4F6";
                const buttonColor = isPrimaryButton ? "#ffffff" : readableColor(buttonBg);

                return (
                  <Button
                    key={idx}
                    className="w-full rounded-lg px-5 py-3 text-sm font-semibold uppercase tracking-wide hover:opacity-90 font-red-hat transition-all duration-200 hover:scale-105"
                    style={{
                      backgroundColor: buttonBg,
                      color: buttonColor,
                      border: isPrimaryButton ? "none" : "1px solid #E5E7EB",
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
              })
            ) : (
              <Button
                className="w-full rounded-lg px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:opacity-90 font-red-hat transition-all duration-200 hover:scale-105"
                style={{ backgroundColor: effectiveSecondaryColor }}
                onClick={() => window.open(appointmentLink, "_blank")}
              >
                Schedule Appointment
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
