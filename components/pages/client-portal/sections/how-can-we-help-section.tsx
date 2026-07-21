"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import Link from "next/link";

export interface HelpCardData {
  id: string;
  title: string;
  introBold?: string;
  paragraphs: string[];
  cta: string;
  href?: string;
}

interface HowCanWeHelpSectionProps {
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  /** Custom cards from the wizard. Falls back to HELP_CARDS defaults when omitted. */
  cards?: HelpCardData[];
  /** Click handler for editing a specific card. Receives the card's ID. */
  onCardEdit?: (cardId: string) => void;
}

const HELP_CARDS: HelpCardData[] = [
  {
    id: "access-account",
    title: "Access My Retirement Account",
    paragraphs: [
      "View your balances, plan documents, and investment details all in one place.",
      "Take charge of your retirement plan and stay on top of your progress anytime.",
    ],
    cta: "ACCESS ACCOUNT →",
  },
  {
    id: "financial-planning",
    title: "Financial Planning",
    paragraphs: [
      "Exclusive Benefits for [Company Name] Plan Participants",
      "Elevate your financial journey with personalized planning through [Advisor Name]—a comprehensive service seamlessly integrated with your retirement benefits.",
    ],
    cta: "START PLANNING →",
    href: "/financial-planning",
  },
  {
    id: "rollovers",
    title: "Rollovers & Distributions",
    introBold: "Transitioning to a new employer?",
    paragraphs: [
      "Understand your options for managing the savings you've built. The decision you make now can have a lasting impact on your retirement lifestyle.",
    ],
    cta: "LEARN MORE →",
    href: "/rollovers-distributions",
  },
];

export function HowCanWeHelpSection({
  brandColor = "#002B5B",
  secondaryColor = "#E6C47A",
  clientId,
  cards,
  onCardEdit,
}: HowCanWeHelpSectionProps) {
  const resolvedCards = cards && cards.length > 0 ? cards : HELP_CARDS;
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const basePath = clientId ? `/new/view/${clientId}` : "";
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const EditPencil = () => (
    <div className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </div>
  );

  return (
    <section ref={ref} className="bg-white py-16 lg:py-20">
      <h2
        className="mb-14 text-center text-2xl font-dm-serif sm:text-2xl lg:text-5xl"
        style={{ color: brandColor }}
      >
        How Can We Help You Today?
      </h2>

      <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-8 px-4">
        {resolvedCards.map((card, index) => (
          <div
            key={card.id}
            className={`relative ${onCardEdit ? "cursor-pointer group" : ""}`}
            onClick={() => onCardEdit?.(card.id)}
            onMouseEnter={() => onCardEdit && setHoveredCardId(card.id)}
            onMouseLeave={() => onCardEdit && setHoveredCardId(null)}
          >
            {onCardEdit && hoveredCardId === card.id && <EditPencil />}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
                delay: index * 0.15,
              }}
              className="flex min-h-[450px] w-full max-w-sm flex-col rounded-xl border border-neutral-200 bg-white px-8 py-10 shadow-sm"
            >
            <h3
              className="mb-5 text-2xl font-dm-serif"
              style={{
                color: brandColor,
              }}
            >
              {card.title}
            </h3>

            {card.introBold && (
              <p className="mb-2 text-[16px] font-red-hat text-neutral-900">
                {card.introBold}
              </p>
            )}

            <div className="mb-8 space-y-2 text-[16px] font-red-hat leading-relaxed text-neutral-700">
              {card.paragraphs.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            {card.href ? (
              <Link
                href={`${basePath}${card.href}`}
                className="mt-auto w-full rounded-md border bg-white py-3 text-center text-[15px] font-red-hat uppercase tracking-[0.15em] transition-all duration-300 hover:opacity-90 hover:scale-105"
                style={{ borderColor: secondaryColor, color: secondaryColor }}
              >
                {card.cta}
              </Link>
            ) : (
              <button
                type="button"
                className="mt-auto w-full rounded-md border bg-white py-3 text-center text-[15px] font-red-hat uppercase tracking-[0.15em] transition-all duration-300 hover:opacity-90 hover:scale-105"
                style={{ borderColor: secondaryColor, color: secondaryColor }}
              >
                {card.cta}
              </button>
            )}
          </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}
