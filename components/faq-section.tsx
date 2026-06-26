"use client";

import { useState } from "react";
import {
  ChevronDown,
  FileText,
  Users,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface DynamicFAQItem {
  id: string;
  question: string;
  answer: string;
  linkLabel?: string;
  linkHref?: string;
}

interface FAQSectionProps {
  brandColor?: string;
  secondaryColor?: string;
  faqs?: DynamicFAQItem[];
}

export function FAQSection({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  faqs,
}: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number, categoryIndex: number) => {
    setOpenItems((prev) => {
      const categoryStart = categoryIndex * 10;
      const categoryEnd = categoryStart + 10;
      const otherItemsInCategory = prev.filter(
        (i) => i < categoryStart || i >= categoryEnd,
      );

      if (prev.includes(index)) {
        return otherItemsInCategory;
      }

      return [...otherItemsInCategory, index];
    });
  };

  // Use dynamic FAQs if provided, otherwise fall back to static defaults
  const dynamicItems = faqs?.filter(faq => faq.question && faq.answer) ?? [];

  const faqCategories = dynamicItems.length > 0
    ? [
        {
          icon: FileText,
          title: "Frequently Asked Questions",
          items: dynamicItems.map(({ question, answer }) => ({
            question,
            answer,
          })),
        },
      ]
    : [
    {
      icon: FileText,
      title: "How to Enroll",
      items: [
        {
          question: "When is the enrollment period?",
          answer:
            "Open enrollment typically runs from November 1st through December 15th each year. New employees have 30 days from their start date to enroll in benefits.",
        },
        {
          question: "What documents do I need to enroll?",
          answer:
            "You'll need your Social Security number, dependent information (if applicable), and beneficiary details. For health savings accounts, you may need additional documentation.",
        },
      ],
    },
    {
      icon: Users,
      title: "Understanding Your Benefits Package",
      items: [
        {
          question: "What's included in my benefits package?",
          answer:
            "Your comprehensive package includes health insurance, dental and vision coverage, 401(k) retirement plan with company match, life insurance, disability insurance, and wellness programs.",
        },
        {
          question: "How does the employer match work for 401(k)?",
          answer:
            "We match 100% of your contributions up to 6% of your salary. For example, if you contribute 6% of your salary, we'll add another 6% - that's free money toward your retirement!",
        },
      ],
    },
    {
      icon: Calendar,
      title: "Can I Make Changes Mid-Year?",
      items: [
        {
          question: "When can I change my benefits?",
          answer:
            "You can make changes during open enrollment or within 30 days of a qualifying life event such as marriage, divorce, birth of a child, or change in employment status.",
        },
        {
          question: "What counts as a qualifying life event?",
          answer:
            "Qualifying events include marriage, divorce, birth or adoption of a child, death of a dependent, change in employment status, or loss of other coverage.",
        },
      ],
    },
  ];

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-20 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-[40px] font-dm-serif mb-4"
            style={{ color: brandColor }}
          >
            Get Quick Answers to Common Benefits Questions
          </h2>
        </div>

        <div className={dynamicItems.length > 0 ? "space-y-3" : "space-y-6"}>
          {faqCategories.map((category, categoryIndex) => {
            const Icon = category.icon;

            return (
              <Card key={categoryIndex} className="overflow-hidden">
                <CardContent className="p-0">
                  <div
                    className="text-white p-4 flex items-center gap-3"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Icon className="h-5 w-5" />
                    <h3 className="text-[20px] font-dm-serif">
                      {category.title}
                    </h3>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {category.items.map((item, itemIndex) => {
                      const globalIndex = categoryIndex * 10 + itemIndex;
                      const isOpen = openItems.includes(globalIndex);

                      return (
                        <div key={itemIndex}>
                          <button
                            onClick={() =>
                              toggleItem(globalIndex, categoryIndex)
                            }
                            className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
                            onMouseEnter={(e) => {
                              const span =
                                e.currentTarget.querySelector("span");
                              const icon = e.currentTarget.querySelector("svg");
                              if (span) span.style.color = secondaryColor;
                              if (icon && !isOpen)
                                icon.style.color = brandColor;
                            }}
                            onMouseLeave={(e) => {
                              const span =
                                e.currentTarget.querySelector("span");
                              const icon = e.currentTarget.querySelector("svg");
                              if (span) span.style.color = brandColor;
                              if (icon && !isOpen) icon.style.color = "#6B6B6B";
                            }}
                          >
                            <span
                              className="text-base font-red-hat font-semibold transition-colors duration-300"
                              style={{
                                color: brandColor,
                              }}
                            >
                              {item.question}
                            </span>
                            <div
                              className="transition-transform duration-300"
                              style={{
                                transform: isOpen
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                              }}
                            >
                              <ChevronDown
                                className="h-5 w-5 flex-shrink-0 transition-colors duration-300"
                                style={{
                                  color: isOpen ? brandColor : "#6B6B6B",
                                }}
                              />
                            </div>
                          </button>

                          <div
                            className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
                            style={{
                              gridTemplateRows: isOpen ? "1fr" : "0fr",
                            }}
                          >
                            <div className="overflow-hidden">
                              <div
                                className="px-4 pb-4 transition-opacity duration-300"
                                style={{
                                  opacity: isOpen ? 1 : 0,
                                }}
                              >
                                <p className="text-base font-red-hat leading-relaxed">
                                  {item.answer}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
