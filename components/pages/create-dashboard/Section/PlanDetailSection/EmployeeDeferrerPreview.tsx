"use client";

import React, { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
  listAutoEscalation,
  listDeferralCap,
  listEnrollmentMethod,
  listEnrollmentRate,
} from "./EmployeeDeferrer";

interface EmployeeDeferrerPreviewProps {
  employeeDeferrals: {
    autoEnrollment: boolean | null;
    autoEscalation: string;
    customEnrollmentMethod: string;
    deferralCap: string;
    enrollmentRate: string;
    enrollmentMethods: string[];
    customEnrollmentRate?: string;
    customAutoEscalation?: string;
    customDeferralCap?: string;
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

const EmployeeDeferrerPreview = forwardRef<
  HTMLDivElement,
  EmployeeDeferrerPreviewProps
>((props, ref) => {
  const {
    brandColor,
    backgroundImage,
    avatarChoice,
    employeeDeferrals,
    onEdit,
    onConfirm,
    imageOnly = false,
  } = props;

  const currentEnrollmentRate = listEnrollmentRate.find(
    (item) => item.value === employeeDeferrals.enrollmentRate,
  );

  const currentAutoEscalation = listAutoEscalation.find(
    (item) => item.value === employeeDeferrals.autoEscalation,
  );

  const currentDeferralCap = listDeferralCap.find(
    (item) => item.value === employeeDeferrals.deferralCap,
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
          <div className="text-right space-y-4 pr-12">
            <p className="text-3xl font-bold text-black tracking-tight">
              {employeeDeferrals?.autoEnrollment
                ? "Auto Enrollment"
                : "Enrollment Option"}
            </p>

            {/* Show different content based on Auto Enrollment setting */}
            {employeeDeferrals?.autoEnrollment ? (
              // Auto Enrollment is Yes - show enrollment rate, auto escalation, and deferral cap
              <div className="flex flex-col items-end mt-4 gap-4 text-3xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-black tracking-tight">
                    Enrollment Rate:
                  </span>
                  <span className="text-xl font-normal text-black tracking-tight">
                    {employeeDeferrals.customEnrollmentRate ||
                      currentEnrollmentRate?.label ||
                      ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-black tracking-tight">
                    Auto Escalation:
                  </span>
                  <span className="text-xl font-normal text-black tracking-tight">
                    {employeeDeferrals.customAutoEscalation ||
                      currentAutoEscalation?.label ||
                      ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-black tracking-tight">
                    Escalation Cap:
                  </span>
                  <span className="text-xl font-normal text-black tracking-tight">
                    {employeeDeferrals.customDeferralCap ||
                      currentDeferralCap?.label ||
                      ""}
                  </span>
                </div>
              </div>
            ) : (
              // Auto Enrollment is No - show enrollment methods first, then other details
              <>
                {/* Show enrollment methods */}
                {[...Array(5)].map((_, index) => {
                  const enrollmentMethod =
                    employeeDeferrals?.enrollmentMethods?.[index];
                  const enrollmentMethodLabel = listEnrollmentMethod.find(
                    (item) => item.value === enrollmentMethod,
                  )?.label;

                  return (
                    <div className="font-normal" key={index}>
                      <div className="text-3xl">
                        {enrollmentMethodLabel === "Custom"
                          ? employeeDeferrals.customEnrollmentMethod
                          : enrollmentMethodLabel ?? ""}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={ref}>
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Deferrals Preview
        </h2>
        <p className="text-gray-500 mt-1">
          Review how your deferrals will appear
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
          <div className="absolute h-[85%] z-10 top-0 w-full flex flex-col items-end justify-center pr-12 text-xl text-black tracking-tight font-bold">
            <p className="font-bold text-black tracking-tight text-3xl">
              {employeeDeferrals?.autoEnrollment
                ? "Auto Enrollment"
                : "Enrollment Option"}
            </p>

            {/* Show different content based on Auto Enrollment setting */}
            {employeeDeferrals?.autoEnrollment ? (
              // Auto Enrollment is Yes - show enrollment rate, auto escalation, and deferral cap
              <div className="flex flex-col items-end mt-4 gap-4 text-3xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-black tracking-tight">
                    Enrollment Rate:
                  </span>
                  <span className="text-xl font-normal text-black tracking-tight">
                    {employeeDeferrals.customEnrollmentRate ||
                      currentEnrollmentRate?.label ||
                      ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-black tracking-tight">
                    Auto Escalation:
                  </span>
                  <span className="text-xl font-normal text-black tracking-tight">
                    {employeeDeferrals.customAutoEscalation ||
                      currentAutoEscalation?.label ||
                      ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-black tracking-tight">
                    Escalation Cap:
                  </span>
                  <span className="text-xl font-normal text-black tracking-tight">
                    {employeeDeferrals.customDeferralCap ||
                      currentDeferralCap?.label ||
                      ""}
                  </span>
                </div>
              </div>
            ) : (
              // Auto Enrollment is No - show enrollment methods first, then other details
              <>
                {/* Show enrollment methods */}
                {[...Array(5)].map((_, index) => {
                  const enrollmentMethod =
                    employeeDeferrals?.enrollmentMethods?.[index];
                  const enrollmentMethodLabel = listEnrollmentMethod.find(
                    (item) => item.value === enrollmentMethod,
                  )?.label;

                  return (
                    <div className="font-normal" key={index}>
                      <div className="text-3xl">
                        {enrollmentMethodLabel === "Custom"
                          ? employeeDeferrals.customEnrollmentMethod
                          : enrollmentMethodLabel ?? ""}
                      </div>
                    </div>
                  );
                })}

                {/* <div className="flex flex-col items-end mt-4 gap-2 text-3xl">
                  <div>
                    {employeeDeferrals.customEnrollmentRate ||
                      currentEnrollmentRate?.label ||
                      "-"}
                  </div>
                  <div>
                    {employeeDeferrals.customAutoEscalation ||
                      currentAutoEscalation?.label ||
                      "-"}
                  </div>
                  <div>
                    {employeeDeferrals.customDeferralCap ||
                      currentDeferralCap?.label ||
                      "-"}
                  </div>
                </div> */}
              </>
            )}
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
});

EmployeeDeferrerPreview.displayName = "EmployeeDeferrerPreview";

export default EmployeeDeferrerPreview;
