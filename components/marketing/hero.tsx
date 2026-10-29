import { ArrowRight, Check, ChevronDown } from "lucide-react";

import {
  MARKETING_HERO,
  MARKETING_HERO_CHIPS,
} from "@/config/marketing";
import { PortalHeroVignette } from "@/components/marketing/product-vignettes";
import { MarketingButton, MarketingEyebrow } from "@/components/marketing/ui";

interface MarketingHeroProps {
  appOrigin: string;
  isSignedIn: boolean;
}

export function MarketingHero({
  appOrigin,
  isSignedIn,
}: MarketingHeroProps) {
  // The headline is authored as "lead, emphasis" so the second half can be
  // tinted. A title without that comma must still render in full.
  const [lead, emphasis] = MARKETING_HERO.title.includes(", ")
    ? MARKETING_HERO.title.split(", ")
    : [MARKETING_HERO.title, ""];
  const primaryHref = isSignedIn
    ? `${appOrigin}/dashboard`
    : `${appOrigin}/signin`;
  const primaryLabel = isSignedIn
    ? "Go to dashboard"
    : MARKETING_HERO.primaryCta;

  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(35,145,156,0.16),transparent_36%),radial-gradient(circle_at_86%_4%,rgba(31,58,96,0.1),transparent_40%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,#E7E1D8_1px,transparent_1px),linear-gradient(to_bottom,#E7E1D8_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-10 lg:pb-28 lg:pt-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D6E8EA] bg-white/70 px-3 py-1.5">
            <span
              className="size-1.5 rounded-full bg-[#23919C]"
              aria-hidden="true"
            />
            <MarketingEyebrow>{MARKETING_HERO.eyebrow}</MarketingEyebrow>
          </div>

          <h1 className="mt-6 max-w-2xl font-dm-serif text-[2.65rem] leading-[1.02] tracking-[-0.025em] text-[#14243A] sm:text-6xl lg:text-[4.15rem]">
            {lead},
            <span className="block text-[#1B7C86]">{emphasis}</span>
          </h1>

          <p className="mt-6 max-w-xl font-red-hat text-base leading-relaxed text-[#526072] sm:text-lg">
            {MARKETING_HERO.description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <MarketingButton href={primaryHref} className="group">
              {primaryLabel}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </MarketingButton>
            <MarketingButton href="#features" variant="secondary">
              {MARKETING_HERO.secondaryCta}
              <ChevronDown className="size-4" aria-hidden="true" />
            </MarketingButton>
          </div>

          <p className="mt-4 text-xs text-[#5A6675]">
            {MARKETING_HERO.supportingLine}
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {MARKETING_HERO_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-[#E2DCCF] bg-white/65 px-3 py-1 text-[11px] font-medium text-[#526072]"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E7E1D8] pt-5 text-[11px] font-medium text-[#5A6675]">
            {[
              "Built for advisors",
              "Branded for every plan",
              "Mobile-ready portal",
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="size-3 text-[#1B7C86]" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[540px] lg:max-w-none">
          <PortalHeroVignette />
        </div>
      </div>
    </section>
  );
}
