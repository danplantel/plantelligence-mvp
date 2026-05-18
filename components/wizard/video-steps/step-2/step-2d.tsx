"use client";

import React from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import {
  listAutoEscalation,
  listDeferralCap,
  listEnrollmentMethod,
  listEnrollmentRate,
} from "./step-2c";

interface VideoStep2dProps {}

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

export function VideoStep2d({}: VideoStep2dProps) {
  const { stepData } = useVideoWizardStore();

  // Get employee deferrals data from step2c
  const step2cData = (stepData as any).step2c || {};
  const employeeDeferrals = {
    autoEnrollment: step2cData.autoEnrollment ?? null,
    autoEscalation: step2cData.autoEscalation || "",
    customEnrollmentMethod: step2cData.customEnrollmentMethod || "",
    deferralCap: step2cData.deferralCap || "",
    enrollmentRate: step2cData.enrollmentRate || "",
    enrollmentMethods: step2cData.enrollmentMethods || [],
    customEnrollmentRate: step2cData.customEnrollmentRate || "",
    customAutoEscalation: step2cData.customAutoEscalation || "",
    customDeferralCap: step2cData.customDeferralCap || "",
  };

  // Get branding data from selected plan or step1
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;
  const step1 = (stepData as any).step1 || {};
  // Use edited values from step1 if available, otherwise use plan data (like in step-2b)
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
  const barHeight = step1.barHeight ?? 15;
  const avatarChoice =
    stepData.avatarValue ||
    stepData.selectedAvatar ||
    selectedPlan?.videoAvatar ||
    "";

  const currentEnrollmentRate = listEnrollmentRate.find(
    (item) => item.value === employeeDeferrals.enrollmentRate,
  );

  const currentAutoEscalation = listAutoEscalation.find(
    (item) => item.value === employeeDeferrals.autoEscalation,
  );

  const currentDeferralCap = listDeferralCap.find(
    (item) => item.value === employeeDeferrals.deferralCap,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white font-inter">
          Deferrals Preview
        </h2>
        <p className="text-gray-500 mt-1 font-inter">
          Review how your deferrals will appear
        </p>
      </div>

      {/* 16:9 aspect ratio container */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ paddingBottom: "56.25%" }}
        data-preview-step="2"
      >
        {/* Background container with white base and image overlay */}
        <div className="absolute inset-0 bg-white overflow-hidden">
          {/* Background image overlay if available */}
          {backgroundImage && (
            <div
              className="absolute inset-0 bg-no-repeat bg-center bg-cover opacity-25"
              style={{
                backgroundImage: `url(${backgroundImage})`,
              }}
            />
          )}

          {/* Text container */}
          <div className="absolute h-[85%] z-10 top-0 w-full flex flex-col items-end justify-center pr-12 text-black tracking-tight">
            {/* Title */}
            <p className="font-bold text-black tracking-tight text-4xl mb-6 font-inter">
              Deferrals
            </p>

            {/* Enrollment Method(s) */}
            <div className="mb-4">
              <p className="font-bold text-black tracking-tight text-2xl mb-2 font-inter">
                Enrollment Method(s):
              </p>
              <div className="flex flex-col items-end  gap-1 ml-4">
                {/* Show other enrollment methods */}
                {employeeDeferrals?.enrollmentMethods?.map((method: string) => {
                  const enrollmentMethodLabel = listEnrollmentMethod.find(
                    (item) => item.value === method,
                  )?.label;

                  return (
                    <p
                      key={method}
                      className="text-xl font-normal text-black tracking-tight font-inter"
                    >
                      -
                      {enrollmentMethodLabel === "Custom"
                        ? employeeDeferrals.customEnrollmentMethod
                        : enrollmentMethodLabel || ""}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* Auto enrollment rate, Auto-escalation, Escalation cap */}
            {employeeDeferrals?.autoEnrollment && (
              <div className="flex flex-col items-end gap-2 mt-4">
                <p className="text-xl font-normal text-black tracking-tight font-inter">
                  Auto enrollment rate:{" "}
                  <span className="font-bold">
                    {employeeDeferrals.customEnrollmentRate ||
                      currentEnrollmentRate?.label ||
                      ""}
                  </span>
                </p>
                <p className="text-xl font-normal text-black tracking-tight font-inter">
                  Auto-escalation:{" "}
                  <span className="font-bold">
                    {employeeDeferrals.customAutoEscalation ||
                      currentAutoEscalation?.label ||
                      ""}
                  </span>
                </p>
                <p className="text-xl font-normal text-black tracking-tight font-inter">
                  Escalation cap:{" "}
                  <span className="font-bold">
                    {employeeDeferrals.customDeferralCap ||
                      currentDeferralCap?.label ||
                      ""}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Color bar at the bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 z-20"
            style={{ background: brandColor, height: `${barHeight}%` }}
          />

          {/* Avatar */}
          {avatarChoice && (
            <div
              className="absolute w-full h-[90%] bottom-0"
              data-preview-avatar="true"
            >
              <img
                src={avatarImagePaths[avatarChoice] || "/placeholder.svg"}
                alt="Avatar"
                className="h-full w-auto object-contain object-bottom"
              />
            </div>
          )}

          {/* HeyGen Avatar — RIGHT SIDE */}
          <div
            className="absolute left-4 z-20 bottom-[-200px] flex items-end"
            data-preview-avatar="true"
          >
            <div className="relative">
              <img
                src="/HeyGen-AI.png"
                alt="HeyGen Avatar"
                className="object-contain pointer-events-none select-none"
                style={{
                  width: 520,
                  height: 750,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
