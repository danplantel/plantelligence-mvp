"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import type { MissingRetirementFlyerFields } from "../shared/types";

type MarketingMissingRetirementPreviewProps = {
  form: MissingRetirementFlyerFields;
  sponsorLogoUrl?: string;
  advisorLogoUrl?: string;
  piggyBankImageUrl?: string;
  language?: "English" | "Spanish";
};

type MissingRetirementCopy = {
  headlineTop: string;
  headlineBottom: string;
  bodyText: string;
  callToAction: string;
  instructions: string;
  advisory: string;
  poweredBy: string;
};

const spanishCopy = (qrCta: string): MissingRetirementCopy => ({
  headlineTop: "FALTAN",
  headlineBottom: "AHORROS DE JUBILACIÓN DE EMPLEADORES ANTERIORES",
  bodyText:
    "Si se mudó a un nuevo trabajo o está entre oportunidades, la forma en que administre sus ahorros ahora definirá su jubilación futura.",
  callToAction: "POR FAVOR CONTÁCTENOS PARA VOLVER A REUNIRLO CON SU DINERO",
  instructions: `Escanee este código QR para explorar sus opciones y programar una consulta, o visite: ${qrCta}`,
  advisory:
    "Servicios de valores y asesoría ofrecidos a través de LPL Financial o sus afiliados con licencia.",
  poweredBy: "Impulsado por PlanTelligence™",
});

export const MarketingMissingRetirementPreview = forwardRef<
  HTMLDivElement,
  MarketingMissingRetirementPreviewProps
>(
  (
    { form, sponsorLogoUrl, advisorLogoUrl, piggyBankImageUrl, language },
    ref,
  ) => {
    const qrValue = form.qrUrl || form.qrCta;
    const isSpanish = language === "Spanish";
    const englishBodyText =
      form.bodyText ||
      "Whether you've moved to a new job or are between opportunities, how you manage your savings now will shape your future retirement.";
    const englishCallToAction =
      form.callToAction || "PLEASE CONTACT US TO BE RE-UNITED WITH YOUR MONEY";

    const englishCopy: MissingRetirementCopy = {
      headlineTop: "MISSING",
      headlineBottom: "RETIREMENT SAVINGS FROM FORMER EMPLOYER",
      bodyText: englishBodyText,
      callToAction: englishCallToAction,
      instructions: `Scan this QR code to explore your options and schedule a consultation, or visit: ${form.qrCta}`,
      advisory:
        "Securities and advisory services offered through LPL Financial or its licensed affiliates.",
      poweredBy: "Powered by PlanTelligence™",
    };

    const copy = isSpanish ? spanishCopy(form.qrCta) : englishCopy;

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
        {/* Main Content - White Background */}
        <div className="px-8 py-4 space-y-3 bg-white">
          {/* Headline */}
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-bold text-red-600 leading-tight">
              {copy.headlineTop}
            </h1>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              {copy.headlineBottom}
            </h2>
          </div>

          {/* Logo and Piggy Bank */}
          <div className="flex items-center justify-center gap-6">
            {/* Sponsor Logo */}
            <div className="flex-shrink-0">
              {sponsorLogoUrl ? (
                <img
                  src={sponsorLogoUrl}
                  alt="Sponsor logo"
                  className="h-16 object-contain"
                />
              ) : (
                <div className="h-16 w-28 flex items-center justify-center border border-slate-200">
                  <span className="text-[8px] text-slate-400">
                    Sponsor Logo
                  </span>
                </div>
              )}
            </div>

            {/* Piggy Bank Image */}
            <div className="flex-shrink-0">
              {piggyBankImageUrl ? (
                <img
                  src={piggyBankImageUrl}
                  alt="Piggy bank"
                  className="h-32 object-contain"
                />
              ) : (
                <div className="h-32 w-32 flex items-center justify-center border border-slate-200 bg-slate-50">
                  <span className="text-[8px] text-slate-400">
                    Piggy Bank Image
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Body Text */}
          <div className="text-center">
            <p className="text-[10px] text-slate-900 leading-tight">
              {copy.bodyText}
            </p>
          </div>

          {/* Call to Action */}
          <div className="text-center">
            <p className="text-sm font-bold text-slate-900 leading-tight">
              {copy.callToAction}
            </p>
          </div>
        </div>

        {/* Bottom Section - Dark Footer */}
        <div className="bg-slate-900 px-8 py-3">
          <div className="flex items-start justify-between gap-4 mb-2">
            {/* Left: Instructions */}
            <div className="flex-1">
              <p className="text-white text-[9px] leading-tight mb-1.5">
                {copy.instructions}
              </p>
              {/* Advisor Logo */}
              {advisorLogoUrl ? (
                <img
                  src={advisorLogoUrl}
                  alt="Advisor logo"
                  className="h-6 object-contain"
                />
              ) : (
                <div className="h-6 w-36 flex items-center justify-center text-white text-[9px]">
                  WAYPOINT FINANCIAL ADVISORS
                </div>
              )}
            </div>

            {/* Right: QR Code with Arrow */}
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400 text-lg">➜</span>
              <div className="border-2 border-yellow-400 p-1 bg-white">
                <QRCodeSVG
                  value={qrValue || "https://waypointfas.com"}
                  width={60}
                  height={60}
                />
              </div>
            </div>
          </div>

          {/* Disclaimers */}
          <div className="flex items-center justify-between text-white text-[7px] leading-tight">
            <p>{copy.advisory}</p>
            <p>{copy.poweredBy}</p>
          </div>
        </div>
      </div>
    );
  },
);

MarketingMissingRetirementPreview.displayName =
  "MarketingMissingRetirementPreview";
