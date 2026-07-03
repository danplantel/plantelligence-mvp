"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { useClientPortal } from "@/contexts/client-portal-context";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { isR2BrandingKey } from "@/lib/branding-image-url";

interface PortalMaterialsHeroProps {
  brandColor?: string;
  backgroundImage?: string;
  heading?: string;
  cardHeading?: string;
  planIdLabel?: string;
  buttonLabel?: string;
  featureBullets?: string[];
  onButtonClick?: () => void;
}

export function PortalMaterialsHero({
  brandColor = "#1F3A60",
  backgroundImage: backgroundImageProp,
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
}: PortalMaterialsHeroProps) {
  // Resolve insurance fields from client portal context (persisted inside employeePortalPreview)
  const { clientData } = useClientPortal();
  const epp = clientData?.employeePortalPreview as Record<string, unknown> | undefined;

  // Plan ID label: prop override → context → default
  const resolvedPlanIdLabel = planIdLabelProp ?? (epp?.insurancePlanId ? `PLAN ID: ${epp.insurancePlanId}` : undefined);

  // Login URL: prop override → context → no button
  const insuranceLoginUrl = epp?.insuranceLoginUrl as string | undefined;
  const resolvedOnButtonClick = onButtonClickProp ?? (insuranceLoginUrl ? () => window.open(insuranceLoginUrl, "_blank", "noopener,noreferrer") : undefined);

  // Background image: prop override → context → default
  const contextBg = (epp?.insuranceBackgroundImage as string) || "";
  const rawBg = backgroundImageProp || contextBg;
  const isR2 = isR2BrandingKey(rawBg);
  const { url: resolvedR2Bg } = useBrandingImageUrl(isR2 ? rawBg : null);
  const resolvedBackgroundImage = isR2 ? (resolvedR2Bg || rawBg) : (rawBg || undefined);
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
        <div className="absolute inset-0 bg-black/80" />
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
                <span
                  className="font-red-hat text-[16px] leading-tight font-semibold"
                  style={{ color: brandColor }}
                >
                  {resolvedPlanIdLabel}
                </span>
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
