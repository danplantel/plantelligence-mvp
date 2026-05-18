"use client";

import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";

interface KeyContact {
  id?: string;
  name?: string;
  role?: string;
  customRole?: string;
  bio?: string;
  email?: string;
  phone?: string;
  headshot?: string;
  headshotFileName?: string;
  companyLogo?: string;
  enableContactButton?: boolean;
  contactButton?: boolean;
  contactButtonType?: "email" | "phone" | "calendar" | "url";
  contactUrl?: string;
  displayEmail?: boolean;
  displayPhone?: boolean;
  displayUrl?: boolean;
  showOnPortal?: boolean;
  isPrimary?: boolean;
}

interface BenefitsTeamProps {
  brandColor?: string;
  secondaryColor?: string;
  keyContact: KeyContact[];
  companyData?: {
    companyLogo?: string;
    companyName?: string;
  };
  enableContactButton?: boolean;
  baselineBackgroundColor?: string;
}

export function BenefitsTeam({
  brandColor = "#1E3A8A",
  secondaryColor = "#BFDBFE",
  companyData,
  keyContact,
  enableContactButton = false,
  baselineBackgroundColor,
}: BenefitsTeamProps) {
  const contact = keyContact.find((c) => c.bio);
  const backgroundColor = baselineBackgroundColor || brandColor;

  return (
    <div className="bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-serif text-[#002B5B] md:text-5xl mb-6">
            Your Dedicated Benefits Team
          </h1>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            We&apos;re committed to helping you navigate your benefits with
            confidence. Our experienced team is here to support you every step
            of the way, from enrollment to retirement planning.
          </p>
        </div>

        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: `${backgroundColor}`,
          }}
        >
          <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
            <div className="flex justify-center md:justify-start">
              <div className="relative">
                {contact?.headshot ? (
                  <BrandingImage
                    src={contact.headshot}
                    alt="Professional advisor"
                    className="rounded-lg shadow-xl w-80 h-96 object-cover"
                    fillContainer
                  />
                ) : (
                  <img
                    src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=500&h=500&fit=crop"
                    alt="Professional advisor"
                    className="rounded-lg shadow-xl w-80 h-96 object-cover"
                  />
                )}
              </div>
            </div>

            <div className="space-y-6 flex flex-col items-start md:items-start">
              {companyData?.companyLogo && (
                <BrandingImage
                  src={companyData.companyLogo}
                  alt="Organization Logo"
                  className="w-32 h-auto mb-4"
                />
              )}

              <h2 className="text-4xl font-serif md:text-5xl font-bold text-white">
                {`Welcome to ${companyData?.companyName}!`}
              </h2>
              <p className="text-xl md:text-2xl font-light text-white">
                We hope to inspire you to save!
              </p>
              <div className="text-white m-0">
                <p className="text-lg md:text-xl">
                  <span className="font-semibold">{contact?.customRole}</span>
                  <span className="text-opacity-80 ml-2">{contact?.name}</span>
                </p>
                <p className="text-base md:text-lg mt-1 text-opacity-80">
                  {contact?.bio}
                </p>
              </div>

              <div className="flex gap-4 mt-4 w-full justify-end">
                <Button
                  className="w-1/2 text-white"
                  style={{ background: secondaryColor }}
                >
                  schedule an appointment
                </Button>

                <Button
                  variant="outline"
                  className="w-1/2 bg-gray-200"
                  style={{
                    borderColor: secondaryColor,
                    color: secondaryColor,
                  }}
                >
                  Contact
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
