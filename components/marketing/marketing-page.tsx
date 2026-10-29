import { MARKETING_FAQS, MARKETING_HERO } from "@/config/marketing";
import { MarketingFaq } from "@/components/marketing/faq";
import { MarketingHero } from "@/components/marketing/hero";
import {
  AudienceSection,
  DeepDiveSections,
  FeatureGridSection,
  FinalCtaSection,
  HowItWorksSection,
  MarketingFooter,
  PillarsSection,
  PositioningStrip,
} from "@/components/marketing/sections";
import { MarketingHeader } from "@/components/marketing/site-header";

interface MarketingPageProps {
  appOrigin: string;
  marketingOrigin: string;
  isSignedIn: boolean;
}

export function MarketingPage({
  appOrigin,
  marketingOrigin,
  isSignedIn,
}: MarketingPageProps) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: MARKETING_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "PlanTelligence",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: MARKETING_HERO.description,
    url: marketingOrigin,
  };

  return (
    <div
      id="top"
      className="min-h-screen overflow-x-clip bg-[#FBF9F6] text-[#14243A]"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([softwareJsonLd, faqJsonLd]),
        }}
      />

      <MarketingHeader appOrigin={appOrigin} isSignedIn={isSignedIn} />

      {/* `tabIndex={-1}` makes the skip link actually move focus here, not just
          scroll — without it the next Tab continues from the header. */}
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <MarketingHero appOrigin={appOrigin} isSignedIn={isSignedIn} />
        <PositioningStrip />
        <PillarsSection />
        <DeepDiveSections />
        <FeatureGridSection />
        <HowItWorksSection />
        <AudienceSection />
        <MarketingFaq appOrigin={appOrigin} />
        <FinalCtaSection appOrigin={appOrigin} isSignedIn={isSignedIn} />
      </main>

      <MarketingFooter appOrigin={appOrigin} />
    </div>
  );
}
