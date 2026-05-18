"use client";

import React, { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

interface ResourcesPreviewProps {
  resources: {
    contactInformation: {
      planId: string;
      primaryType: string;
      primaryTypeCustom?: string;
      primaryName: string;
      primaryEmail: string;
      primaryPhone: string;
      secondaryType: string;
      secondaryTypeCustom?: string;
      secondaryName: string;
      secondaryEmail: string;
      secondaryPhone: string;
      tertiaryType: string;
      tertiaryTypeCustom?: string;
      tertiaryName: string;
      tertiaryEmail: string;
      tertiaryPhone: string;
    };
    qrUrl: string;
  };
  branding: {
    companyName: string;
    companyLogo: string;
  };
  brandColor: string;
  backgroundImage: string;
  avatarChoice: string;
  onEdit: () => void;
  onConfirm: () => void;
  imageOnly?: boolean;
}

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

const ResourcesPreview = forwardRef<HTMLDivElement, ResourcesPreviewProps>(
  (props, ref) => {
    const {
      brandColor,
      backgroundImage,
      avatarChoice,
      resources,
      branding,
      onEdit,
      onConfirm,
      imageOnly = false,
    } = props;

    // If imageOnly is true, render just the content without header, avatar, and bottom bar
    if (imageOnly) {
      return (
        <div className="space-y-4">
          <div
            className="relative w-full h-full bg-transparent"
            ref={ref}
            style={{
              background: "transparent",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              minHeight: "400px",
            }}
          >
            <div className="text-left space-y-4 pl-4">
              <img
                src="/pt_web_light.png"
                className="object-contain h-[80px] -ml-8 -mb-2"
                alt="PlanTelligence"
              />

              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-700 tracking-wide">
                  Plan ID:
                </span>
                <span className="text-lg text-gray-600 font-medium">
                  {resources.contactInformation.planId}
                </span>
              </div>

              {/* Primary Contact - only show if any field has content */}
              {(resources.contactInformation.primaryTypeCustom ||
                resources.contactInformation.primaryType ||
                resources.contactInformation.primaryName ||
                resources.contactInformation.primaryEmail ||
                resources.contactInformation.primaryPhone) && (
                <div>
                  {(resources.contactInformation.primaryTypeCustom ||
                    resources.contactInformation.primaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Primary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {resources.contactInformation.primaryTypeCustom ||
                          resources.contactInformation.primaryType}
                      </strong>
                    </div>
                  )}
                  {resources.contactInformation.primaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.primaryName}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.primaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.primaryEmail}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.primaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.primaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Secondary Contact - only show if any field has content */}
              {(resources.contactInformation.secondaryTypeCustom ||
                resources.contactInformation.secondaryType ||
                resources.contactInformation.secondaryName ||
                resources.contactInformation.secondaryEmail ||
                resources.contactInformation.secondaryPhone) && (
                <div>
                  {(resources.contactInformation.secondaryTypeCustom ||
                    resources.contactInformation.secondaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Secondary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {resources.contactInformation.secondaryTypeCustom ||
                          resources.contactInformation.secondaryType}
                      </strong>
                    </div>
                  )}
                  {resources.contactInformation.secondaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.secondaryName}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.secondaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.secondaryEmail}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.secondaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.secondaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tertiary Contact - only show if any field has content */}
              {(resources.contactInformation.tertiaryTypeCustom ||
                resources.contactInformation.tertiaryType ||
                resources.contactInformation.tertiaryName ||
                resources.contactInformation.tertiaryEmail ||
                resources.contactInformation.tertiaryPhone) && (
                <div>
                  {(resources.contactInformation.tertiaryTypeCustom ||
                    resources.contactInformation.tertiaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Tertiary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {resources.contactInformation.tertiaryTypeCustom ||
                          resources.contactInformation.tertiaryType}
                      </strong>
                    </div>
                  )}
                  {resources.contactInformation.tertiaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.tertiaryName}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.tertiaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.tertiaryEmail}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.tertiaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.tertiaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Original full preview component
    return (
      <div className="space-y-6" ref={ref}>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Resources Preview
          </h2>
          <p className="text-gray-500 mt-1">
            Review how your resources will appear
          </p>
        </div>

        {/* 16:9 aspect ratio container */}
        <div
          className="relative w-full rounded-lg overflow-hidden border border-gray-200"
          style={{ paddingBottom: "56.25%" }}
        >
          <div className="absolute inset-0 bg-white overflow-hidden flex px-8 py-6">
            <div className="w-full flex flex-col items-start pl-4 gap-1.5 text-lg text-black tracking-tight">
              <img
                src="/pt_web_light.png"
                className="object-contain h-[80px] -ml-8 -mb-2"
                alt="PlanTelligence"
              />

              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-700 tracking-wide">
                  Plan ID:
                </span>
                <span className="text-lg text-gray-600 font-medium">
                  {resources.contactInformation.planId}
                </span>
              </div>

              {/* Primary Contact - only show if any field has content */}
              {(resources.contactInformation.primaryTypeCustom ||
                resources.contactInformation.primaryType ||
                resources.contactInformation.primaryName ||
                resources.contactInformation.primaryEmail ||
                resources.contactInformation.primaryPhone) && (
                <div>
                  {(resources.contactInformation.primaryTypeCustom ||
                    resources.contactInformation.primaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Primary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {resources.contactInformation.primaryTypeCustom ||
                          resources.contactInformation.primaryType}
                      </strong>
                    </div>
                  )}
                  {resources.contactInformation.primaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.primaryName}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.primaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.primaryEmail}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.primaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.primaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Secondary Contact - only show if any field has content */}
              {(resources.contactInformation.secondaryTypeCustom ||
                resources.contactInformation.secondaryType ||
                resources.contactInformation.secondaryName ||
                resources.contactInformation.secondaryEmail ||
                resources.contactInformation.secondaryPhone) && (
                <div>
                  {(resources.contactInformation.secondaryTypeCustom ||
                    resources.contactInformation.secondaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Secondary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {resources.contactInformation.secondaryTypeCustom ||
                          resources.contactInformation.secondaryType}
                      </strong>
                    </div>
                  )}
                  {resources.contactInformation.secondaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.secondaryName}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.secondaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.secondaryEmail}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.secondaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.secondaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tertiary Contact - only show if any field has content */}
              {(resources.contactInformation.tertiaryTypeCustom ||
                resources.contactInformation.tertiaryType ||
                resources.contactInformation.tertiaryName ||
                resources.contactInformation.tertiaryEmail ||
                resources.contactInformation.tertiaryPhone) && (
                <div>
                  {(resources.contactInformation.tertiaryTypeCustom ||
                    resources.contactInformation.tertiaryType) && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Tertiary Contact Type:
                      </span>
                      <strong className="text-sm">
                        {resources.contactInformation.tertiaryTypeCustom ||
                          resources.contactInformation.tertiaryType}
                      </strong>
                    </div>
                  )}
                  {resources.contactInformation.tertiaryName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Name:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.tertiaryName}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.tertiaryEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Email:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.tertiaryEmail}
                      </span>
                    </div>
                  )}
                  {resources.contactInformation.tertiaryPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Phone:
                      </span>
                      <span className="text-sm text-gray-600">
                        {resources.contactInformation.tertiaryPhone}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="size-full">
              <div className="h-1/3 flex items-center gap-4 overflow-hidden">
                {/* Avatar */}
                {avatarChoice && (
                  <img
                    src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                    alt="Avatar"
                    className="h-full w-auto object-contain object-bottom rounded-full size-[100px]"
                  />
                )}
                {/* Company logo */}
                {branding.companyLogo && (
                  <div className="size-full flex items-center justify-center">
                    <img
                      src={branding.companyLogo || "/placeholder.svg"}
                      alt={`${branding.companyName} Company Logo`}
                      className="object-contain"
                    />
                  </div>
                )}
              </div>
              <div className="h-2/3 flex flex-col items-end justify-end gap-2">
                <p>visit site/ schedule an appointment</p>
                <QRCodeSVG
                  value={resources.qrUrl}
                  size={120}
                  className="mr-2"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <Button
            onClick={onEdit}
            variant="outline"
            className="border-2 border-gray-300 hover:border-gray-400 transition-colors"
          >
            Edit
          </Button>
          <Button
            onClick={onConfirm}
            className="!bg-[#005F73] hover:!bg-[#004D5D] text-white"
          >
            Confirm & Continue
          </Button>
        </div>
      </div>
    );
  },
);

ResourcesPreview.displayName = "ResourcesPreview";

export default ResourcesPreview;
