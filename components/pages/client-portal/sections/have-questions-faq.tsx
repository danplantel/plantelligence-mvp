"use client";

import { Phone, Mail } from "lucide-react";
import { Headshot } from "@/components/ui/headshot";
import type { FAQContact } from "@/components/faq-section";

interface HaveQuestionsFAQProps {
  brandColor?: string;
  secondaryColor?: string;
  contacts?: FAQContact[];
}

export function HaveQuestions({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  contacts,
}: HaveQuestionsFAQProps) {
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
              className="text-center h-[327px] p-6 border flex flex-col justify-between border-gray-200 rounded-lg hover:shadow-lg transition-shadow"
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
                <p className="text-[16px] font-red-hat text-gray-600 mb-4">{contact.description}</p>
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
                    <Phone className="h-4 w-4 mr-2" />
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
