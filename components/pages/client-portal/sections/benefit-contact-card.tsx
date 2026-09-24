"use client";

import { PrimaryContactCard } from "@/components/pages/my-benefits-team/primary-contact-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { getContactCategories } from "@/lib/portal-category-visibility";

/**
 * Where the card is being rendered. The client wants the same contact to appear
 * in two places with (for now) a very similar design:
 *
 * - `team`     — the My Benefits Team page
 * - `category` — the benefit category's own page (Retirement, Group Health, …)
 *
 * The distinction is deliberately a prop rather than a second component, so both
 * placements stay visually in lockstep when the design is reviewed later.
 */
export type ContactPlacement = "team" | "category";

export interface BenefitContactCardProps {
  /** A `KeyContact` (or the equivalent serialized portal contact). */
  contact: Record<string, any>;
  brandColor: string;
  secondaryColor: string;
  appointmentLink?: string;
  companyName?: string;
  /** Animation stagger index (My Benefits Team layouts use it). */
  index?: number;
  disableAnimation?: boolean;
  baselineBackgroundColor?: string;
  /** Renders the large `PrimaryContactCard` instead of the compact card. */
  asPrimary?: boolean;
  /** Defaults to `team`. `category` renders the compact card variant. */
  placement?: ContactPlacement;
  /** Explicit compact override; wins over the placement default. */
  compact?: boolean;
}

/**
 * The benefit category (or categories) a contact serves, as a card label — e.g.
 * "Retirement", "Group Health · Group Life", "Company / Plan Sponsor".
 *
 * `getContactCategories` is the same resolver the portal's visibility filter and the
 * benefit hubs use, so it already folds the stored spellings onto the canonical hub
 * names ("Health Insurance" → "Group Health"); the tag therefore names the hub the
 * employee actually sees that contact under. Empty for a contact with no category
 * (e.g. a plan-wide / External HR row), which is what makes the tag optional.
 */
function benefitCategoryLabel(contact: Record<string, any>): string {
  return getContactCategories(contact).filter(Boolean).join(" · ");
}

/**
 * The one card used by both contact placements.
 *
 * It composes the existing My Benefits Team cards (rather than re-implementing
 * their styling) so the two surfaces cannot drift, and so the eventual design
 * review only has to change one entry point.
 */
export function BenefitContactCard({
  contact,
  brandColor,
  secondaryColor,
  appointmentLink = "",
  companyName = "",
  index,
  disableAnimation,
  baselineBackgroundColor,
  asPrimary = false,
  placement = "team",
  compact,
}: BenefitContactCardProps) {
  // Category pages are content-dense, so their cards default to the compact
  // variant; the team page keeps whatever its layout asks for.
  const isCompact = compact ?? placement === "category";

  // My Benefits Team mixes contacts from every benefit on one page, so each card is
  // tagged with the benefit its contact speaks for. The category pages ARE one
  // benefit, so the tag would only repeat the page it sits on and is skipped there.
  const categoryLabel = placement === "team" ? benefitCategoryLabel(contact) : "";

  if (asPrimary) {
    return (
      <PrimaryContactCard
        contact={contact as any}
        brandColor={brandColor}
        secondaryColor={secondaryColor}
        appointmentLink={appointmentLink}
        companyName={companyName}
        baselineBackgroundColor={baselineBackgroundColor}
        compact={isCompact}
        categoryLabel={categoryLabel}
      />
    );
  }

  return (
    <SmallVerticalCard
      contact={contact as any}
      brandColor={brandColor}
      secondaryColor={secondaryColor}
      appointmentLink={appointmentLink}
      companyName={companyName}
      index={index}
      disableAnimation={disableAnimation}
      baselineBackgroundColor={baselineBackgroundColor}
      compact={isCompact}
      categoryLabel={categoryLabel}
    />
  );
}
