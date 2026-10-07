"use client";

import { Phone, Mail } from "lucide-react";
import { Headshot } from "@/components/ui/headshot";
import type { FAQContact } from "@/components/faq-section";

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
    <section className="px-4 sm:px-6 lg:px-8 py-20 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="font-dm-serif text-3xl leading-tight mb-2 sm:text-4xl lg:text-[40px]"
            style={{ color: brandColor }}
          >
            Have Questions?
          </h2>
          <p className="text-[16px] max-w-[505px] font-red-hat mx-auto">
            Our team is here to help you navigate your benefits and answer any questions you may have.
          </p>
        </div>
        <div className="flex flex-wrap gap-8 justify-center">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="text-center h-[327px] p-6 border flex flex-col justify-between border-gray-200 rounded-lg hover:shadow-lg transition-shadow w-full sm:w-auto sm:flex-1 sm:min-w-[240px] sm:max-w-[340px]"
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
                  {/* Designations — a wrapping row of chips under the job title
                      (they flow onto another line only when they run out of room).
                      Each chip wraps internally too, so a long designation stays
                      inside the card. */}
                  {(contact.designations || []).some(
                    (value) => value && value.trim(),
                  ) && (
                    <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-1">
                      {(contact.designations || [])
                        .filter((value) => value && value.trim())
                        .map((value, index) => (
                          <span
                            key={index}
                            className="inline-block max-w-full break-words rounded-full bg-gray-100 px-2 py-0.5 text-center text-[12px] font-red-hat leading-tight text-gray-600"
                          >
                            {value}
                          </span>
                        ))}
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
