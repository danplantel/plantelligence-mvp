"use client";

import React, { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { QRCodeSVG } from "qrcode.react";

interface VideoStep5bProps {}

const avatarImagePaths: Record<string, string> = {
  alison: "/images/alison-trans.png",
  chad: "/images/chad-trans.png",
  leah: "/images/leah-trans.png",
  alicia: "/images/alicia-trans.png",
  paul: "/images/paul-trans.png",
  helena: "/images/helena-trans.png",
  maria: "/images/maria-trans.png",
  scott: "/images/scott-trans.png",
  custom: "/images/custom-trans.png",
};

export function VideoStep5b({}: VideoStep5bProps) {
  const { stepData } = useVideoWizardStore();
  const [companyLogo, setCompanyLogo] = useState<string>("");

  // Get user profile company logo
  useEffect(() => {
    const fetchCompanyLogo = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const profile = await response.json();

          // Try multiple paths to find company logo
          const wizardSession = profile.wizardSessions?.[0];
          const branding = wizardSession?.branding;

          const logoUrl =
            branding?.logo ||
            profile.advisorLogoUrl ||
            profile.companyLogo ||
            profile.logo ||
            (typeof profile.companyLogo === "object" && profile.companyLogo?.url
              ? profile.companyLogo.url
              : null) ||
            "";

          setCompanyLogo(logoUrl);
        } else {
          console.error(
            "Failed to fetch profile:",
            response.status,
            response.statusText,
          );
        }
      } catch (error) {
        console.error("Error fetching company logo:", error);
      }
    };

    fetchCompanyLogo();
  }, []);

  // Get resources data from step5a
  const step5aData = (stepData as any).step5a || {};
  const resources = {
    contactInformation: {
      planId: step5aData.contactInformation?.planId || "",
      primaryType: step5aData.contactInformation?.primaryType || "",
      primaryTypeCustom: step5aData.contactInformation?.primaryTypeCustom || "",
      primaryName: step5aData.contactInformation?.primaryName || "",
      primaryEmail: step5aData.contactInformation?.primaryEmail || "",
      primaryPhone: step5aData.contactInformation?.primaryPhone || "",
      secondaryType: step5aData.contactInformation?.secondaryType || "",
      secondaryTypeCustom:
        step5aData.contactInformation?.secondaryTypeCustom || "",
      secondaryName: step5aData.contactInformation?.secondaryName || "",
      secondaryEmail: step5aData.contactInformation?.secondaryEmail || "",
      secondaryPhone: step5aData.contactInformation?.secondaryPhone || "",
      tertiaryType: step5aData.contactInformation?.tertiaryType || "",
      tertiaryTypeCustom:
        step5aData.contactInformation?.tertiaryTypeCustom || "",
      tertiaryName: step5aData.contactInformation?.tertiaryName || "",
      tertiaryEmail: step5aData.contactInformation?.tertiaryEmail || "",
      tertiaryPhone: step5aData.contactInformation?.tertiaryPhone || "",
    },
    qrUrl: step5aData.qrUrl || "",
  };

  // Get branding data from selected plan or step1
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;
  const step1 = (stepData as any).step1 || {};
  // Use edited values from step1 if available, otherwise use plan data
  const brandColor =
    step1.brandColor ||
    selectedPlan?.brandColor ||
    selectedPlan?.videoThemeColor ||
    "#005F73";
  const backgroundImage =
    step1.editedBackgroundImg ||
    selectedPlan?.backgroundImg ||
    selectedPlan?.videoBackgroundImage ||
    "";
  const avatarChoice =
    stepData.avatarValue ||
    stepData.selectedAvatar ||
    selectedPlan?.videoAvatar ||
    "";

  // Plan logo (left side) - from step1 edited logo or plan
  const planLogo =
    step1.editedLogo ||
    selectedPlan?.companyLogo ||
    selectedPlan?.clientLogo ||
    "";

  // Company logo (right side) - from user profile
  const advisorCompanyLogo = companyLogo || "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white font-inter">
          Resources & Contact Information Preview
        </h2>
        <p className="text-gray-500 mt-1 font-inter">
          Review how your resources and contact information will appear
        </p>
      </div>

      {/* 16:9 aspect ratio container */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ paddingBottom: "56.25%" }}
        data-preview-step="5"
      >
        <div className="absolute inset-0 bg-white overflow-hidden flex flex-col px-8 py-6">
          {/* Top section: Logos and Avatar */}
          <div className="flex items-center justify-between w-full mb-4">
            {/* Left: Plan Logo */}
            <div className="flex-1 flex items-center">
              {planLogo && (
                <img
                  src={planLogo}
                  alt="Plan Logo"
                  className="h-16 w-auto object-contain"
                />
              )}
            </div>

            {/* Center: Avatar */}
            <div
              className="flex items-center justify-center"
              data-preview-avatar="true"
            >
              {avatarChoice && (
                <img
                  src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                  alt="Avatar"
                  className="h-24 w-24 object-contain rounded-full"
                />
              )}
            </div>

            {/* Right: Company Logo */}
            <div className="flex-1 flex items-center justify-end">
              {advisorCompanyLogo && (
                <img
                  src={advisorCompanyLogo}
                  alt="Company Logo"
                  className="h-16 w-auto object-contain"
                />
              )}
            </div>
          </div>

          {/* Bottom section: Contact Info (left) and QR Code (right) */}
          <div className="flex-1 flex items-end justify-between w-full">
            {/* Left: Contact Information */}
            <div className="flex flex-col gap-4 text-sm text-gray-800">
              {/* Primary Contact */}
              {(resources.contactInformation.primaryTypeCustom ||
                resources.contactInformation.primaryType !== "None") && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold font-inter">
                    {resources.contactInformation.primaryTypeCustom ||
                      resources.contactInformation.primaryType ||
                      "Primary Contact"}
                  </span>
                  {resources.contactInformation.primaryName && (
                    <span className="font-inter">
                      {resources.contactInformation.primaryName}
                    </span>
                  )}
                  {resources.contactInformation.primaryEmail && (
                    <span className="font-inter">
                      {resources.contactInformation.primaryEmail}
                    </span>
                  )}
                  {resources.contactInformation.primaryPhone && (
                    <span className="font-inter">
                      {resources.contactInformation.primaryPhone}
                    </span>
                  )}
                </div>
              )}

              {/* Secondary Contact */}
              {(resources.contactInformation.secondaryTypeCustom ||
                (resources.contactInformation.secondaryType &&
                  resources.contactInformation.secondaryType !== "None")) && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold font-inter">
                    {resources.contactInformation.secondaryTypeCustom ||
                      resources.contactInformation.secondaryType ||
                      "Secondary Contact"}
                  </span>
                  {resources.contactInformation.secondaryName && (
                    <span className="font-inter">
                      {resources.contactInformation.secondaryName}
                    </span>
                  )}
                  {resources.contactInformation.secondaryEmail && (
                    <span className="font-inter">
                      {resources.contactInformation.secondaryEmail}
                    </span>
                  )}
                  {resources.contactInformation.secondaryPhone && (
                    <span className="font-inter">
                      {resources.contactInformation.secondaryPhone}
                    </span>
                  )}
                </div>
              )}

              {/* Tertiary Contact */}
              {(resources.contactInformation.tertiaryTypeCustom ||
                (resources.contactInformation.tertiaryType &&
                  resources.contactInformation.tertiaryType !== "None")) && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold font-inter">
                    {resources.contactInformation.tertiaryTypeCustom ||
                      resources.contactInformation.tertiaryType ||
                      "Tertiary Contact"}
                  </span>
                  {resources.contactInformation.tertiaryName && (
                    <span className="font-inter">
                      {resources.contactInformation.tertiaryName}
                    </span>
                  )}
                  {resources.contactInformation.tertiaryEmail && (
                    <span className="font-inter">
                      {resources.contactInformation.tertiaryEmail}
                    </span>
                  )}
                  {resources.contactInformation.tertiaryPhone && (
                    <span className="font-inter">
                      {resources.contactInformation.tertiaryPhone}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: QR Code */}
            <div className="flex items-end justify-end">
              {resources.qrUrl && (
                <QRCodeSVG value={resources.qrUrl} size={250} />
              )}
            </div>
          </div>

          {/* HeyGen Avatar — RIGHT SIDE */}
          <div
            className="absolute left-1/2 top-5 transform -translate-x-1/2 z-20"
            data-preview-avatar="true"
          >
            <div
              className="relative overflow-hidden rounded-full"
              style={{
                width: 270,
                height: 270,
                minWidth: 120,
                minHeight: 120,
              }}
            >
              <img
                src="/HeyGen-AI.png"
                alt="HeyGen Avatar"
                className="object-cover w-full h-full pointer-events-none select-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
