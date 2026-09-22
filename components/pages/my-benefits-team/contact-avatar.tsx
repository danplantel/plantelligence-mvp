"use client";

import { Headshot } from "@/components/ui/headshot";
import { BrandingImage } from "@/components/ui/branding-image";
import { initials } from "@/components/pages/my-benefits-team/utils";
import { getSupportIcon } from "@/lib/support-icons";

interface Contact {
  name?: string;
  headshot?: string;
  teamImage?: string;
  contactType?: "individual" | "team_support";
  companyLogo?: string;
  logo?: string;
  /** Advisor-selected badge icon for Team / Support Line contacts. */
  supportIcon?: string;
}

interface ContactAvatarProps {
  contact: Contact;
}

export function ContactAvatar({ contact }: ContactAvatarProps) {
  // Team/Support Line contacts have no person headshot — show the company logo
  // inside the circular avatar slot instead (falling back to the advisor-selected
  // support icon when no logo has been uploaded).
  const SupportIcon = getSupportIcon(contact.supportIcon);
  if (contact.contactType === "team_support") {
    const logoSrc = contact.companyLogo || contact.logo;
    return (
      <div className="w-full h-full flex items-center justify-center rounded-full bg-white overflow-hidden">
        {logoSrc ? (
          <BrandingImage
            src={logoSrc}
            alt="Company logo"
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <SupportIcon className="w-2/5 h-2/5 text-gray-400" />
        )}
      </div>
    );
  }

  const displayImage = contact.headshot || contact.teamImage;

  return (
    <Headshot
      src={displayImage}
      alt="Avatar"
      fallback={
        <span className="text-lg text-gray-400">
          {initials(contact.name)}
        </span>
      }
    />
  );
}
