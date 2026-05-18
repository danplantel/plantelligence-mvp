"use client";

import { Phone, Mail, ExternalLink, LucideIcon } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { formatPhoneWithExtension, getBasePhoneForDialing } from "@/lib/phone-utils";
import { Headshot } from "@/components/ui/headshot";

export interface ContactInfo {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  email: string;
  phone: string;
  phoneExtension?: string;
  iconType?: "image";
  iconSrc?: string;
  iconAlt?: string;
}

interface HaveQuestionsSectionProps {
  brandColor?: string;
  secondaryColor?: string;
  contacts?: ContactInfo[];
  cardWidth?: string; // e.g., "400px", "50%", "auto"
}

function ContactCard({
  contact,
  brandColor,
  secondaryColor,
  cardWidth,
}: {
  contact: ContactInfo;
  brandColor: string;
  secondaryColor: string;
  cardWidth?: string;
}) {
  const IconComponent = contact.icon;

  const widthStyle = cardWidth ? { width: cardWidth } : {};

  return (
    <div
      className="text-center h-[327px] p-6 border flex flex-col justify-between border-gray-200 rounded-lg hover:shadow-lg transition-shadow"
      style={widthStyle}
    >
      <div
        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden"
        style={{ background: brandColor }}
      >
        {contact.iconType === "image" && contact.iconSrc ? (
          <Headshot
            src={contact.iconSrc}
            alt={contact.iconAlt || contact.title}
            className="h-full w-full object-cover opacity-90"
            wrapperClassName="w-full h-full rounded-full"
          />
        ) : (
          <IconComponent className="h-8 w-8 text-white" />
        )}
      </div>
      <h3
        className="font-dm-serif text-[20px] font-semibold mb-2"
        style={{ color: brandColor }}
      >
        {contact.title}
      </h3>
      <p className="text-[16px] font-red-hat mb-4">{contact.description}</p>
      <div className="space-y-2">
        <a
          href={`mailto:${contact.email}`}
          className="flex items-center justify-center text-[12px] font-red-hat transition-colors"
          style={{ color: brandColor }}
          onMouseEnter={(e) => (e.currentTarget.style.color = secondaryColor)}
          onMouseLeave={(e) => (e.currentTarget.style.color = brandColor)}
        >
          <Mail className="h-4 w-4 mr-2" />
          {contact.email}
        </a>
        <a
          href={getBasePhoneForDialing(contact.phone)}
          className="flex items-center justify-center text-[12px] font-red-hat transition-colors"
          style={{ color: brandColor }}
          onMouseEnter={(e) => (e.currentTarget.style.color = secondaryColor)}
          onMouseLeave={(e) => (e.currentTarget.style.color = brandColor)}
        >
          <Phone className="h-4 w-4 mr-2" />
          {formatPhoneWithExtension(contact.phone, contact.phoneExtension)}
        </a>
      </div>
    </div>
  );
}

const defaultContacts: ContactInfo[] = [
  {
    id: "recordkeeper",
    title: "Recordkeeper Support",
    description:
      "For account access, balance inquiries, and plan administration questions.",
    icon: Phone,
    email: "email@recordkeeper.com",
    phone: "(888) 555-1212",
  },
  {
    id: "hr",
    title: "HR Benefits Team",
    description:
      "For enrollment questions, benefit changes, and general HR support.",
    icon: Mail,
    email: "email@company.com",
    phone: "(877) 555-1234",
  },
  {
    id: "advisor",
    title: "Retirement Plan Advisor",
    description:
      "For investment guidance, retirement planning, and financial advice.",
    icon: ExternalLink,
    email: "email@financialadvisory.com",
    phone: "(888) 555-5555",
  },
];

export function HaveQuestionsSection({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  contacts = defaultContacts,
  cardWidth,
}: HaveQuestionsSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="px-4 sm:px-6 lg:px-8 py-16 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="font-dm-serif text-[48px] leading-tight mb-4"
            style={{ color: brandColor }}
          >
            Have Questions?
          </h2>
          <p className="text-[16px] max-w-[505px] font-red-hat mx-auto">
            Our retirement planning team is here to help you navigate your
            benefits and answer any questions you may have.
          </p>
        </div>

        <div className="flex flex-wrap gap-8 justify-center">
          {contacts.map((contact, index) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
                delay: index * 0.15,
              }}
            >
              <ContactCard
                contact={contact}
                brandColor={brandColor}
                secondaryColor={secondaryColor}
                cardWidth={cardWidth}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
