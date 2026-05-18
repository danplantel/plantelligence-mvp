"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Image from "next/image";

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
  backgroundImage = "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1600&q=80",
  heading = "Insurance Benefits Access & Materials",
  cardHeading = "Group Health Insurance Account Access",
  planIdLabel = "PLAN ID: AYR-401K-2024",
  buttonLabel = "REGISTER OR LOGIN HERE",
  featureBullets = [
    "See coverage",
    "Get ID cards",
    "Make changes",
    "Update dependents",
  ],
  onButtonClick,
}: PortalMaterialsHeroProps) {
  return (
    <section className="relative h-[750px] overflow-hidden">
      <div className="absolute inset-0 h-[750px]">
        <Image
          src="/Hiking-Couple-Looking.webp"
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
            <h1 className="font-dm-serif text-[64px] leading-tight">
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
                  {planIdLabel}
                </span>
              </div>

              <Button
                size="lg"
                onClick={onButtonClick}
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
