import { ArrowRight, ArrowUpRight, Check } from "lucide-react";

import {
  MARKETING_AUDIENCES,
  MARKETING_DEEP_DIVES,
  MARKETING_FEATURES,
  MARKETING_FOOTER_TAGLINE,
  MARKETING_NAV_LINKS,
  MARKETING_PILLARS,
  MARKETING_POSITIONING_POINTS,
  MARKETING_STEPS,
} from "@/config/marketing";
import { marketingIcons } from "@/components/marketing/icons";
import { ProductVignette } from "@/components/marketing/product-vignettes";
import {
  MarketingButton,
  MarketingCheckItem,
  MarketingIconBadge,
  MarketingSectionHeading,
} from "@/components/marketing/ui";
import { cn } from "@/lib/utils";

export function PositioningStrip() {
  return (
    <section
      aria-label="What PlanTelligence brings together"
      className="border-y border-[#E7E1D8] bg-white"
    >
      <div className="mx-auto grid max-w-7xl divide-y divide-[#EDE7DC] px-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-8 lg:grid-cols-4 lg:px-10">
        {MARKETING_POSITIONING_POINTS.map((point) => {
          const Icon = marketingIcons[point.icon];
          return (
            <div key={point.title} className="flex gap-3 py-6 sm:px-5 lg:px-6">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#EAF5F6] text-[#1B7C86]">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[#14243A]">
                  {point.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#5A6675]">
                  {point.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PillarsSection() {
  return (
    <section
      id="features"
      className="scroll-mt-24 bg-[#FBF9F6] py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <MarketingSectionHeading
          eyebrow="The platform"
          title="One system from plan setup to participant experience."
          description="PlanTelligence connects the work advisors do behind the scenes with the experience employees actually see. Each part shares the same plan data, branding, and access rules."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MARKETING_PILLARS.map((pillar) => {
            const Icon = marketingIcons[pillar.icon];
            return (
              <article
                key={pillar.title}
                className="group relative overflow-hidden rounded-2xl border border-[#E7E1D8] bg-white p-6 transition-colors hover:border-[#BFDDE0] motion-reduce:transition-none"
              >
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#23919C] to-transparent opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" />
                <MarketingIconBadge>
                  <Icon className="size-5" />
                </MarketingIconBadge>
                <h3 className="mt-5 text-lg font-semibold text-[#14243A]">
                  {pillar.title}
                </h3>
                <p className="mt-2 font-red-hat text-sm leading-relaxed text-[#526072]">
                  {pillar.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function DeepDiveSections() {
  return (
    <>
      {MARKETING_DEEP_DIVES.map((item) => (
        <section
          key={item.id}
          id={item.id}
          className={cn(
            "scroll-mt-24 py-20 sm:py-24 lg:py-28",
            item.tone === "tinted" ? "bg-[#F1F7F7]" : "bg-white",
          )}
        >
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-10">
            <div className={cn(item.reverse && "lg:order-2")}>
              <MarketingSectionHeading
                eyebrow={item.eyebrow}
                title={item.title}
                description={item.description}
              />
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {item.bullets.map((bullet) => (
                  <MarketingCheckItem key={bullet}>
                    {bullet}
                  </MarketingCheckItem>
                ))}
              </ul>
            </div>
            <div className={cn("relative", item.reverse && "lg:order-1")}>
              <ProductVignette variant={item.vignette} />
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

export function FeatureGridSection() {
  return (
    <section
      id="capabilities"
      className="scroll-mt-24 border-y border-[#E7E1D8] bg-[#FBF9F6] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <MarketingSectionHeading
          eyebrow="Capabilities"
          title="Everything that keeps a plan current."
          description="The day-to-day features behind the experience, organized by the work they support."
          align="center"
        />

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_FEATURES.map((feature) => {
            const Icon = marketingIcons[feature.icon];
            return (
              <article
                key={`${feature.title}-${feature.description}`}
                className="group rounded-xl border border-[#E7E1D8] bg-white p-5 transition-colors hover:border-[#BFDDE0] motion-reduce:transition-none"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#EAF5F6] text-[#1B7C86] transition-colors group-hover:bg-[#1B7C86] group-hover:text-white motion-reduce:transition-none">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[#14243A]">
                      {feature.title}
                    </h3>
                    <p className="mt-1 font-red-hat text-xs leading-relaxed text-[#5A6675]">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-white py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <MarketingSectionHeading
          eyebrow="How it works"
          title="A plan, a portal, and a rhythm for keeping both current."
          description="PlanTelligence is designed around the way benefits work already happens: set the plan up, build the story, then keep it moving."
          align="center"
        />

        <div className="relative mt-14 grid gap-8 lg:grid-cols-3 lg:gap-10">
          <div
            className="absolute left-[16.6%] right-[16.6%] top-6 hidden h-px bg-gradient-to-r from-[#D6E8EA] via-[#23919C]/40 to-[#D6E8EA] lg:block"
            aria-hidden="true"
          />
          {MARKETING_STEPS.map((step) => (
            <div key={step.number} className="relative">
              <div className="relative z-10 flex size-12 items-center justify-center rounded-full border border-[#D6E8EA] bg-[#FBF9F6] font-dm-serif text-lg text-[#1B7C86]">
                {step.number}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-[#14243A]">
                {step.title}
              </h3>
              <p className="mt-2 max-w-sm font-red-hat text-sm leading-relaxed text-[#526072]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AudienceSection() {
  return (
    <section
      id="who-its-for"
      className="scroll-mt-24 border-y border-[#E7E1D8] bg-[#F1F7F7] py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <MarketingSectionHeading
          eyebrow="Who it is for"
          title="Built for the people who keep benefits working."
          description="Advisors, service teams, and plan sponsors share one platform without sharing the same view of it."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {MARKETING_AUDIENCES.map((audience) => {
            const Icon = marketingIcons[audience.icon];
            return (
              <article
                key={audience.title}
                className="rounded-2xl border border-[#DCE7E7] bg-white p-6"
              >
                <MarketingIconBadge tone="teal">
                  <Icon className="size-5" />
                </MarketingIconBadge>
                <h3 className="mt-5 text-lg font-semibold text-[#14243A]">
                  {audience.title}
                </h3>
                <p className="mt-2 font-red-hat text-sm leading-relaxed text-[#526072]">
                  {audience.description}
                </p>
                <ul className="mt-5 space-y-2.5 border-t border-[#EDE7DC] pt-5">
                  {audience.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-xs text-[#3E4C5E]"
                    >
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-[#1B7C86]"
                        aria-hidden="true"
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection({
  appOrigin,
  isSignedIn,
}: {
  appOrigin: string;
  isSignedIn: boolean;
}) {
  const primaryHref = isSignedIn
    ? `${appOrigin}/dashboard`
    : `${appOrigin}/signin`;

  return (
    <section className="relative overflow-hidden bg-[#1F3A60] py-20 text-white sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(35,145,156,0.35),transparent_38%),radial-gradient(circle_at_82%_80%,rgba(35,145,156,0.2),transparent_42%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9FD9DE]">
          Ready when the next plan is
        </p>
        <h2 className="mt-4 font-dm-serif text-3xl leading-[1.08] tracking-[-0.015em] sm:text-4xl lg:text-5xl">
          Give every plan a clearer story.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl font-red-hat text-base leading-relaxed text-white/75 sm:text-lg">
          Bring plan setup, benefits content, participant communication, and
          team access into one platform.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <MarketingButton href={primaryHref} variant="light">
            {isSignedIn ? "Go to dashboard" : "Sign in"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </MarketingButton>
          <MarketingButton
            href={`${appOrigin}/signin`}
            variant="ghost"
            className="border border-white/25 text-white hover:bg-white/10 focus-visible:ring-white"
          >
            Start onboarding
          </MarketingButton>
        </div>
        <p className="mt-4 text-xs text-white/70">
          Existing users sign in at plantel.pro. New users can create an account
          from the sign-in page.
        </p>
      </div>
    </section>
  );
}

export function MarketingFooter({ appOrigin }: { appOrigin: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E7E1D8] bg-[#FBF9F6]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/plantelligence-logos/pt_web_light.png"
              alt="PlanTelligence"
              className="h-8 w-auto"
            />
            <p className="mt-4 max-w-sm font-red-hat text-sm leading-relaxed text-[#5A6675]">
              {MARKETING_FOOTER_TAGLINE}
            </p>
          </div>

          <nav aria-labelledby="marketing-footer-platform">
            <p
              id="marketing-footer-platform"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5F6B7A]"
            >
              Platform
            </p>
            <ul className="mt-4 space-y-2.5">
              {MARKETING_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-6 items-center text-sm text-[#526072] transition-colors hover:text-[#14243A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] motion-reduce:transition-none"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="marketing-footer-account">
            <p
              id="marketing-footer-account"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5F6B7A]"
            >
              Account
            </p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href={`${appOrigin}/signin`}
                  className="inline-flex min-h-6 items-center gap-1 text-sm text-[#526072] transition-colors hover:text-[#14243A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] motion-reduce:transition-none"
                >
                  Sign in
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={`${appOrigin}/dashboard`}
                  className="inline-flex min-h-6 items-center gap-1 text-sm text-[#526072] transition-colors hover:text-[#14243A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] motion-reduce:transition-none"
                >
                  Go to dashboard
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[#E7E1D8] pt-6 text-xs text-[#5F6B7A] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} PlanTelligence. All rights reserved.</p>
          <p>Benefits communication, end to end.</p>
        </div>
      </div>
    </footer>
  );
}
