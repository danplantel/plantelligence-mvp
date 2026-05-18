"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";
import { Headshot } from "@/components/ui/headshot";
import type { Contact } from "./contact-builder-section";

interface BenefitsTeamProps {
  brandColor?: string;
  secondaryColor?: string;
  companyData?: {
    companyLogo?: string;
  };
  url?: string;
  enableContactButton?: boolean;
  contact?: Contact;
  baselineBackgroundColor?: string;
}

export function BenefitsTeamPreview({
  brandColor = "#1E3A8A",
  secondaryColor = "#BFDBFE",
  companyData,
  enableContactButton = false,
  contact,
  url,
  baselineBackgroundColor,
}: BenefitsTeamProps) {
  const [isVisible, setIsVisible] = useState(true);
  const {
    headline,
    subHeadline,
    description,
    contactName,
    contactTitle,
    contactCompany,
    headshot,
    role,
    showContactButton,
  } = useMemo(() => {
    const fallbackName = "Ty G. Rogers";
    const fallbackTitle = "Managing Partner";
    const fallbackCompany = "Waypoint Financial Advisors";

    const trimmedName = contact?.fullName?.trim();
    const trimmedRole = contact?.customRole?.trim();
    const trimmedTitle = contact?.title?.trim();
    const trimmedCompany = contact?.companyName?.trim();
    const trimmedDescription = contact?.description?.trim();

    return {
      headline: trimmedCompany
        ? `Welcome to ${trimmedCompany}!`
        : "Welcome to Waypoint!",
      subHeadline: trimmedTitle
        ? `Connect with your ${trimmedTitle}`
        : "We hope to inspire you to save!",
      description:
        trimmedDescription ||
        "Your dedicated benefits team is ready to answer questions about enrollments, plan changes, and day-to-day support.",
      contactName: trimmedName || fallbackName,
      contactTitle: trimmedTitle || fallbackTitle,
      contactCompany: trimmedCompany || fallbackCompany,
      headshot:
        contact?.headshot ||
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=500&h=500&fit=crop",
      showContactButton: enableContactButton || !!contact?.fullName,
      role: trimmedRole || "",
    };
  }, [contact, enableContactButton]);

  return (
    <div className="mb-6">
      <div className="flex justify-end mb-2">
        <Button
          variant="ghost"
          onClick={() => setIsVisible((prev) => !prev)}
          className="px-4 py-2"
        >
          {isVisible ? "Hide Preview" : "Show Preview"}
        </Button>
      </div>

      {isVisible && (
        <div className="bg-white py-12 px-4 sm:px-6 lg:px-8 rounded-2xl shadow-xl">
          <div className="max-w-6xl mx-auto">
            <div
              className="rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: baselineBackgroundColor || brandColor }}
            >
              <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
                <div className="flex justify-center md:justify-start">
                  <div className="relative h-96 w-80 overflow-hidden rounded-lg shadow-xl">
                    <Headshot
                      src={headshot}
                      alt={contactName}
                      wrapperClassName="h-full w-full"
                      className="rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-6 flex flex-col items-start md:items-start">
                  {url && (
                    <BrandingImage
                      src={url}
                      alt="Organization Logo"
                      className="w-32 h-auto mb-4"
                    />
                  )}

                  <h2 className="text-4xl font-serif md:text-5xl font-bold text-white">
                    {headline}
                  </h2>
                  <p className="text-xl md:text-2xl font-light text-white">
                    {role}
                  </p>
                  <p className="text-xl md:text-2xl font-light text-white">
                    {contactName}
                  </p>
                  <div className="text-white m-0">
                    <p className="text-base md:text-lg mt-4 text-opacity-90">
                      {description}
                    </p>
                  </div>

                  <div className="flex gap-4 mt-4 w-full justify-end">
                    <Button
                      className="w-1/2 text-white"
                      style={{ backgroundColor: secondaryColor }}
                    >
                      Schedule an Appointment
                    </Button>

                    {enableContactButton && (
                      <Button
                        variant="outline"
                        style={{
                          borderColor: secondaryColor,
                          color: secondaryColor,
                        }}
                      >
                        Contact
                      </Button>
                    )}
                    {!enableContactButton && showContactButton && (
                      <Button
                        variant="outline"
                        className={`w-1/2 bg-gray-200`}
                        style={{
                          borderColor: secondaryColor,
                          color: secondaryColor,
                        }}
                      >
                        Contact
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
