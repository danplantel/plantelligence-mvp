"use client";

import React, { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
  listAgeRequirement,
  listEntryDate,
  listServiceRequirement,
} from "./Eligibility";

interface EligibilityPreviewProps {
  eligibility: {
    ageRequirement: string;
    customAgeRequirement?: string;
    serviceRequirement: string;
    customServiceRequirement?: string;
    entryDate: string;
    customEntryDate?: string;
  };
  brandColor: string;
  backgroundImage: string;
  avatarChoice: string;
  onEdit: () => void;
  onConfirm: () => void;
  imageOnly?: boolean; // New prop to control image-only mode
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

const EligibilityPreview = forwardRef<HTMLDivElement, EligibilityPreviewProps>(
  (props, ref) => {
    const {
      brandColor,
      backgroundImage,
      avatarChoice,
      eligibility,
      onEdit,
      onConfirm,
      imageOnly = false, // Default to false for backward compatibility
    } = props;

    const currentServiceRequirement = listServiceRequirement.find(
      (item) => item.value === eligibility.serviceRequirement,
    );

    const currentEntryDate = listEntryDate.find(
      (item) => item.value === eligibility.entryDate,
    );

    const currentAgeRequirement = listAgeRequirement.find(
      (item) => item.value === eligibility.ageRequirement,
    );

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
              alignItems: "flex-end",
              minHeight: "400px",
            }}
          >
            <div className="text-right space-y-4 pr-8">
              <div>
                <p className="text-3xl font-bold text-black tracking-tight">
                  Age requirement
                </p>
                <div className="text-2xl text-black tracking-tight">
                  {eligibility.customAgeRequirement ||
                    currentAgeRequirement?.label ||
                    "-"}
                </div>
              </div>

              <div>
                <p className="text-3xl font-bold text-black tracking-tight">
                  Service requirement
                </p>
                <div className="text-2xl text-black tracking-tight">
                  {eligibility.customServiceRequirement ||
                    currentServiceRequirement?.label ||
                    "-"}
                </div>
              </div>

              <div>
                <p className="text-3xl font-bold text-black tracking-tight">
                  Entry period
                </p>
                <div className="text-2xl text-black tracking-tight">
                  {eligibility.customEntryDate ||
                    currentEntryDate?.label ||
                    "-"}
                </div>
              </div>
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
            Eligibility Preview
          </h2>
          <p className="text-gray-500 mt-1">
            Review how your eligibility will appear
          </p>
        </div>

        {/* 16:9 aspect ratio container */}
        <div
          className="relative w-full rounded-lg overflow-hidden border border-gray-200"
          style={{ paddingBottom: "56.25%" }}
        >
          {/* Background container with white base and image overlay */}
          <div className="absolute inset-0 bg-white overflow-hidden">
            {/* Removed background image overlay - keeping only white background */}

            {/* Text container */}
            <div className="absolute h-[85%] top-0 w-full flex flex-col items-end justify-center pr-12">
              <p className="text-3xl font-bold text-black tracking-tight">
                Age requirement
              </p>
              <div className="text-2xl  text-black tracking-tight">
                {eligibility.customAgeRequirement ||
                  currentAgeRequirement?.label ||
                  "-"}
              </div>
              <p className="text-3xl font-bold text-black tracking-tight mt-4">
                Service requirement
              </p>
              <div className="text-2xl text-black tracking-tight">
                {eligibility.customServiceRequirement ||
                  currentServiceRequirement?.label ||
                  "-"}
              </div>
              <p className="text-3xl font-bold text-black tracking-tight mt-4">
                Entry period
              </p>
              <div className="text-2xl text-black tracking-tight">
                {eligibility.customEntryDate || currentEntryDate?.label || "-"}
              </div>
            </div>

            {/* Color bar at the bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[15%]"
              style={{ backgroundColor: brandColor }}
            />

            {/* Avatar */}
            {avatarChoice && (
              <div className="absolute w-full h-[90%] bottom-0">
                <img
                  src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                  alt="Avatar"
                  className="h-full w-auto object-contain object-bottom"
                />
              </div>
            )}
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

EligibilityPreview.displayName = "EligibilityPreview";

export default EligibilityPreview;
