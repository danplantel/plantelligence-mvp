"use client";

import {
  BenefitContactCard,
  type ContactPlacement,
} from "@/components/pages/client-portal/sections/benefit-contact-card";
import type { ResolvedCategoryContact } from "@/lib/benefit-contacts";

interface BenefitTeamSectionProps {
  /** e.g. "Your Retirement Team". */
  title: string;
  /** Optional supporting line under the heading. */
  subtitle?: string;
  primary: ResolvedCategoryContact | null;
  others: ResolvedCategoryContact[];
  brandColor: string;
  secondaryColor: string;
  appointmentLink?: string;
  companyName?: string;
  /** Defaults to `category` — this section is normally mounted on a category page. */
  placement?: ContactPlacement;
  className?: string;
}

/**
 * "Who to contact for this benefit" — the category-page placement.
 *
 * One component for all four category pages so Retirement / Group Health /
 * Group Life / Custom cannot drift apart. Renders nothing when the category has
 * no contacts, so existing plans are visually unchanged until an advisor attaches
 * someone (the resolver is the single source of truth for who is attached).
 */
export function BenefitTeamSection({
  title,
  subtitle,
  primary,
  others,
  brandColor,
  secondaryColor,
  appointmentLink = "",
  companyName = "",
  placement = "category",
  className,
}: BenefitTeamSectionProps) {
  const hasContacts = !!primary || others.length > 0;
  if (!hasContacts) return null;

  return (
    <section className={className ?? "w-full py-12"}>
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        {subtitle ? (
          <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            {subtitle}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {primary ? (
            <BenefitContactCard
              contact={primary.contact}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              asPrimary
              placement={placement}
            />
          ) : null}

          {others.map((row, index) => (
            <BenefitContactCard
              key={row.contact.id || `${index}`}
              contact={row.contact}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              index={index}
              placement={placement}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
