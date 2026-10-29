"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MARKETING_FAQS, type MarketingFaqItem } from "@/config/marketing";
import {
  MarketingButton,
  MarketingSectionHeading,
} from "@/components/marketing/ui";

interface MarketingFaqProps {
  appOrigin: string;
  items?: MarketingFaqItem[];
}

export function MarketingFaq({
  appOrigin,
  items = MARKETING_FAQS,
}: MarketingFaqProps) {
  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-[#E7E1D8] bg-white py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:px-10">
        <div>
          <MarketingSectionHeading
            eyebrow="FAQ"
            title="Questions, answered."
            description="The details advisors and plan sponsors ask about before bringing a plan onto PlanTelligence."
          />
          <p className="mt-6 max-w-sm font-red-hat text-sm leading-relaxed text-[#5A6675]">
            Ready to look inside? Sign in with an existing account or create one
            from the sign-in page.
          </p>
          <MarketingButton
            href={`${appOrigin}/signin`}
            variant="secondary"
            className="mt-5"
          >
            Sign in
          </MarketingButton>
        </div>

        <Accordion
          type="single"
          collapsible
          className="divide-y divide-[#EDE7DC] rounded-2xl border border-[#E7E1D8] bg-[#FBF9F6] px-5 sm:px-6"
          data-testid="marketing-faq"
        >
          {items.map((item, index) => (
            <AccordionItem
              key={item.question}
              value={`faq-${index}`}
              className="border-b-0"
              data-testid="marketing-faq-item"
            >
              <AccordionTrigger className="gap-6 py-5 text-left font-red-hat text-[15px] font-semibold text-[#14243A] hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pr-8 font-red-hat text-sm leading-relaxed text-[#526072]">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
