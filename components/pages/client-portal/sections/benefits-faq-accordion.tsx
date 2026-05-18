"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type BenefitsFaqItem = {
  id: string;
  question: string;
  answer: string;
  linkLabel: string;
  linkHref: string;
};

interface BenefitsFAQAccordionProps {
  title?: string;
  subtitle?: string;
  items: BenefitsFaqItem[];
  brandColor?: string;
  accentColor?: string;
}

export function BenefitsFAQAccordion({
  title = "Frequently Asked Questions",
  subtitle = "Get quick answers to common benefits questions",
  items,
  brandColor = "#002B5B",
  accentColor = "#E6C47A",
}: BenefitsFAQAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(
    items.length ? items[0].id : null,
  );

  const handleToggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-[40px] font-dm-serif">{title}</h2>
          {subtitle && (
            <p className="mt-4 text-[16px] font-red-hat">{subtitle}</p>
          )}
        </div>

        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {items.map((item) => {
            const isOpen = openId === item.id;

            return (
              <div
                key={item.id}
                className="border-b border-neutral-200 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(item.id)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left text-[16px] font-red-hat"
                  style={{
                    color: isOpen ? accentColor : "black",
                  }}
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-neutral-400 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`
                    overflow-hidden px-6 text-[16px] font-red-hat
                    transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
                    ${
                      isOpen
                        ? "max-h-40 py-3 opacity-100"
                        : "max-h-0 py-0 opacity-0"
                    }
                  `}
                >
                  <p className="mb-2 text-neutral-800">{item.answer}</p>
                  <a
                    href={item.linkHref}
                    className="text-[#002B5B] underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.linkLabel}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
