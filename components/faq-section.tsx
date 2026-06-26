"use client";

import { useState } from "react";
import { ChevronDown, Phone, Mail } from "lucide-react";
import { Headshot } from "@/components/ui/headshot";

export interface DynamicFAQItem {
  id: string;
  question: string;
  answer: string;
  linkLabel?: string;
  linkHref?: string;
}

export interface FAQContact {
  id: string;
  title: string;
  description: string;
  email: string;
  phone: string;
  phoneExtension?: string;
  headshot?: string;
}

interface FAQSectionProps {
  brandColor?: string;
  secondaryColor?: string;
  faqs?: DynamicFAQItem[];
  contacts?: FAQContact[];
}

/** Ensure the URL has a protocol prefix so browser does not treat it as a relative path. */
function normalizeHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return trimmed;
  // Already has a protocol — keep as-is
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return trimmed;
  // Protocol-relative (starts with //) — keep as-is
  if (trimmed.startsWith("//")) return trimmed;
  // Anchor or javascript: — keep as-is
  if (trimmed.startsWith("#") || trimmed.startsWith("javascript:")) return trimmed;
  // Mailto: — keep as-is
  if (trimmed.startsWith("mailto:")) return trimmed;
  // Tel: — keep as-is
  if (trimmed.startsWith("tel:")) return trimmed;
  // Default to https
  return `https://${trimmed}`;
}

export function FAQSection({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  faqs,
  contacts,
}: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const items =
    faqs?.filter((faq) => faq.question && faq.answer) ?? [];

  const toggleItem = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-20 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-[40px] font-dm-serif mb-4"
            style={{ color: brandColor }}
          >
            Frequently Asked Questions (FAQs)
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={item.id || index}
                className="border border-gray-200 rounded-lg overflow-hidden transition-shadow duration-200 hover:shadow-sm"
              >
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 bg-white hover:bg-gray-50/50 transition-colors duration-200"
                >
                  <span
                    className="text-base font-red-hat font-semibold transition-colors duration-200"
                    style={{
                      color: isOpen ? brandColor : secondaryColor,
                    }}
                  >
                    {item.question}
                  </span>
                  <ChevronDown
                    className="h-5 w-5 flex-shrink-0 transition-all duration-300"
                    style={{
                      color: isOpen ? brandColor : "#9CA3AF",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>

                <div
                  className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
                  style={{
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                  }}
                >
                  <div className="overflow-hidden">
                    <div
                      className="px-5 pb-4 transition-opacity duration-300"
                      style={{
                        opacity: isOpen ? 1 : 0,
                      }}
                    >
                      <p className="text-base font-red-hat leading-relaxed text-gray-600">
                        {item.answer}
                      </p>
                      {item.linkLabel && item.linkHref && (
                        <a
                          href={normalizeHref(item.linkHref)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-3 text-sm font-semibold transition-colors duration-200 hover:underline"
                          style={{ color: secondaryColor }}
                        >
                          {item.linkLabel} ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {contacts && contacts.length > 0 && (
          <div className="mt-16 text-center">
            <h2
              className="font-dm-serif text-[40px] leading-tight mb-2"
              style={{ color: brandColor }}
            >
              Have Questions?
            </h2>
            <p className="text-[16px] max-w-[505px] font-red-hat mx-auto mb-10">
              Our team is here to help you navigate your benefits and answer any questions you may have.
            </p>
            <div className="flex flex-wrap gap-8 justify-center">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="text-center h-[327px] p-6 border flex flex-col justify-between border-gray-200 rounded-lg hover:shadow-lg transition-shadow"
                >
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden"
                    style={{ background: brandColor }}
                  >
                    {contact.headshot ? (
                      <Headshot
                        src={contact.headshot}
                        alt={contact.title}
                        className="h-full w-full object-cover opacity-90"
                        wrapperClassName="w-full h-full rounded-full"
                      />
                    ) : (
                      <Phone className="h-8 w-8 text-white" />
                    )}
                  </div>
                  <h3
                    className="font-dm-serif text-[20px] font-semibold mb-2"
                    style={{ color: secondaryColor }}
                  >
                    {contact.title}
                  </h3>
                  <p className="text-[16px] font-red-hat text-gray-600 mb-4">{contact.description}</p>
                  <div className="space-y-2">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center justify-center text-[12px] font-red-hat transition-colors"
                        style={{ color: secondaryColor }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = brandColor)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = secondaryColor)}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone.replace(/[^0-9]/g, "")}`}
                        className="flex items-center justify-center text-[12px] font-red-hat transition-colors"
                        style={{ color: secondaryColor }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = brandColor)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = secondaryColor)}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        {contact.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
