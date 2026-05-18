"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import type { FlyerFields } from "../shared/types";

type FlyerCopy = {
  heroHeadline: string;
  heroSubheadline: string;
  introHeadline: string;
  bulletPoints: { title: string; body: string }[];
  contactParagraph: string;
  qrHeadline: string;
  qrSubheadline: string;
  disclaimer: string;
  advisoryDisclosure: string;
};

const copyByLanguage: Record<"English" | "Spanish", FlyerCopy> = {
  English: {
    heroHeadline: "Invest in Yourself:",
    heroSubheadline: "Start Your Retirement Journey Today!",
    introHeadline:
      "Whether you're just starting your journey or looking to enhance your existing retirement strategy, every contribution counts.",
    bulletPoints: [
      {
        title: "It's Easy & Convenient.",
        body: "Your contribution is automatically deducted from your pay and deposited into your account.",
      },
      {
        title: "Employer Matching Contributions.",
        body: "Take advantage of potential matching contributions—it's like getting free money to boost your retirement savings even further.",
      },
      {
        title: "Tax-Deferred Savings.",
        body: "Money is put into your retirement account before federal (and most state) taxes. You don't pay taxes on it until you take the money out.",
      },
      {
        title: "You're in Control.",
        body: "Decide your contribution amount and investment strategy. Not sure how to invest? Our team at Waypoint Financial Advisors is here for you.",
      },
    ],
    contactParagraph:
      "If you have any questions regarding your retirement future or how to get started in the plan, visit us by scanning the QR code below or call us at 877-757-3263. Para ayuda en español acerca del plan 401k, por favor llame al 877-757-3263.",
    qrHeadline: "Scan this QR code to visit your participant website",
    qrSubheadline: "or visit the website below",
    disclaimer:
      "*Matching contributions from your employer may be subject to a vesting schedule. Please consult with your financial advisor for more information. 401(k) plans are long-term retirement savings vehicles. Withdrawal of pre-tax contributions and/or earnings will be subject to ordinary income tax and, if taken prior to age 59 1/2, may be subject to a 10% federal tax penalty.",
    advisoryDisclosure:
      "This material was created for educational and informational purposes only and is not intended as ERISA, tax, legal or investment advice. If you are seeking investment advice specific to your needs, such advice services must be obtained on your own separate from this educational material. Securities and advisory services offered through LPL Financial, a registered investment advisor, Member FINRA/SIPC.",
  },
  Spanish: {
    heroHeadline: "Invierta en Usted:",
    heroSubheadline: "Empiece su Trayectoria hacia la Jubilación Hoy.",
    introHeadline:
      "Aquí hay algunas razones por las que inscribirse en el Plan 401(k) es una gran idea:",
    bulletPoints: [
      {
        title: "Es fácil y conveniente.",
        body: "Su contribución se deduce automáticamente de su pago y se deposita en su cuenta. Además, su empleador puede igualar sus contribuciones, ¡lo cual es literalmente dinero gratis!*",
      },
      {
        title: "Ahorros con impuestos diferidos.",
        body: "El dinero se deposita en su cuenta de jubilación antes de los impuestos federales (y la mayoría de los estatales). Eso significa que no pagará impuestos hasta que retire el dinero.",
      },
      {
        title: "Portabilidad.",
        body: "No importa a dónde lo lleve su carrera, el dinero que invierta en el plan es suyo, lo que significa que cambiar de trabajo o mudarse a otro país no obstaculizará su progreso.",
      },
      {
        title: "Usted tiene el control.",
        body: "Usted decide cuánto contribuir. Puede comenzar poco a poco y aumentar un poco cada año. Con el tiempo su saldo puede crecer y lo acercará a su objetivo.",
      },
    ],
    contactParagraph:
      "Si tiene alguna pregunta sobre su futuro de jubilación o cómo comenzar con el plan, visítenos escaneando el código QR a continuación o llámenos al 877-757-3263. Para ayuda en español acerca del plan 401(k), por favor llame al 877-757-3263.",
    qrHeadline:
      "Escanee este código QR para visitar su sitio web de participante",
    qrSubheadline: "o visite el sitio web a continuación",
    disclaimer:
      "*Las contribuciones equivalentes de su empleador pueden estar sujetas a un cronograma de adquisición de derechos. Para obtener más información, consulte con su asesor financiero. Los planes 401(k) son vehículos de ahorro para la jubilación a largo plazo. El retiro de contribuciones y/o ganancias antes de los 59 años y medio estará sujeto a impuestos sobre la renta ordinarios y, si se realiza antes de esa edad, puede generar una multa fiscal federal del 10%.",
    advisoryDisclosure:
      "Este material fue creado con fines educativos e informativos y no pretende ser asesoramiento ERISA, fiscal, legal o de inversión. Si busca asesoramiento de inversión específico para sus necesidades, dichos servicios deben obtenerse por su cuenta y por separado de este material educativo. Valores y servicios de asesoramiento ofrecidos a través de LPL Financial, un asesor de inversiones registrado, Miembro FINRA/SIPC.",
  },
};

type MarketingFlyerPreviewProps = {
  form: FlyerFields;
  heroImage?: string;
  sponsorLogoUrl?: string;
  advisorLogoUrl?: string;
  language?: "English" | "Spanish";
};

export const MarketingFlyerPreview = forwardRef<
  HTMLDivElement,
  MarketingFlyerPreviewProps
>(({ form, heroImage, sponsorLogoUrl, advisorLogoUrl, language }, ref) => {
  const qrValue = form.qrUrl || form.qrCta;
  const activeLanguage = language ?? "English";
  const copy = copyByLanguage[activeLanguage];

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
      <div className="relative h-44 w-full bg-slate-200 overflow-hidden">
        {heroImage ? (
          <img
            src={heroImage}
            alt="Hero"
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-600 via-slate-400 to-slate-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/10 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center items-end px-5 text-white text-right">
          <p className="text-base font-semibold leading-tight">
            {copy.heroHeadline}
          </p>
          <p className="text-base max-w-[200px]">{copy.heroSubheadline}</p>
        </div>
      </div>
      <div className="px-9 py-4 space-y-1.5">
        <div className="text-center space-y-1.5">
          {sponsorLogoUrl ? (
            <img
              src={sponsorLogoUrl}
              alt="Sponsor logo"
              className="mx-auto h-16 object-contain"
            />
          ) : (
            <div className="mx-auto h-8 w-32 flex items-center justify-center border border-slate-200">
              <span className="text-[9px] text-slate-400">Sponsor Logo</span>
            </div>
          )}
        </div>
        <div className="space-y-1 text-center">
          <p className="font-semibold text-[9px] leading-tight">
            {copy.introHeadline}
          </p>
        </div>
        <div className="space-y-3">
          {copy.bulletPoints.map((point) => (
            <div
              key={point.title}
              className="text-[7px] text-slate-700 leading-tight"
            >
              <span className="font-semibold">{point.title} </span>
              <span>{point.body}</span>
              <br />
            </div>
          ))}
        </div>
        <p className="text-[8px] text-slate-600 leading-tight">
          {copy.contactParagraph}
        </p>
        <div className="flex items-center justify-between gap-2 border-t border-b border-slate-200 py-1.5">
          <div className="flex items-center">
            {advisorLogoUrl ? (
              <img
                src={advisorLogoUrl}
                alt="Advisor logo"
                className="h-auto max-h-12 object-contain"
              />
            ) : (
              <div className="h-12 w-32 flex items-center justify-center text-[9px] text-slate-400 border border-slate-200">
                Advisor Logo
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[9px] text-slate-600 space-y-0.5">
              <p className="font-semibold text-slate-900 leading-tight">
                {copy.qrHeadline}
              </p>
              <p className="leading-tight">{copy.qrSubheadline}</p>
              <p className="font-semibold break-all text-slate-900 leading-tight">
                {form.qrCta}
              </p>
            </div>
            <div className="border border-slate-300 p-1.5">
              <QRCodeSVG
                value={qrValue || "https://waypointfas.com"}
                width={60}
                height={60}
              />
            </div>
          </div>
        </div>
        <div className="space-y-0.5 text-[7px] leading-tight text-slate-500">
          <p>{copy.disclaimer}</p>
          <br />
          <p>{copy.advisoryDisclosure}</p>
        </div>
      </div>
    </div>
  );
});

MarketingFlyerPreview.displayName = "MarketingFlyerPreview";
