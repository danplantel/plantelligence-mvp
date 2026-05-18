"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MeetingFlyerFields } from "../shared/types";

type MarketingMeetingFlyerPreviewProps = {
  form: MeetingFlyerFields;
  heroImage?: string;
  sponsorLogoUrl?: string;
  advisorLogoUrl?: string;
};

export const MarketingMeetingFlyerPreview = forwardRef<
  HTMLDivElement,
  MarketingMeetingFlyerPreviewProps
>(({ form, heroImage, sponsorLogoUrl, advisorLogoUrl }, ref) => {
  const qrValue = form.qrUrl || form.qrCta;

  return (
    <div
      ref={ref}
      className={cn(
        "mx-auto aspect-[8.5/11] w-full max-w-[480px] overflow-hidden bg-white shadow-xl",
      )}
      style={{
        maxHeight: "620px",
        height: "auto",
      }}
    >
      {/* Hero Section - Dark with financial theme */}
      <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
        {heroImage ? (
          <img
            src={heroImage}
            alt="Hero"
            className="h-full w-full object-cover object-center opacity-60"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900" />
        )}
        <div className="absolute inset-0 flex flex-col justify-center items-center px-5 text-center">
          <p className="text-white text-sm font-semibold leading-tight mb-0.5">
            Transform Your Tomorrow:
          </p>
          <p className="text-yellow-400 text-sm font-semibold leading-tight mb-0.5">
            Unlock the Full Potential
          </p>
          <p className="text-yellow-400 text-sm font-semibold leading-tight">
            of Your 401(k)!
          </p>
        </div>
      </div>

      {/* Main Content - White Background */}
      <div className="px-8 py-3 space-y-2 bg-white">
        {/* Sponsor Logo */}
        <div className="text-center">
          {sponsorLogoUrl ? (
            <img
              src={sponsorLogoUrl}
              alt="Sponsor logo"
              className="mx-auto h-12 object-contain"
            />
          ) : (
            <div className="mx-auto h-12 w-40 flex items-center justify-center border border-slate-200">
              <span className="text-[8px] text-slate-400">Sponsor Logo</span>
            </div>
          )}
        </div>

        {/* Main Call to Action */}
        <div className="text-center">
          <p className="font-semibold text-[9px] leading-tight text-slate-900">
            Join Our Retirement Plan Advisory Team To Discover How To Maximize
            Your Retirement Benefits
          </p>
        </div>

        {/* Group Sessions */}
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            {/* ICON */}
            <Calendar className="w-4 h-4 text-slate-800 flex-shrink-0 mt-0.5" />

            {/* TEXT BLOCK */}
            <div className="space-y-1">
              <p className="font-semibold text-[10px] text-slate-900 leading-tight">
                Group Sessions:
              </p>

              {form.groupSessions.map((session, index) => (
                <p
                  key={session.id}
                  className="text-[10px] text-slate-800 leading-tight"
                >
                  {session.date} at {session.time} ({session.language})
                  {index < form.groupSessions.length - 1 && <> or</>}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* One-on-One Consultations */}
        <div className="space-y-1 mt-3">
          <div className="flex items-start gap-2">
            {/* EMPTY SPACE INSTEAD OF ICON TO ALIGN TEXT */}
            <div className="w-4 flex-shrink-0" />

            <div className="space-y-1">
              <p className="font-semibold text-[10px] text-slate-900 leading-tight">
                One-on-One Consultations:
              </p>

              {form.oneOnOneConsultations.map((consult, index) => (
                <p
                  key={consult.id}
                  className="text-[10px] text-slate-800 leading-tight"
                >
                  {consult.date} {consult.startTime} – {consult.endTime}
                  {index < form.oneOnOneConsultations.length - 1 && <> or</>}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="mt-4 flex items-start gap-2">
          <MapPin className="w-4 h-4 text-slate-800 flex-shrink-0 mt-0.5" />

          <p className="text-[10px] text-slate-900 leading-tight">
            <span className="font-semibold">Where:</span> Virtual via Zoom
          </p>
        </div>

        {/* Advisor Logo */}
        <div className="text-center pt-1">
          {advisorLogoUrl ? (
            <img
              src={advisorLogoUrl}
              alt="Advisor logo"
              className="mx-auto h-8 object-contain"
            />
          ) : (
            <div className="mx-auto h-8 w-40 flex items-center justify-center border border-slate-200 bg-slate-50">
              <span className="text-[7px] text-slate-400">Advisor Logo</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section - Dark with QR Code */}
      <div className="bg-[#0B0F1A] px-8 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* TEXT + ARROW BLOCK */}
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-1">
              {/* Arrow */}
              <span className="text-yellow-400 text-[9px] font-semibold translate-y-[1px]">
                ➜
              </span>

              <p className="text-yellow-400 font-semibold text-[9px] leading-tight">
                Scan this QR code to reserve your spot & learn more!
              </p>
            </div>

            <p className="text-white text-[8px] leading-tight mt-1">
              or visit: <span className="font-semibold">{form.qrCta}</span>
            </p>
          </div>

          {/* QR CODE */}
          <div className="border-2 border-yellow-400 p-1 bg-white">
            <QRCodeSVG
              value={qrValue || "https://waypointfas.com/"}
              width={60}
              height={60}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

MarketingMeetingFlyerPreview.displayName = "MarketingMeetingFlyerPreview";
