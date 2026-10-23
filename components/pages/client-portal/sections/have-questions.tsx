"use client";

import { Phone, Mail } from "lucide-react";
import { Headshot } from "@/components/ui/headshot";
import type { FAQContact } from "@/components/faq-section";
import { designationAcronym } from "@/config/onboarding/designations";
import { HAVE_QUESTIONS_SECTION_ID } from "@/lib/portal-section-anchors";

interface HaveQuestionsProps {
  brandColor?: string;
  secondaryColor?: string;
  contacts?: FAQContact[];
}

export function HaveQuestions({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  contacts,
}: HaveQuestionsProps) {
  if (!contacts || contacts.length === 0) return null;

  return (
    // The same light grey band as the FAQ section above it: it separates this block
    // from the white sections around it, and the white cards sit against it.
    // `id` + scroll margin: the journey section's "Schedule with …" buttons scroll
    // here, and the margin keeps the heading clear of the fixed portal header.
    <section
      id={HAVE_QUESTIONS_SECTION_ID}
      className="w-full scroll-mt-24 border-y border-black/5 bg-gray-100 px-4 py-20 sm:scroll-mt-28 sm:px-6 lg:scroll-mt-32 lg:px-8"
    >
      {/* Wide enough for the four support cards side by side (`lg` and up); the
          heading below keeps its own narrower measure. */}
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="font-dm-serif text-3xl leading-tight mb-2 sm:text-4xl lg:text-[40px]"
            style={{ color: brandColor }}
          >
            Have Questions?
          </h2>
          <p className="text-[16px] max-w-[505px] font-red-hat mx-auto">
            Our team is here to help you navigate your benefits and answer any
            questions you may have.
          </p>
        </div>
        {/* One row of four on `lg` and up (`5xl`/`2xl` calc = four columns after
            the three 24px gaps). Below `lg` the cards keep their previous
            comfortable width and wrap — two across on tablets, stacked on
            phones — because four columns at 640–1023px would be too narrow for
            the email and phone lines. Fewer than four contacts stay centred. */}
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:flex-nowrap">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              // White cards on the grey band, matching the FAQ accordion.
              className="text-center h-[327px] p-6 border flex flex-col justify-between border-gray-200 rounded-lg bg-white hover:shadow-lg transition-shadow w-full sm:w-auto sm:flex-1 sm:min-w-[240px] sm:max-w-[340px] lg:w-[calc((100%-4.5rem)/4)] lg:flex-none"
            >
              <div>
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
                <div className="mb-4">
                  <p className="text-[16px] font-red-hat text-gray-600">
                    {contact.description}
                  </p>
                  {/* Designations — acronyms only (CFP®, AIF®), under the role line
                      and held to a SINGLE row. A chip never shrinks and its text never
                      wraps — a chip squeezed into a narrow column read as VERTICAL
                      text — so a row that does not fit scrolls sideways instead (and
                      stays centred while it fits). */}
                  {(contact.designations || []).some(
                    (value) => value && value.trim(),
                  ) && (
                    <div className="mt-1 w-full min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="mx-auto flex w-max items-center gap-px">
                        {(contact.designations || [])
                          .filter((value) => value && value.trim())
                          .map((value, index) => (
                            <span
                              key={index}
                              className="inline-block shrink-0 whitespace-nowrap rounded-full bg-gray-100 px-1 py-px text-center text-[8px] font-red-hat leading-none tracking-tight text-gray-600"
                            >
                              {designationAcronym(value)}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center justify-center text-[12px] font-red-hat transition-colors"
                    style={{ color: secondaryColor }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = brandColor)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = secondaryColor)
                    }
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
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = brandColor)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = secondaryColor)
                    }
                  >
                    {/* The contact's own photo stands in for the generic phone glyph when
                        there is one — the same picture as the card's avatar, so the row
                        reads as a person rather than a switchboard. Falls back to the icon
                        while the contact has no headshot. */}
                    {contact.headshot ? (
                      <span
                        aria-hidden="true"
                        className="mr-2 h-4 w-4 shrink-0 overflow-hidden rounded-full"
                      >
                        <Headshot
                          src={contact.headshot}
                          alt=""
                          wrapperClassName="h-full w-full rounded-full"
                        />
                      </span>
                    ) : (
                      <Phone className="h-4 w-4 mr-2" />
                    )}
                    {contact.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
