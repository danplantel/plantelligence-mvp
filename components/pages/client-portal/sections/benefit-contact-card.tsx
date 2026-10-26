"use client";

import { PrimaryContactCard } from "@/components/pages/my-benefits-team/primary-contact-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { getContactCategories } from "@/lib/portal-category-visibility";
import { canonicalContactCategory } from "@/lib/benefit-contacts";

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
  /** Primary CTA background; defaults to `secondaryColor` (the card's design). */
  ctaColor?: string;
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
  /**
   * Phone-sized card design, set only by the mobile layouts (My Benefits Team and
   * the Step 3 / Contacts mobile preview): `wide` for a full-width card, `compact`
   * for one that shares a row in the 2-column grid. Ignored by the large
   * `PrimaryContactCard`, which only renders on desktop.
   */
  mobileVariant?: "wide" | "compact";
}

/**
 * The benefit categories a contact serves, as card labels — e.g. ["Retirement"] or
 * ["Retirement", "Group Health", "Group Life"].
 *
 * `getContactCategories` is the same resolver the portal's visibility filter and the
 * benefit hubs use, so it already folds the stored spellings onto the canonical hub
 * names ("Health Insurance" → "Group Health"); `canonicalContactCategory` then turns the
 * visibility key "Other" back into the contact-facing "Other Benefits". Empty for a
 * contact with no category (e.g. a plan-wide / External HR row), which is what makes the
 * tag optional.
 */
function benefitCategoryList(contact: Record<string, any>): string[] {
  return Array.from(
    new Set(
      getContactCategories(contact)
        .map((category) => canonicalContactCategory(String(category)))
        .filter(Boolean),
    ),
  );
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
  ctaColor,
  appointmentLink = "",
  companyName = "",
  index,
  disableAnimation,
  baselineBackgroundColor,
  asPrimary = false,
  placement = "team",
  compact,
  mobileVariant,
}: BenefitContactCardProps) {
  // Category pages are content-dense, so their cards default to the compact
  // variant; the team page keeps whatever its layout asks for.
  const isCompact = compact ?? placement === "category";

  // My Benefits Team mixes contacts from every benefit on one page, so each card is
  // tagged with the benefit its contact speaks for. The category pages ARE one
  // benefit, so the tag would only repeat the page it sits on and is skipped there.
  // The list (not just the joined string) travels with the card so several categories
  // can collapse to "Multiple Categories" with the full list on hover.
  const categoryList = placement === "team" ? benefitCategoryList(contact) : [];
  const categoryLabel = categoryList.join(" · ");

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
        categoryList={categoryList}
      />
    );
  }

  return (
    <SmallVerticalCard
      contact={contact as any}
      brandColor={brandColor}
      secondaryColor={secondaryColor}
      ctaColor={ctaColor}
      appointmentLink={appointmentLink}
      companyName={companyName}
      index={index}
      disableAnimation={disableAnimation}
      baselineBackgroundColor={baselineBackgroundColor}
      compact={isCompact}
      mobileVariant={mobileVariant}
      categoryLabel={categoryLabel}
      categoryList={categoryList}
    />
  );
}
