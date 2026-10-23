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
  /** Free-text designations, each rendered directly under the job title. */
  designations?: string[];
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

/**
 * Renders one column of accordion FAQ items.
 *
 * The open item is keyed by the FAQ's id rather than its position, because the
 * section splits the list across two columns — a positional index would collide
 * between them and open the wrong question.
 */
function FAQAccordionGroup({
  items,
  openId,
  onToggle,
  brandColor,
  secondaryColor,
}: {
  items: DynamicFAQItem[];
  openId: string | null;
  onToggle: (id: string) => void;
  brandColor: string;
  secondaryColor: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const key = item.id || `faq-${index}`;
        const isOpen = openId === key;

        return (
          <div
            key={key}
            // The section sits on a light grey band; each card stays white so the
            // question (secondary colour) and its answer read as raised panels.
            className="overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow duration-200 hover:shadow-sm"
          >
            <button
              onClick={() => onToggle(key)}
              className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 bg-white hover:bg-gray-50/50 transition-colors duration-200"
              style={{
                  backgroundColor: secondaryColor,
                }}
            >
              <span
                // A step down from the body copy: the question is a label, the
                // answer is what the reader came for.
                className="text-[13px] uppercase font-red-hat font-semibold leading-snug tracking-[0.02em] transition-colors duration-200 sm:text-sm"
                style={{
                  color:  "#ffffff",
                }}
              >
                {item.question}
              </span>
              <ChevronDown
                className="h-5 w-5 flex-shrink-0 transition-all duration-300"
                style={{
                  color:  "#ffffff",
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
                  {/* The answer runs a step LARGER than the question — it is the
                      content the reader opened the accordion for. */}
                  <p className="pt-2 text-[17px] font-red-hat leading-relaxed text-gray-600 sm:text-lg">
                    {item.answer}
                  </p>
                  {item.linkLabel && item.linkHref && (
                    <a
                      href={normalizeHref(item.linkHref)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-[15px] font-semibold transition-colors duration-200 hover:underline"
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
  );
}

export function FAQSection({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  faqs,
  contacts,
}: FAQSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const items =
    faqs?.filter((faq) => faq.question && faq.answer) ?? [];

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  // Two columns, filled in reading order: the first half on the left, the rest on
  // the right. `Math.ceil` keeps the LEFT column the longer one for an odd count,
  // which is what the eye expects.
  const splitAt = Math.ceil(items.length / 2);
  const columns = [items.slice(0, splitAt), items.slice(splitAt)];

  return (
    // Fills a screen on desktop (`lg:min-h-screen`), centred vertically like the
    // "How Can We Help You Today?" band above it, so the portal reads as a sequence
    // of full-height sections. Phones keep the natural height.
    //
    // Light grey rather than white: it separates this band from the white sections
    // around it and gives the white answer cards something to sit against.
    <section className="flex w-full flex-col justify-center border-y border-black/5 bg-gray-100 px-4 py-20 sm:px-6 lg:min-h-screen lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-dm-serif mb-4 sm:text-4xl lg:text-[40px]"
            style={{ color: brandColor }}
          >
            Frequently Asked Questions (FAQs)
          </h2>
        </div>

        {/* Two columns at `md` and up; one column on a phone. `items-start` lets the
            columns keep their own height rather than stretching every card. */}
        <div className="grid items-start gap-3 md:grid-cols-2 md:gap-4">
          {columns.map((column, columnIndex) =>
            column.length > 0 ? (
              <FAQAccordionGroup
                key={columnIndex}
                items={column}
                openId={openId}
                onToggle={toggleItem}
                brandColor={brandColor}
                secondaryColor={secondaryColor}
              />
            ) : null,
          )}
        </div>
      </div>
    </section>
  );
}
