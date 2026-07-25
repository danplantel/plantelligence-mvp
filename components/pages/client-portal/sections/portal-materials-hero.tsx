"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useClientPortal } from "@/contexts/client-portal-context";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { isR2BrandingKey } from "@/lib/branding-image-url";

/** Per-category default background images for the Insurance Benefits Access & Materials section (distinct from welcome banner defaults). */
const INSURANCE_DEFAULT_BGS: Record<string, string> = {
  Retirement: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80",
  "Group Health": "https://images.unsplash.com/photo-1551190822-f3f355555630?w=1920&q=80",
  "Group Life": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80",
  "Company / Plan Sponsor": "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920&q=80",
};

interface PortalMaterialsHeroProps {
  brandColor?: string;
  backgroundImage?: string;
  /** Overlay darkness (0-1, higher = darker overlay) */
  containerBlockOpacity?: number;
  heading?: string;
  cardHeading?: string;
  planIdLabel?: string;
  buttonLabel?: string;
  featureBullets?: string[];
  onButtonClick?: () => void;
  onPlanIdClick?: () => void;
  /** Category for default background image fallback */
  category?: string;
}

export function PortalMaterialsHero({
  brandColor = "#1F3A60",
  backgroundImage: backgroundImageProp,
  containerBlockOpacity = 0.8,
  heading = "Insurance Benefits Access & Materials",
  cardHeading = "Group Health Insurance Account Access",
  planIdLabel: planIdLabelProp,
  buttonLabel = "REGISTER OR LOGIN HERE",
  featureBullets = [
    "See coverage",
    "Get ID cards",
    "Make changes",
    "Update dependents",
  ],
  onButtonClick: onButtonClickProp,
  onPlanIdClick,
  category,
}: PortalMaterialsHeroProps) {
  // Resolve insurance fields from client portal context (persisted inside employeePortalPreview)
  const { clientData } = useClientPortal();
  const epp = clientData?.employeePortalPreview as Record<string, unknown> | undefined;

  // Plan ID label: prop override → context → default
  const resolvedPlanIdLabel = planIdLabelProp ?? (epp?.insurancePlanId ? `PLAN ID: ${epp.insurancePlanId}` : undefined);

  // Login URL: prop override → context → no button
  const insuranceLoginUrl = epp?.insuranceLoginUrl as string | undefined;
  const resolvedOnButtonClick = onButtonClickProp ?? (insuranceLoginUrl ? () => window.open(insuranceLoginUrl, "_blank", "noopener,noreferrer") : undefined);

  // Background image: prop override → context → per-category default
  const contextBg = (epp?.insuranceBackgroundImage as string) || "";
  const rawBg = backgroundImageProp || contextBg;
  const isR2 = isR2BrandingKey(rawBg);
  const { url: resolvedR2Bg } = useBrandingImageUrl(isR2 ? rawBg : null);
  const defaultBg = category
    ? INSURANCE_DEFAULT_BGS[category] || INSURANCE_DEFAULT_BGS["Retirement"]
    : INSURANCE_DEFAULT_BGS["Retirement"];
  const resolvedBackgroundImage = isR2 ? (resolvedR2Bg || rawBg) : (rawBg || defaultBg);

  const [hoveredField, setHoveredField] = useState<string | null>(null);

  const EditPencil = () => (
    <div className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </div>
  );

  return (
    <section className="relative h-[750px] overflow-hidden">
      <div className="absolute inset-0 h-[750px]">
        <Image
          src={resolvedBackgroundImage}
          alt="Professional team in office environment"
          width={1000}
          height={1000}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0, 0, 0, ${containerBlockOpacity})` }} />
      </div>

      <div className="relative z-10 flex h-[750px] flex-col items-center justify-center">
        <div className="mx-auto w-full max-w-8xl">
          <div className="mb-8 text-center text-white">
            <h1 className="font-dm-serif text-3xl leading-tight sm:text-4xl lg:text-[64px]">
              {heading}
            </h1>
          </div>

          <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-white bg-white/10 p-8 backdrop-blur-lg">
              <h3 className="font-dm-serif text-[28px] leading-tight text-center text-white">
                {cardHeading}
              </h3>

              <div className="my-6 text-center">
                <div
                  className={`relative inline-block ${onPlanIdClick ? "cursor-pointer group" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onPlanIdClick?.(); }}
                  onMouseEnter={() => onPlanIdClick && setHoveredField("planId")}
                  onMouseLeave={() => onPlanIdClick && setHoveredField(null)}
                >
                  {onPlanIdClick && hoveredField === "planId" && <EditPencil />}
                  <span className="inline-block rounded-lg bg-black/60 px-4 py-2 font-red-hat text-[16px] leading-tight font-semibold text-[#b78e42] backdrop-blur-sm">
                    {resolvedPlanIdLabel}
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={resolvedOnButtonClick}
                className="mb-6 flex h-auto w-full items-center justify-center gap-2 px-6 py-3 text-[16px] leading-tight font-red-hat text-white hover:opacity-90"
                style={{ background: brandColor }}
              >
                {buttonLabel}
                <ExternalLink className="h-5 w-5" />
              </Button>

              <div className="grid grid-cols-2 gap-3 text-white/90">
                {featureBullets.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-center">
                    <span
                      className="mr-3 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: brandColor }}
                    />
                    <span className="font-red-hat text-[19px] leading-tight">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
