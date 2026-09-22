"use client";

import { Headshot } from "@/components/ui/headshot";
import { BrandingImage } from "@/components/ui/branding-image";
import { initials } from "@/components/pages/my-benefits-team/utils";
import { getSupportIcon } from "@/lib/support-icons";

interface Contact {
  name?: string;
  headshot?: string;
  contactType?: "individual" | "team_support";
  companyLogo?: string;
  logo?: string;
  /** Advisor-selected badge icon for Team / Support Line contacts. */
  supportIcon?: string;
}

interface PrimaryVisualProps {
  contact: Contact;
}

export function PrimaryVisual({ contact }: PrimaryVisualProps) {
  // Team/Support Line contacts have no person headshot — show the company logo
  // inside the large circular slot instead (falling back to the advisor-selected
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
            className="w-full h-full object-contain p-6"
          />
        ) : (
          <SupportIcon className="w-1/3 h-1/3 text-gray-400" />
        )}
      </div>
    );
  }

  return (
    <Headshot
      src={contact.headshot}
      alt="Photo"
      fallback={
        <span className="text-7xl text-white">
          {initials(contact.name)}
        </span>
      }
    />
  );
}
